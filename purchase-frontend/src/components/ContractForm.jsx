import React from 'react';

const ContractForm = ({ formState, handleInputChange, handleSubmit, saving, editingId, handleArchive, archivingId, formError, successMessage, statusOptions }) => {
  return (
    <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="title">
            Contract title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            value={formState.title}
            onChange={handleInputChange}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="vendor">
            Vendor
          </label>
          <input
            id="vendor"
            name="vendor"
            type="text"
            value={formState.vendor}
            onChange={handleInputChange}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="reference_number"
          >
            Reference number
          </label>
          <input
            id="reference_number"
            name="reference_number"
            type="text"
            value={formState.reference_number}
            onChange={handleInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="start_date">
            Start date
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            value={formState.start_date}
            onChange={handleInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="end_date">
            End date
          </label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            value={formState.end_date}
            onChange={handleInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="contract_value"
          >
            Contract value
          </label>
          <input
            id="contract_value"
            name="contract_value"
            type="text"
            value={formState.contract_value}
            onChange={handleInputChange}
            placeholder="e.g. 250000"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            value={formState.status}
            onChange={handleInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            {statusOptions
              .filter((option) => option.value !== 'all')
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="description">
            Notes
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            value={formState.description}
            onChange={handleInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            placeholder="Important clauses, renewal reminders, or performance notes"
          />
        </div>
      </div>

      {formError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          {formError}
        </div>
      )}
      {successMessage && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
          {successMessage}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
        >
          {saving ? 'Saving...' : editingId ? 'Update contract' : 'Create contract'}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={() => handleArchive(editingId)}
            disabled={archivingId === editingId}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-60 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
          >
            {archivingId === editingId ? 'Archiving...' : 'Archive contract'}
          </button>
        )}
      </div>
    </form>
  )
};

export default ContractForm;