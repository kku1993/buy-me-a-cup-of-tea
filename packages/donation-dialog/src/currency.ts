/**
 * Donation currency configuration — the single source of truth shared by
 * the donate dialog (this package) and the backend that mints Stripe
 * PaymentIntents. Ported from `@repo/currency` so this package stays
 * standalone.
 *
 * Fields:
 *  - `decimals` — Stripe's minor-unit exponent for *charges*. The backend
 *    uses this to convert the user's major-unit amount to Stripe minor units
 *    via {@link toStripeMinorUnits}. Per Stripe's "Special cases" table,
 *    TWD is a two-decimal currency for charges even though Stripe treats it
 *    as zero-decimal for *payouts*.
 *  - `displayDecimals` — the number of decimal places the UI should accept
 *    and display. Defaults to `decimals` when omitted. TWD overrides this to
 *    `0` so the donate dialog only accepts whole NTD amounts (e.g. 200, not
 *    200.50), even though the backend converts to 2-decimal minor units
 *    (200 → 20000) for the Stripe charge.
 *  - `min` / `max` — major-unit bounds for the UI's quick-pick presets and
 *    custom-amount input. The backend does *not* enforce these; Stripe
 *    enforces its own minimums.
 *  - `symbol` / `presets` — display-only metadata used by the donate dialog.
 */
export interface DonationCurrencyConfig {
  code: string;
  symbol: string;
  /** Stripe's minor-unit exponent for charges (2 for USD/EUR/TWD/etc.,
   *  0 for zero-decimal currencies like JPY). */
  decimals: number;
  /** Decimal places the UI should accept and display. Defaults to
   *  `decimals` when omitted. TWD sets this to `0` so users enter whole
   *  NTD even though charges use 2-decimal minor units. */
  displayDecimals?: number;
  min: number;
  max: number;
  /** Three quick-pick amounts in major units (cups of tea). */
  presets: readonly number[];
}

/** The supported donation currencies — the single source of truth for both
 *  the backend (Stripe charge conversion) and the frontend (donate dialog
 *  display + input). `code`/`decimals`/`displayDecimals`/`min`/`max` are
 *  used by both sides; `symbol`/`presets` are display-only. */
export const DONATION_CURRENCIES: readonly DonationCurrencyConfig[] = [
  {
    code: "USD",
    symbol: "$",
    decimals: 2,
    min: 1,
    max: 500,
    presets: [3, 9, 15],
  },
  {
    code: "TWD",
    symbol: "NT$",
    decimals: 2,
    displayDecimals: 0,
    min: 30,
    max: 15000,
    presets: [90, 270, 450],
  },
  {
    code: "CNY",
    symbol: "¥",
    decimals: 2,
    min: 5,
    max: 3500,
    presets: [18, 54, 90],
  },
  {
    code: "HKD",
    symbol: "HK$",
    decimals: 2,
    min: 8,
    max: 4000,
    presets: [24, 72, 120],
  },
  {
    code: "EUR",
    symbol: "€",
    decimals: 2,
    min: 1,
    max: 500,
    presets: [3, 9, 15],
  },
  {
    code: "GBP",
    symbol: "£",
    decimals: 2,
    min: 1,
    max: 500,
    presets: [3, 9, 15],
  },
  {
    code: "JPY",
    symbol: "¥",
    decimals: 0,
    min: 150,
    max: 75000,
    presets: [400, 1200, 2000],
  },
];

export const DEFAULT_DONATION_CURRENCY = "USD";

/** Lookup helper — returns the config for a currency code, or USD as a
 *  fallback if the code is unknown. */
export function getDonationCurrency(code: string): DonationCurrencyConfig {
  return (
    DONATION_CURRENCIES.find((c) => c.code === code) ?? DONATION_CURRENCIES[0]
  );
}

/** The number of decimal places the UI should accept and display for a
 *  currency — `displayDecimals` when set, otherwise `decimals`. */
export function displayDecimalsFor(currency: DonationCurrencyConfig): number {
  return currency.displayDecimals ?? currency.decimals;
}

/** Converts a major-unit amount (e.g. dollars or yen) to Stripe minor units
 *  (cents for 2-decimal currencies, whole units for 0-decimal). Uses
 *  `Math.round` to avoid float precision artifacts. The backend uses this
 *  as the single source of truth for the per-currency exponent. */
export function toStripeMinorUnits(
  amount: number,
  currency: DonationCurrencyConfig,
): number {
  return Math.round(amount * Math.pow(10, currency.decimals));
}
