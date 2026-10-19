import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fetchAllRows } from "./paginated-query";
import { createClient } from "@supabase/supabase-js";

test("loads all 2233 report rows through the real Supabase query builder, past the 1000-row cap", async () => {
  const rows = Array.from({ length: 2233 }, (_, id) => ({ id, points: 20 }));
  const offsets: number[] = [];
  const client = createClient("https://example.supabase.co", "test-public-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.get("order"), "id.asc");
      assert.match(new Headers(init?.headers).get("prefer") ?? "", /count=exact/);
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 1000), 1000);
      offsets.push(offset);
      const page = rows.slice(offset, offset + limit);
      return new Response(JSON.stringify(page), { status: 206, headers: {
        "content-type": "application/json",
        "content-range": `${offset}-${offset + page.length - 1}/${rows.length}`,
      } });
    } },
  });
  const result = await fetchAllRows((from, to) => client.from("activity_entries")
    .select("id, points", { count: "exact" }).order("id").range(from, to));
  assert.deepEqual(result, rows);
  assert.equal(result.reduce((sum, row) => sum + row.points, 0), 44660);
  assert.deepEqual(offsets, [0, 1000, 2000]);
});

test("rejects malformed or incomplete page results instead of publishing partial totals", async () => {
  for (const badResult of [
    { data: [{ id: 1 }], error: null, count: null },
    { data: null, error: null, count: 0 },
    { data: [], error: null, count: 5 },
    { data: [{ id: 1 }], error: null, count: 0 },
  ]) {
    let calls = 0;
    await assert.rejects(fetchAllRows(async () => {
      if (++calls > 1) throw new Error("unexpected repeated request");
      return badResult;
    }), /Incomplete reporting data/);
  }
});

test("rejects changing row counts so a concurrent change cannot masquerade as a complete report", async () => {
  let calls = 0;
  await assert.rejects(fetchAllRows(async () => ({
    data: [{ id: ++calls }], error: null, count: calls === 1 ? 2 : 3,
  })), /Reporting data changed/);
});

for (const length of [0, 7, 1000, 2000]) {
  test(`loads ${length} rows without an unnecessary out-of-range request`, async () => {
    const rows = Array.from({ length }, (_, id) => ({ id }));
    const offsets: number[] = [];
    const result = await fetchAllRows(async (from, to) => {
      offsets.push(from);
      return { data: rows.slice(from, to + 1), error: null, count: length };
    });
    assert.deepEqual(result, rows);
    assert.deepEqual(offsets, length > 1000 ? [0, 1000] : [0]);
  });
}

test("continues past a server cap smaller than the requested page size", async () => {
  const rows = Array.from({ length: 1554 }, (_, id) => ({ id }));
  const result = await fetchAllRows(async (from) => ({
    data: rows.slice(from, from + 500), error: null, count: rows.length,
  }));
  assert.deepEqual(result, rows);
});

test("propagates a later-page database failure instead of returning the first page", async () => {
  const failure = { code: "42501", message: "permission denied" };
  await assert.rejects(fetchAllRows(async (from) => from === 0
    ? { data: [{ id: 1 }], error: null, count: 2 }
    : { data: null, error: failure, count: null }), (error) => error === failure);
});

test("propagates a thrown network failure", async () => {
  await assert.rejects(fetchAllRows(async () => { throw new Error("Failed to fetch"); }), /Failed to fetch/);
});

test("every full-list admin table read is paginated with a unique ordering key", () => {
  const source = readFileSync("app/admin/page.tsx", "utf8");
  for (const table of ["profiles", "teams", "activity_entries", "wellness_checkins", "survey_responses", "draw_results_view", "support_replies"]) {
    assert.match(source, new RegExp(`fetchAllRows\\([^;]*?from\\("${table}"\\)[^;]*?\\.order\\("id"[^;]*?\\.range\\(from, to\\)`), `${table} must be fetched completely with deterministic ordering`);
  }
  assert.match(source, /setLoadError/);
  assert.match(source, /role="alert"[\s\S]*?could not be loaded/);
  assert.match(source, /onClick=\{\(\) => void load\(\)\}/);
});
