import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import type { CustomSummaryMetric, SummaryInventory, SummaryMetric, SummaryOrder, SummaryPeriod, SummaryProduct } from '../../utilities/summary-core';
import { buildCustomMetrics, buildInventoryMetrics, buildOrderMetrics, buildProductMetrics, comparisonLabel, durationLabel, periodLabel, trendLabel } from '../../utilities/summary-core';

/** Framework-independent summary strip. Assign `metrics` as a JavaScript property. */
export class PerformanceSummaryElement extends LitElement {
  static override properties = {
    metrics: { attribute: false },
    summaryType: { attribute: 'summary-type' },
    orders: { attribute: false },
    products: { attribute: false },
    inventory: { attribute: false },
    customMetrics: { attribute: false },
    period: { type: String },
    activeFilter: { attribute: 'active-filter' },
    showPeriod: { type: Boolean, attribute: 'show-period' },
    currency: { type: String },
    locale: { type: String },
    menuOpen: { state: true },
    canScrollLeft: { state: true },
    canScrollRight: { state: true },
  };

  declare metrics: readonly SummaryMetric[];
  declare summaryType: 'orders' | 'products' | 'inventory' | 'custom';
  declare orders: readonly SummaryOrder[];
  declare products: readonly SummaryProduct[];
  declare inventory: SummaryInventory | null;
  declare customMetrics: readonly CustomSummaryMetric[];
  declare period: SummaryPeriod;
  declare activeFilter: string | null;
  declare showPeriod: boolean;
  declare currency: string;
  declare locale: string;
  declare menuOpen: boolean;
  declare canScrollLeft: boolean;
  declare canScrollRight: boolean;

  private resizeObserver?: ResizeObserver;

  constructor() {
    super();
    this.metrics = [];
    this.summaryType = 'orders';
    this.orders = [];
    this.products = [];
    this.inventory = null;
    this.customMetrics = [];
    this.period = '7d';
    this.activeFilter = null;
    this.showPeriod = true;
    this.currency = 'INR';
    this.locale = 'en-IN';
    this.menuOpen = false;
    this.canScrollLeft = false;
    this.canScrollRight = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('focusout', this.closeMenuAfterFocus);
  }

  override disconnectedCallback(): void {
    this.resizeObserver?.disconnect();
    this.removeEventListener('focusout', this.closeMenuAfterFocus);
    super.disconnectedCallback();
  }

  protected override firstUpdated(): void {
    const scroller = this.scroller;
    if (scroller) {
      this.resizeObserver = new ResizeObserver(() => this.updateScrollControls());
      this.resizeObserver.observe(scroller);
    }
    this.updateScrollControls();
  }

  protected override updated(changes: PropertyValues): void {
    if (changes.has('summaryType') || changes.has('period') || changes.has('orders') || changes.has('products') || changes.has('inventory') || changes.has('customMetrics')) {
      const next = this.buildMetrics();
      if (!sameMetrics(this.metrics, next)) this.metrics = next;
    }
    if (changes.has('metrics')) queueMicrotask(() => this.updateScrollControls());
  }

  private buildMetrics(): SummaryMetric[] {
    if (this.summaryType === 'products') return buildProductMetrics(this.products, this.period);
    if (this.summaryType === 'inventory') return buildInventoryMetrics(this.inventory);
    if (this.summaryType === 'custom') return buildCustomMetrics(this.customMetrics);
    return buildOrderMetrics(this.orders, this.period);
  }

  private get scroller(): HTMLElement | null { return this.renderRoot.querySelector('.metrics-scroller'); }
  private closeMenuAfterFocus = () => queueMicrotask(() => { if (!this.matches(':focus-within')) this.menuOpen = false; });

  private selectPeriod(next: SummaryPeriod): void {
    this.period = next;
    this.menuOpen = false;
    this.dispatchEvent(new CustomEvent<SummaryPeriod>('summary-period-change', { detail: next, bubbles: true, composed: true }));
  }

  private selectMetric(metric: SummaryMetric): void {
    if (!metric.filterable) return;
    const next = this.activeFilter === metric.key ? null : metric.key;
    this.activeFilter = next;
    this.dispatchEvent(new CustomEvent<string | null>('summary-filter-change', { detail: next, bubbles: true, composed: true }));
  }

