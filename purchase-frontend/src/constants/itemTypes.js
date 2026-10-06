export const ITEM_TYPES = [
  'general_item', 'medication', 'medical_supply', 'medical_device',
  'laboratory_item', 'maintenance_spare_part', 'it_item', 'stationery',
  'furniture', 'equipment', 'consumable', 'cleaning_supply', 'linen',
  'food_beverage', 'service',
].map(value => ({
  value,
  label: ({ it_item: 'IT item', consumable: 'General consumables', food_beverage: 'Food and beverages' })[value]
    || value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' '),
}));
