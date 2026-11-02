const mod = await import(new URL('../src/services/stockMovementService.ts', import.meta.url));
const { validateStockMovementPlan } = mod;

const stock = [
  { product_id: 'p-1', org_id: 'org-1', location_type: 'WAREHOUSE', location_id: 'w-1', quantity: 15, reserved_quantity: 0, status: 'IN_STOCK' },
  { product_id: 'p-1', org_id: 'org-1', location_type: 'WAREHOUSE', location_id: 'w-2', quantity: 0, reserved_quantity: 0, status: 'OUT_OF_STOCK' },
];

const validPlan = [
  { product_id: 'p-1', quantity: 10, from_location_type: 'WAREHOUSE', from_location_id: 'w-1', to_location_type: 'WAREHOUSE', to_location_id: 'w-2' },
  { product_id: 'p-1', quantity: 5, from_location_type: 'WAREHOUSE', from_location_id: 'w-1', to_location_type: 'WAREHOUSE', to_location_id: 'w-2' },
];

const invalidPlan = [
  { product_id: 'p-1', quantity: 16, from_location_type: 'WAREHOUSE', from_location_id: 'w-1', to_location_type: 'WAREHOUSE', to_location_id: 'w-2' },
];

const validResult = validateStockMovementPlan(validPlan, stock);
if (!validResult.ok) {
  throw new Error(`Valid plan failed: ${validResult.reason}`);
}

const invalidResult = validateStockMovementPlan(invalidPlan, stock);
if (invalidResult.ok) {
  throw new Error('Invalid plan unexpectedly passed validation.');
}

console.log('stock movement validation ok');
