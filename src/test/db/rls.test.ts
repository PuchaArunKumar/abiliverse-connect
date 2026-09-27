// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  applyMigration,
  asAnon,
  asUser,
  createDb,
  createUser,
  describeDbError,
  enrolVerifiedFactor,
  expectDenied,
  grantRole,
  listMigrations,
  sqlState,
  SUPABASE_SHIM,
  type Db,
  type SessionOptions,
  type Tx,
  type UserSessionOptions,
} from "./harness";

/**
 * The security promises of the schema, checked with real queries through the
 * same roles and JWT claims PostgREST uses. Each test states a property a
 * member or visitor relies on; a failure here means the database would let
 * someone do or see something the app tells people cannot happen.
 *
 * One database is shared by the whole file, so every test builds the rows it
 * asserts on rather than relying on another test's leftovers.
 */

const PERMISSION_DENIED = "42501";
const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";

let db: Db;

beforeAll(async () => {
  db = await createDb();
}, 60_000);

afterAll(async () => {
  await db?.close();
});

// HELPERS ---------------------------------------------------------------

/** Asserts `work` fails with exactly this SQLSTATE. */
async function expectSqlState(work: Promise<unknown>, code: string): Promise<void> {
  let error: unknown;
  try {
    await work;
  } catch (caught) {
    error = caught;
  }
  expect(error, `expected SQLSTATE ${code}, but the statement succeeded`).toBeDefined();
  expect(sqlState(error), describeDbError(error)).toBe(code);
}

interface Member {
  id: string;
  /** The session a real sign-in would give: aal2 once a second factor exists. */
  session: UserSessionOptions;
}

async function newMember(options: { mfa?: boolean; email?: string; meta?: Record<string, unknown> } = {}): Promise<Member> {
  const id = await createUser(db, { email: options.email, meta: options.meta });
  if (options.mfa) await enrolVerifiedFactor(db, id);
  return { id, session: { aal: options.mfa ? "aal2" : "aal1" } };
}

function as<T>(member: Member, fn: (tx: Tx) => Promise<T>, options: UserSessionOptions = {}): Promise<T> {
  return asUser(db, member.id, { ...member.session, ...options }, fn);
}

/** Runs `sql` as the member and returns the rows. */
async function rowsAs<R>(member: Member, sql: string, params: unknown[] = [], options: UserSessionOptions = {}): Promise<R[]> {
  const result = await as(member, (tx) => tx.query<R>(sql, params), options);
  return result.rows;
}

async function rowsAsAnon<R>(sql: string, params: unknown[] = [], options: SessionOptions = {}): Promise<R[]> {
  const result = await asAnon(db, (tx) => tx.query<R>(sql, params), options);
  return result.rows;
}

/** Reads as the superuser, past RLS, to see what actually happened. */
async function peek<R>(sql: string, params: unknown[] = []): Promise<R[]> {
  return (await db.query<R>(sql, params)).rows;
}

let problemsCreated = 0;

async function newProblem(author: Member, title?: string, description?: string): Promise<string> {
  problemsCreated += 1;
  const [row] = await rowsAs<{ id: string }>(
    author,
    "INSERT INTO public.problems (user_id, title, description) VALUES ($1, $2, $3) RETURNING id",
    [
      author.id,
      title ?? `Barrier report number ${problemsCreated}`,
      description ?? `A description long enough to pass the check, report ${problemsCreated}.`,
    ],
  );
  return row.id;
}

async function newPitch(founder: Member, isOpen = true): Promise<string> {
  const [row] = await rowsAs<{ id: string }>(
    founder,
    `INSERT INTO public.pitches (user_id, title, tagline, description, is_open)
     VALUES ($1, 'Talking kettle', 'A kettle that says when it has boiled',
             'A kettle for blind and low-vision cooks that announces its temperature out loud.', $2)
     RETURNING id`,
    [founder.id, isOpen],
  );
  return row.id;
}

async function newRoutine(owner: Member): Promise<string> {
  const [row] = await rowsAs<{ id: string }>(
    owner,
    "INSERT INTO public.companion_routines (user_id, title, steps) VALUES ($1, 'Morning medication', ARRAY['Fill water glass', 'Take tablets']) RETURNING id",
    [owner.id],
  );
  return row.id;
}

async function count(table: string, where = "true", params: unknown[] = []): Promise<number> {
  const [row] = await peek<{ n: number }>(`SELECT count(*)::int AS n FROM public.${table} WHERE ${where}`, params);
  return row.n;
}

// VISITORS --------------------------------------------------------------

