export interface PageResult<Row, QueryError = unknown> {
  data: Row[] | null;
  error: QueryError | null;
}

export type PageFetcher<Row, QueryError = unknown> = (
  from: number,
  to: number,
) => PromiseLike<PageResult<Row, QueryError>>;

export async function fetchAllRows<Row, QueryError = unknown>(
  fetchPage: PageFetcher<Row, QueryError>,
  pageSize = 1000,
): Promise<PageResult<Row, QueryError>> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError("pageSize must be a positive integer");
  }

  const rows: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    const result = await fetchPage(from, from + pageSize - 1);
    if (result.error) return { data: null, error: result.error };

    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}
