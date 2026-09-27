// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  applyMigration,
  asAnon,
  asUser,
  createDb,
  createUser,
  enrolVerifiedFactor,
  expectDenied,
  listMigrations,
  MigrationError,
  splitStatements,
  sqlState,
  type Db,
} from "./harness";

/**
 * Structural checks over the fully migrated schema. These catch the mistakes
 * that are easy to make in a migration and invisible in review: a table
 * created without RLS, a SECURITY DEFINER function without a pinned
 * search_path, and a counter column left writable through the API because
 * Supabase's default privileges grant ALL on every new table.
 */

// Every table the app reads or writes. A migration that drops or renames one
// should fail here before it fails in front of a member.
const EXPECTED_TABLES = [
  "profiles",
  "posts",
  "post_likes",
  "post_comments",
  "jobs",
  "job_applications",
  "courses",
  "events",
  "user_roles",
  "problems",
  "problem_votes",
  "problem_bookmarks",
  "problem_comments",
  "problem_reports",
  "problem_revisions",
  "newsletter_subscribers",
  "problem_media",
  "pitches",
  "pitch_supports",
  "pitch_feedback",
  "pitch_interests",
  "companion_routines",
  "companion_completions",
];

// Counters kept by triggers. Named explicitly so the generic *_count check
// below cannot pass by finding nothing after a rename.
const TRIGGER_OWNED_COUNTERS: Array<[table: string, column: string]> = [
  ["problems", "vote_count"],
  ["problems", "comment_count"],
  ["pitches", "support_count"],
  ["pitches", "feedback_count"],
];

const API_ROLES = ["anon", "authenticated"] as const;

let db: Db;