describe("a signed-out visitor", () => {
  const publicTables = [
    "problems",
    "problem_comments",
    "problem_media",
    "pitches",
    "pitch_feedback",
    "jobs",
    "courses",
    "events",
  ];

  // Every private table, not only the obvious ones: each holds something about
  // a person (health, contact details, what they back or bookmark).
  const privateTables = [
    "profiles",
    "posts",
    "post_likes",
    "post_comments",
    "job_applications",
    "user_roles",
    "problem_votes",
    "problem_bookmarks",
    "problem_reports",
    "problem_revisions",
    "pitch_supports",
    "pitch_interests",
    "newsletter_subscribers",
    "contact_messages",
    "companion_routines",
    "companion_completions",
  ];

  beforeAll(async () => {
    // One row in every table, so "can read" is shown by rows coming back and
    // "cannot read" is a refusal, not an empty table.
    const author = await newMember();
    const other = await newMember();
    const problemId = await newProblem(author);
    const pitchId = await newPitch(author);
    const routineId = await newRoutine(author);
    await as(author, async (tx) => {
      await tx.query("UPDATE public.problems SET title = 'An edited barrier report' WHERE id = $1", [problemId]);
      await tx.query("INSERT INTO public.problem_comments (problem_id, user_id, body) VALUES ($1, $2, 'Same here')", [problemId, author.id]);
      await tx.query(
        `INSERT INTO public.problem_media (problem_id, user_id, kind, storage_path, file_name, mime_type, size_bytes, description)
         VALUES ($1, $2, 'image', $3, 'step.png', 'image/png', 100, 'A kerb with no dropped section')`,
        [problemId, author.id, `${author.id}/${problemId}/step.png`],
      );
      await tx.query("INSERT INTO public.companion_completions (routine_id, user_id, completed_on) VALUES ($1, $2, current_date)", [routineId, author.id]);
      const post = await tx.query<{ id: string }>("INSERT INTO public.posts (user_id, body) VALUES ($1, 'Hello') RETURNING id", [author.id]);
      await tx.query("INSERT INTO public.post_likes (post_id, user_id) VALUES ($1, $2)", [post.rows[0].id, author.id]);
      await tx.query("INSERT INTO public.post_comments (post_id, user_id, body) VALUES ($1, $2, 'Hi')", [post.rows[0].id, author.id]);
      await tx.query("INSERT INTO public.jobs (user_id, title, company, description) VALUES ($1, 'Tester', 'Acme', 'Test things')", [author.id]);
      await tx.query("INSERT INTO public.courses (user_id, title, description) VALUES ($1, 'Braille basics', 'Learn braille')", [author.id]);
      await tx.query(
        "INSERT INTO public.events (user_id, kind, title, description) VALUES ($1, 'event', 'Meetup', 'Monthly meetup')",
        [author.id],
      );
      await tx.query("SELECT public.subscribe_to_newsletter('reader@example.test')");
      await tx.query("SELECT public.send_contact_message('Sam', 'sam@example.test', '', 'Hello from the contact page')");
    });
    await as(other, async (tx) => {
      await tx.query("INSERT INTO public.problem_votes (problem_id, user_id) VALUES ($1, $2)", [problemId, other.id]);
      await tx.query("INSERT INTO public.problem_bookmarks (problem_id, user_id) VALUES ($1, $2)", [problemId, other.id]);
      await tx.query("INSERT INTO public.problem_reports (problem_id, user_id, reason) VALUES ($1, $2, 'Spam')", [problemId, other.id]);
      await tx.query("INSERT INTO public.pitch_supports (pitch_id, user_id) VALUES ($1, $2)", [pitchId, other.id]);
      await tx.query("INSERT INTO public.pitch_feedback (pitch_id, user_id, body) VALUES ($1, $2, 'Love it')", [pitchId, other.id]);
      await tx.query(
        "INSERT INTO public.pitch_interests (pitch_id, user_id, offering, message, contact) VALUES ($1, $2, 'mentorship', 'I can mentor you on this', 'me@example.test')",
        [pitchId, other.id],
      );
      const job = await tx.query<{ id: string }>("SELECT id FROM public.jobs LIMIT 1");
      await tx.query("INSERT INTO public.job_applications (job_id, user_id) VALUES ($1, $2)", [job.rows[0].id, other.id]);
    });

    for (const table of [...publicTables, ...privateTables]) {
      expect(await count(table), `seed row in ${table}`).toBeGreaterThan(0);
    }
  });

  it.each(publicTables)("can read %s", async (table) => {
    const rows = await rowsAsAnon(`SELECT * FROM public.${table}`);
    expect(rows.length).toBeGreaterThan(0);
  });

  it.each(privateTables)("cannot read %s at all", async (table) => {
    await expectSqlState(asAnon(db, (tx) => tx.query(`SELECT * FROM public.${table}`)), PERMISSION_DENIED);
  });

  it("cannot write to the newsletter or contact tables directly", async () => {
    await expectSqlState(
      asAnon(db, (tx) => tx.query("INSERT INTO public.newsletter_subscribers (email) VALUES ('direct@example.test')")),
      PERMISSION_DENIED,
    );
    await expectSqlState(
      asAnon(db, (tx) =>
        tx.query("INSERT INTO public.contact_messages (name, email, message) VALUES ('X', 'x@example.test', 'A direct insert')"),
      ),
      PERMISSION_DENIED,
    );
  });

  it("can subscribe to the newsletter, normalised, and a second time changes nothing", async () => {
    await rowsAsAnon("SELECT public.subscribe_to_newsletter($1)", ["  Alex.Visitor@Example.TEST "]);
    // Same answer the second time, so the endpoint cannot be used to test
    // whether someone is already on the list.
    await rowsAsAnon("SELECT public.subscribe_to_newsletter($1)", ["alex.visitor@example.test"]);
    expect(await peek("SELECT email FROM public.newsletter_subscribers WHERE email LIKE 'alex.visitor%'")).toEqual([
      { email: "alex.visitor@example.test" },
    ]);
  });

  it.each(["", "not-an-address", "two@@example.test", "spaces in@example.test", null])(
    "is told %j is not an email address",
    async (email) => {
      await expectSqlState(asAnon(db, (tx) => tx.query("SELECT public.subscribe_to_newsletter($1)", [email])), CHECK_VIOLATION);
    },
  );

  it("can send a contact message, stored trimmed and without an account", async () => {
    await rowsAsAnon("SELECT public.send_contact_message($1, $2, $3, $4)", [
      "  Robin  ",
      "robin@example.test",
      " Access ",
      "  The captcha has no audio option.  ",
    ]);
    expect(await peek("SELECT user_id, name, topic, message FROM public.contact_messages WHERE email = 'robin@example.test'")).toEqual([
      { user_id: null, name: "Robin", topic: "Access", message: "The captcha has no audio option." },
    ]);
  });

  it.each([
    ["an empty name", "   ", "a@example.test", "", "A long enough message"],
    ["a name over 200 characters", "n".repeat(201), "a@example.test", "", "A long enough message"],
    ["a bad address", "Robin", "robin.example.test", "", "A long enough message"],
    ["a topic over 100 characters", "Robin", "a@example.test", "t".repeat(101), "A long enough message"],
    ["a message under 10 characters", "Robin", "a@example.test", "", "  too short  "],
    ["a message over 5000 characters", "Robin", "a@example.test", "", "m".repeat(5001)],
  ])("is refused a contact message with %s", async (_label, name, email, topic, message) => {
    await expectSqlState(
      asAnon(db, (tx) => tx.query("SELECT public.send_contact_message($1, $2, $3, $4)", [name, email, topic, message])),
      CHECK_VIOLATION,
    );
  });

  it("cannot write anything else", async () => {
    await expectSqlState(
      asAnon(db, (tx) =>
        tx.query("INSERT INTO public.problems (user_id, title, description) VALUES (gen_random_uuid(), 'A visitor problem', 'Twenty characters or more here')"),
      ),
      PERMISSION_DENIED,
    );
    await expectSqlState(asAnon(db, (tx) => tx.query("UPDATE public.problems SET title = 'Defaced by a visitor'")), PERMISSION_DENIED);
    await expectSqlState(asAnon(db, (tx) => tx.query("DELETE FROM public.jobs")), PERMISSION_DENIED);
  });

  it("cannot ask what roles a member holds", async () => {
    const member = await newMember();
    await expectSqlState(
      asAnon(db, (tx) => tx.query("SELECT public.has_role($1, 'person_with_disability')", [member.id])),
      PERMISSION_DENIED,
    );
    expect(await rowsAsAnon("SELECT public.is_admin() AS admin, public.is_moderator() AS moderator")).toEqual([
      { admin: false, moderator: false },
    ]);
  });

  it("gets totals, not rows, from public_stats()", async () => {
    const [stats] = await rowsAsAnon<{ members: number; problems: number }>("SELECT * FROM public.public_stats()");
    expect(Number(stats.members)).toBeGreaterThan(0);
    expect(Number(stats.problems)).toBeGreaterThan(0);
  });
});

// PROBLEMS --------------------------------------------------------------

