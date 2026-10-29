import {deriveItemPurchaseState} from './itemPurchaseStatus';
test.each([{is_available_in_stock:true},{procurement_status:' Available_in_stock '},{approval_status:'Available in Stock'}])('stock disposition has a distinct label and does not fabricate purchased quantity: %j', marker=>{
 expect(deriveItemPurchaseState({quantity:10,purchased_quantity:0,procurement_status:'pending',...marker})).toMatchObject({statusKey:'availableInStock',purchasedQuantity:0});
});
test('available quantity alone is not a stock fulfillment decision',()=>{
 expect(deriveItemPurchaseState({quantity:10,purchased_quantity:0,available_quantity:99,procurement_status:'pending'}).statusKey).toBe('notPurchased');
});
