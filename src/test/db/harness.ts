import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite, type Results, type Transaction } from "@electric-sql/pglite";

/**
 * In-process Postgres for testing supabase/migrations.
 *
 * createDb() boots PGlite (Postgres compiled to WebAssembly), installs a small
 * model of what a Supabase project already contains before any migration runs,
 * then applies every migration in filename order, one transaction per file, the
 * way `supabase db push` does. Tests then act as a visitor or a signed-in member
 * through the same database roles and JWT claims PostgREST uses, so grants and
 * RLS policies are exercised for real rather than read by eye.
 *
 * The model is deliberately the part of Supabase these migrations lean on, not
 * all of it. What matters most is reproduced exactly:
 * - `anon`, `authenticated` and `service_role`, with Supabase's default
 *   privileges: every new table, sequence and function in `public` is granted
 *   to all three. That is why a migration must REVOKE before it GRANTs, and a
 *   missing REVOKE shows up here the same way it would in production.
 * - `auth.uid()`, `auth.jwt()` and `auth.role()`, reading the JWT claims
 *   PostgREST puts in `request.jwt.claims`.
 * - The auth tables are not readable by the API roles, as on Supabase. A policy
 *   that queries auth.users or auth.mfa_factors directly fails here with the
 *   same "permission denied" it would hit in production.
 * - storage.objects has RLS enabled and storage.foldername() splits paths the
 *   way Supabase Storage does.
 *
 * Test files that use this need `// @vitest-environment node` on their first
 * line: PGlite loads its WebAssembly from disk.
 */

export type Db = PGlite;
export type Tx = Transaction;

// import.meta.url rather than __dirname: this is an ES module ("type": "module").
export const MIGRATIONS_DIR = fileURLToPath(new URL("../../../supabase/migrations/", import.meta.url));

/**
 * The file name pattern the Supabase CLI applies. Anything else in the folder
 * is skipped with a warning by `supabase db push`, so it is skipped here too.
 */
export const MIGRATION_FILE_PATTERN = /^([0-9]+)_(.*)\.sql$/;

export interface Migration {
  file: string;
  version: string;
  name: string;
  sql: string;
}

export function listMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  return readdirSync(dir)
    .filter((file) => MIGRATION_FILE_PATTERN.test(file))
    .sort()
    .map((file) => {
      const [, version, name] = MIGRATION_FILE_PATTERN.exec(file) ?? [];
      return { file, version, name, sql: readFileSync(join(dir, file), "utf8") };
    });
}

/**
 * Everything a fresh Supabase project has before the first migration, reduced
 * to what these migrations and their policies touch. Runs as the superuser.
 */
export const SUPABASE_SHIM = `
CREATE ROLE anon NOLOGIN NOINHERIT;
CREATE ROLE authenticated NOLOGIN NOINHERIT;
CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
CREATE ROLE authenticator NOINHERIT;
GRANT anon, authenticated, service_role TO authenticator;
-- Referenced by grants for auth hooks and storage; present on every project.
CREATE ROLE supabase_auth_admin NOLOGIN NOINHERIT;
CREATE ROLE supabase_storage_admin NOLOGIN NOINHERIT;

CREATE SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- AUTH ------------------------------------------------------------------
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb,
  raw_app_meta_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON auth.users (email);

CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn', 'phone');
CREATE TYPE auth.factor_status AS ENUM ('unverified', 'verified');

CREATE TABLE auth.mfa_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friendly_name text,
  factor_type auth.factor_type NOT NULL,
  status auth.factor_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Verbatim from Supabase, including the fallback to the pre-v10 PostgREST
-- per-claim settings.
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

CREATE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;

GRANT EXECUTE ON FUNCTION auth.jwt(), auth.uid(), auth.role(), auth.email()
  TO anon, authenticated, service_role;

-- STORAGE ---------------------------------------------------------------
CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;

CREATE TABLE storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  owner uuid,
  public boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX bname ON storage.buckets (name);

CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text,
  owner uuid,
  owner_id text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX bucketid_objname ON storage.objects (bucket_id, name);

-- The Storage API reaches these tables as the caller's role, so policies on
-- them are the only thing standing between a member and another's files.
GRANT ALL ON storage.buckets, storage.objects TO anon, authenticated, service_role;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Same bodies as Supabase: every path segment except the last, the last one,
-- and the text after its final dot.
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE plpgsql AS $$
DECLARE
  _parts text[];
BEGIN
  SELECT string_to_array(name, '/') INTO _parts;
  RETURN _parts[1:array_length(_parts, 1) - 1];
END
$$;

CREATE FUNCTION storage.filename(name text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  _parts text[];
BEGIN
  SELECT string_to_array(name, '/') INTO _parts;
  RETURN _parts[array_length(_parts, 1)];
END
$$;

CREATE FUNCTION storage.extension(name text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  _parts text[];
  _filename text;
BEGIN
  SELECT string_to_array(name, '/') INTO _parts;
  SELECT _parts[array_length(_parts, 1)] INTO _filename;
  RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;

GRANT EXECUTE ON FUNCTION storage.foldername(text), storage.filename(text), storage.extension(text)
  TO anon, authenticated, service_role;

-- REALTIME --------------------------------------------------------------
-- Every project has this publication, empty until a migration adds a table.
CREATE PUBLICATION supabase_realtime;

-- MIGRATION HISTORY -----------------------------------------------------
-- Where the CLI records what it applied. Its primary key is the version
-- prefix, so two files with the same timestamp fail here as they do on push.
CREATE SCHEMA supabase_migrations;
CREATE TABLE supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  statements text[],
  name text
);
`;

