// src/pages/requests/StockRequestForm.js

import { useTranslation } from 'react-i18next';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import api from '../../api/axios';
import { useNavigate } from 'react-router-dom';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { buildRequestSubmissionState } from '../../utils/requestSubmission';
import { matchesSearchTokens } from '../../utils/search';
import ProjectSelector from '../../components/projects/ProjectSelector';
import useCurrentUser from '../../hooks/useCurrentUser';
import useRequestDraftAutosave from '../../hooks/useRequestDraftAutosave';
import UrgentRequestToggle from '../../components/requests/UrgentRequestToggle';

const createEmptyItem = (overrides = {}) => ({
  item_name: '',
  stock_item_id: '',
  brand: '',
  category: overrides.category ?? '',
  sub_category: overrides.sub_category ?? '',
  quantity: 1,
  available_quantity: '',
  attachments: [],
});

const hasWarehouseAssignment = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0;
};

const normalizeUploadHeader = (header = '') =>
  String(header)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const pickUploadValue = (row, aliases) => {
  for (const alias of aliases) {
    if (
      row[alias] !== undefined &&
      row[alias] !== null &&
      String(row[alias]).trim() !== ''
    ) {
      return String(row[alias]).trim();
    }
  }
  return '';
};

const parsePositiveQuantity = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.ceil(parsed) : 0;
};