describe("a member writing problems", () => {
  let author: Member;
  let other: Member;
  let problemId: string;

  beforeAll(async () => {
    author = await newMember();
    other = await newMember();
    problemId = await newProblem(author);
  });

  it.each([
    ["vote_count", "100000"],
    ["comment_count", "100000"],
    ["created_at", "'2999-01-01'"],
    ["updated_at", "'2999-01-01'"],
    ["status", "'solved'"],
    ["id", "gen_random_uuid()"],
  ])("cannot set %s on insert", async (column, value) => {
    await expectSqlState(
      as(author, (tx) =>
        tx.query(
          `INSERT INTO public.problems (user_id, title, description, ${column}) VALUES ($1, 'Inflated problem title', 'Twenty characters or more here', ${value})`,
          [author.id],
        ),
      ),
      PERMISSION_DENIED,
    );
  });

  it.each([
    ["vote_count", "100000"],
    ["comment_count", "100000"],
    ["created_at", "'2999-01-01'"],
    ["updated_at", "'2999-01-01'"],
    ["user_id", "$2"],
  ])("cannot change %s of their own problem", async (column, value) => {
    const params = column === "user_id" ? [problemId, other.id] : [problemId];
    await expectSqlState(
      as(author, (tx) => tx.query(`UPDATE public.problems SET ${column} = ${value} WHERE id = $1`, params)),
      PERMISSION_DENIED,
    );
  });

  it("cannot file a problem under someone else's name", async () => {
    await expectSqlState(
      as(author, (tx) =>
        tx.query("INSERT INTO public.problems (user_id, title, description) VALUES ($1, 'Written for someone', 'Twenty characters or more here')", [
          other.id,
        ]),
      ),
      PERMISSION_DENIED,
    );
  });

  it("can edit and close their own problem, but not someone else's", async () => {
    const edited = await rowsAs(author, "UPDATE public.problems SET title = 'A clearer problem title', status = 'solved' WHERE id = $1 RETURNING id", [problemId]);
    expect(edited).toHaveLength(1);
    await expectDenied(as(other, (tx) => tx.query("UPDATE public.problems SET title = 'Hijacked title here' WHERE id = $1", [problemId])));
    await expectDenied(as(other, (tx) => tx.query("DELETE FROM public.problems WHERE id = $1", [problemId])));
    expect(await peek("SELECT title, status FROM public.problems WHERE id = $1", [problemId])).toEqual([
      { title: "A clearer problem title", status: "solved" },
    ]);
  });

  it("keeps the edit history visible to the author only", async () => {
    const id = await newProblem(author, "Original wording of report", "Original description with a name in it.");
    await rowsAs(author, "UPDATE public.problems SET description = 'Description with the name taken out.' WHERE id = $1", [id]);

    const history = await rowsAs<{ description: string }>(author, "SELECT description FROM public.problem_revisions WHERE problem_id = $1", [id]);
    expect(history).toEqual([{ description: "Original description with a name in it." }]);

    await expectDenied(as(other, (tx) => tx.query("SELECT * FROM public.problem_revisions WHERE problem_id = $1", [id])));
    await expectSqlState(asAnon(db, (tx) => tx.query("SELECT * FROM public.problem_revisions WHERE problem_id = $1", [id])), PERMISSION_DENIED);
    // Only the database writes history.
    await expectSqlState(
      as(author, (tx) => tx.query("INSERT INTO public.problem_revisions (problem_id, title, description) VALUES ($1, 'Forged', 'Forged')", [id])),
      PERMISSION_DENIED,
    );

    // The author can finish a redaction by removing the old text.
    await rowsAs(author, "DELETE FROM public.problem_revisions WHERE problem_id = $1", [id]);
    expect(await count("problem_revisions", "problem_id = $1", [id])).toBe(0);
  });
});

describe("comments on a problem", () => {
  let author: Member;
  let other: Member;
  let problemA: string;
  let problemB: string;
  let commentId: string;

  beforeAll(async () => {
    author = await newMember();
    other = await newMember();
    problemA = await newProblem(author);
    problemB = await newProblem(other);
    [{ id: commentId }] = await rowsAs<{ id: string }>(
      author,
      "INSERT INTO public.problem_comments (problem_id, user_id, body) VALUES ($1, $2, 'First thought') RETURNING id",
      [problemA, author.id],
    );
  });

  it("count towards the problem through the trigger", async () => {
    expect(await peek("SELECT comment_count FROM public.problems WHERE id = $1", [problemA])).toEqual([{ comment_count: 1 }]);
  });

  it("can have their body edited by their writer", async () => {
    const rows = await rowsAs(author, "UPDATE public.problem_comments SET body = 'Second thought' WHERE id = $1 RETURNING body", [commentId]);
    expect(rows).toEqual([{ body: "Second thought" }]);
  });

  it("cannot be moved to another problem", async () => {
    await expectSqlState(
      as(author, (tx) => tx.query("UPDATE public.problem_comments SET problem_id = $2 WHERE id = $1", [commentId, problemB])),
      PERMISSION_DENIED,
    );
    expect(await peek("SELECT problem_id FROM public.problem_comments WHERE id = $1", [commentId])).toEqual([{ problem_id: problemA }]);
  });

  it("cannot be reassigned, backdated or edited by someone else", async () => {
    await expectSqlState(
      as(author, (tx) => tx.query("UPDATE public.problem_comments SET user_id = $2 WHERE id = $1", [commentId, other.id])),
      PERMISSION_DENIED,
    );
    await expectSqlState(
      as(author, (tx) => tx.query("UPDATE public.problem_comments SET created_at = '2000-01-01' WHERE id = $1", [commentId])),
      PERMISSION_DENIED,
    );
    await expectDenied(as(other, (tx) => tx.query("UPDATE public.problem_comments SET body = 'Rewritten' WHERE id = $1", [commentId])));
    await expectDenied(as(other, (tx) => tx.query("DELETE FROM public.problem_comments WHERE id = $1", [commentId])));
  });

  it("uncount when deleted", async () => {
    await rowsAs(author, "DELETE FROM public.problem_comments WHERE id = $1", [commentId]);
    expect(await peek("SELECT comment_count FROM public.problems WHERE id = $1", [problemA])).toEqual([{ comment_count: 0 }]);
  });
});

describe("votes, bookmarks and reports", () => {
  let author: Member;
  let voter: Member;
  let problemId: string;

  beforeAll(async () => {
    author = await newMember();
    voter = await newMember();
    problemId = await newProblem(author);
  });

  it("move vote_count up and down through the trigger", async () => {
    const before = await peek<{ updated_at: string }>("SELECT updated_at FROM public.problems WHERE id = $1", [problemId]);
    await rowsAs(voter, "INSERT INTO public.problem_votes (problem_id, user_id) VALUES ($1, $2)", [problemId, voter.id]);
    await rowsAs(author, "INSERT INTO public.problem_votes (problem_id, user_id) VALUES ($1, $2)", [problemId, author.id]);
    expect(await peek("SELECT vote_count FROM public.problems WHERE id = $1", [problemId])).toEqual([{ vote_count: 2 }]);

    await rowsAs(voter, "DELETE FROM public.problem_votes WHERE problem_id = $1", [problemId]);
    const after = await peek<{ vote_count: number; updated_at: string }>("SELECT vote_count, updated_at FROM public.problems WHERE id = $1", [
      problemId,
    ]);
    expect(after[0].vote_count).toBe(1);
    // A vote is not an edit.
    expect(after[0].updated_at).toEqual(before[0].updated_at);
  });

  it("cannot be cast in someone else's name", async () => {
    await expectSqlState(
      as(voter, (tx) => tx.query("INSERT INTO public.problem_votes (problem_id, user_id) VALUES ($1, $2)", [problemId, author.id])),
      PERMISSION_DENIED,
    );
    await expectSqlState(
      as(voter, (tx) => tx.query("INSERT INTO public.problem_bookmarks (problem_id, user_id) VALUES ($1, $2)", [problemId, author.id])),
      PERMISSION_DENIED,
    );
  });

  it("are private to the member who made them", async () => {
    await rowsAs(voter, "INSERT INTO public.problem_votes (problem_id, user_id) VALUES ($1, $2)", [problemId, voter.id]);
    await rowsAs(voter, "INSERT INTO public.problem_bookmarks (problem_id, user_id) VALUES ($1, $2)", [problemId, voter.id]);

    expect(await rowsAs(voter, "SELECT user_id FROM public.problem_votes WHERE problem_id = $1", [problemId])).toEqual([{ user_id: voter.id }]);
    expect(await rowsAs(voter, "SELECT user_id FROM public.problem_bookmarks WHERE problem_id = $1", [problemId])).toEqual([
      { user_id: voter.id },
    ]);

    // Not even the problem's author learns who voted: only how many.
    await expectDenied(as(author, (tx) => tx.query("SELECT * FROM public.problem_votes WHERE user_id = $1", [voter.id])));
    await expectDenied(as(author, (tx) => tx.query("SELECT * FROM public.problem_bookmarks WHERE user_id = $1", [voter.id])));
    await expectDenied(as(author, (tx) => tx.query("DELETE FROM public.problem_votes WHERE user_id = $1", [voter.id])));
    expect(await peek("SELECT vote_count FROM public.problems WHERE id = $1", [problemId])).toEqual([{ vote_count: 2 }]);
  });

  it("allow one report per member per problem, seen by the reporter only", async () => {
    await rowsAs(voter, "INSERT INTO public.problem_reports (problem_id, user_id, reason) VALUES ($1, $2, 'Contains a full name')", [
      problemId,
      voter.id,
    ]);
    await expectSqlState(
      as(voter, (tx) =>
        tx.query("INSERT INTO public.problem_reports (problem_id, user_id, reason) VALUES ($1, $2, 'Again')", [problemId, voter.id]),
      ),
      UNIQUE_VIOLATION,
    );
    expect(await rowsAs(voter, "SELECT reason FROM public.problem_reports WHERE problem_id = $1", [problemId])).toEqual([
      { reason: "Contains a full name" },
    ]);
    await expectDenied(as(author, (tx) => tx.query("SELECT * FROM public.problem_reports WHERE problem_id = $1", [problemId])));
    // Only a moderator marks a report resolved.
    await expectDenied(as(voter, (tx) => tx.query("UPDATE public.problem_reports SET resolved = true WHERE problem_id = $1", [problemId])));
  });
});

// PITCHES ---------------------------------------------------------------

describe("pitches", () => {
  let founder: Member;
  let backer: Member;
  let bystander: Member;
  let pitchId: string;

  beforeAll(async () => {
    founder = await newMember();
    backer = await newMember();
    bystander = await newMember();
    pitchId = await newPitch(founder);
  });

  it("cannot have their counters set by the founder", async () => {
    await expectSqlState(
      as(founder, (tx) => tx.query("UPDATE public.pitches SET support_count = 500 WHERE id = $1", [pitchId])),
      PERMISSION_DENIED,
    );
    await expectSqlState(
      as(founder, (tx) => tx.query("UPDATE public.pitches SET feedback_count = 500 WHERE id = $1", [pitchId])),
      PERMISSION_DENIED,
    );
  });

  it("cannot be supported by their own founder", async () => {
    await expectSqlState(
      as(founder, (tx) => tx.query("INSERT INTO public.pitch_supports (pitch_id, user_id) VALUES ($1, $2)", [pitchId, founder.id])),
      PERMISSION_DENIED,
    );
  });

  it("count supporters privately", async () => {
    await rowsAs(backer, "INSERT INTO public.pitch_supports (pitch_id, user_id) VALUES ($1, $2)", [pitchId, backer.id]);
    expect(await peek("SELECT support_count FROM public.pitches WHERE id = $1", [pitchId])).toEqual([{ support_count: 1 }]);
    expect(await rowsAs(backer, "SELECT user_id FROM public.pitch_supports WHERE pitch_id = $1", [pitchId])).toEqual([{ user_id: backer.id }]);
    await expectDenied(as(founder, (tx) => tx.query("SELECT * FROM public.pitch_supports WHERE pitch_id = $1", [pitchId])));
    await expectDenied(as(bystander, (tx) => tx.query("SELECT * FROM public.pitch_supports WHERE pitch_id = $1", [pitchId])));
  });

  it("show an interest request to its sender and the founder only", async () => {
    await rowsAs(
      backer,
      "INSERT INTO public.pitch_interests (pitch_id, user_id, offering, message, contact) VALUES ($1, $2, 'funding', 'We fund early prototypes like this', 'fund@example.test')",
      [pitchId, backer.id],
    );
    expect(await rowsAs(founder, "SELECT contact FROM public.pitch_interests WHERE pitch_id = $1", [pitchId])).toEqual([
      { contact: "fund@example.test" },
    ]);
    expect(await rowsAs(backer, "SELECT contact FROM public.pitch_interests WHERE pitch_id = $1", [pitchId])).toEqual([
      { contact: "fund@example.test" },
    ]);
    await expectDenied(as(bystander, (tx) => tx.query("SELECT * FROM public.pitch_interests WHERE pitch_id = $1", [pitchId])));
    await expectSqlState(asAnon(db, (tx) => tx.query("SELECT * FROM public.pitch_interests")), PERMISSION_DENIED);
  });

  it("refuse interest once closed, and from the founder", async () => {
    const closed = await newPitch(founder, false);
    await expectSqlState(
      as(bystander, (tx) =>
        tx.query(
          "INSERT INTO public.pitch_interests (pitch_id, user_id, offering, message, contact) VALUES ($1, $2, 'mentorship', 'Happy to mentor on this', 'me@example.test')",
          [closed, bystander.id],
        ),
      ),
      PERMISSION_DENIED,
    );
    await expectSqlState(
      as(founder, (tx) =>
        tx.query(
          "INSERT INTO public.pitch_interests (pitch_id, user_id, offering, message, contact) VALUES ($1, $2, 'mentorship', 'Talking to myself here', 'me@example.test')",
          [pitchId, founder.id],
        ),
      ),
      PERMISSION_DENIED,
    );
  });

  it("keep feedback the founder cannot delete", async () => {
    const [{ id }] = await rowsAs<{ id: string }>(
      bystander,
      "INSERT INTO public.pitch_feedback (pitch_id, user_id, kind, body) VALUES ($1, $2, 'concern', 'The voice is too quiet') RETURNING id",
      [pitchId, bystander.id],
    );
    expect(await peek("SELECT feedback_count FROM public.pitches WHERE id = $1", [pitchId])).toEqual([{ feedback_count: 1 }]);
    await expectDenied(as(founder, (tx) => tx.query("DELETE FROM public.pitch_feedback WHERE id = $1", [id])));
    await expectSqlState(
      as(bystander, (tx) => tx.query("UPDATE public.pitch_feedback SET pitch_id = $2 WHERE id = $1", [id, pitchId])),
      PERMISSION_DENIED,
    );
  });
});

