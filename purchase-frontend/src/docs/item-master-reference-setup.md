# Set up Item Master references and resolve referrals

Generic Items use active controlled categories and UOMs. Legacy item text fields
do not populate these lists. Empty lists and failed API requests now have
different messages, with refresh/retry actions for loading failures.

## Create an item when the category or UOM list is empty

1. Open Item Master → Generic Items → Create Generic Item.
2. Enter the item code, generic name and canonical description.
3. Under **Controlled reference data**, choose **Set up standard lists** to add
   15 standard categories (including Furniture) and 12 controlled UOMs. Existing
   references, including inactive ones, are preserved; repeating setup only adds
   missing entries. Each new entry is audited. Alternatively, use **Add category** and save its name
   (for example, Furniture). Use **Add UOM** and save its controlled code and
   name (for example, EA / Piece).
4. References created individually are selected after refresh. Standard setup
   refreshes the lists; select the appropriate category and UOM. Your item fields stay
   in the form. Choose other references if needed.
5. Create the governed draft, then complete review → validation → approval →
   active using the authorized lifecycle actions in Generic Items.

Reference creation requires `item-master.references-maintain`; Generic Item
creation requires `item-master.create`. Reading references and searching the
catalog requires `item-master.view`. If a creator cannot maintain references,
ask an authorized maintainer to add them, then use **Refresh reference lists**
without leaving the draft. Resolve loading errors before saving.

These actions use existing authenticated APIs, server validation and audit
logging. No default categories or units are inserted automatically. The chosen
controlled unit becomes both base and inventory UOM, as in the existing workflow.

## Resolve a missing-item referral

1. In Pending Item Master requests, choose **Resolve referral**.
2. Search and select an **active** Generic Item, enter decision notes, and save.
3. If the item does not exist, an authorized creator can choose **Create Generic
   Item draft for this referral**. Name, specifications and item type prefill the
   draft. Reference setup is available in this form too.
4. Creating a draft leaves the referral open. Note its item code, complete its
   lifecycle in Generic Items, then return and link the active item. Creation
   does not activate an item or authorize procurement. Resolve duplicate
   candidates before activation if the creation response reports them.
5. For clarification, choose **Request more information** with decision notes.
   Authorized exception and rejection options remain available.

Referral resolution requires `item-master.map`. Review uses `item-master.edit`,
validation/approval submission uses `item-master.validate`, and activation uses
`item-master.approve`. Free-text exceptions require their separate permission.
Product and Supplier Catalog creation select existing active Generic Items;
they cannot create another pending referral.

The shared Item type list includes Furniture, Equipment, General consumables,
Cleaning supply, Linen, Food and beverages, and Service in both Generic Item
creation and missing-item referrals. These types describe identity, not quantity
conversions or approval rules.

Generic Items, Products, Supplier Catalog and Reference data show 25 records per
page. Previous is disabled on the first page; Next is disabled on the last page.
Both are disabled while loading or when there are no records. The page count and
empty-list message explain these boundaries. Changing filters or reference type
returns to page 1.

No database migration is required. Deploy both the backend and frontend after
merging, then verify with an authorized development user against the
already-migrated backend. Automated UI checks mock API responses and do not
verify the contents of a connected database.