  private scrollCards(direction: -1 | 1): void {
    const scroller = this.scroller;
    scroller?.scrollBy({ left: direction * Math.max(180, scroller.clientWidth * .7), behavior: 'smooth' });
  }

  private updateScrollControls(): void {
    const scroller = this.scroller;
    if (!scroller) return;
    const maximum = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    this.canScrollLeft = scroller.scrollLeft > 2;
    this.canScrollRight = scroller.scrollLeft < maximum - 2;
  }

  private formatValue(metric: SummaryMetric): string {
    if (metric.kind === 'duration') return durationLabel(metric.value);
    if (metric.kind === 'currency') return new Intl.NumberFormat(this.locale, { style: 'currency', currency: this.currency, maximumFractionDigits: 0 }).format(metric.value);
    return new Intl.NumberFormat(this.locale, { maximumFractionDigits: 0 }).format(metric.value);
  }

  protected override render() {
    return html`<section class="summary-strip" aria-label="Performance summary for ${periodLabel(this.period)}">
      ${this.showPeriod ? html`<div class="range-wrap">
        <button class="range-cell" type="button" aria-haspopup="menu" aria-expanded=${this.menuOpen} @click=${() => this.menuOpen = !this.menuOpen}>
          <span class="calendar" aria-hidden="true"><svg viewBox="0 0 20 20"><rect x="3" y="4.5" width="14" height="12" rx="2"></rect><path d="M6 3v3M14 3v3M3 8h14"></path></svg></span>
          <span><strong>${periodLabel(this.period)}</strong><small>${comparisonLabel(this.period)}</small></span>
        </button>
        ${this.menuOpen ? html`<div class="period-menu" role="menu" aria-label="Summary date range">
          ${(['today', '7d', '30d'] as SummaryPeriod[]).map((value) => html`<button type="button" role="menuitemradio" aria-checked=${this.period === value} @click=${() => this.selectPeriod(value)}><span>${periodLabel(value)}</span>${this.period === value ? html`<b>${'\u2713'}</b>` : nothing}</button>`)}
        </div>` : nothing}
      </div>` : nothing}
      <div class="metrics-shell ${this.showPeriod ? '' : 'no-range'}">
        <div class="metrics-scroller" @scroll=${this.updateScrollControls}>
          ${this.metrics.map((metric) => html`<button type="button" class="metric-card ${this.activeFilter === metric.key ? 'active' : ''} ${metric.filterable ? '' : 'informational'}" aria-pressed=${metric.filterable ? String(this.activeFilter === metric.key) : nothing} @click=${() => this.selectMetric(metric)}>
            <span class="metric-copy"><span>${metric.label}</span><span class="metric-value"><strong>${this.formatValue(metric)}</strong>${metric.showTrend ? html`<small class=${metric.change && metric.change > 0 ? 'positive' : metric.change && metric.change < 0 ? 'negative' : ''}>${trendLabel(metric.change)}</small>` : nothing}</span>${metric.showTrend ? html`<span class="comparison">vs previous period</span>` : nothing}</span>
            ${metric.showTrend ? html`<svg class="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label="${metric.label} trend"><line x1="0" y1="27" x2="100" y2="27"></line><polyline class="previous" points=${metric.previousPoints}></polyline><polyline class="current" points=${metric.currentPoints}></polyline></svg>` : nothing}
          </button>`)}
        </div>
        ${this.canScrollLeft || this.canScrollRight ? html`<div class="scroll-controls" aria-label="Summary card navigation"><button type="button" ?disabled=${!this.canScrollLeft} aria-label="Previous cards" @click=${() => this.scrollCards(-1)}>${'\u2039'}</button><button type="button" ?disabled=${!this.canScrollRight} aria-label="More cards" @click=${() => this.scrollCards(1)}>${'\u203a'}</button></div>` : nothing}
      </div>
    </section>`;
  }

