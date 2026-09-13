import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createEquipment, listAvailableAssets, listEquipment, updateEquipment } from '../api/equipment';

const blank = { asset_id: '', equipment_code: '', lifecycle_status: 'ACTIVE' };

export default function EquipmentManagementPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [assets, setAssets] = useState([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setState('loading');
    return listEquipment({ search: query, limit: 100 })
      .then(result => { setRows(result.data); setState('ready'); })
      .catch(requestError => {
        setError(requestError.response?.data?.message || t('spareParts.error'));
        setState('error');
      });
  }, [query, t]);

  const loadAssets = useCallback((includeAssetId = '') => {
    return listAvailableAssets({ limit: 100, includeAssetId })
      .then(setAssets)
      .catch(() => setAssets([]));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadAssets(); }, [loadAssets]);

  const change = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const save = async event => {
    event.preventDefault();
    setError('');
    try {
      if (editing) await updateEquipment(editing, form);
      else await createEquipment(form);
      setEditing(null);
      setForm(blank);
      await Promise.all([load(), loadAssets()]);
    } catch (requestError) {
      setError(requestError.response?.data?.message || t('spareParts.error'));
    }
  };
  const edit = async row => {
    setEditing(row.id);
    setForm({ asset_id: row.asset_id || '', equipment_code: row.equipment_code, lifecycle_status: row.lifecycle_status });
    await loadAssets(row.asset_id || '');
  };
  const cancel = () => { setEditing(null); setForm(blank); loadAssets(); };

  return <main className="mx-auto max-w-6xl p-6">
    <header className="mb-6">
      <h1 className="text-2xl font-bold">{t('spareParts.equipmentManagement')}</h1>
      <p className="mt-1 text-sm text-slate-600">{t('spareParts.equipment.assetAuthority')}</p>
    </header>
    {error && <p role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-red-700">{error}</p>}
    <input aria-label={t('spareParts.searchEquipment')} className="mb-4 w-full rounded border p-3" value={query} onChange={event => setQuery(event.target.value)} />
    <form onSubmit={save} className="mb-6 grid gap-4 rounded border bg-white p-5 shadow-sm md:grid-cols-3">
      <label className="md:col-span-2">{t('spareParts.equipment.asset')}
        <select required className="mt-1 w-full rounded border p-2" name="asset_id" value={form.asset_id} onChange={change} disabled={editing && Boolean(form.asset_id)}>
          <option value="">{t('spareParts.equipment.selectAsset')}</option>
          {assets.map(asset => <option key={asset.id} value={asset.id}>{asset.asset_number} — {asset.description}</option>)}
        </select>
        <span className="mt-1 block text-xs text-slate-500">{t('spareParts.equipment.assetIdentityHint')}</span>
      </label>
      <label>{t('spareParts.equipment.equipment_code')}
        <input required className="mt-1 w-full rounded border p-2" name="equipment_code" value={form.equipment_code} onChange={change} />
      </label>
      <label>{t('spareParts.equipment.lifecycle_status')}
        <select className="mt-1 w-full rounded border p-2" name="lifecycle_status" value={form.lifecycle_status} onChange={change}>
          {['ACTIVE', 'INACTIVE', 'OBSOLETE', 'SUPERSEDED'].map(value => <option key={value}>{value}</option>)}
        </select>
      </label>
      <div className="flex items-end gap-2">
        <button className="rounded bg-blue-600 px-5 py-2 text-white">{editing ? t('common.save') : t('common.add')}</button>
        {editing && <button type="button" className="rounded border px-5 py-2" onClick={cancel}>{t('common.cancel')}</button>}
      </div>
    </form>
    {state === 'loading' ? <p>{t('common.loading')}</p> : !rows.length ? <p>{t('spareParts.noEquipment')}</p> :
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-left">
          <thead className="bg-slate-100"><tr>
            <th className="p-3">{t('spareParts.equipment.equipment_code')}</th>
            <th className="p-3">{t('spareParts.equipment.asset')}</th>
            <th className="p-3">{t('spareParts.equipment.name')}</th>
            <th className="p-3">{t('spareParts.equipment.manufacturer')}</th>
            <th className="p-3">{t('spareParts.equipment.model')}</th>
            <th className="p-3">{t('spareParts.equipment.activeContracts')}</th>
            <th className="p-3">{t('spareParts.equipment.openWorkOrders')}</th>
            <th className="p-3">{t('spareParts.equipment.lifecycle_status')}</th><th />
          </tr></thead>
          <tbody>{rows.map(row => <tr className="border-t" key={row.id}>
            <td className="p-3 font-medium">{row.equipment_code}</td><td className="p-3">{row.asset_number || t('spareParts.equipment.legacyUnlinked')}</td>
            <td className="p-3">{row.name || '—'}</td><td className="p-3">{row.manufacturer || '—'}</td><td className="p-3">{row.model || '—'}</td><td className="p-3">{row.active_contract_count || 0}</td><td className="p-3">{row.open_work_order_count || 0}</td>
            <td className="p-3">{row.lifecycle_status}</td><td className="p-3"><button className="text-blue-700" onClick={() => edit(row)}>{t('spareParts.edit')}</button></td>
          </tr>)}</tbody>
        </table>
      </div>}
  </main>;
}