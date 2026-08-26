import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Catches internal links pointing at routes that do not exist.
 *
 * This was written after `/accessibility` shipped in a redesign while the route
 * was actually registered as `/accessibility-statement` — a dead link on the
 * accessibility page of an accessibility platform. Typecheck and lint both pass
 * on a broken `to=` because it is just a string.
 */

const SRC = resolve(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "test" || entry === "node_modules") continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function definedRoutes(): Set<string> {
  const app = readFileSync(join(SRC, "App.tsx"), "utf8");
  const routes = new Set<string>();
  for (const m of app.matchAll(/<Route\s+path="([^"]+)"/g)) {
    routes.add(m[1]);
  }
  return routes;
}

/** `/problems/:id` should satisfy a link to `/problems/abc`. */
function matchesRoute(target: string, routes: Set<string>): boolean {
  if (routes.has(target)) return true;
  const parts = target.split("/").filter(Boolean);
  for (const route of routes) {
    if (route === "*") continue;
    const rparts = route.split("/").filter(Boolean);
    if (rparts.length !== parts.length) continue;
    if (rparts.every((r, i) => r.startsWith(":") || r === parts[i])) return true;
  }
  return false;
}

describe("internal links", () => {
  const routes = definedRoutes();
  const files = walk(SRC);

  it("App.tsx declares routes", () => {
    expect(routes.size).toBeGreaterThan(5);
  });

  it("every static <Link to='/...'> resolves to a declared route", () => {
    const broken: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      // Static string targets only. Template literals and expressions carry
      // runtime ids that cannot be checked here.
      for (const m of source.matchAll(/\bto=["'](\/[^"'{}]*)["']/g)) {
        const target = m[1].split("?")[0].split("#")[0];
        if (target === "/") continue;
        if (!matchesRoute(target, routes)) {
          broken.push(`${file.replace(SRC, "src")} -> ${target}`);
        }
      }
    }

    expect(broken).toEqual([]);
  });
});