const StockRequestForm = () => {
  const { t } = useTranslation();
  const [itemsList, setItemsList] = useState([]);
  const [selectedItems, setSelectedItems] = useState([createEmptyItem()]);
  const [itemSearchTerms, setItemSearchTerms] = useState(['']);
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [justification, setJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [sectionId, setSectionId] = useState(null);
  const [projectId, setProjectId] = useState('');
  const { user, loading: userLoading, error: userError } = useCurrentUser();
  const [currentUser, setCurrentUser] = useState(null);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState('');
  const [bulkUploadMessage, setBulkUploadMessage] = useState('');
  const [pastedItemsText, setPastedItemsText] = useState('');
  const navigate = useNavigate();
  const categories = useMemo(
    () =>
      Array.from(new Set(itemsList.map((it) => it.category))).filter(Boolean),
    [itemsList]
  );
  const subCategories = useMemo(() => {
    const scopedItems = category
      ? itemsList.filter((it) => it.category === category)
      : itemsList;
    return Array.from(new Set(scopedItems.map((it) => it.sub_category))).filter(
      Boolean
    );
  }, [category, itemsList]);

  const draftData = useMemo(
    () => ({
      category,
      itemSearchTerms,
      justification,
      projectId,
      selectedItems: selectedItems.map(
        ({ attachments: _attachments, ...item }) => item
      ),
      subCategory,
    }),
    [
      category,
      itemSearchTerms,
      justification,
      projectId,
      selectedItems,
      subCategory,
    ]
  );

  const restoreDraft = useCallback((draft) => {
    if (typeof draft?.justification === 'string')
      setJustification(draft.justification);
    if (typeof draft?.projectId === 'string') setProjectId(draft.projectId);
    if (typeof draft?.category === 'string') setCategory(draft.category);
    if (typeof draft?.subCategory === 'string')
      setSubCategory(draft.subCategory);
    if (Array.isArray(draft?.selectedItems) && draft.selectedItems.length > 0) {
      setSelectedItems(
        draft.selectedItems.map((item) => ({
          ...createEmptyItem(),
          ...item,
          attachments: [],
        }))
      );
    }
    if (Array.isArray(draft?.itemSearchTerms)) {
      setItemSearchTerms(draft.itemSearchTerms);
    }
  }, []);

  const {
    clearDraft,
    isSaving: isDraftSaving,
    lastSavedLabel,
    status: draftStatus,
  } = useRequestDraftAutosave({
    storageKey: 'stock_request_draft_v1',
    data: draftData,
    restoreDraft,
  });

  const hasSelectedData = useMemo(
    () =>
      selectedItems.some(
        (it) =>
          it.item_name ||
          it.brand ||
          it.available_quantity ||
          it.quantity !== 1 ||
          (it.attachments && it.attachments.length)
      ),
    [selectedItems]
  );

  const handleCategoryChange = (value) => {
    if (hasSelectedData) {
      const confirmChange = window.confirm(
        t('stockPurchaseRequestForm.alerts.changeCategory')
      );
      if (!confirmChange) {
        return;
      }
      setSelectedItems([createEmptyItem({ category: value })]);
      setItemSearchTerms(['']);
    } else {
      setSelectedItems((items) =>
        items.map((it) => ({ ...it, category: value, sub_category: '' }))
      );
    }
    setCategory(value);
    setSubCategory('');
  };

  const handleSubCategoryChange = (value) => {
    setSubCategory(value);
    setSelectedItems((items) =>
      items.map((it) => ({ ...it, sub_category: value }))
    );
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert(t('stockPurchaseRequestForm.alerts.login'));
      navigate('/login');
    }
  }, [navigate, t]);

  useEffect(() => {
    if (userLoading || !user) {
      return;
    }

    if (!hasWarehouseAssignment(user.warehouse_id)) {
      alert(
        t('stockPurchaseRequestForm.alerts.accessDenied')
      );
      navigate('/');
    }
  }, [navigate, t, user, userLoading]);

  useEffect(() => {
    if (user) {
      setSectionId(user.section_id);
      setCurrentUser(user);
    }
  }, [user]);

  useEffect(() => {
    const fetchItems = async () => {
      setItemsLoading(true);
      setItemsError('');
      try {
        const res = await api.get('/stock-items');
        setItemsList(res.data || []);
      } catch (err) {
        console.error('Failed to load stock items:', err);
        setItemsError(
          err?.response?.data?.message || t('stockPurchaseRequestForm.alerts.catalogFailed')
        );
      } finally {
        setItemsLoading(false);
      }
    };

    fetchItems();
  }, [t]);

  const handleItemChange = (index, field, value) => {
    setSelectedItems((prev) => {
      const updated = [...prev];
      const nextValue = field === 'quantity' ? parseInt(value || 0, 10) : value;
      updated[index] = { ...updated[index], [field]: nextValue };
      return updated;
    });
  };

  const handleSearchTermChange = (index, value) => {
    setItemSearchTerms((terms) => {
      const next = [...terms];
      next[index] = value;
      return next;
    });
  };

  const handleItemSelection = (index, stockItemId) => {
    setSelectedItems((prev) => {
      const updated = [...prev];
      const current = { ...updated[index] };
      if (!stockItemId) {
        updated[index] = {
          ...current,
          stock_item_id: '',
          item_name: '',
          brand: '',
          available_quantity: '',
        };
      } else {
        const matchedItem = itemsList.find(
          (stock) => String(stock.id) === stockItemId
        );
        if (matchedItem) {
          updated[index] = {
            ...current,
            stock_item_id: matchedItem.id,
            item_name: matchedItem.name,
            brand: matchedItem.brand || '',
            available_quantity: matchedItem.available_quantity ?? '',
            category: matchedItem.category || current.category,
            sub_category: matchedItem.sub_category || current.sub_category,
          };
          if (!category && matchedItem.category) {
            setCategory(matchedItem.category);
          }
          if (!subCategory && matchedItem.sub_category) {
            setSubCategory(matchedItem.sub_category);
          }
        }
      }
      return updated;
    });

    setItemSearchTerms((terms) => {
      const next = [...terms];
      next[index] = '';
      return next;
    });
  };

  const handleItemFiles = (index, files) => {
    const updated = [...selectedItems];
    updated[index].attachments = Array.from(files);
    setSelectedItems(updated);
  };

  const findCatalogMatch = useCallback(
    ({ id, name, brand }) => {
      const normalizedName = name.trim().toLowerCase();
      const normalizedBrand = brand.trim().toLowerCase();
      if (id) {
        const byId = itemsList.find(
          (stock) => String(stock.id).trim() === id.trim()
        );
        if (byId) return byId;
      }
      if (!normalizedName) return null;
      return (
        itemsList.find((stock) => {
          const stockName = String(stock.name || '')
            .trim()
            .toLowerCase();
          const stockBrand = String(stock.brand || '')
            .trim()
            .toLowerCase();
          return (
            stockName === normalizedName &&
            (!normalizedBrand || stockBrand === normalizedBrand)
          );
        }) || null
      );
    },
    [itemsList]
  );

  const applyUploadedRows = useCallback(
    (rows) => {
      const importedItems = [];
      const skippedRows = [];
      const unmatchedRows = [];

      rows.forEach((rawRow, index) => {
        const row = Object.entries(rawRow || {}).reduce((acc, [key, value]) => {
          acc[normalizeUploadHeader(key)] = value;
          return acc;
        }, {});
        const id = pickUploadValue(row, ['id', 'item_id', 'stock_item_id']);
        const name = pickUploadValue(row, ['name', 'item_name', 'item']);
        const brand = pickUploadValue(row, ['brand']);
        const availableQuantity = pickUploadValue(row, [
          'available_quantity',
          'available_qty',
          'available',
          'stock_available',
        ]);
        const requestedQuantity = parsePositiveQuantity(
          pickUploadValue(row, [
            'requested_quantity',
            'requested_qty',
            'request_quantity',
            'quantity',
            'qty',
          ])
        );

        if ((!id && !name) || !requestedQuantity) {
          skippedRows.push(index + 2);
          return;
        }

        const matchedItem = findCatalogMatch({ id, name, brand });
        if (!matchedItem) {
          unmatchedRows.push(index + 2);
        }

        importedItems.push({
          ...createEmptyItem({
            category: matchedItem?.category || category,
            sub_category: matchedItem?.sub_category || subCategory,
          }),
          stock_item_id: matchedItem?.id || '',
          item_name: matchedItem?.name || name,
          brand: matchedItem?.brand || brand,
          available_quantity:
            matchedItem?.available_quantity ?? availableQuantity,
          quantity: requestedQuantity,
        });
      });

      if (!importedItems.length) {
        setBulkUploadMessage(
          'No valid rows were found. Include id or name and a requested quantity greater than 0.'
        );
        return;
      }

      setSelectedItems(importedItems);
      setItemSearchTerms(
        importedItems.map((item) => (item.stock_item_id ? '' : item.item_name))
      );

      const firstMatched = importedItems.find(
        (item) => item.category || item.sub_category
      );
      if (firstMatched?.category) setCategory(firstMatched.category);
      if (firstMatched?.sub_category) setSubCategory(firstMatched.sub_category);

      const details = [`Imported ${importedItems.length} item(s).`];
      if (skippedRows.length)
        details.push(`Skipped row(s): ${skippedRows.join(', ')}.`);
      if (unmatchedRows.length) {
        details.push(
          `Review row(s) ${unmatchedRows.join(', ')} because they did not match the stock catalog.`
        );
      }
      setBulkUploadMessage(details.join(' '));
    },
    [category, findCatalogMatch, subCategory]
  );

  const handlePastedItemsImport = () => {
    if (!pastedItemsText.trim()) {
      setBulkUploadMessage(
        'Paste rows copied from Excel before importing. Include a header row with id or name and requested quantity.'
      );
      return;
    }

    setBulkUploadMessage('Reading pasted item rows...');
    Papa.parse(pastedItemsText.trim(), {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors?.length) {
          setBulkUploadMessage(
            result.errors[0]?.message || 'Unable to parse the pasted rows.'
          );
          return;
        }
        applyUploadedRows(result.data || []);
      },
      error: (error) => {
        setBulkUploadMessage(
          error?.message || 'Unable to parse the pasted rows.'
        );
      },
    });
  };

  const handleBulkUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBulkUploadMessage('Reading uploaded item file...');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors?.length) {
          setBulkUploadMessage(
            result.errors[0]?.message || 'Unable to parse the uploaded file.'
          );
          return;
        }
        applyUploadedRows(result.data || []);
      },
      error: (error) => {
        setBulkUploadMessage(
          error?.message || 'Unable to parse the uploaded file.'
        );
      },
    });
    event.target.value = '';
  };

  const addItem = () => {
    setSelectedItems((items) => [
      ...items,
      createEmptyItem({ category, sub_category: subCategory }),
    ]);
    setItemSearchTerms((terms) => [...terms, '']);
  };

  const removeItem = (index) => {
    if (!window.confirm(t('stockPurchaseRequestForm.alerts.removeItem'))) return;
    setSelectedItems((items) => items.filter((_, i) => i !== index));
    setItemSearchTerms((terms) => terms.filter((_, i) => i !== index));
  };

  const duplicateItem = (index) => {
    const clone = {
      ...selectedItems[index],
      attachments: [],
    };
    setSelectedItems((items) => {
      const next = [...items];
      next.splice(index + 1, 0, clone);
      return next;
    });
    setItemSearchTerms((terms) => {
      const next = [...terms];
      next.splice(index + 1, 0, selectedItems[index]?.item_name || '');
      return next;
    });
  };

  const itemsStats = useMemo(() => {
    const totalQuantity = selectedItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );
    const attachmentCount = selectedItems.reduce(
      (sum, item) => sum + (item.attachments?.length || 0),
      0
    );
    return {
      totalQuantity,
      attachmentCount,
      count: selectedItems.length,
    };
  }, [selectedItems]);

  const scopedCatalog = useMemo(
    () =>
      itemsList.filter(
        (stock) =>
          (!category || stock.category === category) &&
          (!subCategory || stock.sub_category === subCategory)
      ),
    [itemsList, category, subCategory]
  );

  const catalogPreview = useMemo(
    () => scopedCatalog.slice(0, 5),
    [scopedCatalog]
  );

  const validateForm = () => {
    if (!justification.trim()) {
      alert(t('stockPurchaseRequestForm.alerts.justificationRequired'));
      return false;
    }

    const hasInvalidItem = selectedItems.some(
      (item) => !item.item_name.trim() || item.quantity < 1
    );

    if (hasInvalidItem) {
      alert(t('stockPurchaseRequestForm.alerts.invalidItems'));
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const formData = new FormData();
    formData.append('request_type', 'Stock');
    formData.append('justification', justification);
    if (sectionId !== null && sectionId !== undefined && sectionId !== '') {
      formData.append('target_section_id', sectionId);
    }
    formData.append('budget_impact_month', '');
    if (projectId) {
      formData.append('project_id', projectId);
    }
    const itemsPayload = selectedItems.map(
      ({ attachments, category, sub_category, ...rest }) => rest
    );
    formData.append('items', JSON.stringify(itemsPayload));
    formData.append('is_urgent', isUrgent ? 'true' : 'false');
    attachments.forEach((file) => formData.append('attachments', file));
    selectedItems.forEach((item, idx) => {
      (item.attachments || []).forEach((file) => {
        formData.append(`item_${idx}`, file);
      });
    });

    try {
      setIsSubmitting(true);
      const res = await api.post('/requests', formData);
      clearDraft();
      const state = buildRequestSubmissionState('Stock', res.data);
      navigate('/request-submitted', { state });
    } catch (err) {
      console.error('❌ Submission error:', err);
      alert(
        err.response?.data?.message ||
          '❌ Failed to submit request. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (userLoading) {
    return (
      <>
        <div className="p-6 text-gray-600 text-center">
          Loading your profile...
        </div>
      </>
    );
  }

  if (userError) {
    return (
      <>
        <div className="p-6 text-red-600 text-center">
          {userError || 'Unable to load your account'}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">
          {t('stockRequestForm.title')}
          <HelpTooltip text={t('stockPurchaseRequestForm.help')} />
        </h1>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 mb-6">
          <p className="font-semibold mb-1">
            Need help preparing a stock request?
          </p>
          <p className="text-xs text-blue-700 mb-2" role="status">
            {isDraftSaving
              ? t('stockPurchaseRequestForm.savingDraft')
              : lastSavedLabel
                ? t('stockPurchaseRequestForm.draftSaved', { time: lastSavedLabel })
                : draftStatus === 'restored'
                  ? 'Draft restored. Continue editing and submit when ready.'
                  : t('stockPurchaseRequestForm.draftActive')}
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Filter items by category to quickly narrow down catalog entries.
            </li>
            <li>
              Selecting a known catalog item will pre-fill its brand and
              available quantity for you.
            </li>
            <li>
              Use the project link when the request is tied to a specific
              initiative.
            </li>
          </ul>
        </div>

        {currentUser && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 border rounded-lg bg-white shadow-sm">
              <p className="text-xs uppercase text-gray-500">{t('stockPurchaseRequestForm.fields.requester')}</p>
              <p className="font-semibold text-gray-900">
                {currentUser.full_name}
              </p>
              <p className="text-sm text-gray-600">{currentUser.role_name}</p>
            </div>
            <div className="p-4 border rounded-lg bg-white shadow-sm">
              <p className="text-xs uppercase text-gray-500">{t('stockPurchaseRequestForm.fields.department')}</p>
              <p className="font-semibold text-gray-900">
                {currentUser.department_name}
              </p>
              <p className="text-sm text-gray-600">
                {t('stockPurchaseRequestForm.section', { section: currentUser.section_name || t('stockPurchaseRequestForm.notAssigned') })}
              </p>
            </div>
            <div className="p-4 border rounded-lg bg-white shadow-sm">
              <p className="text-xs uppercase text-gray-500">{t('stockPurchaseRequestForm.fields.summary')}</p>
              <p className="font-semibold text-gray-900">
                {t('stockPurchaseRequestForm.itemsSummary', { count: itemsStats.count })}
              </p>
              <p className="text-sm text-gray-600">
                {t('stockPurchaseRequestForm.unitsSummary', { quantity: itemsStats.totalQuantity, attachments: itemsStats.attachmentCount })}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block font-semibold mb-1">{t('stockPurchaseRequestForm.fields.justification')}</label>
            <textarea
              className="w-full p-2 border rounded"
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder={t('stockPurchaseRequestForm.fields.justificationPlaceholder')}
              required
              disabled={isSubmitting}
            />
          </div>

          <ProjectSelector
            value={projectId}
            onChange={setProjectId}
            disabled={isSubmitting}
            user={currentUser}
          />

          <div>
            <label className="block font-semibold mb-1">{t('stockPurchaseRequestForm.fields.category')}</label>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="p-2 border rounded"
              disabled={isSubmitting}
            >
              <option value="">{t('stockPurchaseRequestForm.fields.allCategories')}</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1">{t('stockPurchaseRequestForm.fields.subCategory')}</label>
            <select
              value={subCategory}
              onChange={(e) => handleSubCategoryChange(e.target.value)}
              className="p-2 border rounded"
              disabled={isSubmitting || subCategories.length === 0}
            >
              <option value="">{t('stockPurchaseRequestForm.fields.allSubCategories')}</option>
              {subCategories.map((subCat) => (
                <option key={subCat} value={subCat}>
                  {subCat}
                </option>
              ))}
            </select>
          </div>

          {itemsError && (
            <p className="text-sm text-red-600" role="alert">
              {itemsError}
            </p>
          )}
          {itemsLoading && (
            <p className="text-sm text-gray-500">{t('stockPurchaseRequestForm.fields.loadingCatalog')}</p>
          )}

          {!itemsLoading && catalogPreview.length > 0 && (
            <div className="border border-dashed border-gray-300 rounded-lg p-4 text-sm text-gray-700 bg-gray-50">
              <p className="font-semibold mb-2">{t('stockPurchaseRequestForm.fields.catalogPreview')}</p>
              <ul className="space-y-1">
                {catalogPreview.map((stock) => (
                  <li key={stock.id} className="flex justify-between">
                    <span>{stock.name}</span>
                    <span className="text-gray-500">
                      {stock.available_quantity ?? '—'} in stock
                    </span>
                  </li>
                ))}
              </ul>
              {itemsList.length > catalogPreview.length && (
                <p className="text-xs text-gray-500 mt-2">
                  Showing {catalogPreview.length} of {itemsList.length} catalog
                  entries.
                </p>
              )}
            </div>
          )}

          <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-4 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <label
                  className="block font-semibold mb-1"
                  htmlFor="stock-items-upload"
                >
                  Upload items from Excel
                </label>
                <p className="text-sm text-emerald-900">
                  Upload a CSV file exported from Excel with columns: id, name,
                  brand, available quantity, requested quantity. Matching by id
                  is preferred; otherwise the form will match by item name and
                  brand.
                </p>
                <p className="text-xs text-emerald-800 mt-1">
                  Tip: in Excel, choose “Save As” and select CSV before
                  uploading.
                </p>
              </div>
              <input
                id="stock-items-upload"
                type="file"
                accept=".csv,text/csv,application/vnd.ms-excel"
                onChange={handleBulkUpload}
                className="p-2 border rounded bg-white md:w-72"
                disabled={isSubmitting || itemsLoading}
              />
            </div>

            <div className="border-t border-emerald-200 pt-4">
              <label
                className="block font-semibold mb-1"
                htmlFor="stock-items-paste"
              >
                Or copy and paste from Excel
              </label>
              <p className="text-sm text-emerald-900 mb-2">
                Copy rows from Excel and paste them here with the same headers:
                id, name, brand, available quantity, requested quantity.
              </p>
              <textarea
                id="stock-items-paste"
                value={pastedItemsText}
                onChange={(e) => setPastedItemsText(e.target.value)}
                className="w-full min-h-32 p-2 border rounded bg-white font-mono text-sm"
                placeholder={
                  'id\tname\tbrand\tavailable quantity\trequested quantity\n123\tGloves\tAcme\t25\t10'
                }
                disabled={isSubmitting || itemsLoading}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handlePastedItemsImport}
                  className="px-3 py-2 bg-emerald-700 text-white text-sm font-semibold rounded hover:bg-emerald-800 disabled:opacity-50"
                  disabled={isSubmitting || itemsLoading}
                >
                  Import pasted rows
                </button>
                <button
                  type="button"
                  onClick={() => setPastedItemsText('')}
                  className="px-3 py-2 border border-emerald-300 text-emerald-900 text-sm font-semibold rounded hover:bg-emerald-100 disabled:opacity-50"
                  disabled={isSubmitting || itemsLoading || !pastedItemsText}
                >
                  Clear pasted rows
                </button>
              </div>
            </div>

            {bulkUploadMessage && (
              <p className="text-sm text-emerald-900 mt-3" role="status">
                {bulkUploadMessage}
              </p>
            )}
          </div>

          <div>
            <label className="block font-semibold mb-2">{t('stockPurchaseRequestForm.fields.selectItems')}</label>
            {selectedItems.map((item, index) => {
              const searchTerm = itemSearchTerms[index] || '';
              let filteredOptions = scopedCatalog.filter((stock) =>
                matchesSearchTokens(searchTerm, [stock.name, stock.brand])
              );
              const hasSelectedOption = filteredOptions.some(
                (stock) => String(stock.id) === String(item.stock_item_id)
              );
              if (item.stock_item_id && !hasSelectedOption) {
                const matched = itemsList.find(
                  (stock) => String(stock.id) === String(item.stock_item_id)
                );
                if (matched) {
                  filteredOptions = [matched, ...filteredOptions];
                }
              }
              return (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 mb-4 bg-white shadow-sm"
                >
                  <div className="flex justify-between items-center mb-3">
                    <p className="font-semibold">Item #{index + 1}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => duplicateItem(index)}
                        className="text-sm text-blue-600 hover:underline"
                        disabled={isSubmitting}
                      >
                        Duplicate
                      </button>
                      {selectedItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-sm text-red-600 hover:underline"
                          disabled={isSubmitting}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-sm text-gray-600 mb-1">
                        Search catalog
                      </label>
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) =>
                          handleSearchTermChange(index, e.target.value)
                        }
                        className="w-full p-2 border rounded"
                        disabled={isSubmitting || itemsLoading}
                        placeholder={t('stockPurchaseRequestForm.fields.itemSearchPlaceholder')}
                      />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-sm text-gray-600 mb-1">
                        Item name
                      </label>
                      <select
                        value={item.stock_item_id}
                        onChange={(e) =>
                          handleItemSelection(index, e.target.value)
                        }
                        className="w-full p-2 border rounded"
                        required
                        disabled={isSubmitting || !scopedCatalog.length}
                      >
                        <option value="">{t('stockPurchaseRequestForm.fields.chooseItem')}</option>
                        {filteredOptions.map((stock) => (
                          <option key={stock.id} value={stock.id}>
                            {stock.name}
                            {stock.brand ? ` • ${stock.brand}` : ''} (
                            {stock.available_quantity ?? '—'} in stock)
                          </option>
                        ))}
                      </select>
                      {!filteredOptions.length && scopedCatalog.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          No catalog items match "{searchTerm}".
                        </p>
                      )}
                      {!scopedCatalog.length && (
                        <p className="text-xs text-gray-500 mt-1">
                          No catalog items available for the selected filters.
                        </p>
                      )}
                    </div>
                    <div className="w-40">
                      <label className="block text-sm text-gray-600 mb-1">
                        Brand
                      </label>
                      <input
                        type="text"
                        placeholder={t('stockPurchaseRequestForm.fields.optional')}
                        value={item.brand}
                        onChange={(e) =>
                          handleItemChange(index, 'brand', e.target.value)
                        }
                        className="w-full p-2 border rounded"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="w-32">
                      <label className="block text-sm text-gray-600 mb-1">
                        Available
                      </label>
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={item.available_quantity}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            'available_quantity',
                            e.target.value
                          )
                        }
                        className="w-full p-2 border rounded"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="w-32">
                      <label className="block text-sm text-gray-600 mb-1">
                        Requested
                      </label>
                      <input
                        type="number"
                        min={1}
                        placeholder="0"
                        value={item.quantity}
                        onChange={(e) =>
                          handleItemChange(index, 'quantity', e.target.value)
                        }
                        className="w-full p-2 border rounded"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-sm text-gray-600 mb-1">
                        Item attachments
                      </label>
                      <input
                        type="file"
                        multiple
                        onChange={(e) => handleItemFiles(index, e.target.files)}
                        className="w-full p-2 border rounded"
                        disabled={isSubmitting}
                      />
                      {!!item.attachments?.length && (
                        <p className="text-xs text-gray-500 mt-1">
                          {item.attachments.length} file(s) selected
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              onClick={addItem}
              className="text-blue-600 font-semibold mt-2"
              disabled={isSubmitting}
            >
              + Add Another Item
            </button>
          </div>

          {/* Attachments */}
          <div>
            <label className="block font-semibold mb-1">{t('stockPurchaseRequestForm.fields.attachments')}</label>
            <input
              type="file"
              multiple
              onChange={(e) => setAttachments(Array.from(e.target.files))}
              className="p-2 border rounded w-full"
              disabled={isSubmitting}
            />
          </div>

          <UrgentRequestToggle
            user={user}
            checked={isUrgent}
            onChange={setIsUrgent}
            disabled={isSubmitting}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className={`bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 ${
              isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
            <HelpTooltip text={t('stockPurchaseRequestForm.submitHelp')} />
          </button>
        </form>
      </div>
    </>
  );
};

export default StockRequestForm;