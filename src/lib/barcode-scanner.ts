// USB barcode scanners behave like keyboards (HID "keyboard wedge"): they
// "type" the code very fast and finish with Enter. This detector tells a
// scanner burst apart from a human typing by the time between keystrokes.
// Framework-free so it can be unit tested; see hooks/useBarcodeScanner.ts.

export type ScannerOptions = {
  /** Max milliseconds between keystrokes of the same scan. */
  maxGapMs?: number;
  /** Minimum code length to count as a scan. */
  minLength?: number;
};

export type ScannerDetector = {
  /** Feed a key; returns the scanned code when a scan completes, otherwise null. */
  handleKey(key: string, timestamp: number): string | null;
  reset(): void;
};

export function createScannerDetector({ maxGapMs = 50, minLength = 4 }: ScannerOptions = {}): ScannerDetector {
  let buffer = "";
  let lastTime = -Infinity;

  return {
    handleKey(key, timestamp) {
      const gap = timestamp - lastTime;
      lastTime = timestamp;

      if (key === "Enter") {
        const code = buffer;
        buffer = "";
        return gap <= maxGapMs && code.length >= minLength ? code : null;
      }
      if (key.length !== 1) return null; // Shift, Tab, arrows...

      // A slow keystroke starts a new candidate burst.
      buffer = gap <= maxGapMs ? buffer + key : key;
      return null;
    },
    reset() {
      buffer = "";
      lastTime = -Infinity;
    },
  };
}
