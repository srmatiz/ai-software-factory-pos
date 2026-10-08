import { Decimal } from "decimal.js";

// All money math goes through Decimal; never use JS floats for prices or costs.
export { Decimal };

export type DecimalLike = Decimal | string | number;

const d = (v: DecimalLike) => new Decimal(v);

/** Profit per unit: salePrice - cost. */
export function unitProfit(salePrice: DecimalLike, cost: DecimalLike): Decimal {
  return d(salePrice).minus(d(cost));
}

/**
 * Margin as a percentage of the sale price: (price - cost) / price * 100.
 * Returns null when the price is zero (margin undefined).
 */
export function marginPercent(salePrice: DecimalLike, cost: DecimalLike): Decimal | null {
  const price = d(salePrice);
  if (price.isZero()) return null;
  return unitProfit(price, cost).dividedBy(price).times(100).toDecimalPlaces(2);
}

/**
 * Weighted average cost after receiving `inQty` units at `inCost`.
 * If current stock is zero or negative, the incoming cost becomes the new cost.
 */
export function weightedAverageCost(
  currentStock: DecimalLike,
  currentCost: DecimalLike,
  inQty: DecimalLike,
  inCost: DecimalLike,
): Decimal {
  const stock = d(currentStock);
  const qty = d(inQty);
  if (stock.lte(0)) return d(inCost).toDecimalPlaces(4);
  const total = stock.plus(qty);
  if (total.isZero()) return d(inCost).toDecimalPlaces(4);
  return stock.times(currentCost).plus(qty.times(inCost)).dividedBy(total).toDecimalPlaces(4);
}

export function formatMoney(value: DecimalLike, currency = "COP", locale = "es-CO"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(d(value).toNumber());
}

/** Formats a percentage value (e.g. 52.5 -> "52,5 %" in es-CO). */
export function formatPercent(value: DecimalLike, locale = "es-CO"): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(d(value).dividedBy(100).toNumber());
}
