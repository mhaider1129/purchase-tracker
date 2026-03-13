import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProcureToPayDashboard } from '../api/procureToPay';

const ProcureToPayDashboardPage = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    getProcureToPayDashboard().then((res) => setData(res?.data || null));
  }, []);

  const cards = [
    ['Approved requests awaiting PO', data?.approved_requests_awaiting_po],
    ['POs awaiting receipt', data?.pos_awaiting_receipt],
    ['Invoices pending match', data?.invoices_pending_match],
    ['Invoices in exception', data?.invoices_in_exception],
    ['Open payables due today', data?.open_payables_due_today],
    ['Overdue payables', data?.overdue_payables],
    ['Payments posted this week', data?.payments_posted_this_week],
  ];

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Procure-to-Pay Dashboard</h1>
      <div className="grid md:grid-cols-3 gap-3">
        {cards.map(([label, value]) => <div key={label} className="bg-white rounded shadow p-4"><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-semibold">{value ?? '...'}</p></div>)}
      </div>
      <div className="bg-white rounded shadow p-4">
        <h2 className="font-semibold mb-2">Quick Actions</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link to="/procure-to-pay/purchase-orders" className="px-3 py-1 rounded bg-indigo-600 text-white">Purchase Orders</Link>
          <Link to="/procure-to-pay/receipts" className="px-3 py-1 rounded bg-blue-600 text-white">Goods Receipt PO</Link>
          <Link to="/procure-to-pay/invoices" className="px-3 py-1 rounded bg-violet-600 text-white">A/P Invoices</Link>
          <Link to="/procure-to-pay/matching" className="px-3 py-1 rounded bg-amber-600 text-white">Matching Queue</Link>
          <Link to="/procure-to-pay/accounts-payable" className="px-3 py-1 rounded bg-cyan-700 text-white">Accounts Payable</Link>
          <Link to="/procure-to-pay/payments" className="px-3 py-1 rounded bg-emerald-700 text-white">Payments</Link>
          <Link to="/procure-to-pay/document-flow" className="px-3 py-1 rounded bg-purple-700 text-white">Document Flow</Link>
        </div>
      </div>
    </div>
  );
};

export default ProcureToPayDashboardPage;