export interface Statement {
  /** The statement text, from its first keyword to its semicolon. */
  sql: string;
  /** 1-based line of the statement's first keyword in its file. */
  line: number;
}

/**
 * Splits a SQL script into statements so a failure can name the one that
 * failed. Semicolons inside quotes, dollar-quoted bodies and comments do not
 * end a statement.
 */
export function splitStatements(script: string): Statement[] {
  const statements: Statement[] = [];
  let start = 0;
  let i = 0;

  const push = (end: number) => {
    const text = script.slice(start, end);
    const first = firstSignificantChar(text);
    if (first !== -1 && text.slice(first).trim() !== ";") {
      statements.push({ sql: text.slice(first).trimEnd(), line: lineAt(script, start + first) });
    }
    start = end;
  };

  while (i < script.length) {
    const skipped = skipComment(script, i) ?? skipQuoted(script, i);
    if (skipped !== undefined) {
      i = skipped;
    } else {
      if (script[i] === ";") push(i + 1);
      i += 1;
    }
  }
  push(script.length);
  return statements;
}

function skipComment(s: string, i: number): number | undefined {
  if (s[i] === "-" && s[i + 1] === "-") {
    const end = s.indexOf("\n", i);
    return end === -1 ? s.length : end + 1;
  }
  if (s[i] === "/" && s[i + 1] === "*") {
    // Postgres block comments nest.
    let depth = 1;
    let j = i + 2;
    while (j < s.length && depth > 0) {
      if (s[j] === "/" && s[j + 1] === "*") {
        depth += 1;
        j += 2;
      } else if (s[j] === "*" && s[j + 1] === "/") {
        depth -= 1;
        j += 2;
      } else {
        j += 1;
      }
    }
    return j;
  }
  return undefined;
}

const DOLLAR_TAG = /\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/y;
const IDENTIFIER_CHAR = /[A-Za-z0-9_$]/;

function skipQuoted(s: string, i: number): number | undefined {
  const ch = s[i];
  const before = s[i - 1] ?? "";
  if (ch === "'" || ch === '"') {
    // Only E'...' strings treat a backslash as an escape.
    const backslashEscapes =
      ch === "'" && (before === "E" || before === "e") && !IDENTIFIER_CHAR.test(s[i - 2] ?? "");
    let j = i + 1;
    while (j < s.length) {
      if (backslashEscapes && s[j] === "\\") {
        j += 2;
      } else if (s[j] === ch) {
        // A doubled quote is an escaped quote, not the end.
        if (s[j + 1] !== ch) return j + 1;
        j += 2;
      } else {
        j += 1;
      }
    }
    return s.length;
  }
  // `$1` is a parameter and `a$b` an identifier; only a tag that does not
  // continue an identifier opens a dollar-quoted body.
  if (ch === "$" && !IDENTIFIER_CHAR.test(before)) {
    DOLLAR_TAG.lastIndex = i;
    const tag = DOLLAR_TAG.exec(s)?.[0];
    if (tag) {
      const end = s.indexOf(tag, i + tag.length);
      return end === -1 ? s.length : end + tag.length;
    }
  }
  return undefined;
}

function firstSignificantChar(text: string): number {
  let i = 0;
  while (i < text.length) {
    const skipped = skipComment(text, i);
    if (skipped !== undefined) {
      i = skipped;
    } else if (/\s/.test(text[i])) {
      i += 1;
    } else {
      return i;
    }
  }
  return -1;
}

function lineAt(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text[i] === "\n") line += 1;
  return line;
}

interface DbErrorFields {
  message: string;
  code?: string;
  detail?: string;
  hint?: string;
  where?: string;
  position?: string;
}

function dbErrorFields(error: unknown): DbErrorFields {
  if (error instanceof Error) {
    const fields = error as Error & Partial<Record<keyof DbErrorFields, unknown>>;
    const text = (value: unknown) => (typeof value === "string" && value ? value : undefined);
    return {
      message: error.message,
      code: text(fields.code),
      detail: text(fields.detail),
      hint: text(fields.hint),
      where: text(fields.where),
      position: text(fields.position),
    };
  }
  return { message: String(error) };
}

