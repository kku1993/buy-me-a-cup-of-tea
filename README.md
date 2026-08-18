# buy-me-a-cup-of-tea

A standalone, drop-in "Buy me a cup of tea" donation dialog for React, with
built-in Stripe Elements integration, multi-currency support, and i18n for
seven locales. Backed by a tiny Go server that mints Stripe PaymentIntents.

## Repository layout

| Path                         | What it is                                                       |
| ---------------------------- | ---------------------------------------------------------------- |
| `packages/donation-dialog`   | The standalone React component (`@repo/donation-dialog`).        |
| `apps/demo-web`              | Vite + React demo that showcases the dialog.                     |
| `apps/backend`               | Go backend (`net/http` + `stripe-go`) that mints PaymentIntents. |
| `packages/eslint-config`     | Shared ESLint config.                                            |
| `packages/typescript-config` | Shared tsconfig bases.                                           |

## Quick start (client)

```sh
npm install
```

Configure the donation runtime once at app boot, then render the button:

```tsx
import { configureDonation, DonateButton } from "@repo/donation-dialog";

configureDonation({
  // Origin of the backend that mints PaymentIntents. Empty string = same
  // origin (use a proxy in dev). For a deployed build set the absolute URL.
  apiOrigin: "",
  // Stripe publishable key (safe for the browser). When unset the dialog
  // shows an "unavailable" state instead of crashing.
  stripePublishableKey: import.meta.env.VITE_STRIPE_PUBLIC_KEY,
});

export function App() {
  return <DonateButton />;
}
```

The dialog handles the rest: currency selection (auto-detected from the
browser timezone), preset and custom amounts, Stripe Elements card entry,
and a success screen.

### Props

`DonateButton` accepts:

| Prop        | Type                       | Default     | Notes                                                                |
| ----------- | -------------------------- | ----------- | -------------------------------------------------------------------- |
| `locale`    | `string`                   | auto-detect | Locale code (`"es"`, `"zh-Hant"`, or a custom code). Omit to detect. |
| `strings`   | `Partial<DonationStrings>` | —           | Per-render overrides merged on top of the resolved locale.           |
| `variant`   | `ButtonVariant`            | `"outline"` | `default` / `outline` / `ghost` / `destructive` / link variants.     |
| `size`      | `ButtonSize`               | `"default"` | `default` / `sm` / `icon` / `icon-sm`.                               |
| `iconOnly`  | `boolean`                  | `false`     | Hide the text label, show only the tea icon.                         |
| `className` | `string`                   | —           | Extra class on the trigger button.                                   |

## i18n

Seven locales ship built-in: **en, es, fr, de, it, zh-Hans, zh-Hant**.
Leave `locale` unset to auto-detect from the browser language (the zh-Hans /
zh-Hant split is handled via script and region subtags).

### Override individual strings (per render)

```tsx
<DonateButton strings={{ button: "Support this project 💛" }} />
```

Only the keys you supply are replaced; the rest come from the resolved
locale. Template placeholders `{min}`, `{max}`, `{amount}`, `{currency}`
are substituted at render time.

### Add a new locale or replace a bundled one (app-wide)

```tsx
import { registerLocale, DonateButton } from "@repo/donation-dialog";

registerLocale("ja", {
  button: "お茶を一杯おごってください",
  title: "お茶を一杯おごってください",
  /* ...all 20 keys... */
});

// then:
<DonateButton locale="ja" />;
```

`registerLocale` with a bundled code replaces it everywhere; with a new
code it adds it. Resolution order is: `strings` prop > registered locale >
bundled locale > English.

## Currencies

Supported: USD, TWD, CNY, HKD, EUR, GBP, JPY. Each has Stripe minor-unit
exponents, display-decimal overrides (TWD charges in 2 decimals but
displays in 0), min/max bounds, and three preset amounts. The table is the
single source of truth shared with the backend — see
`packages/donation-dialog/src/currency.ts`.

## Backend contract

The dialog POSTs to `${apiOrigin}/v1/donations/payment-intent`:

```http
POST /v1/donations/payment-intent
content-type: application/json

{"amount": 5, "currency": "USD"}
```

```http
200 OK
{"data": {"clientSecret": "pi_..._secret_..."}}
```

```http
400 Bad Request
{"message": "Amount must be at least $0.50 USD"}
```

`amount` is in major units (dollars/yen); the backend converts to Stripe
minor units. The reference Go backend lives in `apps/backend`.

## Running the demo locally

1. Copy env files and fill in your Stripe keys:

   ```sh
   cp apps/demo-web/.env.example apps/demo-web/.env
   cp apps/backend/.env.example apps/backend/.env
   ```

   - `apps/demo-web/.env` → `VITE_STRIPE_PUBLIC_KEY=pk_test_...`
   - `apps/backend/.env` → `STRIPE_SECRET_KEY=sk_test_...`

2. Start everything (the Go backend loads `apps/backend/.env` automatically;
   the Vite dev server proxies `/v1` → `:8787`):

   ```sh
   npm run dev
   ```

   This runs all dev tasks in parallel via turbo:

   - `backend` → Go server on `http://localhost:8787`
   - `demo-web` → Vite dev server on `http://localhost:5173`
   - `@repo/donation-dialog` → watch build of the package

   Open `http://localhost:5173`.

## Commands

```sh
npm install            # install all workspaces
npm run dev            # start backend + demo-web + package watch (turbo)
npm run build          # build all packages/apps (turbo)
npm run lint           # eslint across workspaces
npm run format         # prettier
```

Per-package (run inside the workspace):

```sh
npx tsc --noEmit       # typecheck
npx vite build         # build the package/app
```

Go backend:

```sh
cd apps/backend && go build ./... && go vet ./...
```
