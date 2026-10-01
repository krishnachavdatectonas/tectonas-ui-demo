import { PerformanceSummaryElement } from './performance-summary.element';

export const PERFORMANCE_SUMMARY_TAG = 'tec-performance-summary' as const;

/** Register the performance summary once in browser environments. */
export function registerPerformanceSummary(): void {
  if (typeof customElements === 'undefined' || customElements.get(PERFORMANCE_SUMMARY_TAG)) return;
  customElements.define(PERFORMANCE_SUMMARY_TAG, PerformanceSummaryElement);
}

registerPerformanceSummary();
