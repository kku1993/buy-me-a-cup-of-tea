# AGENTS.md

Guidance for agents (and humans) working in this repo.

## What this is

A standalone "Buy me a cup of tea" donation dialog for React, plus a
reference Go backend that mints Stripe PaymentIntents. npm workspaces +
turbo monorepo.

## Repo layout

| Path                         | What it is                                                       |
| ---------------------------- | ---------------------------------------------------------------- |
| `packages/donation-dialog`   | The standalone React component (`@repo/donation-dialog`).        |
| `apps/demo-web`              | Vite + React demo that showcases the dialog.                     |
| `apps/backend`               | Go backend (`net/http` + `stripe-go`) that mints PaymentIntents. |
| `packages/eslint-config`     | Shared ESLint config.                                            |
| `packages/typescript-config` | Shared tsconfig bases.                                           |

## Commands

```sh
npm install            # install all workspaces
npm run build          # turbo build (all workspaces)
npm run lint           # eslint across workspaces
npm run format         # prettier
```

Per-package (run inside the workspace dir):

```sh
npx tsc --noEmit       # typecheck (fastest signal — run first)
npx vite build         # build the package/app
npx eslint "src/**/*.ts" "src/**/*.tsx"
```

Go backend:

```sh
cd apps/backend && go build ./... && go vet ./... && gofmt -l .
```

## Operation notes

- Always run `tsc --noEmit`, `eslint`, and `vite build` for any TS
  workspace you touch before considering work done. `tsc --noEmit` is the
  fastest signal that types are sound — run it first.
- Run `gofmt -w .` and `go vet ./...` after touching the Go backend.
- Run `npm run format` (prettier) from repo root when done.

## Architecture

### `packages/donation-dialog` (the client)

A self-contained React component with no `@repo/ui`, `react-i18next`, or
`@repo/currency` dependencies — everything it needs is bundled.

- `src/donation-dialog.tsx` — `DonateButton` + `DonateDialogContent` +
  `CheckoutForm`. Three-step flow: amount → Stripe Elements pay → success.
- `src/currency.ts` — the donation currency table (USD/TWD/CNY/HKD/EUR/
  GBP/JPY), the single source of truth shared with the backend. Includes
  `displayDecimals` (TWD charges in 2 decimals, displays in 0) and
  `toStripeMinorUnits`.
- `src/donate.ts` — `configureDonation()` (sets Stripe publishable key +
  backend origin once at boot), lazy `getStripe()`,
  `createDonationIntent()` (POSTs to `${apiOrigin}/v1/donations/payment-
intent`), `formatAmount`, `detectCurrencyFromTimezone`, `DonationError`.
- `src/strings.ts` — i18n runtime: locale registry, `detectLocale()`,
  `getStringsForLocale()`, `registerLocale()`/`unregisterLocale()`,
  `resolveStrings()`. Resolution order: `strings` prop > registered locale
  > bundled locale > English.
- `src/locales/` — seven bundled locale bundles (en, es, fr, de, it,
  zh-Hans, zh-Hant). `en` is the canonical source and fallback.
- `src/ui/*` — Radix primitives (`@radix-ui/react-dialog`,
  `react-select`) bundled as thin styled wrappers, plus plain
  `Button`/`Input`/`Alert`.
- `src/styles.css` — self-contained dark-theme stylesheet, all classes
  `dd-`-prefixed to avoid host collisions.
- `vite.config.ts` — library-mode build (React/Stripe externalized) for
  publishing; `exports` point to source TS so the demo consumes it
  directly through Vite.

### `apps/demo-web`

