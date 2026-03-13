import type { NextWebVitalsMetric } from "next/app";

export function reportWebVitals(metric: NextWebVitalsMetric): void {
  if (process.env.NODE_ENV === "development") {
    console.debug("Web vital metric", metric);
  }
}