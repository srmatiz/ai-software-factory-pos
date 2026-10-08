import { describe, expect, it } from "vitest";
import { costExceedsSalePrice, lineSubtotal, lineUnitCost, purchaseTotal } from "@/lib/purchase";

describe("lineUnitCost", () => {
  it("uses the entered cost in unit mode", () => {
    expect(lineUnitCost({ quantity: 3, costMode: "unit", cost: "1.5" }).toString()).toBe("1.5");
  });
  it("divides the batch total by quantity, rounded to 4 decimals", () => {
    expect(lineUnitCost({ quantity: 3, costMode: "total", cost: "10" }).toString()).toBe("3.3333");
    expect(lineUnitCost({ quantity: 12, costMode: "total", cost: "24000" }).toString()).toBe("2000");
  });
});

describe("lineSubtotal and purchaseTotal", () => {
  it("unit mode is quantity x cost; total mode is the entered total", () => {
    expect(lineSubtotal({ quantity: 4, costMode: "unit", cost: "2.5" }).toString()).toBe("10");
    expect(lineSubtotal({ quantity: 3, costMode: "total", cost: "10" }).toString()).toBe("10");
  });
  it("rounds only at the end", () => {
    const lines = [
      { quantity: 1, costMode: "unit" as const, cost: "0.0033" },
      { quantity: 1, costMode: "unit" as const, cost: "0.0033" },
      { quantity: 1, costMode: "unit" as const, cost: "0.0033" },
      { quantity: 1, costMode: "unit" as const, cost: "0.0033" },
      { quantity: 1, costMode: "unit" as const, cost: "0.0033" },
    ];
    // each rounds to 0.00, but the sum 0.0165 rounds to 0.02
    expect(purchaseTotal(lines).toString()).toBe("0.02");
  });
  it("is zero for no lines", () => {
    expect(purchaseTotal([]).toString()).toBe("0");
  });
});

describe("costExceedsSalePrice", () => {
  const line = { quantity: 1, costMode: "unit" as const, cost: "100" };
  it("warns only when the unit cost is above the sale price", () => {
    expect(costExceedsSalePrice(line, "99.99")).toBe(true);
    expect(costExceedsSalePrice(line, "100")).toBe(false);
    expect(costExceedsSalePrice(line, "150")).toBe(false);
  });
  it("compares the derived unit cost in total mode", () => {
    expect(costExceedsSalePrice({ quantity: 10, costMode: "total", cost: "1000" }, "99")).toBe(true);
  });
});
