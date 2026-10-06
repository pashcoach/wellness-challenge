import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { fetchAllRows, type PageResult } from "./admin-pagination";

function createPagedQuery<Row>(rows: Row[], failAtOffset?: number) {
  const requestedRanges: Array<[number, number]> = [];
  const error = new Error("page failed");

  return {
    error,
    requestedRanges,
    fetchPage(from: number, to: number): Promise<PageResult<Row, Error>> {
      requestedRanges.push([from, to]);
      if (from === failAtOffset) return Promise.resolve({ data: null, error });
      return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
    },
  };
}

test("fetches a short final page without skipping or duplicating rows", async () => {
  const query = createPagedQuery([0, 1, 2, 3, 4]);

  const result = await fetchAllRows(query.fetchPage, 2);

  assert.deepEqual(result, { data: [0, 1, 2, 3, 4], error: null });
  assert.deepEqual(query.requestedRanges, [[0, 1], [2, 3], [4, 5]]);
});

test("fetches exact multiples of the page size", async (t) => {
  for (const count of [1000, 2000]) {
    await t.test(`${count} rows`, async () => {
      const rows = Array.from({ length: count }, (_, index) => index);
      const query = createPagedQuery(rows);

      const result = await fetchAllRows(query.fetchPage);

      assert.deepEqual(result, { data: rows, error: null });
      assert.deepEqual(query.requestedRanges.at(-1), [count, count + 999]);
    });
  }
});

test("returns an empty result for an empty table", async () => {
  const query = createPagedQuery<number>([]);

  const result = await fetchAllRows(query.fetchPage);

  assert.deepEqual(result, { data: [], error: null });
  assert.deepEqual(query.requestedRanges, [[0, 999]]);
});

test("returns an error instead of partial data when a later page fails", async () => {
  const query = createPagedQuery([0, 1, 2, 3], 2);

  const result = await fetchAllRows(query.fetchPage, 2);

  assert.equal(result.data, null);
  assert.equal(result.error, query.error);
  assert.deepEqual(query.requestedRanges, [[0, 1], [2, 3]]);
});

const adminSource = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");

test("admin activity and check-in reads use stable paginated queries", () => {
  assert.match(
    adminSource,
    /fetchAllRows[\s\S]{0,300}from\("activity_entries"\)[\s\S]{0,200}order\("id", \{ ascending: true \}\)[\s\S]{0,100}range\(from, to\)/,
  );
  assert.match(
    adminSource,
    /fetchAllRows[\s\S]{0,300}from\("wellness_checkins"\)[\s\S]{0,200}order\("id", \{ ascending: true \}\)[\s\S]{0,100}range\(from, to\)/,
  );
});

test("admin load failures block partial stats and CSV export", () => {
  assert.match(adminSource, /Admin data could not be fully loaded; stats and CSV are unavailable\./);
  assert.match(adminSource, /setData\(null\)/);
  assert.match(adminSource, /role="alert"/);
});
