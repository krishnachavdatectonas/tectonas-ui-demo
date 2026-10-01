/** Shared data contracts and metric builders for summary components. */
export type SummaryPeriod = 'today' | '7d' | '30d';
export type OrderSummaryFilter = 'orders' | 'items' | 'sales' | 'fulfilled' | 'delivered';
export type ProductSummaryFilter = 'products' | 'active' | 'inStock' | 'outOfStock' | 'inventory' | 'variants';
export type InventorySummaryFilter = 'all' | 'out' | 'critical' | 'demand' | 'districts';
export type SummaryMetricKind = 'number' | 'currency' | 'duration';

export type SummaryMetric = {
  key: string;
  label: string;
  value: number;
  kind: SummaryMetricKind;
  change: number | null;
  currentPoints: string;
  previousPoints: string;
  filterable: boolean;
  showTrend: boolean;
};

export type CustomSummaryMetric = {
  key: string;
  label: string;
  value: number;
  kind?: SummaryMetricKind;
  change?: number | null;
  filterable?: boolean;
  showTrend?: boolean;
  currentValues?: readonly number[];
  previousValues?: readonly number[];
};

export type SummaryOrder = {
  createdAt: string;
  updatedAt?: string;
  itemCount: number;
  total: number;
  status: string;
  financialStatus?: string | null;
  fulfillmentStatus?: string | null;
};

export type SummaryProduct = {
  updatedAt: string;
  status: string;
  availableForSale: boolean;
  inventoryQty: number;
  variantCount: number;
};

export type SummaryInventory = {
  summary: { lowStockItems: number; upcomingSubscriptions: number; expectedSubscriptionRevenue: number };
  lowStockAlerts: readonly { productId: string; inventoryQty: number }[];
  requiredProducts: readonly { productId: string; quantity: number }[];
  demandByDistrict: readonly unknown[];
};

