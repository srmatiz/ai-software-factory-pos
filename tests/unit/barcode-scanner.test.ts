import { describe, expect, it } from "vitest";
import { createScannerDetector } from "@/lib/barcode-scanner";

/** Feeds keys spaced `gapMs` apart, ending with Enter; returns the detector result. */
function type(text: string, gapMs: number, detector = createScannerDetector(), start = 1000) {
  let t = start;
  for (const ch of text) detector.handleKey(ch, (t += gapMs));
  return detector.handleKey("Enter", (t += gapMs));
}

describe("createScannerDetector", () => {
  it("detects a fast burst ending in Enter as a scan", () => {
    expect(type("7702004003508", 10)).toBe("7702004003508");
  });

  it("ignores human typing speed", () => {
    expect(type("7702004003508", 150)).toBeNull();
  });

  it("ignores codes shorter than the minimum length", () => {
    expect(type("12", 5)).toBeNull();
  });

  it("starts a new burst after a pause, discarding earlier slow keys", () => {
    const d = createScannerDetector();
    d.handleKey("h", 0);
    d.handleKey("o", 300);
    d.handleKey("l", 600);
    expect(type("123456", 10, d, 2000)).toBe("123456");
  });

  it("ignores a slow Enter after a fast burst", () => {
    const d = createScannerDetector();
    let t = 0;
    for (const ch of "123456") d.handleKey(ch, (t += 10));
    expect(d.handleKey("Enter", t + 500)).toBeNull();
  });

  it("ignores modifier keys such as Shift", () => {
    const d = createScannerDetector();
    let t = 0;
    for (const k of ["Shift", "A", "B", "C", "1", "2"]) d.handleKey(k, (t += 5));
    expect(d.handleKey("Enter", t + 5)).toBe("ABC12");
  });
});
