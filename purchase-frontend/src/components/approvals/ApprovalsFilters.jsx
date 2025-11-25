import React from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '../ui/Button';

const defaultUrgencyOptions = [
  { value: 'all', label: 'All' },
  { value: 'urgent', label: 'Urgent only' },
  { value: 'non-urgent', label: 'Non-urgent' },
];

const defaultSortOptions = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'costHigh', label: 'Cost: high to low' },
  { value: 'costLow', label: 'Cost: low to high' },
];

const ApprovalsFilters = ({
  searchTerm,
  onSearchChange,
  typeFilter,
  onTypeChange,
  urgencyFilter,
  onUrgencyChange,
  sortOption,
  onSortChange,
  availableRequestTypes = [],
  hasActiveFilters,
  onReset,
  labels = {},
  tabs,
}) => {
  const {
    searchPlaceholder = 'Search by ID, justification, department or section',
    typeLabel = 'Request Type',
    typeAllLabel = 'All types',
    urgencyLabel = 'Urgency',
    sortLabel = 'Sort by',
    resetLabel = 'Reset filters',
  } = labels;

  const urgencyOptions = labels.urgencyOptions || defaultUrgencyOptions;
  const sortOptions = labels.sortOptions || defaultSortOptions;

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {tabs?.options?.length ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {tabs.options.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => tabs.onTabChange?.(tab.value)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                tabs.activeTab === tab.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
              {typeof tab.badge === 'number' && (
                <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <Search className="h-4 w-4 text-slate-500" aria-hidden />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-3 xl:grid-cols-4">
          <label className="flex flex-col text-sm text-slate-600">
            <span className="mb-1 flex items-center gap-1 font-medium">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
              {typeLabel}
            </span>
            <select
              value={typeFilter}
              onChange={(event) => onTypeChange(event.target.value)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{typeAllLabel}</option>
              {availableRequestTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm text-slate-600">
            <span className="mb-1 flex items-center gap-1 font-medium">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
              {urgencyLabel}
            </span>
            <select
              value={urgencyFilter}
              onChange={(event) => onUrgencyChange(event.target.value)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {urgencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm text-slate-600">
            <span className="mb-1 flex items-center gap-1 font-medium">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
              {sortLabel}
            </span>
            <select
              value={sortOption}
              onChange={(event) => onSortChange(event.target.value)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={onReset}>
            {resetLabel}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ApprovalsFilters;