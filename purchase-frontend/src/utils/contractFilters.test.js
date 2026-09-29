import { contractMatchesFilters, getContractDateBucket, matchesContractSearch } from './contractFilters';

const contract = {
  title: 'Medical equipment support',
  vendor: 'Acme Health',
  reference_number: 'WICI-2026-04',
  contract_owner: 'Mina Ali',
  contract_category: 'Maintenance',
  contract_type: 'purchasing',
  status: 'active',
  contract_value: 250000,
  days_until_expiry: 45,
};

test('searches multiple terms across contract metadata', () => {
  expect(matchesContractSearch(contract, 'acme maintenance')).toBe(true);
  expect(matchesContractSearch(contract, 'mina WICI')).toBe(true);
  expect(matchesContractSearch(contract, 'acme software')).toBe(false);
});

test('groups renewal dates into useful workspace buckets', () => {
  expect(getContractDateBucket({ days_until_expiry: 12 })).toBe('next_30');
  expect(getContractDateBucket({ days_until_expiry: 75 })).toBe('next_90');
  expect(getContractDateBucket({ is_expired: true })).toBe('expired');
  expect(getContractDateBucket({ days_until_expiry: null })).toBe('unscheduled');
});

test('combines search, portfolio, and value filters', () => {
  expect(contractMatchesFilters(contract, {
    search: 'medical acme', status: 'active', type: 'purchasing', owner: 'Mina Ali',
    renewal: 'next_90', minValue: '200000', maxValue: '300000',
  })).toBe(true);
  expect(contractMatchesFilters(contract, {
    search: '', status: 'active', type: 'all', owner: 'all',
    renewal: 'all', minValue: '', maxValue: '100000',
  })).toBe(false);
});