// ROLES -----------------------------------------------------------------

describe("roles", () => {
  let member: Member;
  let other: Member;

  beforeAll(async () => {
    member = await newMember();
    other = await newMember();
  });

  it("are visible to their holder, not to other members", async () => {
    expect(await rowsAs(member, "SELECT role FROM public.user_roles WHERE user_id = $1", [member.id])).toEqual([{ role: "volunteer" }]);
    await expectDenied(as(member, (tx) => tx.query("SELECT * FROM public.user_roles WHERE user_id = $1", [other.id])));
  });

  it("cannot be self-granted", async () => {
    for (const role of ["admin", "moderator"]) {
      await expectSqlState(
        as(member, (tx) => tx.query("INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2::public.app_role)", [member.id, role])),
        PERMISSION_DENIED,
      );
    }
    await expectSqlState(
      as(member, (tx) => tx.query("UPDATE public.user_roles SET role = 'admin' WHERE user_id = $1", [member.id])),
      PERMISSION_DENIED,
    );
    expect(await rowsAs(member, "SELECT public.is_admin() AS admin")).toEqual([{ admin: false }]);
  });

  it("cannot be looked up for another member", async () => {
    await expectSqlState(
      as(member, (tx) => tx.query("SELECT public.has_role($1, 'person_with_disability')", [other.id])),
      PERMISSION_DENIED,
    );
  });

  it("can be granted by an admin who has used their second factor", async () => {
    const admin = await newMember({ mfa: true });
    await grantRole(db, admin.id, "admin");
    await rowsAs(admin, "INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'moderator')", [other.id]);
    expect(await rowsAs(other, "SELECT public.is_moderator() AS moderator")).toEqual([{ moderator: true }]);
    // A moderator sees everyone's roles, to act on them.
    const seen = await rowsAs(other, "SELECT role FROM public.user_roles WHERE user_id = $1", [member.id]);
    expect(seen).toEqual([{ role: "volunteer" }]);
  });
});

// OTHER PRIVATE RECORDS -------------------------------------------------

describe("a member who is not an admin", () => {
  it("cannot read or clear the newsletter list or contact messages", async () => {
    const member = await newMember();
    await rowsAs(member, "SELECT public.subscribe_to_newsletter('member.list@example.test')");
    await rowsAs(member, "SELECT public.send_contact_message('Member', 'member.contact@example.test', '', 'A message from a member')");
    expect(await count("newsletter_subscribers", "email = 'member.list@example.test'")).toBe(1);

    for (const table of ["newsletter_subscribers", "contact_messages"]) {
      await expectDenied(as(member, (tx) => tx.query(`SELECT * FROM public.${table}`)));
      await expectDenied(as(member, (tx) => tx.query(`DELETE FROM public.${table}`)));
    }
    // Signed in without a second factor to pass, the message is filed under
    // the account for context in a reply.
    expect(await peek("SELECT user_id FROM public.contact_messages WHERE email = 'member.contact@example.test'")).toEqual([
      { user_id: member.id },
    ]);
  });

  it("sees a job application only as its applicant or the job's poster", async () => {
    const poster = await newMember();
    const applicant = await newMember();
    const bystander = await newMember();
    const [{ id: jobId }] = await rowsAs<{ id: string }>(
      poster,
      "INSERT INTO public.jobs (user_id, title, company, description) VALUES ($1, 'Accessibility tester', 'Acme', 'Test with a screen reader') RETURNING id",
      [poster.id],
    );
    const [{ id: otherJob }] = await rowsAs<{ id: string }>(
      bystander,
      "INSERT INTO public.jobs (user_id, title, company, description) VALUES ($1, 'Another job', 'Other', 'Something else') RETURNING id",
      [bystander.id],
    );
    const [{ id }] = await rowsAs<{ id: string }>(
      applicant,
      "INSERT INTO public.job_applications (job_id, user_id, cover_note) VALUES ($1, $2, 'I use JAWS daily') RETURNING id",
      [jobId, applicant.id],
    );

    expect(await rowsAs(applicant, "SELECT cover_note FROM public.job_applications WHERE id = $1", [id])).toHaveLength(1);
    expect(await rowsAs(poster, "SELECT cover_note FROM public.job_applications WHERE id = $1", [id])).toHaveLength(1);
    await expectDenied(as(bystander, (tx) => tx.query("SELECT * FROM public.job_applications WHERE id = $1", [id])));
    // An application stays with the job it was written for.
    await expectSqlState(
      as(applicant, (tx) => tx.query("UPDATE public.job_applications SET job_id = $2 WHERE id = $1", [id, otherJob])),
      PERMISSION_DENIED,
    );
    await expectSqlState(
      as(poster, (tx) => tx.query("UPDATE public.jobs SET created_at = '2999-01-01' WHERE id = $1", [jobId])),
      PERMISSION_DENIED,
    );
    await expectSqlState(
      as(poster, (tx) => tx.query("UPDATE public.jobs SET apply_url = 'javascript:alert(1)' WHERE id = $1", [jobId])),
      CHECK_VIOLATION,
    );
  });
});

// PROFILES --------------------------------------------------------------

