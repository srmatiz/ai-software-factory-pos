# Approved story: Purchases (stock receiving)

Status: approved by the human on 2026-10-07.

## User story

As an ADMIN, I want to register a purchase by scanning the products that arrived and entering the quantity and cost of each, so that my stock and average cost update automatically.

## Acceptance criteria

1. Given a purchase with one or more scanned products, each with quantity and cost, when I save it, then the purchase is recorded with its total and each product's stock goes up by the quantity received.
2. Given a saved purchase, when I check the inventory history of each product, then there is a purchase movement with the quantity and the cost entered.
3. Given a product with existing stock, when I save a purchase at a different cost, then its cost becomes the weighted average of the old stock and the new arrival.
4. Given a product with no stock (zero or less), when I save a purchase, then its cost becomes the cost entered in the purchase.
5. Given a purchase with several products, when one of them is invalid, then nothing is saved and no stock changes for any product.
6. Given a quantity or cost that is empty, zero or negative, when I try to save, then I see a Spanish error and nothing is saved. A decimal comma is accepted in costs.
7. Given I scan a code that does not belong to a product in my business, when the scan finishes, then I see a message and the item is not added.
8. Given I am logged into business A, when I look at or save purchases, then I only see and use the products and purchases of business A, never those of business B. A user without the ADMIN role cannot register purchases.
9. Given a product that is already in the purchase, when I scan it again, then its quantity goes up by 1 and no new line is added.
10. Given a purchase line, when I enter the batch total instead of the unit cost, then the unit cost is computed as total ÷ quantity and that is the cost used for the average and the movement.
11. Given a line whose unit cost is higher than the product's sale price, when I see it before saving, then a warning about that inconsistency is shown, and the purchase can still be saved.
12. Given an inactive product, when I scan it and save the purchase, then it is accepted like any other product and becomes active again.
13. Given a quantity with decimals, when I try to save, then I see a Spanish error: quantities are whole units for now.

## Edge cases

- Very small or very large quantities and costs.
- Purchase with no products added.
- The total shown matches the sum of quantity × cost of each line.

## Out of scope

- Suppliers (choosing, creating, editing or listing) and invoice number: a separate story.
- Purchase list or history, editing, cancelling or returns.
- Payments, credit and amounts owed to suppliers.
- Creating a new product from the purchase screen.
- Changing the sale price after a cost change (it is only warned).
- Unit of measure (products sold by weight with decimal quantities): a separate story; until then quantities are whole units.

## Human decisions (resolved open questions)

- Role: ADMIN only for now; not CAJERO.
- Supplier: not asked in this story; left for another one.
- Cost: each line accepts either the unit cost or the batch total.
- Cost higher than the sale price: warn, do not block.
- Scanning the same product twice: increases the quantity of the existing line.
- Inactive products: allowed; saving the purchase reactivates them.
- Quantities: whole units only for now; decimals will come with the unit-of-measure story.
- Rounding: only the purchase total is rounded (2 decimals), at the end.
- Negative stock counts as "no stock" for the cost (criterion 4).
