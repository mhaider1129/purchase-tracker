import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import Navbar from '../components/Navbar';

const MaintenanceStockListPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStock = async () => {
      try {
        const res = await api.get('/api/maintenance-stock');
        setItems(res.data || []);
      } catch (err) {
        console.error('Failed to load maintenance stock:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStock();
  }, []);

  return (
    <>
      <Navbar />
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Maintenance Stock</h1>
        {loading ? (
          <p className="text-gray-600">Loading...</p>
        ) : items.length === 0 ? (
          <p>No stock items found.</p>
        ) : (
          <table className="w-full text-sm border">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2 text-left">Item</th>
                <th className="border p-2 text-left">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="border p-2">{it.item_name}</td>
                  <td className="border p-2">{it.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
};

export default MaintenanceStockListPage;