export const periodLabel = (period: SummaryPeriod): string =>
  ({ today: 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days' })[period];

export const comparisonLabel = (period: SummaryPeriod): string =>
  period === 'today' ? 'Compared to yesterday' : `Compared to prior ${period === '7d' ? 7 : 30} days`;

export function durationLabel(minutes: number): string {
  if (!minutes) return '\u2014';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
  return `${Math.floor(minutes / 1440)}d ${Math.round((minutes % 1440) / 60)}h`;
}

export const trendLabel = (change: number | null): string => change === null ? '\u2014' : `${Math.abs(change)}%`;

export function buildCustomMetrics(metrics: readonly CustomSummaryMetric[]): SummaryMetric[] {
  return metrics.map((metric) => {
    const current = [...(metric.currentValues?.length ? metric.currentValues : [0, metric.value])];
    const previous = [...(metric.previousValues?.length ? metric.previousValues : current.map(() => 0))];
    const scale = Math.max(...current, ...previous, 1);
    return {
      key: metric.key, label: metric.label, value: metric.value, kind: metric.kind ?? 'number',
      change: metric.change ?? null, currentPoints: sparkline(current, scale),
      previousPoints: sparkline(previous, scale), filterable: metric.filterable ?? true,
      showTrend: metric.showTrend ?? true,
    };
  });
}

export function buildOrderMetrics(orders: readonly SummaryOrder[], period: SummaryPeriod, now = new Date()): SummaryMetric[] {
  const { days, periodDays } = timeline(period, now);
  const series = {
    orders: zeros(days), items: zeros(days), sales: zeros(days), fulfilled: zeros(days),
    delivered: zeros(days), fulfillmentMinutes: zeros(days), fulfillmentCount: zeros(days),
  };
  const dayIndexes = new Map(days.map((day, index) => [day, index]));
  for (const order of orders) {
    const index = dayIndexes.get(dayStart(new Date(order.createdAt)).getTime());
    if (index === undefined) continue;
    series.orders[index] += 1;
    series.items[index] += order.itemCount;
    if (isPaidSale(order)) series.sales[index] += order.total;
    if (isFulfilled(order)) series.fulfilled[index] += 1;
    if (isDelivered(order)) series.delivered[index] += 1;
    if (isFulfilled(order) && order.updatedAt) {
      const minutes = (Date.parse(order.updatedAt) - Date.parse(order.createdAt)) / 60000;
      if (Number.isFinite(minutes) && minutes >= 0) {
        series.fulfillmentMinutes[index] += minutes;
        series.fulfillmentCount[index] += 1;
      }
    }
  }
  return [
    metric('orders', 'Orders', 'number', series.orders, periodDays),
    metric('items', 'Items ordered', 'number', series.items, periodDays),
    metric('sales', 'Total sales', 'currency', series.sales, periodDays),
    metric('fulfilled', 'Orders fulfilled', 'number', series.fulfilled, periodDays),
    metric('delivered', 'Orders delivered', 'number', series.delivered, periodDays),
    durationMetric(series.fulfillmentMinutes, series.fulfillmentCount, periodDays),
  ];
}

export function buildProductMetrics(products: readonly SummaryProduct[], period: SummaryPeriod, now = new Date()): SummaryMetric[] {
  const { days, periodDays } = timeline(period, now);
  const series = { products: zeros(days), active: zeros(days), inStock: zeros(days), outOfStock: zeros(days), inventory: zeros(days), variants: zeros(days) };
  const dayIndexes = new Map(days.map((day, index) => [day, index]));
  for (const product of products) {
    const index = dayIndexes.get(dayStart(new Date(product.updatedAt)).getTime());
    if (index === undefined) continue;
    series.products[index] += 1;
    if (product.status.toUpperCase() === 'ACTIVE') series.active[index] += 1;
    if (product.availableForSale && product.inventoryQty > 0) series.inStock[index] += 1;
    else series.outOfStock[index] += 1;
    series.inventory[index] += product.inventoryQty;
    series.variants[index] += product.variantCount;
  }
  return [
    metric('products', 'Products', 'number', series.products, periodDays),
    metric('active', 'Active products', 'number', series.active, periodDays),
    metric('inStock', 'In stock', 'number', series.inStock, periodDays),
    metric('outOfStock', 'Out of stock', 'number', series.outOfStock, periodDays),
    metric('inventory', 'Inventory units', 'number', series.inventory, periodDays),
    metric('variants', 'Variants', 'number', series.variants, periodDays),
  ];
}

export function buildInventoryMetrics(inventory: SummaryInventory | null): SummaryMetric[] {
  const alerts = inventory?.lowStockAlerts ?? [];
  const demand = new Map<string, number>();
  for (const row of inventory?.requiredProducts ?? []) demand.set(row.productId, (demand.get(row.productId) ?? 0) + row.quantity);
  const snapshot = (key: string, label: string, value: number, kind: SummaryMetricKind = 'number', filterable = true): SummaryMetric => ({
    key, label, value, kind, change: null, currentPoints: sparkline([0, value], Math.max(value, 1)),
    previousPoints: sparkline([0, 0], Math.max(value, 1)), filterable, showTrend: false,
  });
  return [
    snapshot('all', 'Low-stock inventory', inventory?.summary.lowStockItems ?? 0),
    snapshot('out', 'Out of stock', alerts.filter((row) => row.inventoryQty <= 0).length),
    snapshot('critical', 'Commitment shortage', alerts.filter((row) => row.inventoryQty > 0 && row.inventoryQty - (demand.get(row.productId) ?? 0) < 0).length),
    snapshot('demand', 'Upcoming deliveries', inventory?.summary.upcomingSubscriptions ?? 0),
    snapshot('districts', 'Demand locations', inventory?.demandByDistrict.length ?? 0),
    snapshot('revenue', 'Expected revenue', inventory?.summary.expectedSubscriptionRevenue ?? 0, 'currency', false),
  ];
}

function timeline(period: SummaryPeriod, now: Date) {
  const periodDays = period === 'today' ? 1 : period === '7d' ? 7 : 30;
  const today = dayStart(now);
  const days = Array.from({ length: periodDays * 2 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (periodDays * 2 - 1 - index));
    return day.getTime();
  });
  return { days, periodDays };
}

function metric(key: string, label: string, kind: SummaryMetricKind, values: number[], periodDays: number): SummaryMetric {
  const previousValues = values.slice(0, periodDays);
  const currentValues = values.slice(periodDays);
  const previous = previousValues.reduce(sum, 0);
  const value = currentValues.reduce(sum, 0);
  const change = previous === 0 ? (value === 0 ? null : 100) : Math.round(((value - previous) / previous) * 100);
  const scale = Math.max(...previousValues, ...currentValues, 1);
  return { key, label, kind, value, change, currentPoints: sparkline(currentValues, scale), previousPoints: sparkline(previousValues, scale), filterable: true, showTrend: true };
}

function durationMetric(totals: number[], counts: number[], periodDays: number): SummaryMetric {
  const averages = totals.map((total, index) => counts[index] ? total / counts[index] : 0);
  const previousCount = counts.slice(0, periodDays).reduce(sum, 0);
  const currentCount = counts.slice(periodDays).reduce(sum, 0);
  const previous = previousCount ? totals.slice(0, periodDays).reduce(sum, 0) / previousCount : 0;
  const value = currentCount ? totals.slice(periodDays).reduce(sum, 0) / currentCount : 0;
  const change = previous === 0 ? (value === 0 ? null : 100) : Math.round(((value - previous) / previous) * 100);
  const scale = Math.max(...averages, 1);
  return { key: 'fulfillmentTime', label: 'Order to fulfillment time', kind: 'duration', value, change, currentPoints: sparkline(averages.slice(periodDays), scale), previousPoints: sparkline(averages.slice(0, periodDays), scale), filterable: false, showTrend: true };
}

const zeros = (values: readonly unknown[]) => values.map(() => 0);
const sum = (total: number, value: number) => total + value;
const dayStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
const sparkline = (values: readonly number[], scale: number) => values.map((value, index) => `${(index * 100) / Math.max(1, values.length - 1)},${26 - (value / scale) * 22}`).join(' ');
const status = (value?: string | null) => (value ?? '').trim().toUpperCase();
const isFulfilled = (order: SummaryOrder) => ['FULFILLED', 'DELIVERED'].includes(status(order.fulfillmentStatus)) || ['FULFILLED', 'DELIVERED', 'COMPLETED'].includes(status(order.status));
const isDelivered = (order: SummaryOrder) => status(order.fulfillmentStatus) === 'DELIVERED' || status(order.status) === 'DELIVERED';
const isPaidSale = (order: SummaryOrder) => order.total > 0 && ['PAID', 'PARTIALLY_PAID', 'AUTHORIZED'].includes(status(order.financialStatus));