/** The SQLSTATE of a Postgres error, or undefined for anything else. */
export function sqlState(error: unknown): string | undefined {
  return dbErrorFields(error).code;
}

/** One-line-per-field rendering of a Postgres error, for assertion messages. */
export function describeDbError(error: unknown): string {
  const e = dbErrorFields(error);
  return [
    `${e.message}${e.code ? ` [SQLSTATE ${e.code}]` : ""}`,
    e.detail && `DETAIL: ${e.detail}`,
    e.hint && `HINT: ${e.hint}`,
    e.where && `CONTEXT: ${e.where}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Raised by createDb() when a migration does not apply. */
export class MigrationError extends Error {
  readonly file: string;
  readonly line: number | undefined;
  readonly statement: string | undefined;
  readonly sqlState: string | undefined;

  constructor(migration: Migration, statement: Statement | undefined, index: number, total: number, error: unknown) {
    const fields = dbErrorFields(error);
    // Point at the exact line when Postgres reports a character position.
    let line = statement?.line;
    const position = Number(fields.position);
    if (statement && Number.isInteger(position) && position > 0) {
      line = statement.line + (statement.sql.slice(0, position - 1).match(/\n/g)?.length ?? 0);
    }
    const where = statement
      ? `statement ${index + 1} of ${total} (line ${line})`
      : "recording it in supabase_migrations.schema_migrations";
    const listing = statement ? `\n\n${numberLines(statement, line)}` : "";
    super(
      `Migration ${migration.file} failed at ${where}:\n` +
        indent(describeDbError(error)) +
        listing,
    );
    this.name = "MigrationError";
    this.file = migration.file;
    this.line = line;
    this.statement = statement?.sql;
    this.sqlState = fields.code;
  }
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((row) => `  ${row}`)
    .join("\n");
}

function numberLines(statement: Statement, errorLine: number | undefined): string {
  const rows = statement.sql.split("\n");
  const shown = rows.slice(0, 40);
  const width = String(statement.line + shown.length - 1).length;
  const body = shown.map((row, offset) => {
    const lineNumber = statement.line + offset;
    const marker = lineNumber === errorLine && rows.length > 1 ? ">" : " ";
    return `${marker} ${String(lineNumber).padStart(width)} | ${row}`;
  });
  if (rows.length > shown.length) body.push(`  … ${rows.length - shown.length} more lines`);
  return body.join("\n");
}

/**
 * Applies one migration file inside a transaction, statement by statement, and
 * records it in supabase_migrations.schema_migrations. A failure rolls the whole
 * file back, as the CLI does, and names the statement that failed.
 */
export async function applyMigration(db: Db, migration: Migration): Promise<void> {
  const statements = splitStatements(migration.sql);
  let index = -1;
  try {
    await db.transaction(async (tx) => {
      for (index = 0; index < statements.length; index += 1) {
        await tx.exec(statements[index].sql);
      }
      await tx.query(
        "INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ($1, $2, $3)",
        [migration.version, migration.name, statements.map((s) => s.sql)],
      );
    });
  } catch (error) {
    throw new MigrationError(migration, statements[index], index, statements.length, error);
  }
}

/**
 * A fresh database with the Supabase model and every migration applied.
 * Each call boots its own instance, so share one per test file (beforeAll) and
 * close it afterwards.
 */
export async function createDb(): Promise<Db> {
  const db = await PGlite.create();
  try {
    await db.exec(SUPABASE_SHIM);
    for (const migration of listMigrations()) {
      await applyMigration(db, migration);
    }
  } catch (error) {
    await db.close().catch(() => undefined);
    throw error;
  }
  return db;
}

let usersCreated = 0;

/**
 * Signs up a member: inserts into auth.users as the superuser, as GoTrue does,
 * so the signup triggers fire. Returns the new user's id.
 */
export async function createUser(
  db: Db,
  options: { email?: string; meta?: Record<string, unknown> } = {},
): Promise<string> {
  usersCreated += 1;
  const email = options.email ?? `member${usersCreated}@example.test`;
  const { rows } = await db.query<{ id: string }>(
    "INSERT INTO auth.users (email, raw_user_meta_data, raw_app_meta_data) VALUES ($1, $2::jsonb, $3::jsonb) RETURNING id",
    [email, JSON.stringify(options.meta ?? {}), JSON.stringify({ provider: "email", providers: ["email"] })],
  );
  return rows[0].id;
}

/** Gives the user a verified authenticator app, as finishing TOTP enrolment does. */
export async function enrolVerifiedFactor(db: Db, userId: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "INSERT INTO auth.mfa_factors (user_id, friendly_name, factor_type, status) VALUES ($1, 'Authenticator app', 'totp', 'verified') RETURNING id",
    [userId],
  );
  return rows[0].id;
}

/** Assigns a role the way the project owner does, from the SQL editor. */
export async function grantRole(db: Db, userId: string, role: string): Promise<void> {
  await db.query(
    "INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2::public.app_role) ON CONFLICT (user_id, role) DO NOTHING",
    [userId, role],
  );
}

export interface SessionOptions {
  /** Roll the transaction back instead of committing it. Default: commit. */
  rollback?: boolean;
}

export interface UserSessionOptions extends SessionOptions {
  /**
   * Assurance level in the JWT. Supabase issues aal1 for a password sign-in
   * and aal2 once a verified second factor has been used, so aal1 is the default.
   */
  aal?: "aal1" | "aal2";
}

type ApiRole = "anon" | "authenticated" | "service_role";

async function runAs<T>(
  db: Db,
  role: ApiRole,
  claims: Record<string, unknown>,
  options: SessionOptions,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // What PostgREST does per request: claims first, then drop to the role.
    // SET LOCAL and set_config(..., true) both end with the transaction.
    await tx.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await tx.exec(`SET LOCAL ROLE ${role}`);
    const result = await fn(tx);
    if (options.rollback && !tx.closed) await tx.rollback();
    return result;
  });
}

/**
 * Runs `fn` as a signed-out visitor using the publishable key. Use `tx` for
 * every query inside; the transaction commits unless `rollback` is set.
 */
export function asAnon<T>(db: Db, fn: (tx: Tx) => Promise<T>, options: SessionOptions = {}): Promise<T> {
  return runAs(db, "anon", { role: "anon", iss: "supabase" }, options, fn);
}

/**
 * Runs `fn` as the signed-in user, with the claims a Supabase access token
 * carries. Use `tx` for every query inside; the transaction commits unless
 * `rollback` is set.
 */
export async function asUser<T>(
  db: Db,
  userId: string,
  options: UserSessionOptions,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const aal = options.aal ?? "aal1";
  const { rows } = await db.query<{ email: string | null }>("SELECT email FROM auth.users WHERE id = $1", [userId]);
  const now = Math.floor(Date.now() / 1000);
  const amr =
    aal === "aal2"
      ? [
          { method: "totp", timestamp: now },
          { method: "password", timestamp: now },
        ]
      : [{ method: "password", timestamp: now }];
  const claims = {
    iss: "supabase",
    sub: userId,
    role: "authenticated",
    aud: "authenticated",
    aal,
    amr,
    email: rows[0]?.email ?? "",
    is_anonymous: false,
    iat: now,
    exp: now + 3600,
  };
  return runAs(db, "authenticated", claims, options, fn);
}

/** Runs `fn` with the secret service-role key: bypasses RLS, not grants. */
export function asServiceRole<T>(db: Db, fn: (tx: Tx) => Promise<T>, options: SessionOptions = {}): Promise<T> {
  return runAs(db, "service_role", { role: "service_role", iss: "supabase" }, options, fn);
}

function isResults(value: unknown): value is Results {
  return typeof value === "object" && value !== null && Array.isArray((value as Results).rows);
}

/** Rows touched or returned, or undefined when `value` is not a query result. */
function rowsSeen(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (isResults(value)) return Math.max(value.rows.length, value.affectedRows ?? 0);
  if (Array.isArray(value)) {
    // exec() returns one result per statement; a bare array is rows.
    if (value.length > 0 && value.every(isResults)) {
      return value.reduce((sum: number, result: Results) => sum + (rowsSeen(result) ?? 0), 0);
    }
    return value.length;
  }
  return undefined;
}

/**
 * Asserts the database refused `work`. Refusal is either Postgres raising
 * insufficient_privilege (42501: a missing grant, or a row failing an RLS
 * check), or the statement running but touching and returning no rows, which
 * is how RLS answers a SELECT, UPDATE or DELETE whose rows it hides.
 *
 * `work` should resolve to a query result (return `tx.query(...)` from the
 * callback), its rows, or a row count. Any other error is rethrown, so a
 * constraint violation cannot pass for a permission check.
 */
export async function expectDenied(work: Promise<unknown>): Promise<void> {
  let value: unknown;
  try {
    value = await work;
  } catch (error) {
    if (sqlState(error) === "42501") return;
    throw new Error(`Expected the database to refuse this, but it failed for another reason:\n${indent(describeDbError(error))}`);
  }
  const seen = rowsSeen(value);
  if (seen === undefined) {
    throw new Error(
      "expectDenied could not tell whether anything happened: return the tx.query(...) result, its rows, or a row count from the callback.",
    );
  }
  if (seen > 0) {
    throw new Error(`Expected the database to refuse this, but it allowed it: ${seen} row(s) were returned or changed.`);
  }
}
