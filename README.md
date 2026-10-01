# Tectonas UI

Framework-independent web components built with Lit. The distributed JavaScript can be consumed by Angular, React, Vue, or a plain browser application.

## Install

```bash
npm install tectonas-ui
```

For local development from the current repository:

```json
{
  "dependencies": {
    "tectonas-ui": "file:../Project/tectonas-ui"
  }
}
```

## Register components

Register the complete library once at the application entry point:

```ts
import 'tectonas-ui';
```

To register only the performance summary:

```ts
import 'tectonas-ui/performance-summary';
```

Registration is safe to import more than once and is skipped during server-side rendering when `customElements` is unavailable.

## Performance summary

```html
<tec-performance-summary
  summary-type="inventory"
  show-period
></tec-performance-summary>
```

Arrays and objects must be assigned as JavaScript properties. Framework property bindings do this automatically.

### Angular

Add `CUSTOM_ELEMENTS_SCHEMA` to each standalone component that uses the element:

```ts
import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import type { SummaryPeriod } from 'tectonas-ui';

@Component({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <tec-performance-summary
      [orders]="orders"
      [period]="period"
      (summary-period-change)="periodChanged($event)"
    />
  `,
})
export class OrdersPage {
  orders = [];
  period: SummaryPeriod = '7d';
  periodChanged(event: Event): void {
    this.period = (event as CustomEvent<SummaryPeriod>).detail;
  }
}
```

### React

Import the registration entry once, then render the custom element. Assign complex properties with a ref when the React version or tooling does not forward them as DOM properties.

```tsx
import 'tectonas-ui/performance-summary';

export function Summary() {
  return <tec-performance-summary period="7d" />;
}
```

## Development

```bash
npm install
npm run typecheck
npm run build
```

Add each new component under `src/components/<component-name>/`, export its class through `src/components/index.ts`, add its registration to `src/register.ts`, and add a Vite/package export only when a standalone component entry point is needed.
