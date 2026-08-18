import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  DEFAULT_DONATION_CURRENCY,
  DONATION_CURRENCIES,
  displayDecimalsFor,
  getDonationCurrency,
  type DonationCurrencyConfig,
} from "./currency";

export type CurrencyConfig = DonationCurrencyConfig;

// Re-export the shared donation currency config so consumers can reach the
// single source of truth without a second import path.
export {
  DONATION_CURRENCIES,
  DEFAULT_DONATION_CURRENCY,
  displayDecimalsFor,
  getDonationCurrency as getCurrency,
};
export { toStripeMinorUnits } from "./currency";

/** Configuration for the donate dialog's backend client. Set once at app
 *  boot via {@link configureDonation} — the dialog reads the resolved
 *  values from the module singleton, so consumers don't have to thread
 *  props through every render. */
interface DonationConfig {
  /** Stripe publishable key. Safe to expose to the browser. When unset,
   *  `DonateDialog` shows an "unavailable" state instead of crashing. */
  stripePublishableKey?: string;
  /** Origin (scheme + host [+ port]) of the backend that mints
   *  PaymentIntents, e.g. `http://localhost:8787`. The dialog POSTs to
   *  `${apiOrigin}/v1/donations/payment-intent`. An empty string is a
   *  valid value meaning "same-origin" — the request uses a relative URL,
   *  useful when a dev proxy (or a co-located backend) serves `/v1/...`
   *  on the same origin as the page. `undefined` (the unset default)
   *  means `configureDonation()` has not been called yet. */
  apiOrigin?: string;
}

const config: DonationConfig = {};

/** Sets the runtime configuration for the donate dialog. Call once at app
 *  boot, before rendering any donate UI. */
export function configureDonation(
  next: Partial<DonationConfig> & { apiOrigin: string },
): void {
  if (next.stripePublishableKey !== undefined) {
    config.stripePublishableKey = next.stripePublishableKey;
  }
  config.apiOrigin = next.apiOrigin;
}

/** The configured Stripe publishable key (or `undefined` if unset). */
export function getStripePublishableKey(): string | undefined {
  return config.stripePublishableKey;
}

let stripePromise: Promise<Stripe | null> | null = null;

/** Lazily-created singleton Stripe.js instance — loading the script eagerly
 *  on every page would cost bytes/requests for visitors who never donate. */
export function getStripe(): Promise<Stripe | null> {
  if (!config.stripePublishableKey) return Promise.resolve(null);
  if (!stripePromise) stripePromise = loadStripe(config.stripePublishableKey);
  return stripePromise;
}

/** "Buy me a cup of tea" preset labels, indexed by the preset's position
 *  (1 cup / 3 cups / 5 cups). The number of cups is the preset index + 1
 *  mapping: presets[0] = 1 cup, presets[1] = 3 cups, presets[2] = 5 cups. */
export const DONATION_CUP_PRESETS = [
  { cups: 1, labelKey: "presetOne" as const },
  { cups: 3, labelKey: "presetThree" as const },
  { cups: 5, labelKey: "presetFive" as const },
] as const;

export class DonationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DonationError";
  }
}

/** Formats a major-unit amount as a currency string using the user's
 *  locale. e.g. `formatAmount(3, usd)` → "$3.00", `formatAmount(400, jpy)`
 *  → "¥400". Uses `displayDecimals` (falling back to `decimals`) for the
 *  fraction digits — so TWD displays as "NT$200" (0 decimals) even though
 *  its Stripe charge uses 2-decimal minor units. */
export function formatAmount(amount: number, currency: CurrencyConfig): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: displayDecimalsFor(currency),
  }).format(amount);
}

/** Detects a suggested currency from the browser's IANA timezone. This is
 *  a heuristic (not IP geolocation) — it avoids the privacy/consent
 *  implications of processing the visitor's IP address and needs no
 *  external service or geo-IP database. The user can always override via
 *  the currency selector, which covers its imprecision (e.g. a US expat
 *  in Tokyo). Falls back to `DEFAULT_DONATION_CURRENCY` for unmapped
 *  timezones. */
export function detectCurrencyFromTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (tz === "Asia/Taipei") return "TWD";
    if (tz === "Asia/Hong_Kong" || tz === "Asia/Macau") return "HKD";
    if (tz === "Asia/Shanghai" || tz === "Asia/Urumqi") return "CNY";
    if (tz === "Asia/Tokyo") return "JPY";
    if (tz === "Europe/London") return "GBP";
    // Most other European timezones are in the Eurozone (or nearby non-euro
    // countries where EUR is still the closest match the user can override).
    if (tz.startsWith("Europe/")) return "EUR";
  } catch {
    // `Intl` may be unavailable in very old runtimes — fall back to default.
  }
  return DEFAULT_DONATION_CURRENCY;
}

/** Creates a Stripe PaymentIntent for the given amount and currency, and
 *  returns its client secret. Unauthenticated — donations don't require
 *  an account. `amount` is the raw major-unit amount the user entered
 *  (e.g. 200 for 200 NTD, 3.5 for $3.50); the backend converts it to
 *  Stripe minor units using the currency's exponent. */
export async function createDonationIntent(
  amount: number,
  currency: string,
): Promise<string> {
  if (config.apiOrigin === undefined) {
    throw new DonationError(
      "Donation backend origin is not configured. Call configureDonation() first.",
    );
  }
  const response = await fetch(
    `${config.apiOrigin}/v1/donations/payment-intent`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount, currency }),
    },
  );
  if (!response.ok) {
    // Surface the backend's error message (forwarded from Stripe when
    // applicable, e.g. "Amount must be at least $0.50 USD") so the donate
    // dialog can show it to the user.
    let msg: string | undefined;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) msg = body.message;
    } catch {
      // Non-JSON body — keep the status-based fallback.
    }
    throw new DonationError(
      msg ?? `Payment intent request failed: ${response.status}`,
    );
  }
  const body = (await response.json()) as {
    data?: { clientSecret?: string };
  };
  const clientSecret = body.data?.clientSecret;
  if (!clientSecret) throw new DonationError("Missing client secret");
  return clientSecret;
}