Vite + React. Calls `configureDonation()` at module load, renders
`DonateButton` variants. Demonstrates `registerLocale()` (custom "Pirate
English" locale) and per-render `strings` overrides. Vite proxies `/v1`
→ `:8787` so the browser stays single-origin in dev.

### `apps/backend`

Go, `net/http` + `github.com/stripe/stripe-go/v76`, no framework. Single
endpoint:

```
POST /v1/donations/payment-intent
  {"amount": <major units>, "currency": "<ISO>"}
→ 200 {"data":{"clientSecret":"pi_..._secret_..."}}
→ 4xx/5xx {"message":"<forwarded Stripe or validation error>"}
```

The currency exponent table is mirrored from the frontend
(`packages/donation-dialog/src/currency.ts`) so both sides agree on
minor-unit conversion by construction — keep them in sync when adding a
currency. `automatic_payment methods: enabled` is set on the
PaymentIntent so the Stripe `PaymentElement` renders. CORS is
configurable via `ALLOWED_ORIGIN`. Env: `STRIPE_SECRET_KEY` (required),
`PORT` (default 8787), `ALLOWED_ORIGIN` (default `*`).

## Core invariants (do not break)

1. **Currency table parity**: the frontend
   (`packages/donation-dialog/src/currency.ts`) and backend
   (`apps/backend/main.go` `donationCurrencies`) must agree on each
   currency's `decimals` exponent. A mismatch silently multiplies or
   divides the charged amount by 100. When adding/changing a currency,
   update both.
2. **Standalone package**: `packages/donation-dialog` must not depend on
   `@repo/ui`, `@repo/currency`, `react-i18next`, or any other workspace
   package. It bundles its own Radix primitives, currency table, and
   i18n. The only peer deps are `react` / `react-dom`.
3. **English is the fallback**: every locale bundle is a translation of
   `src/locales/en.ts`. Unknown locale codes and missing keys fall back
   to English — the dialog must never throw on i18n.
4. **Publishable key safety**: only the Stripe **publishable** key is
   exposed to the browser (`VITE_STRIPE_PUBLIC_KEY` /
   `configureDonation`). The **secret** key lives only in the Go backend
   (`STRIPE_SECRET_KEY`). Never import `stripe` (server SDK) into the
   client package.
5. **`dd-` CSS prefix**: all classes in `src/styles.css` are `dd-`-
   prefixed to avoid collisions with the host page. Don't add unprefixed
   classes.
6. **Graceful unavailable state**: when `stripePublishableKey` is unset,
   the dialog shows an "unavailable" state instead of crashing. Preserve
   this — it lets consumers kick the tires without a Stripe account.

## i18n rules

- Every user-visible string lives in `src/locales/*.ts` as a
  `DonationStrings` bundle. Don't hardcode English in the component.
- When adding a new string key, add it to `DonationStrings` and to **all
  seven** locale files. TypeScript will error on the bundled locales
  record if a bundled locale is missing a key, but custom-registered
  locales are only checked at the call site.
- Template placeholders (`{min}`, `{max}`, `{amount}`, `{currency}`) are
  substituted by `formatTemplate()` — keep them consistent across
  locales.
- The zh-Hans / zh-Hant split is handled in `matchLocale()` (script
  subtag wins; region TW/HK/MO → Traditional, everything else →
  Simplified). Don't collapse the two.

## Environment

- `apps/demo-web/.env` → `VITE_STRIPE_PUBLIC_KEY` (browser-safe).
- `apps/backend/.env` → `STRIPE_SECRET_KEY` (server only), `PORT`,
  `ALLOWED_ORIGIN`.
- Both have `.env.example` files with placeholder values.

## Gotchas

- The package's `exports` point to **source TS** (not `dist/`) so the
  demo consumes it directly through Vite. The `vite build` script still
  emits `dist/` for publishing — don't delete the build config.
- `@types/react` must be a single version across the monorepo. If you
  see "ReactNode is not assignable to ReactNode" type errors, it's a
  dual-`@types/react` problem — align the versions and reinstall.
- The Go backend forwards Stripe error messages verbatim to the client
  (e.g. "Amount must be at least $0.50 USD") so the dialog can show
  them. Don't swallow or genericize Stripe errors in the backend.
- `go build` leaves a `backend` binary in `apps/backend/`; it's
  gitignored. Don't commit it.