beforeAll(async () => {
  // A failure here is a MigrationError naming the file, statement and line.
  db = await createDb();
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("migrations", () => {
  it("apply cleanly in filename order, each recorded once", async () => {
    const { rows } = await db.query<{ version: string }>(
      "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version",
    );
    const files = listMigrations();
    expect(files.length).toBeGreaterThan(0);
    expect(rows.map((row) => row.version)).toEqual(files.map((migration) => migration.version));
  });

  it("create every table the app uses, with row level security enabled", async () => {
    const { rows } = await db.query<{ name: string; rls: boolean }>(
      `SELECT c.relname AS name, c.relrowsecurity AS rls
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')`,
    );
    const rls = new Map(rows.map((row) => [row.name, row.rls]));
    expect(EXPECTED_TABLES.filter((table) => !rls.has(table)), "missing tables").toEqual([]);
    expect(EXPECTED_TABLES.filter((table) => rls.get(table) === false), "tables without RLS").toEqual([]);
  });

  it("enable row level security on every table in public", async () => {
    // Any public table is reachable through the API, so one without RLS is
    // readable and writable by anyone holding the publishable key.
    const { rows } = await db.query<{ name: string }>(
      `SELECT c.relname AS name
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
        ORDER BY 1`,
    );
    expect(rows.map((row) => row.name)).toEqual([]);
  });

  it("pin search_path on every SECURITY DEFINER function in public", async () => {
    // Without a fixed search_path, a caller who can create objects earlier on
    // the path can make the function run their code with its owner's rights.
    const { rows } = await db.query<{ fn: string; config: string[] | null }>(
      `SELECT p.oid::regprocedure::text AS fn, p.proconfig AS config
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.prosecdef
        ORDER BY 1`,
    );
    expect(rows.length, "expected SECURITY DEFINER functions such as has_role()").toBeGreaterThan(0);
    const unpinned = rows
      .filter((row) => !(row.config ?? []).some((setting) => setting.startsWith("search_path=")))
      .map((row) => row.fn);
    expect(unpinned).toEqual([]);
  });

  it("do not let the API write trigger-owned counters", async () => {
    const { rows: counters } = await db.query<{ tbl: string; col: string }>(
      `SELECT c.relname AS tbl, a.attname AS col
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
          AND a.attnum > 0 AND NOT a.attisdropped AND a.attname LIKE '%\\_count'
        ORDER BY 1, 2`,
    );
    const found = counters.map((row) => `${row.tbl}.${row.col}`);
    for (const [table, column] of TRIGGER_OWNED_COUNTERS) {
      expect(found, "expected counter column").toContain(`${table}.${column}`);
    }

    const writable: string[] = [];
    for (const { tbl, col } of counters) {
      for (const role of API_ROLES) {
        for (const privilege of ["INSERT", "UPDATE"]) {
          const { rows } = await db.query<{ allowed: boolean }>(
            "SELECT has_column_privilege($1, format('public.%I', $2::text), $3, $4) AS allowed",
            [role, tbl, col, privilege],
          );
          if (rows[0].allowed) writable.push(`${role} ${privilege} ${tbl}.${col}`);
        }
      }
    }
    expect(writable).toEqual([]);
  });
});

describe("test harness", () => {
  it("models Supabase's default privileges, so a missing REVOKE is visible", async () => {
    await db.transaction(async (tx) => {
      await tx.exec("CREATE TABLE public.harness_probe (id int); CREATE FUNCTION public.harness_probe_fn() RETURNS int LANGUAGE sql AS 'SELECT 1';");
      const { rows } = await tx.query<{ table_update: boolean; fn_execute: boolean }>(
        `SELECT has_table_privilege('anon', 'public.harness_probe', 'UPDATE') AS table_update,
                has_function_privilege('anon', 'public.harness_probe_fn()', 'EXECUTE') AS fn_execute`,
      );
      expect(rows[0]).toEqual({ table_update: true, fn_execute: true });
      await tx.rollback();
    });
  });

  it("keeps the auth tables out of reach of the API roles", async () => {
    const userId = await createUser(db);
    let error: unknown;
    try {
      await asUser(db, userId, {}, (tx) => tx.query("SELECT email FROM auth.users"));
    } catch (caught) {
      error = caught;
    }
    expect(sqlState(error)).toBe("42501");
    await expectDenied(asAnon(db, (tx) => tx.query("SELECT id FROM auth.mfa_factors")));
  });

  it("signs a user in with the claims auth.uid() and auth.jwt() read", async () => {
    const userId = await createUser(db, { meta: { full_name: "Test Member" } });
    await enrolVerifiedFactor(db, userId);
    const { rows } = await asUser(db, userId, { aal: "aal2" }, (tx) =>
      tx.query<{ uid: string; aal: string; role: string; current: string }>(
        "SELECT auth.uid() AS uid, auth.jwt() ->> 'aal' AS aal, auth.role() AS role, current_user AS current",
      ),
    );
    expect(rows[0]).toEqual({ uid: userId, aal: "aal2", role: "authenticated", current: "authenticated" });

    // The signup trigger ran, as it does when GoTrue inserts the user.
    const profiles = await db.query("SELECT 1 FROM public.profiles WHERE user_id = $1", [userId]);
    expect(profiles.rows).toHaveLength(1);

    // Claims and role end with the transaction.
    const after = await db.query<{ uid: string | null; current: string }>(
      "SELECT auth.uid() AS uid, current_user AS current",
    );
    expect(after.rows[0]).toEqual({ uid: null, current: "postgres" });
  });

  it("rolls a session back when asked", async () => {
    const userId = await createUser(db);
    await db.exec(
      "CREATE SCHEMA IF NOT EXISTS harness; CREATE TABLE harness.notes (body text); GRANT USAGE ON SCHEMA harness TO authenticated; GRANT INSERT ON harness.notes TO authenticated;",
    );
    await asUser(db, userId, { rollback: true }, (tx) => tx.query("INSERT INTO harness.notes VALUES ('discarded')"));
    await asUser(db, userId, {}, (tx) => tx.query("INSERT INTO harness.notes VALUES ('kept')"));
    const { rows } = await db.query<{ body: string }>("SELECT body FROM harness.notes");
    expect(rows).toEqual([{ body: "kept" }]);
  });

  it("expectDenied accepts refusals and rejects anything else", async () => {
    await expect(expectDenied(Promise.resolve({ rows: [], affectedRows: 0, fields: [] }))).resolves.toBeUndefined();
    await expect(expectDenied(Promise.resolve({ rows: [{ id: 1 }], fields: [] }))).rejects.toThrow(/allowed it/);
    await expect(expectDenied(asAnon(db, (tx) => tx.query("SELECT 1/0")))).rejects.toThrow(/another reason/);
  });

  it("names the file and line of a failing migration and rolls the file back", async () => {
    const broken = {
      file: "99999999999999_broken.sql",
      version: "99999999999999",
      name: "broken",
      sql: "CREATE TABLE public.harness_half (id int);\nSELECT 1;\nSELECT nope FROM nowhere;\n",
    };
    const failure = await applyMigration(db, broken).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(MigrationError);
    expect((failure as MigrationError).message).toContain("99999999999999_broken.sql failed at statement 3 of 3 (line 3)");
    expect((failure as MigrationError).sqlState).toBe("42P01");

    const { rows } = await db.query<{ half: string | null; recorded: boolean }>(
      `SELECT to_regclass('public.harness_half')::text AS half,
              EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '99999999999999') AS recorded`,
    );
    expect(rows[0]).toEqual({ half: null, recorded: false });
  });

  it("splits statements without breaking quoted or dollar-quoted bodies", () => {
    const statements = splitStatements(
      "-- a; comment\nSELECT ';';\nCREATE FUNCTION f() RETURNS int AS $body$ SELECT 1; $body$ LANGUAGE sql;\n/* x; */ SELECT 2",
    );
    expect(statements.map((statement) => statement.line)).toEqual([2, 3, 4]);
    expect(statements[1].sql).toContain("$body$ SELECT 1; $body$");
  });

  it("splits storage paths like Supabase Storage", async () => {
    const { rows } = await db.query<{ folders: string[] }>(
      "SELECT storage.foldername('user-id/problem-id/photo.png') AS folders",
    );
    expect(rows[0].folders).toEqual(["user-id", "problem-id"]);
  });
});
