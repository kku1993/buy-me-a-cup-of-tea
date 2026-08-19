# buy-me-a-cup-of-tea

A standalone, drop-in "Buy me a cup of tea" donation dialog for React,
with built-in Stripe Elements integration, multi-currency support, and
i18n for seven locales.

## Install

```sh
npm install @kku1993/buy-me-a-cup-of-tea
```

Peer dependencies: `react` and `react-dom`.

## Quick start

Configure the donation runtime once at app boot, then render the button:

```tsx
import { configureDonation, DonateButton } from "@kku1993/buy-me-a-cup-of-tea";

configureDonation({
  // Origin of the backend that mints PaymentIntents. Empty string = same
  // origin (use a proxy in dev). For a deployed build set the absolute URL.
  apiOrigin: "https://donate.example.com",
  // Stripe publishable key (safe for the browser). When unset the dialog
  // shows an "unavailable" state instead of crashing.
  stripePublishableKey: "pk_live_...",
});

export function App() {
  return <DonateButton />;
}
```

The dialog handles the rest: currency selection (auto-detected from the
browser timezone), preset and custom amounts, Stripe Elements card entry,
and a success screen.

## Props

`DonateButton` accepts:

| Prop        | Type                       | Default     | Notes                                                                |
| ----------- | -------------------------- | ----------- | -------------------------------------------------------------------- |
| `locale`    | `string`                   | auto-detect | Locale code (`"es"`, `"zh-Hant"`, or a custom code). Omit to detect. |
| `strings`   | `Partial<DonationStrings>` | —           | Per-render overrides merged on top of the resolved locale.           |
| `variant`   | `ButtonVariant`            | `"outline"` | `default` / `outline` / `ghost` / `destructive` / `link` variants.  |
| `size`      | `ButtonSize`               | `"default"` | `default` / `sm` / `icon` / `icon-sm`.                              |
| `iconOnly`  | `boolean`                  | `false`     | Hide the text label, show only the tea icon.                         |
| `className` | `string`                   | —           | Extra class on the trigger button.                                   |

## i18n

Seven locales ship built-in: **en, es, fr, de, it, zh-Hans, zh-Hant**.
Leave `locale` unset to auto-detect from the browser language (the
zh-Hans / zh-Hant split is handled via script and region subtags).

### Override individual strings (per render)

```tsx
<DonateButton strings={{ button: "Support this project 💛" }} />
```

Only the keys you supply are replaced; the rest come from the resolved
locale. Template placeholders `{min}`, `{max}`, `{amount}`, `{currency}`
are substituted at render time.

### Add a new locale or replace a bundled one (app-wide)

```tsx
import { registerLocale, DonateButton } from "@kku1993/buy-me-a-cup-of-tea";

registerLocale("ja", {
  button: "お茶を一杯おごってください",
  title: "お茶を一杯おごってください",
  /* ...all keys... */
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
displays in 0), min/max bounds, and three preset amounts.

## Backend deployment

The dialog needs a backend that mints Stripe PaymentIntents.

The simplest way to get started is to use our pre-built docker container

```bash
docker pull kku1993/buy-me-a-cup-of-tea:latest
```

The backend requires a `STRIPE_SECRET_KEY`
(server only — never expose it to the browser) and optionally
`STRIPE_ACCOUNT_ID` (Stripe Connect), `PORT` (default 8787), and
`ALLOWED_ORIGIN` (CORS, default `*`).

You can also build the Go backend included in this repo
(`apps/backend`) — see [DEVELOP.md](./DEVELOP.md) for build, Docker, and
deployment details.
