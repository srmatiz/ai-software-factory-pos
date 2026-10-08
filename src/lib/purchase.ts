import { Decimal, type DecimalLike } from "@/lib/money";

// Pure purchase math shared by the form (preview) and the service (persisted values).
// Rounding happens only where a value is stored: unit cost at 4 decimals, total at 2.

export type CostMode = "unit" | "total";
export type PurchaseLineCost = { quantity: DecimalLike; costMode: CostMode; cost: DecimalLike };

/** Unit cost of a line: the entered cost, or batch total / quantity rounded to 4 decimals. */
export function lineUnitCost(line: PurchaseLineCost): Decimal {
  const cost = new Decimal(line.cost);
  if (line.costMode === "unit") return cost;
  const qty = new Decimal(line.quantity);
  if (qty.lte(0)) return new Decimal(0);
  return cost.dividedBy(qty).toDecimalPlaces(4);
}

/** Line subtotal, unrounded: the batch total as entered, or quantity x unit cost. */
export function lineSubtotal(line: PurchaseLineCost): Decimal {
  const cost = new Decimal(line.cost);
  return line.costMode === "total" ? cost : new Decimal(line.quantity).times(cost);
}

/** Purchase total: sum of unrounded subtotals, rounded to 2 decimals at the end. */
export function purchaseTotal(lines: PurchaseLineCost[]): Decimal {
  return lines.reduce((sum, l) => sum.plus(lineSubtotal(l)), new Decimal(0)).toDecimalPlaces(2);
}

/** True when the unit cost is strictly above the sale price (warning only). */
export function costExceedsSalePrice(line: PurchaseLineCost, salePrice: DecimalLike): boolean {
  return lineUnitCost(line).gt(new Decimal(salePrice));
}
