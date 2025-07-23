import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import useCurrentUser from '../hooks/useCurrentUser';

const MaintenanceStockPage = () => {
  const { user, loading } = useCurrentUser();
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({ item_name: '', quantity: 0 });

  const fetchStock = async () => {
    try {
      const res = await api.get('/api/maintenance-stock');
      setItems(res.data || []);
    } catch (err) {
      console.error('Failed to load maintenance stock:', err);
    }
  };

  useEffect(() => {
    if (user) fetchStock();
  }, [user]);

  const saveItem = async (item) => {
    if (!window.confirm('Save changes to this item?')) return;
    try {
      if (item.id) {
        await api.put(`/api/maintenance-stock/${item.id}`, {
          item_name: item.item_name,
          quantity: parseInt(item.quantity, 10) || 0,
        });
      } else {
        await api.post('/api/maintenance-stock', {
          item_name: item.item_name,
          quantity: parseInt(item.quantity, 10) || 0,
        });
        setNewItem({ item_name: '', quantity: 0 });
      }
      fetchStock();
    } catch (err) {
      console.error('Failed to save stock item:', err);
      alert('Failed to save item');
    }
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
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Maintenance Stock</h1>
        <table className="w-full text-sm border mb-4">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2 text-left">Item</th>
              <th className="border p-2 text-left">Quantity</th>
              <th className="border p-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td className="border p-2">{it.item_name}</td>
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
                      className="px-3 py-1 bg-blue-600 text-white rounded"
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
                      setNewItem({ ...newItem, quantity: e.target.value })
                    }
                  />
                </td>
                <td className="border p-2">
                  <button
                    className="px-3 py-1 bg-green-600 text-white rounded"
                    onClick={() => saveItem(newItem)}
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