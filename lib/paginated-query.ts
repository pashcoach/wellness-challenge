type PageResult<T> = {
  data: T[] | null;
  error: unknown;
  count: number | null;
};

/** Each fresh query must request count: "exact" and a unique, stable ordering. */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  let total: number | undefined;
  do {
    const result = await fetchPage(rows.length, rows.length + 999);
    if (result.error) throw result.error;
    if (!Array.isArray(result.data) || result.count === null ||
        !Number.isSafeInteger(result.count) || result.count < 0) {
      throw new Error("Incomplete reporting data. Please retry loading the report.");
    }
    if (total !== undefined && result.count !== total) {
      throw new Error("Reporting data changed while loading. Please retry loading the report.");
    }
    total = result.count;
    if ((result.data.length === 0 && rows.length < total) ||
        rows.length + result.data.length > total) {
      throw new Error("Incomplete reporting data. Please retry loading the report.");
    }
    // Advance by the rows actually returned, even if the server cap is lower.
    rows.push(...result.data);
  } while (rows.length < total);
  return rows;
}
