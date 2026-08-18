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
  DEFAULT_DONATION_STRINGS,
  formatTemplate,
  resolveStrings,
  type DonationStrings,
} from "./strings";

export type { DonationCurrencyConfig } from "./currency";

import "./styles.css";
