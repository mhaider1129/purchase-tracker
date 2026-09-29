export const normalizeContractSearch = (value) =>
  String(value ?? '')
    .toLocaleLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const matchesContractSearch = (contract, query) => {
  const terms = normalizeContractSearch(query).split(' ').filter(Boolean);
  if (!terms.length) return true;

  const searchableText = normalizeContractSearch([
    contract.title,
    contract.vendor,
    contract.reference_number,
    contract.contract_owner,
    contract.contract_category,
    contract.contract_type,
    contract.status,
    contract.first_party,
    contract.second_party,
    contract.description,
    contract.source_request_id,
  ].filter(Boolean).join(' '));

  return terms.every((term) => searchableText.includes(term));
};

export const getContractDateBucket = (contract) => {
  if (contract?.is_expired || Number(contract?.days_until_expiry) < 0) return 'expired';
  if (contract?.days_until_expiry === null || contract?.days_until_expiry === undefined || contract?.days_until_expiry === '') return 'unscheduled';
  const days = Number(contract?.days_until_expiry);
  if (!Number.isFinite(days)) return 'unscheduled';
  if (days <= 30) return 'next_30';
  if (days <= 90) return 'next_90';
  return 'later';
};

export const contractMatchesFilters = (contract, filters) => {
  if (!matchesContractSearch(contract, filters.search)) return false;
  if (filters.status !== 'all' && contract.status !== filters.status) return false;
  if (filters.type !== 'all' && contract.contract_type !== filters.type) return false;
  if (filters.owner !== 'all' && (contract.contract_owner || '') !== filters.owner) return false;

  const renewalBucket = getContractDateBucket(contract);
  if (filters.renewal === 'expiring' && renewalBucket !== 'next_30') return false;
  if (filters.renewal === 'expired' && renewalBucket !== 'expired') return false;
  if (filters.renewal === 'next_90' && !['next_30', 'next_90'].includes(renewalBucket)) return false;
  if (filters.renewal === 'unscheduled' && renewalBucket !== 'unscheduled') return false;

  const value = Number(contract.contract_value);
  if (filters.minValue !== '' && (!Number.isFinite(value) || value < Number(filters.minValue))) return false;
  if (filters.maxValue !== '' && (!Number.isFinite(value) || value > Number(filters.maxValue))) return false;
  return true;
};