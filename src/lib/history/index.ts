/**
 * Paginated run queries and the report aggregate.
 *
 * Not implemented yet. Both are read server-side only, scoped by the anon_id
 * cookie — the client must never be able to supply an anon_id.
 *
 * History: offset pagination, 10 rows per page, newest first.
 * Report:  one grouped query over answers joined to this player runs, plus one
 *          ordered query for the trend. Insights are template strings computed
 *          from those numbers, never a model call.
 */

export const HISTORY_PAGE_SIZE = 10;