describe("a new member's profile", () => {
  it("has an empty display name, not the email address, when none was given", async () => {
    const member = await newMember({ email: "private.person@example.test" });
    expect(await peek("SELECT display_name FROM public.profiles WHERE user_id = $1", [member.id])).toEqual([{ display_name: "" }]);
  });

  it("uses the name given at signup, trimmed", async () => {
    const member = await newMember({ meta: { full_name: "  Priya Sharma " } });
    const oauth = await newMember({ meta: { name: "Kofi Mensah" } });
    expect(await peek("SELECT display_name FROM public.profiles WHERE user_id = $1", [member.id])).toEqual([{ display_name: "Priya Sharma" }]);
    expect(await peek("SELECT display_name FROM public.profiles WHERE user_id = $1", [oauth.id])).toEqual([{ display_name: "Kofi Mensah" }]);
  });

  it("drops a name that is only the email address", async () => {
    const member = await newMember({ email: "same.as.name@example.test", meta: { full_name: "Same.As.Name@example.test" } });
    expect(await peek("SELECT display_name FROM public.profiles WHERE user_id = $1", [member.id])).toEqual([{ display_name: "" }]);
  });

  it("can only be changed by its owner, and not its timestamps", async () => {
    const member = await newMember();
    const other = await newMember();
    await rowsAs(member, "UPDATE public.profiles SET display_name = 'Jo' WHERE user_id = $1", [member.id]);
    await expectDenied(as(other, (tx) => tx.query("UPDATE public.profiles SET display_name = 'Not Jo' WHERE user_id = $1", [member.id])));
    await expectSqlState(
      as(member, (tx) => tx.query("UPDATE public.profiles SET created_at = '2000-01-01' WHERE user_id = $1", [member.id])),
      PERMISSION_DENIED,
    );
    await expectSqlState(
      as(member, (tx) => tx.query("UPDATE public.profiles SET avatar_url = 'javascript:alert(1)' WHERE user_id = $1", [member.id])),
      CHECK_VIOLATION,
    );
  });
});

describe("upgrading a live database", () => {
  it("blanks display names that were set to the email address", async () => {
    // Rebuild the live state (the migrations before the hardening), sign up
    // under the old trigger, then apply the rest as `supabase db push` would.
    const live = await PGlite.create();
    try {
      await live.exec(SUPABASE_SHIM);
      const migrations = listMigrations();
      const cutoff = migrations.findIndex((migration) => migration.file.startsWith("20260927080000"));
      expect(cutoff).toBeGreaterThan(0);
      for (const migration of migrations.slice(0, cutoff)) await applyMigration(live, migration);

      const leaked = await createUser(live, { email: "Leaked.Address@example.test" });
      const named = await createUser(live, { email: "named@example.test", meta: { full_name: "Ana Lima" } });
      const before = await live.query<{ display_name: string }>("SELECT display_name FROM public.profiles WHERE user_id = $1", [leaked]);
      expect(before.rows).toEqual([{ display_name: "Leaked.Address@example.test" }]);

      for (const migration of migrations.slice(cutoff)) await applyMigration(live, migration);

      const after = await live.query<{ user_id: string; display_name: string }>(
        "SELECT user_id, display_name FROM public.profiles WHERE user_id IN ($1, $2) ORDER BY display_name",
        [leaked, named],
      );
      expect(after.rows).toEqual([
        { user_id: leaked, display_name: "" },
        { user_id: named, display_name: "Ana Lima" },
      ]);
    } finally {
      await live.close();
    }
  }, 60_000);
});

// PROBLEM MEDIA ---------------------------------------------------------

describe("media attached to a problem", () => {
  let author: Member;
  let other: Member;
  let problemId: string;

  beforeAll(async () => {
    author = await newMember();
    other = await newMember();
    problemId = await newProblem(author);
  });

  const insertMedia = (member: Member, fields: { problem: string; path: string; kind?: string; mime?: string; description?: string }) =>
    as(member, (tx) =>
      tx.query(
        `INSERT INTO public.problem_media (problem_id, user_id, kind, storage_path, file_name, mime_type, size_bytes, description)
         VALUES ($1, $2, $3::public.media_kind, $4, 'file', $5, 1024, $6) RETURNING id`,
        [fields.problem, member.id, fields.kind ?? "image", fields.path, fields.mime ?? "image/png", fields.description ?? "A ramp too steep to use"],
      ),
    );

  it("can be added by the problem's author from their own folder", async () => {
    const { rows } = await insertMedia(author, { problem: problemId, path: `${author.id}/${problemId}/x.png` });
    expect(rows).toHaveLength(1);
    expect(await rowsAsAnon("SELECT storage_path FROM public.problem_media WHERE problem_id = $1", [problemId])).toEqual([
      { storage_path: `${author.id}/${problemId}/x.png` },
    ]);
  });

  it("cannot be attached to someone else's problem", async () => {
    await expectSqlState(insertMedia(other, { problem: problemId, path: `${other.id}/${problemId}/y.png` }), PERMISSION_DENIED);
  });

  it("cannot point at a file in someone else's folder", async () => {
    await expectSqlState(insertMedia(author, { problem: problemId, path: `${other.id}/${problemId}/z.png` }), PERMISSION_DENIED);
    const elsewhere = await newProblem(author);
    await expectSqlState(insertMedia(author, { problem: problemId, path: `${author.id}/${elsewhere}/z.png` }), PERMISSION_DENIED);
  });

  it("needs a description for images and video, not for PDFs", async () => {
    await expectSqlState(
      insertMedia(author, { problem: problemId, path: `${author.id}/${problemId}/blank.png`, description: "   " }),
      CHECK_VIOLATION,
    );
    await expectSqlState(
      insertMedia(author, { problem: problemId, path: `${author.id}/${problemId}/blank.mp4`, kind: "video", mime: "video/mp4", description: "" }),
      CHECK_VIOLATION,
    );
    const { rows } = await insertMedia(author, {
      problem: problemId,
      path: `${author.id}/${problemId}/report.pdf`,
      kind: "document",
      mime: "application/pdf",
      description: "",
    });
    expect(rows).toHaveLength(1);
  });

  it("refuses SVG and mismatched types", async () => {
    await expectSqlState(
      insertMedia(author, { problem: problemId, path: `${author.id}/${problemId}/icon.svg`, mime: "image/svg+xml" }),
      CHECK_VIOLATION,
    );
    await expectSqlState(
      insertMedia(author, { problem: problemId, path: `${author.id}/${problemId}/clip.png`, kind: "video", mime: "image/png" }),
      CHECK_VIOLATION,
    );
  });

  it("stops at 20 files per problem", async () => {
    const full = await newProblem(author);
    await as(author, async (tx) => {
      for (let i = 1; i <= 20; i += 1) {
        await tx.query(
          `INSERT INTO public.problem_media (problem_id, user_id, kind, storage_path, file_name, mime_type, size_bytes, description)
           VALUES ($1, $2, 'image', $3, 'file', 'image/png', 1024, 'Photo')`,
          [full, author.id, `${author.id}/${full}/${i}.png`],
        );
      }
    });
    await expectSqlState(insertMedia(author, { problem: full, path: `${author.id}/${full}/21.png` }), CHECK_VIOLATION);
    expect(await count("problem_media", "problem_id = $1", [full])).toBe(20);
  });

  it("cannot be moved or re-typed after upload, only re-described", async () => {
    const [{ id }] = (await insertMedia(author, { problem: problemId, path: `${author.id}/${problemId}/edit.png` })).rows as Array<{ id: string }>;
    await expectSqlState(
      as(author, (tx) => tx.query("UPDATE public.problem_media SET storage_path = $2 WHERE id = $1", [id, `${other.id}/${problemId}/edit.png`])),
      PERMISSION_DENIED,
    );
    const rows = await rowsAs(author, "UPDATE public.problem_media SET description = 'Clearer text' WHERE id = $1 RETURNING description", [id]);
    expect(rows).toEqual([{ description: "Clearer text" }]);
    await expectDenied(as(other, (tx) => tx.query("UPDATE public.problem_media SET description = 'Vandalised' WHERE id = $1", [id])));
    await expectDenied(as(other, (tx) => tx.query("DELETE FROM public.problem_media WHERE id = $1", [id])));
  });

  describe("in Storage", () => {
    const upload = (member: Member, path: string, options: UserSessionOptions = {}) =>
      as(
        member,
        (tx) => tx.query("INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('problem-media', $1, auth.uid()) RETURNING id", [path]),
        options,
      );

    it("accepts uploads into the author's folder for their own problem", async () => {
      const { rows } = await upload(author, `${author.id}/${problemId}/photo.png`);
      expect(rows).toHaveLength(1);
    });

    it("refuses uploads into someone else's folder or for someone else's problem", async () => {
      await expectSqlState(upload(other, `${author.id}/${problemId}/intruder.png`), PERMISSION_DENIED);
      await expectSqlState(upload(other, `${other.id}/${problemId}/intruder.png`), PERMISSION_DENIED);
      // Not attached to any problem: free file hosting.
      await expectSqlState(upload(other, `${other.id}/loose.png`), PERMISSION_DENIED);
      await expectSqlState(upload(other, `${other.id}/not-a-problem/loose.png`), PERMISSION_DENIED);
      await expectSqlState(
        asAnon(db, (tx) => tx.query("INSERT INTO storage.objects (bucket_id, name) VALUES ('problem-media', $1)", [`${author.id}/${problemId}/anon.png`])),
        PERMISSION_DENIED,
      );
    });

    it("lets only the uploader remove a file", async () => {
      const path = `${author.id}/${problemId}/remove-me.png`;
      await upload(author, path);
      await expectDenied(as(other, (tx) => tx.query("DELETE FROM storage.objects WHERE name = $1", [path])));
      const removed = await rowsAs(author, "DELETE FROM storage.objects WHERE name = $1 RETURNING name", [path]);
      expect(removed).toEqual([{ name: path }]);
    });
  });
});

