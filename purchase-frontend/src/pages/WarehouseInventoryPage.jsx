import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import useCurrentUser from '../hooks/useCurrentUser';
import useWarehouses from '../hooks/useWarehouses';
import useWarehouseStockItems from '../hooks/useWarehouseStockItems';

const numberFormatter = new Intl.NumberFormat();
const formatExpiryDate = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
};

const WarehouseInventoryPage = () => {
  const { t } = useTranslation();
  const tr = (key, fallback) => t(`warehouseInventory.${key}`, fallback);
  const { user, loading: userLoading } = useCurrentUser();
  const { warehouses, loading: warehousesLoading, error: warehousesError } = useWarehouses();

  const [stockItems, setStockItems] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [issueItemSearch, setIssueItemSearch] = useState('');
  const [discardItemSearch, setDiscardItemSearch] = useState('');
  const [form, setForm] = useState({
    stock_item_id: '',
    batch_id: '',
    lot_number: '',
    expiry_date: '',
    serial_number: '',
    quantity: '',
    notes: '',
    warehouse_id: '',
  });
  const [discardForm, setDiscardForm] = useState({
    stock_item_id: '',
    batch_id: '',
    lot_number: '',
    expiry_date: '',
    serial_number: '',
    quantity: '',
    reason: '',
    notes: '',
    warehouse_id: '',
  });
  const [issueForm, setIssueForm] = useState({
    department_id: '',
    section_id: '',
    picking_strategy: 'fefo',
    notes: '',
    warehouse_id: '',
  });
  const [issueItems, setIssueItems] = useState([{ stock_item_id: '', quantity: '' }]);
  const [formStatus, setFormStatus] = useState({ state: 'idle', message: '' });
  const [discardFormStatus, setDiscardFormStatus] = useState({ state: 'idle', message: '' });
  const [issueFormStatus, setIssueFormStatus] = useState({ state: 'idle', message: '' });
  const [unassignedItems, setUnassignedItems] = useState([]);
  const [unassignedStatus, setUnassignedStatus] = useState({ state: 'idle', message: '' });
  const [allocationForm, setAllocationForm] = useState({
    stock_item_id: '',
    allocations: [{ warehouse_id: '', quantity: '' }],
  });
  const [allocationStatus, setAllocationStatus] = useState({ state: 'idle', message: '' });
  const [transferForm, setTransferForm] = useState({
    origin_warehouse_id: '',
    destination_warehouse_id: '',
    notes: '',
  });
  const [transferItems, setTransferItems] = useState([{ stock_item_id: '', quantity: '', notes: '' }]);
  const [transferStatus, setTransferStatus] = useState({ state: 'idle', message: '' });
  const [transferActionForm, setTransferActionForm] = useState({ transfer_id: '', reason: '' });
  const [transferActionStatus, setTransferActionStatus] = useState({ state: 'idle', message: '' });
  const [transferDetails, setTransferDetails] = useState(null);

  const [departments, setDepartments] = useState([]);
  const [departmentsStatus, setDepartmentsStatus] = useState({ state: 'idle', message: '' });
  const [report, setReport] = useState({ departments: [], window_start: '', window_end: '', generated_at: '' });
  const [reportStatus, setReportStatus] = useState({ state: 'idle', message: '' });
  const [inventoryWarehouseId, setInventoryWarehouseId] = useState('');
  const [inventorySearch, setInventorySearch] = useState('');
  const [hideZeroInventory, setHideZeroInventory] = useState(false);
  const [inventorySort, setInventorySort] = useState('name-asc');
  const [inventoryStockFilter, setInventoryStockFilter] = useState('all');
  const [inventoryView, setInventoryView] = useState('grid');
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryPageSize, setInventoryPageSize] = useState(12);
  const [inventoryRefreshedAt, setInventoryRefreshedAt] = useState('');
  const selectedInventoryWarehouse = useMemo(
    () => warehouses.find((wh) => String(wh.id) === String(inventoryWarehouseId)),
    [inventoryWarehouseId, warehouses],
  );
  const selectedIssueDepartment = useMemo(
    () => departments.find((dept) => String(dept.id) === String(issueForm.department_id)),
    [departments, issueForm.department_id],
  );
  const availableSections = useMemo(() => selectedIssueDepartment?.sections || [], [selectedIssueDepartment]);

  useEffect(() => {
    if (
      issueForm.section_id &&
      !availableSections.some((section) => String(section.id) === String(issueForm.section_id))
    ) {
      setIssueForm((prev) => ({ ...prev, section_id: '' }));
    }
  }, [availableSections, issueForm.section_id]);

  const {
    items: inventoryItems,
    loading: inventoryLoading,
    error: inventoryError,
    refresh: refreshInventory,
  } = useWarehouseStockItems(inventoryWarehouseId);

  const loadStockItems = async () => {
    try {
      const res = await api.get('/api/stock-items');
      setStockItems(res.data || []);
    } catch (err) {
      console.error('Failed to load stock items:', err);
      setFormStatus({ state: 'error', message: tr('alerts.loadItemsFailed') });
    }
  };

  const loadUnassignedStockItems = async () => {
    setUnassignedStatus({ state: 'loading', message: '' });
    try {
      const res = await api.get('/api/stock-items/unassigned');
      setUnassignedItems(res.data || []);
      setUnassignedStatus({ state: 'idle', message: '' });
    } catch (err) {
      console.error('Failed to load unassigned stock items:', err);
      const message = err?.response?.data?.message || tr('unassigned.alerts.loadFailed');
      setUnassignedStatus({ state: 'error', message });
    }
  };

  const loadDepartments = async () => {
    setDepartmentsStatus({ state: 'loading', message: '' });
    try {
      const res = await api.get('/api/departments');
      setDepartments(res.data || []);
      setDepartmentsStatus({ state: 'idle', message: '' });
    } catch (err) {
      console.error('Failed to load departments:', err);
      setDepartmentsStatus({ state: 'error', message: tr('alerts.loadDepartmentsFailed') });
    }
  };

  const loadReport = async () => {
    setReportStatus({ state: 'loading', message: '' });
    try {
      const res = await api.get('/api/warehouse-inventory/reports/weekly');
      setReport({
        departments: res.data?.departments || [],
        window_start: res.data?.window_start || '',
        window_end: res.data?.window_end || '',
        generated_at: res.data?.generated_at || '',
      });
      setReportStatus({ state: 'idle', message: '' });
    } catch (err) {
      console.error('Failed to load weekly stocking report:', err);
      setReportStatus({ state: 'error', message: tr('alerts.reportFailed') });
    }
  };

  useEffect(() => {
    if (!userLoading && user) {
      loadStockItems();
      loadUnassignedStockItems();
      loadDepartments();
      loadReport();
    }
  }, [user, userLoading]);

  useEffect(() => {
    if (warehouses.length > 0) {
      const preferred = user?.warehouse_id || warehouses[0]?.id;
      if (preferred) {
        if (!form.warehouse_id) {
          setForm((prev) => ({ ...prev, warehouse_id: String(preferred) }));
        }
        if (!discardForm.warehouse_id) {
          setDiscardForm((prev) => ({ ...prev, warehouse_id: String(preferred) }));
        }
        if (!issueForm.warehouse_id) {
          setIssueForm((prev) => ({ ...prev, warehouse_id: String(preferred) }));
        }
        if (!inventoryWarehouseId) {
          setInventoryWarehouseId(String(preferred));
        }
        if (!transferForm.origin_warehouse_id) {
          setTransferForm((prev) => ({ ...prev, origin_warehouse_id: String(preferred) }));
        }
      }
    }
  }, [
    discardForm.warehouse_id,
    form.warehouse_id,
    inventoryWarehouseId,
    issueForm.warehouse_id,
    transferForm.origin_warehouse_id,
    warehouses,
    user,
  ]);

  useEffect(() => {
    if (formStatus.state === 'success') {
      const timer = setTimeout(() => setFormStatus({ state: 'idle', message: '' }), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [formStatus]);

  useEffect(() => {
    if (discardFormStatus.state === 'success') {
      const timer = setTimeout(() => setDiscardFormStatus({ state: 'idle', message: '' }), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [discardFormStatus]);

  useEffect(() => {
    if (issueFormStatus.state === 'success') {
      const timer = setTimeout(() => setIssueFormStatus({ state: 'idle', message: '' }), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [issueFormStatus]);

  useEffect(() => {
    if (allocationStatus.state === 'success') {
      const timer = setTimeout(() => setAllocationStatus({ state: 'idle', message: '' }), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [allocationStatus]);

  useEffect(() => {
    if (transferStatus.state === 'success') {
      const timer = setTimeout(() => setTransferStatus({ state: 'idle', message: '' }), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [transferStatus]);

  useEffect(() => {
    if (inventoryWarehouseId && !inventoryLoading) {
      setInventoryRefreshedAt(new Date().toISOString());
    }
  }, [inventoryItems, inventoryLoading, inventoryWarehouseId]);

  useEffect(() => {
    setInventoryPage(1);
  }, [inventoryWarehouseId, inventorySearch, hideZeroInventory, inventorySort, inventoryStockFilter, inventoryPageSize]);

  const filteredItems = useMemo(() => {
    const term = itemSearch.trim().toLowerCase();
    if (!term) return stockItems;
    return stockItems.filter((item) =>
      [item.name, item.brand, item.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [itemSearch, stockItems]);

  const filteredIssueItems = useMemo(() => {
    const term = issueItemSearch.trim().toLowerCase();
    if (!term) return stockItems;
    return stockItems.filter((item) =>
      [item.name, item.brand, item.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [issueItemSearch, stockItems]);

  const selectedItem = stockItems.find((item) => String(item.id) === String(form.stock_item_id));
  const filteredDiscardItems = useMemo(() => {
    const term = discardItemSearch.trim().toLowerCase();
    if (!term) return stockItems;

    return stockItems.filter((item) =>
      [item.name, item.brand, item.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [discardItemSearch, stockItems]);
  const selectedDiscardItem = stockItems.find(
    (item) => String(item.id) === String(discardForm.stock_item_id),
  );
  const visibleInventoryItems = useMemo(() => {
    const term = inventorySearch.trim().toLowerCase();
    let items = inventoryItems;

    if (term) {
      items = items.filter((item) =>
        [item.item_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      );
    }

    if (hideZeroInventory) {
      items = items.filter((item) => Number(item.quantity) > 0);
    }

    if (inventoryStockFilter === 'inStock') {
      items = items.filter((item) => Number(item.quantity) > 0);
    } else if (inventoryStockFilter === 'outOfStock') {
      items = items.filter((item) => Number(item.quantity) <= 0);
    }

    const sortedItems = [...items].sort((a, b) => {
      const nameA = a.item_name?.toLowerCase?.() || '';
      const nameB = b.item_name?.toLowerCase?.() || '';
      const quantityA = Number(a.quantity) || 0;
      const quantityB = Number(b.quantity) || 0;

      switch (inventorySort) {
        case 'name-desc':
          return nameB.localeCompare(nameA);
        case 'quantity-desc':
          return quantityB - quantityA;
        case 'quantity-asc':
          return quantityA - quantityB;
        case 'name-asc':
        default:
          return nameA.localeCompare(nameB);
      }
    });

    return sortedItems;
  }, [hideZeroInventory, inventoryItems, inventorySearch, inventorySort, inventoryStockFilter]);

  const totalInventoryPages = useMemo(
    () => Math.max(1, Math.ceil(visibleInventoryItems.length / inventoryPageSize) || 1),
    [inventoryPageSize, visibleInventoryItems.length],
  );

  useEffect(() => {
    setInventoryPage((prev) => Math.min(prev, totalInventoryPages));
  }, [totalInventoryPages]);

  const paginatedInventoryItems = useMemo(() => {
    const start = (inventoryPage - 1) * inventoryPageSize;
    return visibleInventoryItems.slice(start, start + inventoryPageSize);
  }, [inventoryPage, inventoryPageSize, visibleInventoryItems]);

  const inventoryRange = useMemo(() => {
    if (!visibleInventoryItems.length) {
      return { start: 0, end: 0 };
    }
    const start = (inventoryPage - 1) * inventoryPageSize + 1;
    const end = Math.min(inventoryPage * inventoryPageSize, visibleInventoryItems.length);
    return { start, end };
  }, [inventoryPage, inventoryPageSize, visibleInventoryItems.length]);

  const visibleInventoryQuantity = useMemo(
    () =>
      visibleInventoryItems.reduce(
        (sum, item) => sum + (Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 0),
        0,
      ),
    [visibleInventoryItems],
  );

  const inventoryTotalQuantity = useMemo(
    () =>
      inventoryItems.reduce(
        (sum, item) => sum + (Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 0),
        0,
      ),
    [inventoryItems],
  );

  const zeroQuantityCount = useMemo(
    () =>
      inventoryItems.filter((item) => (Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 0) <= 0).length,
    [inventoryItems],
  );

  const selectedUnassignedItem = useMemo(
    () => unassignedItems.find((item) => String(item.id) === String(allocationForm.stock_item_id)),
    [allocationForm.stock_item_id, unassignedItems],
  );

  const allocationTotal = useMemo(
    () =>
      allocationForm.allocations.reduce(
        (sum, entry) => sum + (Number.isFinite(Number(entry.quantity)) ? Number(entry.quantity) : 0),
        0,
      ),
    [allocationForm.allocations],
  );

  const handleFormChange = (key) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleIssueFormChange = (key) => (event) => {
    const value = event.target.value;
    if (key === 'department_id') {
      setIssueForm((prev) => ({ ...prev, department_id: value, section_id: '' }));
      return;
    }

    setIssueForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleDiscardFormChange = (key) => (event) => {
    const value = event.target.value;
    setDiscardForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleIssueItemChange = (index, key) => (event) => {
    const value = event.target.value;
    setIssueItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)));
  };

  const addIssueItemRow = () => {
    setIssueItems((prev) => [...prev, { stock_item_id: '', quantity: '' }]);
  };

  const addTransferItemRow = () => {
    setTransferItems((prev) => [...prev, { stock_item_id: '', quantity: '', notes: '' }]);
  };

  const addAllocationRow = () => {
    setAllocationForm((prev) => ({
      ...prev,
      allocations: [...prev.allocations, { warehouse_id: '', quantity: '' }],
    }));
  };

  const removeIssueItemRow = (index) => {
    setIssueItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)));
  };

  const removeTransferItemRow = (index) => {
    setTransferItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)));
  };

  const removeAllocationRow = (index) => {
    setAllocationForm((prev) => ({
      ...prev,
      allocations: prev.allocations.length === 1 ? prev.allocations : prev.allocations.filter((_, idx) => idx !== index),
    }));
  };

  const handleAllocationItemChange = (value) => {
    const selected = unassignedItems.find((item) => String(item.id) === String(value));
    setAllocationForm((prev) => ({
      ...prev,
      stock_item_id: value,
      allocations: [
        {
          warehouse_id:
            prev.allocations[0]?.warehouse_id || (warehouses[0]?.id ? String(warehouses[0].id) : ''),
          quantity: selected?.available_quantity ?? '',
        },
      ],
    }));
    setAllocationStatus({ state: 'idle', message: '' });
  };

  const handleAllocationRowChange = (index, key) => (event) => {
    const value = event.target.value;
    setAllocationForm((prev) => ({
      ...prev,
      allocations: prev.allocations.map((entry, idx) =>
        idx === index ? { ...entry, [key]: value } : entry,
      ),
    }));
  };

  const handleTransferFormChange = (key) => (event) => {
    const value = event.target.value;
    setTransferForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleTransferItemChange = (index, key) => (event) => {
    const value = event.target.value;
    setTransferItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const parsedQuantity = Number(form.quantity);
    if (!form.warehouse_id) {
      setFormStatus({ state: 'error', message: tr('alerts.validationFailed') });
      return;
    }
    if (!form.stock_item_id || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setFormStatus({ state: 'error', message: tr('alerts.validationFailed') });
      return;
    }

    setFormStatus({ state: 'loading', message: '' });
    try {
      await api.post('/api/warehouse-inventory/stock', {
        stock_item_id: Number(form.stock_item_id),
        quantity: parsedQuantity,
        notes: form.notes?.trim() || undefined,
        warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : undefined,
        batch_id: form.batch_id ? Number(form.batch_id) : undefined,
        lot_number: form.lot_number?.trim() || undefined,
        expiry_date: form.expiry_date || undefined,
        serial_number: form.serial_number?.trim() || undefined,
      });
      setFormStatus({ state: 'success', message: tr('alerts.submitSuccess') });
      setForm({
        stock_item_id: '',
        batch_id: '',
        lot_number: '',
        expiry_date: '',
        serial_number: '',
        quantity: '',
        notes: '',
        warehouse_id: form.warehouse_id,
      });
      setItemSearch('');
      loadReport();
    } catch (err) {
      console.error('Failed to add warehouse stock:', err);
      const message = err?.response?.data?.message || tr('alerts.submitFailed');
      setFormStatus({ state: 'error', message });
    }
  };

  const handleDiscardSubmit = async (event) => {
    event.preventDefault();
    const parsedQuantity = Number(discardForm.quantity);

    if (
      !discardForm.warehouse_id ||
      !discardForm.stock_item_id ||
      !discardForm.reason ||
      !Number.isFinite(parsedQuantity) ||
      parsedQuantity <= 0
    ) {
      setDiscardFormStatus({ state: 'error', message: tr('alerts.discardValidationFailed') });
      return;
    }

    setDiscardFormStatus({ state: 'loading', message: '' });
    try {
      await api.post('/api/warehouse-inventory/stock/discard', {
        stock_item_id: Number(discardForm.stock_item_id),
        quantity: parsedQuantity,
        reason: discardForm.reason,
        notes: discardForm.notes?.trim() || undefined,
        warehouse_id: discardForm.warehouse_id ? Number(discardForm.warehouse_id) : undefined,
        batch_id: discardForm.batch_id ? Number(discardForm.batch_id) : undefined,
        lot_number: discardForm.lot_number?.trim() || undefined,
        expiry_date: discardForm.expiry_date || undefined,
        serial_number: discardForm.serial_number?.trim() || undefined,
      });

      setDiscardFormStatus({ state: 'success', message: tr('alerts.discardSubmitSuccess') });
      setDiscardForm((prev) => ({
        stock_item_id: '',
        batch_id: '',
        lot_number: '',
        expiry_date: '',
        serial_number: '',
        quantity: '',
        reason: '',
        notes: '',
        warehouse_id: prev.warehouse_id,
      }));
      setDiscardItemSearch('');
      refreshInventory();
      loadReport();
    } catch (err) {
      console.error('Failed to discard warehouse stock:', err);
      const message = err?.response?.data?.message || tr('alerts.discardSubmitFailed');
      setDiscardFormStatus({ state: 'error', message });
    }
  };

  const handleIssueSubmit = async (event) => {
    event.preventDefault();
    const normalizedItems = issueItems.map((item) => ({
      stock_item_id: Number(item.stock_item_id),
      quantity: Number(item.quantity),
    }));

    const hasInvalidItems =
      normalizedItems.length === 0 ||
      normalizedItems.some(
        (item) => !Number.isInteger(item.stock_item_id) || !Number.isFinite(item.quantity) || item.quantity <= 0,
      );

    if (!issueForm.warehouse_id || !issueForm.department_id || hasInvalidItems) {
      setIssueFormStatus({ state: 'error', message: tr('alerts.issueValidationFailed') });
      return;
    }

    setIssueFormStatus({ state: 'loading', message: '' });
    try {
      await api.post('/api/warehouse-inventory/stock/issue', {
        department_id: Number(issueForm.department_id),
        section_id: issueForm.section_id ? Number(issueForm.section_id) : undefined,
        notes: issueForm.notes?.trim() || undefined,
        picking_strategy: issueForm.picking_strategy,
        warehouse_id: issueForm.warehouse_id ? Number(issueForm.warehouse_id) : undefined,
        items: normalizedItems.map((item) => ({
          stock_item_id: item.stock_item_id,
          quantity: item.quantity,
        })),
      });
      setIssueFormStatus({ state: 'success', message: tr('alerts.issueSubmitSuccess') });
      setIssueForm((prev) => ({
        department_id: '',
        section_id: '',
        picking_strategy: prev.picking_strategy,
        notes: '',
        warehouse_id: prev.warehouse_id,
      }));
      setIssueItems([{ stock_item_id: '', quantity: '' }]);
      setIssueItemSearch('');
      loadReport();
    } catch (err) {
      console.error('Failed to issue warehouse stock:', err);
      const message = err?.response?.data?.message || tr('alerts.issueSubmitFailed');
      setIssueFormStatus({ state: 'error', message });
    }
  };

  const handleAllocationSubmit = async (event) => {
    event.preventDefault();
    const stockItemId = Number(allocationForm.stock_item_id);
    const normalizedAllocations = allocationForm.allocations.map((entry) => ({
      warehouse_id: Number(entry.warehouse_id),
      quantity: Number(entry.quantity),
    }));

    const hasInvalidAllocations =
      !Number.isInteger(stockItemId) ||
      normalizedAllocations.length === 0 ||
      normalizedAllocations.some(
        (entry) => !Number.isInteger(entry.warehouse_id) || !Number.isFinite(entry.quantity) || entry.quantity <= 0,
      );

    if (hasInvalidAllocations) {
      setAllocationStatus({ state: 'error', message: tr('unassigned.alerts.validationFailed') });
      return;
    }

    const targetQuantity = Number(selectedUnassignedItem?.available_quantity) || 0;
    const totalsMatch = Math.abs((allocationTotal || 0) - targetQuantity) < 0.0001;
    if (targetQuantity > 0 && !totalsMatch) {
      setAllocationStatus({
        state: 'error',
        message: tr('unassigned.alerts.totalMismatch', {
          total: numberFormatter.format(allocationTotal),
          available: numberFormatter.format(targetQuantity),
        }),
      });
      return;
    }

    setAllocationStatus({ state: 'loading', message: '' });
    try {
      await api.post('/api/stock-items/assign-warehouses', {
        stock_item_id: stockItemId,
        allocations: normalizedAllocations.map((entry) => ({
          warehouse_id: entry.warehouse_id,
          quantity: entry.quantity,
        })),
      });

      setAllocationStatus({ state: 'success', message: tr('unassigned.alerts.submitSuccess') });
      setAllocationForm({ stock_item_id: '', allocations: [{ warehouse_id: '', quantity: '' }] });
      await Promise.all([loadUnassignedStockItems(), loadStockItems(), refreshInventory()]);
    } catch (err) {
      console.error('Failed to assign stock item to warehouses:', err);
      const message = err?.response?.data?.message || tr('unassigned.alerts.submitFailed');
      setAllocationStatus({ state: 'error', message });
    }
  };

  const loadTransferRequest = async (transferId) => {
    if (!transferId) return;
    const res = await api.get(`/api/warehouse-transfers/${transferId}`);
    setTransferDetails(res.data || null);
  };

  const handleTransferSubmit = async (event) => {
    event.preventDefault();
    const normalizedItems = transferItems.map((item) => ({
      stock_item_id: Number(item.stock_item_id),
      quantity: Number(item.quantity),
      notes: item.notes?.trim() || undefined,
    }));

    const hasInvalidItems =
      normalizedItems.length === 0 ||
      normalizedItems.some(
        (item) => !Number.isInteger(item.stock_item_id) || !Number.isFinite(item.quantity) || item.quantity <= 0,
      );

    if (!transferForm.origin_warehouse_id || !transferForm.destination_warehouse_id || hasInvalidItems) {
      setTransferStatus({ state: 'error', message: tr('transfer.alerts.validation', 'Fill all required fields and item quantities.') });
      return;
    }

    if (String(transferForm.origin_warehouse_id) === String(transferForm.destination_warehouse_id)) {
      setTransferStatus({ state: 'error', message: tr('transfer.alerts.sameWarehouse', 'Origin and destination warehouses must be different.') });
      return;
    }

    setTransferStatus({ state: 'loading', message: '' });
    try {
      const res = await api.post('/api/warehouse-transfers', {
        origin_warehouse_id: Number(transferForm.origin_warehouse_id),
        destination_warehouse_id: Number(transferForm.destination_warehouse_id),
        notes: transferForm.notes?.trim() || undefined,
        items: normalizedItems,
      });

      const createdId = res.data?.transfer?.id;
      setTransferStatus({
        state: 'success',
        message: tr('transfer.alerts.created', 'Transfer request created successfully.') + (createdId ? ` #${createdId}` : ''),
      });
      setTransferActionForm((prev) => ({ ...prev, transfer_id: createdId ? String(createdId) : prev.transfer_id }));
      setTransferForm((prev) => ({ ...prev, destination_warehouse_id: '', notes: '' }));
      setTransferItems([{ stock_item_id: '', quantity: '', notes: '' }]);

      if (createdId) {
        await loadTransferRequest(createdId);
      }
    } catch (err) {
      console.error('Failed to create warehouse transfer request:', err);
      const message = err?.response?.data?.message || tr('transfer.alerts.createFailed', 'Failed to create transfer request.');
      setTransferStatus({ state: 'error', message });
    }
  };

  const handleTransferAction = async (action) => {
    const transferId = Number(transferActionForm.transfer_id);
    if (!Number.isInteger(transferId)) {
      setTransferActionStatus({ state: 'error', message: tr('transfer.alerts.transferId', 'Enter a valid transfer request ID.') });
      return;
    }

    setTransferActionStatus({ state: 'loading', message: '' });
    try {
      if (action === 'load') {
        await loadTransferRequest(transferId);
        setTransferActionStatus({ state: 'success', message: tr('transfer.alerts.loaded', 'Transfer request loaded.') });
        return;
      }

      await api.post(`/api/warehouse-transfers/${transferId}/${action}`, {
        reason: action === 'reject' ? transferActionForm.reason?.trim() || undefined : undefined,
      });

      await Promise.all([loadTransferRequest(transferId), refreshInventory(), loadReport()]);

      setTransferActionStatus({
        state: 'success',
        message:
          action === 'approve'
            ? tr('transfer.alerts.approved', 'Transfer request approved.')
            : tr('transfer.alerts.rejected', 'Transfer request rejected.'),
      });
    } catch (err) {
      console.error(`Failed to ${action} transfer request:`, err);
      const message = err?.response?.data?.message || tr('transfer.alerts.actionFailed', 'Transfer action failed.');
      setTransferActionStatus({ state: 'error', message });
    }
  };

  const reportRange = useMemo(() => {
    if (!report.window_start || !report.window_end) return '';
    try {
      const start = new Date(report.window_start).toLocaleString();
      const end = new Date(report.window_end).toLocaleString();
      return `${start} → ${end}`;
    } catch (err) {
      return `${report.window_start} → ${report.window_end}`;
    }
  }, [report.window_end, report.window_start]);

  if (userLoading || !user) {
    return (
      <>
        <Navbar />
        <div className="p-6 text-gray-600">{tr('loading')}</div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('pageTitles.warehouseInventory', 'Warehouse Inventory')}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">{tr('subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {report.generated_at && `${tr('report.generatedAt')} ${new Date(report.generated_at).toLocaleString()}`}
            </span>
            <button
              type="button"
              onClick={loadReport}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {tr('report.refresh')}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {tr('transfer.title', 'Inter-warehouse transfers')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {tr('transfer.description', 'Create transfer requests from an origin warehouse to a destination warehouse, then approve or reject by transfer ID.')}
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <form onSubmit={handleTransferSubmit} className="space-y-4 rounded-md border border-gray-200 p-4 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{tr('transfer.requestTitle', 'Create transfer request')}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="transfer-origin">
                    {tr('transfer.origin', 'Origin warehouse')}
                  </label>
                  <select
                    id="transfer-origin"
                    value={transferForm.origin_warehouse_id}
                    onChange={handleTransferFormChange('origin_warehouse_id')}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    required
                  >
                    <option value="">{tr('transfer.selectWarehouse', 'Choose a warehouse')}</option>
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>{wh.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="transfer-destination">
                    {tr('transfer.destination', 'Destination warehouse')}
                  </label>
                  <select
                    id="transfer-destination"
                    value={transferForm.destination_warehouse_id}
                    onChange={handleTransferFormChange('destination_warehouse_id')}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    required
                  >
                    <option value="">{tr('transfer.selectWarehouse', 'Choose a warehouse')}</option>
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>{wh.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{tr('transfer.items', 'Transfer items')}</p>
                  <button type="button" onClick={addTransferItemRow} className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-300">
                    {tr('transfer.addItem', 'Add item')}
                  </button>
                </div>
                <div className="space-y-2">
                  {transferItems.map((item, index) => (
                    <div key={`transfer-item-${index}`} className="grid gap-2 sm:grid-cols-12 rounded-md bg-gray-50 p-2 dark:bg-gray-900">
                      <select
                        value={item.stock_item_id}
                        onChange={handleTransferItemChange(index, 'stock_item_id')}
                        className="sm:col-span-5 rounded-md border border-gray-300 bg-white px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        required
                      >
                        <option value="">{tr('transfer.selectItem', 'Choose stock item')}</option>
                        {stockItems.map((stockItem) => (
                          <option key={stockItem.id} value={stockItem.id}>{stockItem.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity}
                        onChange={handleTransferItemChange(index, 'quantity')}
                        placeholder={tr('transfer.quantity', 'Quantity')}
                        className="sm:col-span-3 rounded-md border border-gray-300 px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        required
                      />
                      <input
                        type="text"
                        value={item.notes}
                        onChange={handleTransferItemChange(index, 'notes')}
                        placeholder={tr('transfer.itemNotes', 'Item notes (optional)')}
                        className="sm:col-span-3 rounded-md border border-gray-300 px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      />
                      <button type="button" onClick={() => removeTransferItemRow(index)} className="sm:col-span-1 text-xs font-semibold text-red-600 dark:text-red-300">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <textarea
                value={transferForm.notes}
                onChange={handleTransferFormChange('notes')}
                rows="2"
                placeholder={tr('transfer.notes', 'Request notes (optional)')}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />

              {transferStatus.message && (
                <div className={`rounded-md px-3 py-2 text-sm ${transferStatus.state === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-100' : transferStatus.state === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-100' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-100'}`}>
                  {transferStatus.message}
                </div>
              )}

              <button type="submit" disabled={transferStatus.state === 'loading'} className="inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300">
                {transferStatus.state === 'loading' ? tr('transfer.submitting', 'Submitting...') : tr('transfer.submit', 'Create transfer request')}
              </button>
            </form>

            <div className="space-y-4 rounded-md border border-gray-200 p-4 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{tr('transfer.reviewTitle', 'Review / approve transfer')}</h3>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="transfer-id">{tr('transfer.transferId', 'Transfer ID')}</label>
                <input
                  id="transfer-id"
                  type="number"
                  min="1"
                  value={transferActionForm.transfer_id}
                  onChange={(event) => setTransferActionForm((prev) => ({ ...prev, transfer_id: event.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  placeholder={tr('transfer.transferIdPlaceholder', 'Enter transfer request ID')}
                />
                <textarea
                  rows="2"
                  value={transferActionForm.reason}
                  onChange={(event) => setTransferActionForm((prev) => ({ ...prev, reason: event.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  placeholder={tr('transfer.rejectionReason', 'Rejection reason (optional)')}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => handleTransferAction('load')} className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold dark:border-gray-700">{tr('transfer.load', 'Load')}</button>
                <button type="button" onClick={() => handleTransferAction('approve')} className="rounded-md bg-green-600 px-3 py-2 text-xs font-semibold text-white">{tr('transfer.approve', 'Approve')}</button>
                <button type="button" onClick={() => handleTransferAction('reject')} className="rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white">{tr('transfer.reject', 'Reject')}</button>
              </div>

              {transferActionStatus.message && (
                <div className={`rounded-md px-3 py-2 text-sm ${transferActionStatus.state === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-100' : transferActionStatus.state === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-100' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-100'}`}>
                  {transferActionStatus.message}
                </div>
              )}

              {transferDetails?.transfer && (
                <div className="rounded-md bg-gray-50 p-3 text-sm dark:bg-gray-900">
                  <p><span className="font-semibold">{tr('transfer.status', 'Status')}:</span> {transferDetails.transfer.status}</p>
                  <p><span className="font-semibold">{tr('transfer.route', 'Route')}:</span> {transferDetails.transfer.origin_warehouse_id} → {transferDetails.transfer.destination_warehouse_id}</p>
                  <p><span className="font-semibold">{tr('transfer.itemsCount', 'Items')}:</span> {transferDetails.items?.length || 0}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{tr('unassigned.title')}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">{tr('unassigned.description')}</p>
            </div>
            <div className="flex items-center gap-2">
              {unassignedStatus.state === 'loading' && (
                <span className="text-xs text-blue-600 dark:text-blue-300">{tr('unassigned.loading')}</span>
              )}
              <button
                type="button"
                onClick={loadUnassignedStockItems}
                className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
              >
                {tr('unassigned.refresh')}
              </button>
            </div>
          </div>

          {unassignedStatus.state === 'error' && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-100">
              {unassignedStatus.message}
            </div>
          )}

          {unassignedItems.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">{tr('unassigned.empty')}</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3 overflow-y-auto pr-1 sm:max-h-80">
                {unassignedItems.map((item) => {
                  const isSelected = String(item.id) === String(allocationForm.stock_item_id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleAllocationItemChange(String(item.id))}
                      className={`w-full rounded-md border px-3 py-2 text-left shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-100 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 hover:border-blue-400 dark:border-gray-700 dark:hover:border-blue-400'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-medium text-gray-900 dark:text-gray-100">{item.name}</p>
                          {item.brand && <p className="text-xs text-gray-600 dark:text-gray-300">{item.brand}</p>}
                          <p className="text-xs text-gray-600 dark:text-gray-300">
                            {tr('unassigned.availableLabel', {
                              count: numberFormatter.format(Number(item.available_quantity) || 0),
                            })}
                          </p>
                        </div>
                        {isSelected && (
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                            {tr('unassigned.selected')}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleAllocationSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="unassigned-stock-item">
                    {tr('unassigned.fields.stockItem')}
                  </label>
                  <select
                    id="unassigned-stock-item"
                    value={allocationForm.stock_item_id}
                    onChange={(event) => handleAllocationItemChange(event.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  >
                    <option value="">{tr('unassigned.fields.selectPlaceholder')}</option>
                    {unassignedItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} {item.brand ? `(${item.brand})` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedUnassignedItem && (
                    <div className="text-xs text-gray-600 dark:text-gray-300">
                      <p>
                        {tr('unassigned.availableLabel', {
                          count: numberFormatter.format(Number(selectedUnassignedItem.available_quantity) || 0),
                        })}
                      </p>
                      <p>
                        {tr('unassigned.allocationTotal', { total: numberFormatter.format(allocationTotal) })}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{tr('unassigned.fields.allocations')}</h3>
                    <button
                      type="button"
                      onClick={addAllocationRow}
                      className="text-sm font-semibold text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      {tr('unassigned.fields.addRow')}
                    </button>
                  </div>

                  {allocationForm.allocations.map((entry, index) => (
                    <div key={`${entry.warehouse_id || 'new'}-${index}`} className="grid gap-3 sm:grid-cols-2 sm:items-end">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor={`allocation-warehouse-${index}`}>
                          {tr('form.fields.warehouse')}
                        </label>
                        <select
                          id={`allocation-warehouse-${index}`}
                          value={entry.warehouse_id}
                          onChange={handleAllocationRowChange(index, 'warehouse_id')}
                          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                          disabled={warehousesLoading || !warehouses.length}
                          required
                        >
                          <option value="">{tr('form.fields.selectPlaceholder')}</option>
                          {warehouses.map((wh) => (
                            <option key={wh.id} value={wh.id}>
                              {wh.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor={`allocation-quantity-${index}`}>
                          {tr('unassigned.fields.quantity')}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            id={`allocation-quantity-${index}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={entry.quantity}
                            onChange={handleAllocationRowChange(index, 'quantity')}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                            required
                          />
                          {allocationForm.allocations.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeAllocationRow(index)}
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                              {tr('unassigned.fields.removeRow')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {allocationStatus.message && (
                  <div
                    className={`rounded-md px-3 py-2 text-sm ${
                      allocationStatus.state === 'success'
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-100'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-100'
                    }`}
                  >
                    {allocationStatus.message}
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
                    disabled={allocationStatus.state === 'loading' || !allocationForm.stock_item_id}
                  >
                    {allocationStatus.state === 'loading' ? tr('unassigned.submitLoading') : tr('unassigned.submit')}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{tr('inventory.title')}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">{tr('inventory.description')}</p>
              {selectedInventoryWarehouse && (
                <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-100 dark:ring-blue-800">
                  <span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden />
                  {selectedInventoryWarehouse.name}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {inventoryRefreshedAt && (
                <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700">
                  <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden />
                  {tr('inventory.lastUpdated', {
                    timestamp: new Date(inventoryRefreshedAt).toLocaleString(),
                  })}
                </span>
              )}
              <label className="sr-only" htmlFor="inventory-warehouse">
                {tr('inventory.fields.warehouse')}
              </label>
              <select
                id="inventory-warehouse"
                value={inventoryWarehouseId}
                onChange={(event) => setInventoryWarehouseId(event.target.value)}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                disabled={warehousesLoading || !warehouses.length}
              >
                <option value="">{tr('inventory.fields.warehousePlaceholder')}</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={refreshInventory}
                className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-blue-600 to-blue-700 px-3 py-2 text-sm font-semibold text-white shadow transition hover:from-blue-700 hover:to-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:from-blue-300 disabled:to-blue-400"
                disabled={!inventoryWarehouseId || inventoryLoading}
              >
                <span className="inline-flex h-2 w-2 rounded-full bg-white/80" aria-hidden />
                {inventoryLoading ? tr('inventory.refreshing') : tr('inventory.refresh')}
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 rounded-md bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm ring-1 ring-blue-100 dark:from-blue-900/30 dark:via-gray-800 dark:to-gray-800 dark:ring-blue-800/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-100">
                📦
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-100">
                  {tr('inventory.stats.totalItems')}
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                  {numberFormatter.format(inventoryItems.length)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-md bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm ring-1 ring-indigo-100 dark:from-indigo-900/30 dark:via-gray-800 dark:to-gray-800 dark:ring-indigo-800/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-100">
                📊
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-100">
                  {tr('inventory.stats.visibleItems')}
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                  {numberFormatter.format(visibleInventoryItems.length)}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {tr('inventory.summaryWithQuantity', {
                    count: visibleInventoryItems.length,
                    total: numberFormatter.format(visibleInventoryQuantity),
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-md bg-gradient-to-br from-green-50 to-white p-4 shadow-sm ring-1 ring-green-100 dark:from-green-900/30 dark:via-gray-800 dark:to-gray-800 dark:ring-green-800/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-100">
                ✅
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-100">
                  {tr('inventory.stats.totalQuantity')}
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                  {numberFormatter.format(inventoryTotalQuantity)}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-300">{tr('inventory.labels.systemWide')}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-md bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm ring-1 ring-amber-100 dark:from-amber-900/30 dark:via-gray-800 dark:to-gray-800 dark:ring-amber-800/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-100">
                ⚠️
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-100">
                  {tr('inventory.stats.zeroQuantity')}
                </p>
                <p className="mt-1 text-2xl font-bold text-amber-800 dark:text-amber-100">
                  {numberFormatter.format(zeroQuantityCount)}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-200">{tr('inventory.labels.attention')}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-4 lg:items-end">
            <div className="space-y-1 lg:col-span-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="inventory-search">
                {tr('inventory.fields.search')}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">🔎</span>
                <input
                  id="inventory-search"
                  type="search"
                  value={inventorySearch}
                  onChange={(event) => setInventorySearch(event.target.value)}
                  placeholder={tr('inventory.fields.searchPlaceholder')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 pl-9 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-300">
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-700">
                  {tr('inventory.labels.showingFor')} {selectedInventoryWarehouse?.name || tr('inventory.labels.noWarehouse')}
                </span>
                {hideZeroInventory && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:ring-amber-800/40">
                    {tr('inventory.filters.hideZero')}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="inventory-stock-filter">
                  {tr('inventory.fields.stockFilter')}
                </label>
                <select
                  id="inventory-stock-filter"
                  value={inventoryStockFilter}
                  onChange={(event) => setInventoryStockFilter(event.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  <option value="all">{tr('inventory.filters.stock.all')}</option>
                  <option value="inStock">{tr('inventory.filters.stock.inStock')}</option>
                  <option value="outOfStock">{tr('inventory.filters.stock.outOfStock')}</option>
                </select>
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                  checked={hideZeroInventory}
                  onChange={(event) => setHideZeroInventory(event.target.checked)}
                />
                {tr('inventory.filters.hideZero')}
              </label>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="inventory-sort">
                  {tr('inventory.fields.sort')}
                </label>
                <select
                  id="inventory-sort"
                  value={inventorySort}
                  onChange={(event) => setInventorySort(event.target.value)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  <option value="name-asc">{tr('inventory.sortOptions.nameAsc')}</option>
                  <option value="name-desc">{tr('inventory.sortOptions.nameDesc')}</option>
                  <option value="quantity-desc">{tr('inventory.sortOptions.quantityDesc')}</option>
                  <option value="quantity-asc">{tr('inventory.sortOptions.quantityAsc')}</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="inventory-view">
                  {tr('inventory.fields.view')}
                </label>
                <div className="inline-flex overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                  <button
                    type="button"
                    id="inventory-view"
                    onClick={() => setInventoryView('grid')}
                    className={`px-3 py-2 text-xs font-semibold transition ${
                      inventoryView === 'grid'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800'
                    }`}
                  >
                    {tr('inventory.viewOptions.grid')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInventoryView('table')}
                    className={`px-3 py-2 text-xs font-semibold transition ${
                      inventoryView === 'table'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800'
                    }`}
                  >
                    {tr('inventory.viewOptions.table')}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="inventory-page-size">
                  {tr('inventory.fields.pageSize')}
                </label>
                <select
                  id="inventory-page-size"
                  value={inventoryPageSize}
                  onChange={(event) => setInventoryPageSize(Number(event.target.value))}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  {[6, 12, 24, 36].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {inventoryError && (
            <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-100">
              {inventoryError}
            </div>
          )}

          <div className="mt-4 space-y-4">
            {inventoryLoading ? (
              <div className="py-6 text-sm text-gray-600 dark:text-gray-300">{tr('inventory.loading')}</div>
            ) : !inventoryWarehouseId ? (
              <div className="py-6 text-sm text-gray-600 dark:text-gray-300">{tr('inventory.selectWarehouse')}</div>
            ) : visibleInventoryItems.length === 0 ? (
              <div className="py-6 text-sm text-gray-600 dark:text-gray-300">{tr('inventory.empty')}</div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600 dark:text-gray-300">
                  <span>
                    {tr('inventory.labels.showingRange', {
                      start: numberFormatter.format(inventoryRange.start),
                      end: numberFormatter.format(inventoryRange.end),
                      total: numberFormatter.format(visibleInventoryItems.length),
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700">
                    {tr('inventory.labels.pageSummary', { page: inventoryPage, pages: totalInventoryPages })}
                  </span>
                </div>

                {inventoryView === 'grid' ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {paginatedInventoryItems.map((item) => {
                      const quantityValue = Number(item.quantity) || 0;
                      const isZeroQuantity = quantityValue <= 0;

                      return (
                        <div
                          key={`${item.stock_item_id}-${item.item_name}-${item.lot_number || ''}-${item.expiry_date || ''}-${item.serial_number || ''}`}
                          className="flex items-start justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-900/50"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.item_name}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-300">
                              {tr('inventory.labels.itemCode', { code: item.stock_item_id || '—' })}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {tr('inventory.labels.batchMeta', {
                                lot: item.lot_number || '—',
                                expiry: formatExpiryDate(item.expiry_date),
                                serial: item.serial_number || '—',
                              })}
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                              isZeroQuantity
                                ? 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-800/60'
                                : 'bg-green-50 text-green-800 ring-green-200 dark:bg-green-900/30 dark:text-green-100 dark:ring-green-800/40'
                            }`}
                          >
                            {numberFormatter.format(quantityValue)}
                            {isZeroQuantity && <span className="text-[10px] uppercase tracking-wide">{tr('inventory.labels.restock')}</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 overflow-hidden rounded-lg text-sm shadow-sm ring-1 ring-gray-200 dark:divide-gray-700 dark:ring-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-200">{tr('inventory.columns.item')}</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-200">{tr('inventory.columns.batch')}</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-200">{tr('inventory.columns.quantity')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                        {paginatedInventoryItems.map((item) => {
                          const quantityValue = Number(item.quantity) || 0;
                          const isZeroQuantity = quantityValue <= 0;

                          return (
                            <tr key={`${item.stock_item_id}-${item.item_name}-${item.lot_number || ''}-${item.expiry_date || ''}-${item.serial_number || ''}`} className={isZeroQuantity ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}>
                              <td className="px-3 py-2 text-gray-800 dark:text-gray-100">{item.item_name}</td>
                              <td className="px-3 py-2 text-gray-700 dark:text-gray-200">
                                <div className="text-xs">
                                  <div>{tr('inventory.labels.lotLabel', { value: item.lot_number || '—' })}</div>
                                  <div>{tr('inventory.labels.expiryLabel', { value: formatExpiryDate(item.expiry_date) })}</div>
                                  <div>{tr('inventory.labels.serialLabel', { value: item.serial_number || '—' })}</div>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-gray-800 dark:text-gray-100">
                                <span
                                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                                    isZeroQuantity
                                      ? 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-800/60'
                                      : 'bg-green-50 text-green-800 ring-green-200 dark:bg-green-900/30 dark:text-green-100 dark:ring-green-800/40'
                                  }`}
                                >
                                  {numberFormatter.format(quantityValue)}
                                  {isZeroQuantity && <span className="text-[10px] uppercase tracking-wide">{tr('inventory.labels.restock')}</span>}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {totalInventoryPages > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-700 dark:text-gray-200">
                    <div className="text-gray-600 dark:text-gray-300">
                      {tr('inventory.labels.pageSummary', { page: inventoryPage, pages: totalInventoryPages })}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInventoryPage((prev) => Math.max(1, prev - 1))}
                        disabled={inventoryPage === 1}
                        className="rounded-md border border-gray-300 bg-white px-3 py-1 font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                      >
                        {tr('inventory.labels.previousPage')}
                      </button>
                      <span className="text-gray-600 dark:text-gray-300">{inventoryPage}</span>
                      <button
                        type="button"
                        onClick={() => setInventoryPage((prev) => Math.min(totalInventoryPages, prev + 1))}
                        disabled={inventoryPage >= totalInventoryPages}
                        className="rounded-md border border-gray-300 bg-white px-3 py-1 font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                      >
                        {tr('inventory.labels.nextPage')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{tr('form.title')}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">{tr('form.description')}</p>
              </div>
              {formStatus.state === 'loading' && (
                <span className="text-xs text-blue-600 dark:text-blue-300">{tr('form.saving')}</span>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="warehouse">
                  {tr('form.fields.warehouse')}
                </label>
                <select
                  id="warehouse"
                  value={form.warehouse_id}
                  onChange={handleFormChange('warehouse_id')}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  disabled={warehousesLoading || !warehouses.length}
                  required
                >
                  <option value="">{tr('form.fields.warehousePlaceholder')}</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name}
                    </option>
                  ))}
                </select>
                {warehousesError && <p className="text-xs text-red-600">{warehousesError}</p>}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="stock-item">
                  {tr('form.fields.stockItem')}
                </label>
                <input
                  id="stock-item-search"
                  type="search"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder={tr('form.fields.stockItemSearch')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                />
                <select
                  id="stock-item"
                  value={form.stock_item_id}
                  onChange={handleFormChange('stock_item_id')}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  required
                >
                  <option value="">{tr('form.fields.selectPlaceholder')}</option>
                  {filteredItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} {item.brand ? `(${item.brand})` : ''}
                    </option>
                  ))}
                </select>
                {selectedItem && (
                  <p className="text-xs text-gray-500">
                    {selectedItem.category && `${selectedItem.category} • `}
                    {selectedItem.available_quantity !== undefined &&
                      tr('form.fields.available', {
                        count: numberFormatter.format(Number(selectedItem.available_quantity) || 0),
                      })}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="quantity">
                  {tr('form.fields.quantity')}
                </label>
                <input
                  id="quantity"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.quantity}
                  onChange={handleFormChange('quantity')}
                  placeholder={tr('form.fields.quantityPlaceholder')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                  required
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="lot-number">
                    {tr('form.fields.lotNumber')}
                  </label>
                  <input
                    id="lot-number"
                    type="text"
                    value={form.lot_number}
                    onChange={handleFormChange('lot_number')}
                    placeholder={tr('form.fields.lotNumberPlaceholder')}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="expiry-date">
                    {tr('form.fields.expiryDate')}
                  </label>
                  <input
                    id="expiry-date"
                    type="date"
                    value={form.expiry_date}
                    onChange={handleFormChange('expiry_date')}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="serial-number">
                  {tr('form.fields.serialNumber')}
                </label>
                <input
                  id="serial-number"
                  type="text"
                  value={form.serial_number}
                  onChange={handleFormChange('serial_number')}
                  placeholder={tr('form.fields.serialNumberPlaceholder')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="notes">
                  {tr('form.fields.notes')}
                </label>
                <textarea
                  id="notes"
                  value={form.notes}
                  onChange={handleFormChange('notes')}
                  rows="3"
                  placeholder={tr('form.fields.notesPlaceholder')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                />
              </div>

              {formStatus.message && (
                <div
                  className={`rounded-md px-3 py-2 text-sm ${
                    formStatus.state === 'success'
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-100'
                      : 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-100'
                  }`}
                >
                  {formStatus.message}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
                  disabled={formStatus.state === 'loading'}
                >
                  {formStatus.state === 'loading' ? tr('form.submitLoading') : tr('form.submit')}
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{tr('discardForm.title')}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">{tr('discardForm.description')}</p>
              </div>
              {discardFormStatus.state === 'loading' && (
                <span className="text-xs text-blue-600 dark:text-blue-300">{tr('discardForm.saving')}</span>
              )}
            </div>

            <form onSubmit={handleDiscardSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="discard-warehouse">
                  {tr('form.fields.warehouse')}
                </label>
                <select
                  id="discard-warehouse"
                  value={discardForm.warehouse_id}
                  onChange={handleDiscardFormChange('warehouse_id')}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  disabled={warehousesLoading || !warehouses.length}
                  required
                >
                  <option value="">{tr('form.fields.warehousePlaceholder')}</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name}
                    </option>
                  ))}
                </select>
                {warehousesError && <p className="text-xs text-red-600">{warehousesError}</p>}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="discard-stock-item">
                  {tr('discardForm.fields.stockItem')}
                </label>
                <input
                  id="discard-stock-item-search"
                  type="search"
                  value={discardItemSearch}
                  onChange={(e) => setDiscardItemSearch(e.target.value)}
                  placeholder={tr('discardForm.fields.stockItemSearch')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                />
                <select
                  id="discard-stock-item"
                  value={discardForm.stock_item_id}
                  onChange={handleDiscardFormChange('stock_item_id')}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  required
                >
                  <option value="">{tr('discardForm.fields.selectPlaceholder')}</option>
                  {filteredDiscardItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} {item.brand ? `(${item.brand})` : ''}
                    </option>
                  ))}
                </select>
                {selectedDiscardItem && (
                  <p className="text-xs text-gray-500">
                    {selectedDiscardItem.category && `${selectedDiscardItem.category} • `}
                    {selectedDiscardItem.available_quantity !== undefined &&
                      tr('form.fields.available', {
                        count: numberFormatter.format(Number(selectedDiscardItem.available_quantity) || 0),
                      })}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="discard-quantity">
                  {tr('discardForm.fields.quantity')}
                </label>
                <input
                  id="discard-quantity"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discardForm.quantity}
                  onChange={handleDiscardFormChange('quantity')}
                  placeholder={tr('discardForm.fields.quantityPlaceholder')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                  required
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="discard-lot-number">
                    {tr('discardForm.fields.lotNumber')}
                  </label>
                  <input
                    id="discard-lot-number"
                    type="text"
                    value={discardForm.lot_number}
                    onChange={handleDiscardFormChange('lot_number')}
                    placeholder={tr('discardForm.fields.lotNumberPlaceholder')}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="discard-expiry-date">
                    {tr('discardForm.fields.expiryDate')}
                  </label>
                  <input
                    id="discard-expiry-date"
                    type="date"
                    value={discardForm.expiry_date}
                    onChange={handleDiscardFormChange('expiry_date')}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="discard-serial-number">
                  {tr('discardForm.fields.serialNumber')}
                </label>
                <input
                  id="discard-serial-number"
                  type="text"
                  value={discardForm.serial_number}
                  onChange={handleDiscardFormChange('serial_number')}
                  placeholder={tr('discardForm.fields.serialNumberPlaceholder')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="discard-reason">
                  {tr('discardForm.fields.reason')}
                </label>
                <select
                  id="discard-reason"
                  value={discardForm.reason}
                  onChange={handleDiscardFormChange('reason')}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  required
                >
                  <option value="">{tr('discardForm.fields.selectPlaceholder')}</option>
                  <option value="expired">{tr('discardForm.fields.reasons.expired')}</option>
                  <option value="damaged">{tr('discardForm.fields.reasons.damaged')}</option>
                  <option value="other">{tr('discardForm.fields.reasons.other')}</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="discard-notes">
                  {tr('discardForm.fields.notes')}
                </label>
                <textarea
                  id="discard-notes"
                  value={discardForm.notes}
                  onChange={handleDiscardFormChange('notes')}
                  rows="3"
                  placeholder={tr('discardForm.fields.notesPlaceholder')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                />
              </div>

              {discardFormStatus.message && (
                <div
                  className={`rounded-md px-3 py-2 text-sm ${
                    discardFormStatus.state === 'success'
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-100'
                      : 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-100'
                  }`}
                >
                  {discardFormStatus.message}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
                  disabled={discardFormStatus.state === 'loading'}
                >
                  {discardFormStatus.state === 'loading' ? tr('discardForm.submitLoading') : tr('discardForm.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{tr('report.title')}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">{tr('report.description')}</p>
            </div>
            {reportRange && <span className="text-xs text-gray-500">{reportRange}</span>}
          </div>

            {reportStatus.state === 'error' && (
              <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-100">
                {reportStatus.message}
              </div>
            )}

            {reportStatus.state === 'loading' ? (
              <div className="text-sm text-gray-600 dark:text-gray-300">{tr('report.loading')}</div>
            ) : report.departments.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-gray-300">{tr('report.empty')}</div>
            ) : (
              <div className="space-y-4">
                {report.departments.map((dept) => (
                  <div
                    key={dept.department_id}
                    className="rounded-md border border-gray-200 bg-gray-50 p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{dept.department_name}</p>
                        <p className="text-xs text-gray-500">
                          {tr('report.itemCount', { count: dept.items?.length ?? 0 })}
                        </p>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300">
                        {tr('report.last7days')}
                      </div>
                    </div>
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                        <thead className="bg-white dark:bg-gray-800">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-200">
                              {tr('report.columns.item')}
                            </th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-200">
                              {tr('report.columns.quantity')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                          {(dept.items || []).map((item) => (
                            <tr key={`${dept.department_id}-${item.stock_item_id}-${item.item_name}`}>
                              <td className="px-3 py-2 text-gray-800 dark:text-gray-100">{item.item_name}</td>
                              <td className="px-3 py-2 text-gray-800 dark:text-gray-100">
                                {numberFormatter.format(Number(item.total_quantity) || 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{tr('issueForm.title')}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">{tr('issueForm.description')}</p>
              </div>
              {issueFormStatus.state === 'loading' && (
                <span className="text-xs text-blue-600 dark:text-blue-300">{tr('issueForm.saving')}</span>
              )}
            </div>

            <form onSubmit={handleIssueSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="issue-warehouse">
                  {tr('form.fields.warehouse')}
                </label>
                <select
                  id="issue-warehouse"
                  value={issueForm.warehouse_id}
                  onChange={handleIssueFormChange('warehouse_id')}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  disabled={warehousesLoading || !warehouses.length}
                  required
                >
                  <option value="">{tr('form.fields.warehousePlaceholder')}</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name}
                    </option>
                  ))}
                </select>
                {warehousesError && <p className="text-xs text-red-600">{warehousesError}</p>}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="issue-department">
                  {tr('issueForm.fields.department')}
                </label>
                <select
                  id="issue-department"
                  value={issueForm.department_id}
                  onChange={handleIssueFormChange('department_id')}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  disabled={departmentsStatus.state === 'loading' || departments.length === 0}
                  required
                >
                  <option value="">{tr('issueForm.fields.departmentPlaceholder')}</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                {departmentsStatus.state === 'error' && (
                  <p className="text-xs text-red-600">{departmentsStatus.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="issue-section">
                  {tr('issueForm.fields.section')}
                  <span className="text-gray-500 dark:text-gray-400"> ({tr('issueForm.fields.optional')})</span>
                </label>
                <select
                  id="issue-section"
                  value={issueForm.section_id}
                  onChange={handleIssueFormChange('section_id')}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  disabled={!issueForm.department_id || availableSections.length === 0}
                >
                  <option value="">{tr('issueForm.fields.sectionPlaceholder')}</option>
                  {availableSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="issue-stock-item-search">
                      {tr('issueForm.fields.itemsLabel', 'Items to issue')}
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {tr('issueForm.fields.itemsHelper', 'Add one or more stock items with the quantities issued to this department.')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addIssueItemRow}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
                  >
                    {tr('issueForm.fields.addItem', 'Add item')}
                  </button>
                </div>

                <input
                  id="issue-stock-item-search"
                  type="search"
                  value={issueItemSearch}
                  onChange={(e) => setIssueItemSearch(e.target.value)}
                  placeholder={tr('issueForm.fields.stockItemSearch')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                />

                <div className="space-y-3">
                  {issueItems.map((issueItem, index) => {
                    const selectedIssueRowItem = stockItems.find(
                      (item) => String(item.id) === String(issueItem.stock_item_id),
                    );

                    return (
                      <div
                        key={`issue-item-${index}`}
                        className="rounded-md border border-gray-200 bg-gray-50 p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900"
                      >
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                            {tr('issueForm.fields.itemLabel', { index: index + 1 })}
                          </p>
                          {issueItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeIssueItemRow(index)}
                              className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                            >
                              {tr('issueForm.fields.removeItem', 'Remove')}
                            </button>
                          )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <label
                              className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                              htmlFor={`issue-stock-item-${index}`}
                            >
                              {tr('issueForm.fields.stockItem')}
                            </label>
                            <select
                              id={`issue-stock-item-${index}`}
                              value={issueItem.stock_item_id}
                              onChange={handleIssueItemChange(index, 'stock_item_id')}
                              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                              required
                            >
                              <option value="">{tr('issueForm.fields.selectPlaceholder')}</option>
                              {filteredIssueItems.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name} {item.brand ? `(${item.brand})` : ''}
                                </option>
                              ))}
                            </select>
                            {selectedIssueRowItem && (
                              <p className="text-xs text-gray-500">
                                {selectedIssueRowItem.category && `${selectedIssueRowItem.category} • `}
                                {selectedIssueRowItem.available_quantity !== undefined &&
                                  tr('form.fields.available', {
                                    count: numberFormatter.format(Number(selectedIssueRowItem.available_quantity) || 0),
                                  })}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <label
                              className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                              htmlFor={`issue-quantity-${index}`}
                            >
                              {tr('issueForm.fields.quantity')}
                            </label>
                            <input
                              id={`issue-quantity-${index}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={issueItem.quantity}
                              onChange={handleIssueItemChange(index, 'quantity')}
                              placeholder={tr('issueForm.fields.quantityPlaceholder')}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                              required
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="issue-picking-strategy">
                  {tr('issueForm.fields.pickingStrategy')}
                </label>
                <select
                  id="issue-picking-strategy"
                  value={issueForm.picking_strategy}
                  onChange={handleIssueFormChange('picking_strategy')}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  <option value="fefo">{tr('issueForm.fields.pickingOptions.fefo')}</option>
                  <option value="fifo">{tr('issueForm.fields.pickingOptions.fifo')}</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="issue-notes">
                  {tr('issueForm.fields.notes')}
                </label>
                <textarea
                  id="issue-notes"
                  value={issueForm.notes}
                  onChange={handleIssueFormChange('notes')}
                  rows="3"
                  placeholder={tr('issueForm.fields.notesPlaceholder')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                />
              </div>

              {issueFormStatus.message && (
                <div
                  className={`rounded-md px-3 py-2 text-sm ${
                    issueFormStatus.state === 'success'
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-100'
                      : 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-100'
                  }`}
                >
                  {issueFormStatus.message}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
                  disabled={issueFormStatus.state === 'loading'}
                >
                  {issueFormStatus.state === 'loading' ? tr('issueForm.submitLoading') : tr('issueForm.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
    </>
  );
};

export default WarehouseInventoryPage;