import React, { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import useCurrentUser from '../hooks/useCurrentUser';

const MaintenanceStockPage = () => {
  const { user, loading } = useCurrentUser();
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({ item_name: '', quantity: 0 });
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'item_name', direction: 'asc' });

  const fetchStock = async () => {
    try {
      const res = await api.get('/api/maintenance-stock');
      setItems(res.data || []);
      setStatus({ type: 'idle', message: '' });
    } catch (err) {
      console.error('Failed to load maintenance stock:', err);
      setStatus({ type: 'error', message: 'Failed to load maintenance stock.' });
    }
  };

  useEffect(() => {
    if (user) fetchStock();
  }, [user]);

  useEffect(() => {
    if (status.type === 'success') {
      const timer = setTimeout(() => setStatus({ type: 'idle', message: '' }), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status]);

  const saveItem = async (item) => {
    if (!item.item_name?.trim()) {
      setStatus({ type: 'error', message: 'Item name is required.' });
      return;
    }

    const parsedQuantity = Number.isNaN(Number(item.quantity))
      ? 0
      : Number(item.quantity);

    if (parsedQuantity < 0) {
      setStatus({ type: 'error', message: 'Quantity cannot be negative.' });
      return;
    }

    if (!window.confirm('Save changes to this item?')) return;

    try {
      if (item.id) {
        await api.put(`/api/maintenance-stock/${item.id}`, {
          item_name: item.item_name,
          quantity: parsedQuantity,
        });
      } else {
        await api.post('/api/maintenance-stock', {
          item_name: item.item_name,
          quantity: parsedQuantity,
        });
        setNewItem({ item_name: '', quantity: 0 });
      }
      fetchStock();
      setStatus({ type: 'success', message: 'Stock item saved successfully.' });
    } catch (err) {
      console.error('Failed to save stock item:', err);
      setStatus({ type: 'error', message: 'Failed to save item.' });
    }
  };

  const sortedItems = useMemo(() => {
    const sortable = [...items];
    sortable.sort((a, b) => {
      const { key, direction } = sortConfig;

      const valA = key === 'quantity' ? Number(a[key]) : a[key]?.toLowerCase?.() ?? '';
      const valB = key === 'quantity' ? Number(b[key]) : b[key]?.toLowerCase?.() ?? '';

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sortable;
  }, [items, sortConfig]);

  const visibleItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return sortedItems;
    return sortedItems.filter((item) =>
      item.item_name?.toLowerCase?.().includes(term)
    );
  }, [sortedItems, searchTerm]);

  const totals = useMemo(() => {
    const totalQuantity = visibleItems.reduce(
      (acc, item) => acc + (Number.isNaN(Number(item.quantity)) ? 0 : Number(item.quantity)),
      0
    );
    return {
      items: visibleItems.length,
      totalQuantity,
    };
  }, [visibleItems]);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        const nextDirection = prev.direction === 'asc' ? 'desc' : 'asc';
        return { key, direction: nextDirection };
      }
      return { key, direction: 'asc' };
    });
  };

  if (loading || !user) {
    return (
      <>
        <Navbar />
        <div className="p-6 text-gray-600">Loading...</div>
      </>
    );
  }

  const isManager =
    user.role === 'WarehouseManager' || user.role === 'warehouse_manager';

  return (
    <>
      <Navbar />
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Maintenance Stock</h1>
            <p className="text-sm text-gray-600">
              Track current maintenance inventory and adjust quantities as needed.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="search"
              className="border rounded px-3 py-2 text-sm"
              placeholder="Search items"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="flex border rounded overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => handleSort('item_name')}
                className={`px-3 py-2 transition-colors ${
                  sortConfig.key === 'item_name' ? 'bg-blue-600 text-white' : 'bg-white'
                }`}
              >
                Sort A-Z
              </button>
              <button
                type="button"
                onClick={() => handleSort('quantity')}
                className={`px-3 py-2 border-l transition-colors ${
                  sortConfig.key === 'quantity' ? 'bg-blue-600 text-white' : 'bg-white'
                }`}
              >
                Sort Qty
              </button>
            </div>
          </div>
        </div>

        {status.type !== 'idle' && status.message && (
          <div
            className={`rounded border px-4 py-3 text-sm ${
              status.type === 'error'
                ? 'border-red-300 bg-red-50 text-red-700'
                : 'border-green-300 bg-green-50 text-green-700'
            }`}
          >
            {status.message}
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-sm text-gray-700">
          <div className="px-3 py-2 bg-gray-100 rounded">
            <span className="font-semibold">Visible Items:</span> {totals.items}
          </div>
          <div className="px-3 py-2 bg-gray-100 rounded">
            <span className="font-semibold">Total Quantity:</span> {totals.totalQuantity}
          </div>
        </div>

        <table className="w-full text-sm border rounded overflow-hidden">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2 text-left">Item</th>
              <th className="border p-2 text-left">Quantity</th>
              <th className="border p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.length === 0 && (
              <tr>
                <td colSpan={3} className="border p-4 text-center text-gray-500">
                  No items match your filters.
                </td>
              </tr>
            )}
            {visibleItems.map((it) => (
              <tr key={it.id} className={Number(it.quantity) <= 5 ? 'bg-red-50' : ''}>
                <td className="border p-2 align-top">
                  <div className="font-medium text-gray-900">{it.item_name}</div>
                  {Number(it.quantity) <= 5 && (
                    <p className="text-xs text-red-600">Low stock warning</p>
                  )}
                </td>
                <td className="border p-2">
                  {isManager ? (
                    <input
                      type="number"
                      value={it.quantity}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((p) =>
                            p.id === it.id ? { ...p, quantity: e.target.value } : p
                          )
                        )
                      }
                      className="w-24 p-1 border rounded"
                    />
                  ) : (
                    it.quantity
                  )}
                </td>
                <td className="border p-2">
                  {isManager && (
                    <button
                      className="px-3 py-1 bg-blue-600 text-white rounded shadow-sm hover:bg-blue-700"
                      onClick={() => saveItem(it)}
                    >
                      Save
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {isManager && (
              <tr>
                <td className="border p-2">
                  <input
                    className="w-full p-1 border rounded"
                    placeholder="New item"
                    value={newItem.item_name}
                    onChange={(e) =>
                      setNewItem({ ...newItem, item_name: e.target.value })
                    }
                  />
                </td>
                <td className="border p-2">
                  <input
                    type="number"
                    className="w-24 p-1 border rounded"
                    value={newItem.quantity}
                    onChange={(e) =>
                      setNewItem({
                        ...newItem,
                        quantity: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                  />
                </td>
                <td className="border p-2">
                  <button
                    className="px-3 py-1 bg-green-600 text-white rounded shadow-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => saveItem(newItem)}
                    disabled={!newItem.item_name?.trim()}
                  >
                    Add
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default MaintenanceStockPage;