// COMPANION -------------------------------------------------------------

describe("companion routines", () => {
  let owner: Member;
  let other: Member;
  let routineId: string;

  beforeAll(async () => {
    owner = await newMember();
    other = await newMember();
    routineId = await newRoutine(owner);
  });

  it("are private to their owner", async () => {
    await rowsAs(owner, "INSERT INTO public.companion_completions (routine_id, user_id, completed_on) VALUES ($1, $2, current_date)", [
      routineId,
      owner.id,
    ]);
    expect(await rowsAs(owner, "SELECT id FROM public.companion_routines WHERE id = $1", [routineId])).toHaveLength(1);
    expect(await rowsAs(owner, "SELECT routine_id FROM public.companion_completions WHERE routine_id = $1", [routineId])).toHaveLength(1);

    await expectDenied(as(other, (tx) => tx.query("SELECT * FROM public.companion_routines WHERE id = $1", [routineId])));
    await expectDenied(as(other, (tx) => tx.query("SELECT * FROM public.companion_completions WHERE routine_id = $1", [routineId])));
    await expectDenied(as(other, (tx) => tx.query("UPDATE public.companion_routines SET title = 'Changed' WHERE id = $1", [routineId])));
    await expectDenied(as(other, (tx) => tx.query("DELETE FROM public.companion_routines WHERE id = $1", [routineId])));
  });

  it("cannot be ticked off for someone else", async () => {
    await expectSqlState(
      as(other, (tx) =>
        tx.query("INSERT INTO public.companion_completions (routine_id, user_id, completed_on) VALUES ($1, $2, current_date - 1)", [
          routineId,
          other.id,
        ]),
      ),
      PERMISSION_DENIED,
    );
    await expectSqlState(
      as(other, (tx) =>
        tx.query("INSERT INTO public.companion_completions (routine_id, user_id, completed_on) VALUES ($1, $2, current_date - 1)", [
          routineId,
          owner.id,
        ]),
      ),
      PERMISSION_DENIED,
    );
  });

  it("can be ticked off for a recent day only", async () => {
    await rowsAs(owner, "INSERT INTO public.companion_completions (routine_id, user_id, completed_on) VALUES ($1, $2, current_date - 7)", [
      routineId,
      owner.id,
    ]);
    for (const day of ["current_date - 30", "current_date - 8", "current_date + 2"]) {
      await expectSqlState(
        as(owner, (tx) =>
          tx.query(`INSERT INTO public.companion_completions (routine_id, user_id, completed_on) VALUES ($1, $2, ${day})`, [routineId, owner.id]),
        ),
        PERMISSION_DENIED,
      );
    }
  });
});

// TWO-FACTOR ------------------------------------------------------------

describe("a member with two-factor authentication turned on", () => {
  let enrolled: Member;
  let plain: Member;
  let postId: string;

  const aal1: UserSessionOptions = { aal: "aal1" };
  const aal2: UserSessionOptions = { aal: "aal2" };

  beforeAll(async () => {
    enrolled = await newMember({ mfa: true });
    plain = await newMember();
    [{ id: postId }] = await rowsAs<{ id: string }>(plain, "INSERT INTO public.posts (user_id, body) VALUES ($1, 'A post to read') RETURNING id", [
      plain.id,
    ]);
    await newProblem(plain);
    // Rows of the enrolled member's own, so "cannot read" below is hiding
    // something rather than finding an empty table.
    await newRoutine(enrolled);
  });

  describe("with only a password (aal1)", () => {
    it("cannot write posts or problems", async () => {
      await expectSqlState(
        as(enrolled, (tx) => tx.query("INSERT INTO public.posts (user_id, body) VALUES ($1, 'From a stolen password')", [enrolled.id]), aal1),
        PERMISSION_DENIED,
      );
      await expectSqlState(
        as(
          enrolled,
          (tx) =>
            tx.query("INSERT INTO public.problems (user_id, title, description) VALUES ($1, 'From a stolen password', 'Twenty characters or more here')", [
              enrolled.id,
            ]),
          aal1,
        ),
        PERMISSION_DENIED,
      );
      await expectSqlState(
        as(enrolled, (tx) => tx.query("INSERT INTO public.post_likes (post_id, user_id) VALUES ($1, $2)", [postId, enrolled.id]), aal1),
        PERMISSION_DENIED,
      );
    });

    it("cannot read what only members can, their own rows included", async () => {
      for (const table of ["posts", "profiles", "user_roles", "companion_routines"]) {
        expect((await rowsAs(enrolled, `SELECT * FROM public.${table}`, [], aal2)).length, `${table} at aal2`).toBeGreaterThan(0);
        await expectDenied(as(enrolled, (tx) => tx.query(`SELECT * FROM public.${table}`), aal1));
      }
    });

    it("can still read what a visitor can", async () => {
      const problems = await rowsAs(enrolled, "SELECT id FROM public.problems", [], aal1);
      expect(problems.length).toBeGreaterThan(0);
      const jobs = await rowsAs(enrolled, "SELECT id FROM public.jobs", [], aal1);
      const anonJobs = await rowsAsAnon("SELECT id FROM public.jobs");
      expect(jobs.length).toBe(anonJobs.length);
    });

    it("cannot act on their own existing rows", async () => {
      const [{ id }] = await rowsAs<{ id: string }>(
        enrolled,
        "INSERT INTO public.posts (user_id, body) VALUES ($1, 'Written with the second factor') RETURNING id",
        [enrolled.id],
        aal2,
      );
      await expectDenied(as(enrolled, (tx) => tx.query("UPDATE public.posts SET body = 'Changed' WHERE id = $1", [id]), aal1));
      await expectDenied(as(enrolled, (tx) => tx.query("DELETE FROM public.posts WHERE id = $1", [id]), aal1));
      expect(await count("posts", "id = $1 AND body = 'Written with the second factor'", [id])).toBe(1);
    });

    it("cannot upload media", async () => {
      const problem = await newProblem(enrolled);
      await expectSqlState(
        as(
          enrolled,
          (tx) => tx.query("INSERT INTO storage.objects (bucket_id, name) VALUES ('problem-media', $1)", [`${enrolled.id}/${problem}/a.png`]),
          aal1,
        ),
        PERMISSION_DENIED,
      );
    });

    it("sends a contact message as a visitor would, not as the account", async () => {
      await rowsAs(enrolled, "SELECT public.send_contact_message('Owner', 'aal1@example.test', '', 'Please turn off my two-factor')", [], aal1);
      await rowsAs(enrolled, "SELECT public.send_contact_message('Owner', 'aal2@example.test', '', 'A message sent after the code')", [], aal2);
      expect(await peek("SELECT email, user_id FROM public.contact_messages WHERE email LIKE 'aal_@example.test' ORDER BY email")).toEqual([
        { email: "aal1@example.test", user_id: null },
        { email: "aal2@example.test", user_id: enrolled.id },
      ]);
    });

    it("has no admin powers, even as an admin", async () => {
      const admin = await newMember({ mfa: true });
      await grantRole(db, admin.id, "admin");
      expect(await rowsAs(admin, "SELECT public.is_admin() AS admin, public.is_moderator() AS moderator", [], aal1)).toEqual([
        { admin: false, moderator: false },
      ]);
      expect(await rowsAs(admin, "SELECT public.is_admin() AS admin, public.is_moderator() AS moderator", [], aal2)).toEqual([
        { admin: true, moderator: true },
      ]);
      for (const table of ["contact_messages", "newsletter_subscribers"]) {
        await expectDenied(as(admin, (tx) => tx.query(`SELECT * FROM public.${table}`), aal1));
        expect((await rowsAs(admin, `SELECT id FROM public.${table}`, [], aal2)).length, `${table} at aal2`).toBeGreaterThan(0);
      }
      await expectSqlState(
        as(admin, (tx) => tx.query("INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'moderator')", [plain.id]), aal1),
        PERMISSION_DENIED,
      );
    });
  });

  describe("after using the second factor (aal2)", () => {
    it("can write and read as a member", async () => {
      const posted = await rowsAs(enrolled, "INSERT INTO public.posts (user_id, body) VALUES ($1, 'With the code') RETURNING id", [enrolled.id], aal2);
      expect(posted).toHaveLength(1);
      await newProblem({ id: enrolled.id, session: aal2 });
      expect((await rowsAs(enrolled, "SELECT id FROM public.posts", [], aal2)).length).toBeGreaterThan(0);
      expect((await rowsAs(enrolled, "SELECT user_id FROM public.profiles", [], aal2)).length).toBeGreaterThan(0);
    });
  });

  it("does not change anything for a member without a verified factor", async () => {
    // A factor that was started but never confirmed does not count.
    const started = await newMember();
    await db.query("INSERT INTO auth.mfa_factors (user_id, factor_type, status) VALUES ($1, 'totp', 'unverified')", [started.id]);
    for (const member of [plain, started]) {
      const posted = await rowsAs(member, "INSERT INTO public.posts (user_id, body) VALUES ($1, 'Password only') RETURNING id", [member.id], aal1);
      expect(posted).toHaveLength(1);
      await newProblem({ id: member.id, session: aal1 });
      expect((await rowsAs(member, "SELECT id FROM public.posts", [], aal1)).length).toBeGreaterThan(0);
      expect((await rowsAs(member, "SELECT user_id FROM public.profiles", [], aal1)).length).toBeGreaterThan(0);
    }
  });
});

// DUPLICATE SEARCH ------------------------------------------------------

describe("search_problems", () => {
  let existing: string;

  beforeAll(async () => {
    const author = await newMember();
    existing = await newProblem(
      author,
      "Screen reader skips form error messages",
      "When a form fails validation the errors appear visually but are never announced.",
    );
  });

  it("finds a near-duplicate when the new title has extra words", async () => {
    const rows = await rowsAsAnon<{ id: string }>("SELECT id FROM public.search_problems($1, 10)", [
      "My screen reader never announces the error messages on my bank's checkout forms",
    ]);
    expect(rows.map((row) => row.id)).toContain(existing);
  });

  it("ranks the closest match first", async () => {
    const rows = await rowsAsAnon<{ id: string }>("SELECT id FROM public.search_problems($1, 10)", [
      "screen reader skips form error messages",
    ]);
    expect(rows[0]?.id).toBe(existing);
  });

  it("returns nothing for a query of only stop words, or none at all", async () => {
    expect(await rowsAsAnon("SELECT id FROM public.search_problems($1, 10)", ["the and of"])).toEqual([]);
    expect(await rowsAsAnon("SELECT id FROM public.search_problems($1, 10)", [null])).toEqual([]);
  });
});
