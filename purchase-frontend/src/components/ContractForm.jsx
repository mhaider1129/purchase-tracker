import React from "react";

const ContractForm = ({
  formState,
  handleInputChange,
  handleSubmit,
  saving,
  editingId,
  handleArchive,
  archivingId,
  formError,
  successMessage,
  statusOptions,
  departments,
  departmentsLoading,
  departmentsError,
  users,
  usersLoading,
  usersError,
  suppliers,
  suppliersLoading,
  suppliersError,
}) => {
  return (
    <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="title"
          >
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
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="vendor"
          >
            Vendor
          </label>
          <input
            id="vendor"
            name="vendor"
            type="text"
            value={formState.vendor}
            onChange={handleInputChange}
            required
            list="supplier-suggestions"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Start typing to reuse an existing supplier or enter a new vendor name.
          </p>
          <datalist id="supplier-suggestions">
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.name}>
                {supplier.name}
              </option>
            ))}
          </datalist>
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="supplier_id"
          >
            Supplier record (optional)
          </label>
          <select
            id="supplier_id"
            name="supplier_id"
            value={formState.supplier_id}
            onChange={handleInputChange}
            disabled={suppliersLoading}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-900 dark:disabled:text-gray-500"
          >
            <option value="">No linked supplier selected</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={String(supplier.id)}>
                {supplier.name}
              </option>
            ))}
          </select>
          {suppliersLoading && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Loading suppliers…</p>
          )}
          {suppliersError && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{suppliersError}</p>
          )}
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
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="source_request_id"
          >
            Source request ID
          </label>
          <input
            id="source_request_id"
            name="source_request_id"
            type="number"
            min="1"
            value={formState.source_request_id}
            onChange={handleInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            placeholder="Link the originating request"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Linking a contract to its originating request keeps the lifecycle connected and auditable.
          </p>
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="start_date"
          >
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
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="end_date"
          >
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
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="status"
          >
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
              .filter((option) => option.value !== "all")
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="end_user_department_id"
          >
            End user department
          </label>
          <select
            id="end_user_department_id"
            name="end_user_department_id"
            value={formState.end_user_department_id}
            onChange={handleInputChange}
            disabled={departmentsLoading}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-900 dark:disabled:text-gray-500"
          >
            <option value="">
              {departmentsLoading
                ? "Loading departments..."
                : "No department (send to CMO/COO)"}
            </option>
            {departments.map((department) => (
              <option key={department.id} value={String(department.id)}>
                {department.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            If no department is selected, stakeholder and risk evaluations will
            be routed to the CMO/COO.
          </p>
          {departmentsError && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {departmentsError}
            </p>
          )}
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="contract_manager_id"
          >
            Contract manager
          </label>
          {users.length > 0 ? (
            <select
              id="contract_manager_id"
              name="contract_manager_id"
              value={formState.contract_manager_id}
              onChange={handleInputChange}
              disabled={usersLoading}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-900 dark:disabled:text-gray-500"
            >
              <option value="">No contract manager assigned</option>
              {users.map((user) => (
                <option key={user.id} value={String(user.id)}>
                  {user.name || user.email || `User #${user.id}`} (
                  {(user.role || "").toUpperCase() || "Unknown"})
                </option>
              ))}
            </select>
          ) : (
            <input
              id="contract_manager_id"
              name="contract_manager_id"
              type="number"
              min="1"
              value={formState.contract_manager_id}
              onChange={handleInputChange}
              placeholder="Enter user ID"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          )}
          {usersLoading && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Loading users…
            </p>
          )}
          {usersError && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {usersError}
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="technical_department_ids"
          >
            Technical departments involved
          </label>
          <select
            id="technical_department_ids"
            name="technical_department_ids"
            value={formState.technical_department_ids}
            onChange={handleInputChange}
            multiple
            disabled={departmentsLoading}
            className="h-32 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-900 dark:disabled:text-gray-500"
          >
            {departments.map((department) => (
              <option key={department.id} value={String(department.id)}>
                {department.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Hold Ctrl/⌘ to select multiple departments. Leave empty if no
            technical departments are required.
          </p>
        </div>
        <div className="sm:col-span-2">
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="description"
          >
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
        <div className="sm:col-span-2">
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="delivery_terms"
          >
            Delivery Terms
          </label>
          <textarea
            id="delivery_terms"
            name="delivery_terms"
            rows={4}
            value={formState.delivery_terms}
            onChange={handleInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            placeholder="Specify delivery terms, including shipping, timelines, and responsibilities."
          />
        </div>
        <div className="sm:col-span-2">
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="warranty_terms"
          >
            Warranty Terms
          </label>
          <textarea
            id="warranty_terms"
            name="warranty_terms"
            rows={4}
            value={formState.warranty_terms}
            onChange={handleInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            placeholder="Outline warranty coverage, duration, and claim procedures."
          />
        </div>
        <div className="sm:col-span-2">
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="performance_management"
          >
            Performance Management
          </label>
          <textarea
            id="performance_management"
            name="performance_management"
            rows={4}
            value={formState.performance_management}
            onChange={handleInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            placeholder="Define KPIs, performance metrics, and review processes."
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
          {saving
            ? "Saving..."
            : editingId
              ? "Update contract"
              : "Create contract"}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={() => handleArchive(editingId)}
            disabled={archivingId === editingId}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-60 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
          >
            {archivingId === editingId ? "Archiving..." : "Archive contract"}
          </button>
        )}
      </div>
    </form>
  );
};

export default ContractForm;
