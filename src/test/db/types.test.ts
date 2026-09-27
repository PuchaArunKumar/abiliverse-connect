// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

/**
 * src/integrations/supabase/types.ts is maintained by hand, because the
 * migrations are not applied to a database `supabase gen types` can read until
 * they ship. These checks hold it to the migrated schema, so a column added in
 * SQL but not in the types (or typed as never null when it can be) fails here
 * instead of as `undefined` in a page.
 */

const TYPES_FILE = fileURLToPath(new URL("../../integrations/supabase/types.ts", import.meta.url));

let db: Db;
let source: string;

beforeAll(async () => {
  source = readFileSync(TYPES_FILE, "utf8").replace(/\r\n/g, "\n");
  db = await createDb();
}, 60_000);

afterAll(async () => {
  await db?.close();
});

/** The text of `public.<section>`: from its opening line to the next section. */
function section(name: string, next: string): string {
  const start = source.indexOf(`\n    ${name}: {\n`);
  const end = source.indexOf(`\n    ${next}: {`, start + 1);
  expect(start, `public.${name} in types.ts`).toBeGreaterThan(-1);
  expect(end, `public.${next} after public.${name} in types.ts`).toBeGreaterThan(start);
  return source.slice(start, end);
}

/** Each entry at six spaces of indent, with the text up to the next one. */
function entries(text: string): Map<string, string> {
  const found = new Map<string, string>();
  const pattern = /^ {6}(\w+):([\s\S]*?)(?=^ {6}\w+:|(?![\s\S]))/gm;
  for (const match of text.matchAll(pattern)) found.set(match[1], match[2]);
  return found;
}

describe("types.ts", () => {
  it("types every table with its columns and their nullability", async () => {
    const { rows } = await db.query<{ tbl: string; col: string; nullable: boolean }>(
      `SELECT c.relname AS tbl, a.attname AS col, NOT a.attnotnull AS nullable
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
          AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY 1, 2`,
    );
    const inDatabase = rows.map((row) => `${row.tbl}.${row.col}${row.nullable ? " | null" : ""}`);

    const typed: string[] = [];
    for (const [table, body] of entries(section("Tables", "Views"))) {
      const row = /^ {8}Row: \{\n([\s\S]*?)^ {8}\}/m.exec(body);
      expect(row, `${table}.Row in types.ts`).not.toBeNull();
      for (const line of (row?.[1] ?? "").split("\n")) {
        const column = /^ {10}(\w+): (.+)$/.exec(line);
        if (column) typed.push(`${table}.${column[1]}${column[2].endsWith("| null") ? " | null" : ""}`);
      }
    }

    expect(typed.sort()).toEqual(inDatabase.sort());
  });

  it("types every enum with its values in order", async () => {
    const { rows } = await db.query<{ name: string; labels: string[] }>(
      `SELECT t.typname AS name, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
         FROM pg_type t
         JOIN pg_enum e ON e.enumtypid = t.oid
         JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        GROUP BY t.typname
        ORDER BY 1`,
    );
    const typed = [...entries(section("Enums", "CompositeTypes"))].map(([name, body]) => ({
      name,
      labels: [...body.matchAll(/"([^"]+)"/g)].map((match) => match[1]),
    }));
    expect(typed.sort((a, b) => a.name.localeCompare(b.name))).toEqual(rows);
  });

  it("types every function the API can call, with its argument names", async () => {
    // Trigger functions are not callable through the API and are left out.
    const { rows } = await db.query<{ name: string; args: string[]; optional: number; callable: boolean }>(
      `SELECT p.proname AS name,
              coalesce(p.proargnames[1:p.pronargs], '{}') AS args,
              p.pronargdefaults AS optional,
              has_function_privilege('anon', p.oid, 'EXECUTE')
                OR has_function_privilege('authenticated', p.oid, 'EXECUTE') AS callable
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.prorettype <> 'trigger'::regtype
        ORDER BY 1`,
    );
    const inDatabase = new Map(rows.map((row) => [row.name, row]));
    const typed = entries(section("Functions", "Enums"));

    const untyped = rows.filter((row) => row.callable && !typed.has(row.name)).map((row) => row.name);
    expect(untyped, "callable through the API but missing from types.ts").toEqual([]);

    for (const [name, body] of typed) {
      const fn = inDatabase.get(name);
      expect(fn, `${name} in types.ts but not in the database`).toBeDefined();
      if (!fn) continue;
      const args = /Args: \{([^}]*)\}/.exec(body)?.[1] ?? "";
      const typedArgs = [...args.matchAll(/(\w+)(\?)?:/g)].map((match) => `${match[1]}${match[2] ?? ""}`);
      const expected = fn.args.map((arg, index) => (index >= fn.args.length - fn.optional ? `${arg}?` : arg));
      expect(typedArgs, `${name} arguments`).toEqual(expected);
    }
  });
});