  static override styles = css`
    :host{display:block;min-width:0;font-family:var(--summary-font,Inter,system-ui,sans-serif);color:var(--summary-text,#202622)}*{box-sizing:border-box}.summary-strip{display:flex;overflow:visible;border:1px solid var(--summary-border,#d8ddda);border-radius:12px;background:#fff;box-shadow:0 1px 2px #1018280a,0 2px 8px #10182808}.range-wrap{position:relative;z-index:3;width:150px;min-width:150px;background:#fbfcfb;border-radius:12px 0 0 12px}.range-cell{display:flex;width:100%;min-height:78px;align-items:center;gap:9px;padding:12px 14px;border:0;background:transparent;text-align:left;cursor:pointer}.calendar{display:grid;width:26px;height:26px;flex:none;place-items:center;border-radius:7px;background:#f0f2f1;color:#5b655f}.calendar svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round}.range-cell strong,.range-cell small{display:block}.range-cell strong{font-size:12px}.range-cell small{margin-top:2px;color:#89918d;font-size:9px}.period-menu{position:absolute;z-index:30;top:calc(100% + 6px);left:8px;width:170px;padding:5px;border:1px solid #d8ddda;border-radius:9px;background:#fff;box-shadow:0 10px 28px #1018281f}.period-menu button{display:flex;width:100%;height:34px;align-items:center;justify-content:space-between;border:0;border-radius:6px;background:transparent;padding:0 9px;color:#344139;font:600 12px inherit;cursor:pointer}.period-menu button:hover{background:#f2f6f3}.period-menu b{color:var(--summary-accent,#137333)}.metrics-shell{position:relative;min-width:0;flex:1;overflow:hidden;border-radius:0 12px 12px 0}.metrics-shell.no-range{border-radius:12px}.metrics-scroller{display:flex;width:100%;overflow-x:auto;overflow-y:hidden;scroll-behavior:smooth;scrollbar-width:none;overscroll-behavior-inline:contain}.metrics-scroller::-webkit-scrollbar{display:none}.metric-card{display:flex;min-width:190px;min-height:78px;flex:1 0 25%;align-items:center;justify-content:space-between;gap:10px;padding:11px 14px;border:0;border-left:1px solid #e5e9e7;background:#fff;text-align:left;cursor:pointer}.no-range .metric-card:first-child{border-left:0}.metric-card:hover{background:#f8faf9}.metric-card.informational{cursor:default}.metric-card.active{position:relative;z-index:1;background:#f1f8f3;box-shadow:inset 0 -3px var(--summary-accent,#137333)}button:focus-visible{outline:2px solid var(--summary-accent,#137333);outline-offset:-2px}.metric-copy{min-width:0}.metric-copy>span:first-child{display:block;width:fit-content;border-bottom:1px dotted #aab2ae;color:#48534d;font-size:11px;font-weight:650;white-space:nowrap}.metric-value{display:flex!important;align-items:baseline;gap:6px;margin-top:2px}.metric-value strong{font-size:15px;white-space:nowrap}.metric-value small{color:#737d77;font-size:10px;font-weight:750}.metric-value small.positive{color:#16834d}.metric-value small.negative{color:#c13b35}.comparison{display:block;margin-top:2px;color:#939b97;font-size:9px;white-space:nowrap}.sparkline{width:68px;height:32px;flex:0 0 68px;overflow:visible}.sparkline line{stroke:#e5ebe8}.sparkline polyline{fill:none;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}.sparkline .previous{stroke:#a9daf5;stroke-width:1.5;stroke-dasharray:2 3}.sparkline .current{stroke:#19a8f4;stroke-width:2}.scroll-controls{position:absolute;z-index:4;top:6px;right:7px;display:flex;gap:2px;padding:2px;border:1px solid #d8ddda;border-radius:8px;background:#fff;box-shadow:0 2px 8px #10182817}.scroll-controls button{width:25px;height:25px;border:0;border-radius:6px;background:#fff;color:#354139;font-size:20px;line-height:1;cursor:pointer}.scroll-controls button:hover:not(:disabled){background:#f0f3f1}.scroll-controls button:disabled{color:#b8bfbb}@media(max-width:600px){.summary-strip{flex-direction:column;overflow:hidden}.range-wrap{width:100%;min-width:0;border-bottom:1px solid #e5e9e7;border-radius:12px 12px 0 0}.range-cell{min-height:58px}.metrics-shell{width:100%;border-radius:0 0 12px 12px}.metric-card{min-width:168px;min-height:76px;flex-basis:168px;padding:10px 12px}.sparkline{width:54px;flex-basis:54px}}
  `;
}

declare global { interface HTMLElementTagNameMap { 'tec-performance-summary': PerformanceSummaryElement } }

function sameMetrics(left: readonly SummaryMetric[], right: readonly SummaryMetric[]): boolean {
  return left.length === right.length && left.every((metric, index) => JSON.stringify(metric) === JSON.stringify(right[index]));
}

