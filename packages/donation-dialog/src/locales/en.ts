import type { DonationStrings } from "../strings";

/** English (en) — the canonical source copy. Every other locale is a
 *  translation of these strings, and the fallback when a locale is unknown
 *  or a key is missing. */
export const en: DonationStrings = {
  button: "Buy me a cup of tea",
  title: "Buy me a cup of tea",
  description:
    "If you enjoyed this, consider buying me a cup of tea. Every cup keeps me brewing. Thank you!",
  unavailable: "Donations are not available right now. Please try again later.",
  currencyLabel: "Currency",
  presetOne: "A sip",
  presetThree: "A cup",
  presetFive: "A pot",
  customLabel: "Custom amount ({currency})",
  customPlaceholder: "Enter amount",
  continue: "Continue",
  invalidAmount: "Amount must be between {min} and {max}.",
  error: "Something went wrong. Please try again.",
  payTitle: "Pay {amount}",
  pay: "Pay {amount}",
  processing: "Processing…",
  back: "Back",
  thankYouTitle: "Thank you!",
  thankYouBody: "Your cup of tea is on its way. I appreciate the support!",
  close: "Close",
};
