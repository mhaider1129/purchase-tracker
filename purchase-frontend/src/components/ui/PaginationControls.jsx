const getPageItems = (currentPage, totalPages, siblingCount = 1) => {
  if (totalPages <= 0) return [];

  const pages = new Set([1, totalPages]);
  const start = Math.max(1, currentPage - siblingCount);
  const end = Math.min(totalPages, currentPage + siblingCount);

  for (let page = start; page <= end; page += 1) {
    pages.add(page);
  }

  const sortedPages = [...pages].sort((a, b) => a - b);

  return sortedPages.reduce((items, page, index) => {
    const previousPage = sortedPages[index - 1];

    if (previousPage && page - previousPage > 1) {
      items.push(`ellipsis-${previousPage}-${page}`);
    }

    items.push(page);
    return items;
  }, []);
};

const defaultButtonClassName =
  'rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800';

const activeButtonClassName =
  'border-blue-600 bg-blue-600 text-white hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-600';

const PaginationControls = ({
  currentPage,
  totalPages,
  onPageChange,
  previousLabel = 'Prev',
  nextLabel = 'Next',
  pageSelectLabel = 'Go to page',
  className = '',
  summary,
  buttonClassName = defaultButtonClassName,
  showPageSelect = true,
}) => {
  if (totalPages <= 1) return null;

  const normalizedCurrentPage = Math.min(Math.max(Number(currentPage) || 1, 1), totalPages);
  const goToPage = (page) => {
    const nextPage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
    if (nextPage !== normalizedCurrentPage) {
      onPageChange(nextPage);
    }
  };
  const pageItems = getPageItems(normalizedCurrentPage, totalPages);
  const pageOptions = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <nav
      className={`flex flex-wrap items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-300 ${className}`}
      aria-label="Pagination"
    >
      {summary && <span className="mr-1 text-gray-600 dark:text-gray-300">{summary}</span>}
      <button
        type="button"
        onClick={() => goToPage(normalizedCurrentPage - 1)}
        disabled={normalizedCurrentPage === 1}
        className={buttonClassName}
      >
        {previousLabel}
      </button>

      <div className="flex flex-wrap items-center justify-center gap-1" aria-label="Page numbers">
        {pageItems.map((item) => {
          if (typeof item === 'string') {
            return (
              <span key={item} className="px-2 text-gray-400" aria-hidden="true">
                …
              </span>
            );
          }

          const isActive = item === normalizedCurrentPage;

          return (
            <button
              key={item}
              type="button"
              onClick={() => goToPage(item)}
              aria-current={isActive ? 'page' : undefined}
              className={`${buttonClassName} ${isActive ? activeButtonClassName : ''}`}
            >
              {item}
            </button>
          );
        })}
      </div>

      {showPageSelect && (
        <label className="flex items-center gap-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
          <span>{pageSelectLabel}</span>
          <select
            value={normalizedCurrentPage}
            onChange={(event) => goToPage(event.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            {pageOptions.map((page) => (
              <option key={page} value={page}>
                {page}
              </option>
            ))}
          </select>
        </label>
      )}

      <button
        type="button"
        onClick={() => goToPage(normalizedCurrentPage + 1)}
        disabled={normalizedCurrentPage === totalPages}
        className={buttonClassName}
      >
        {nextLabel}
      </button>
    </nav>
  );
};

export default PaginationControls;