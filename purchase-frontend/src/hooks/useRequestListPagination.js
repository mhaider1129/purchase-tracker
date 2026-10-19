import { useEffect, useState } from "react";

export default function useRequestListPagination(
  items,
  resetKey,
  pageSize = 10,
) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  useEffect(() => setPage(1), [resetKey]);
  useEffect(() => setPage((old) => Math.min(old, totalPages)), [totalPages]);
  const start = (currentPage - 1) * pageSize;
  return {
    currentPage,
    totalPages,
    setPage,
    paginatedItems: items.slice(start, start + pageSize),
  };
}
