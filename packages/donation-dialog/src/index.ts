// Component
export {
  DonateButton,
  DonateDialogContent,
  type DonateButtonProps,
} from "./donation-dialog";

// Icon + field helpers
export { TeaCupIcon } from "./tea-cup-icon";
export { SelectField, type SelectFieldOption } from "./select-field";

// UI primitives (bundled, standalone)
export * from "./ui";

// Donation runtime: configuration, currency configs, formatting, intent
export {
  configureDonation,
  createDonationIntent,
  detectCurrencyFromTimezone,
  displayDecimalsFor,
  DONATION_CURRENCIES,
  DONATION_CUP_PRESETS,
  DEFAULT_DONATION_CURRENCY,
  DonationError,
  formatAmount,
  getCurrency,
  getStripe,
  getStripePublishableKey,
  toStripeMinorUnits,
  type CurrencyConfig,
} from "./donate";

export {
  BUNDLED_LOCALES,
  DEFAULT_DONATION_STRINGS,
  detectLocale,
  formatTemplate,
  getStringsForLocale,
  registerLocale,
  resolveStrings,
  unregisterLocale,
  type DonationStrings,
  type LocaleCode,
  type ResolveStringsOptions,
} from "./strings";

// Individual locale bundles — import these to inspect or diff a translation,
// or to spread into a custom bundle passed to `registerLocale`.
export { de, en, es, fr, it, zhHant, zhHans } from "./locales";

export type { DonationCurrencyConfig } from "./currency";

import "./styles.css";
