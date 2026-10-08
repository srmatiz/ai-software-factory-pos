import { describe, expect, it } from "vitest";
import { formatMoney, formatPercent, marginPercent, unitProfit, weightedAverageCost } from "@/lib/money";

describe("unitProfit", () => {
  it("is sale price minus cost", () => {
    expect(unitProfit("2500", "1200").toString()).toBe("1300");
  });
  it("is negative when selling below cost", () => {
    expect(unitProfit(1000, 1500).toString()).toBe("-500");
  });
  it("has no float rounding errors", () => {
    expect(unitProfit("0.3", "0.1").toString()).toBe("0.2");
  });
});

describe("marginPercent", () => {
  it("is profit over sale price", () => {
    expect(marginPercent(2500, 1200)?.toString()).toBe("52");
    expect(marginPercent(3, 2)?.toString()).toBe("33.33");
  });
  it("is null when the price is zero", () => {
    expect(marginPercent(0, 100)).toBeNull();
  });
});

describe("weightedAverageCost", () => {
  it("averages current stock with the incoming purchase", () => {
    // 10 units @ 100 + 10 units @ 200 = 150
    expect(weightedAverageCost(10, 100, 10, 200).toString()).toBe("150");
    // 30 @ 1000 + 10 @ 1400 = 1100
    expect(weightedAverageCost(30, 1000, 10, 1400).toString()).toBe("1100");
  });
  it("uses the incoming cost when there is no stock", () => {
    expect(weightedAverageCost(0, 100, 5, 120).toString()).toBe("120");
    expect(weightedAverageCost(-3, 100, 5, 120).toString()).toBe("120");
  });
  it("rounds to 4 decimals", () => {
    expect(weightedAverageCost(1, 1, 2, 2).toString()).toBe("1.6667");
  });
});

describe("formatPercent", () => {
  it("uses the Spanish decimal comma", () => {
    // Spacing before % varies across ICU versions, so ignore whitespace.
    expect(formatPercent(52).replace(/\s/g, "")).toBe("52,0%");
  });
});

describe("formatMoney", () => {
  // ICU uses a non-breaking space after the symbol; normalize it for comparison.
  const fmt = (v: string | number) => formatMoney(v).replace(/\s/g, " ");
  it("always shows exactly 2 decimals", () => {
    expect(fmt("2500.5")).toBe("$ 2.500,50");
    expect(fmt(2500)).toBe("$ 2.500,00");
    expect(fmt("0")).toBe("$ 0,00");
  });
  it("rounds to 2 decimals", () => {
    expect(fmt("625.125")).toBe("$ 625,13");
  });
});
