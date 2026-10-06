"use client";

import { useEffect, useRef } from "react";
import { createScannerDetector, type ScannerOptions } from "@/lib/barcode-scanner";

/**
 * Calls `onScan(code, target)` whenever a barcode scanner reads a code,
 * regardless of which element has focus. The Enter key that ends a scan is
 * swallowed so it does not submit forms.
 */
export function useBarcodeScanner(
  onScan: (code: string, target: EventTarget | null) => void,
  options?: ScannerOptions,
) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const { maxGapMs, minLength } = options ?? {};

  useEffect(() => {
    const detector = createScannerDetector({ maxGapMs, minLength });
    const listener = (e: KeyboardEvent) => {
      const code = detector.handleKey(e.key, e.timeStamp);
      if (code) {
        e.preventDefault();
        onScanRef.current(code, e.target);
      }
    };
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  }, [maxGapMs, minLength]);
}
