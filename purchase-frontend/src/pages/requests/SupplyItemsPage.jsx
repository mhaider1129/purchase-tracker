import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';

const SupplyItemsPage = () => {
  const { id } = useParams();
  const [items, setItems] = useState([]);
  const [qtyMap, setQtyMap] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await api.get(`/api/requests/${id}/items`);
        setItems(res.data.items || []);
        const map = {};
        (res.data.items || []).forEach(it => { map[it.id] = it.quantity; });
        setQtyMap(map);
      } catch (err) {
        console.error('Failed to load items:', err);
      }
    };
    fetchItems();
  }, [id]);

  const handleChange = (itemId, value) => {
    setQtyMap(prev => ({ ...prev, [itemId]: value }));
  };

  const handleSave = async () => {
    if (!window.confirm('Save supplied quantities?')) return;
    const payload = { items: items.map(it => ({ item_id: it.id, supplied_quantity: Number(qtyMap[it.id]) || 0 })) };
    try {
      setSaving(true);
      await api.post(`/api/warehouse-supply/${id}/items`, payload);
      alert('Supplied quantities saved');
    } catch (err) {
      console.error('Save failed:', err);
      alert(err.response?.data?.message || 'Failed to save quantities');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-xl font-bold mb-4">Supply Items</h1>
        {items.map(it => (
          <div key={it.id} className="mb-3 flex items-center gap-2">
            <span className="flex-1">{it.item_name}</span>
            <input
              type="number"
              min={0}
              value={qtyMap[it.id]}
              onChange={(e) => handleChange(it.id, e.target.value)}
              className="w-24 p-1 border rounded"
            />
          </div>
        ))}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`mt-4 px-4 py-2 bg-blue-600 text-white rounded ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </>
  );
};

export default SupplyItemsPage;