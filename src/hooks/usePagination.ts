"use client";

import { useMemo, useState } from "react";

/**
 * Client-side pagination for tables that already hold the full filtered list.
 * The page is clamped when the data shrinks, so deleting rows never leaves the
 * table on a blank page.
 */
export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  return { page: currentPage, setPage, totalPages, pageItems };
}
