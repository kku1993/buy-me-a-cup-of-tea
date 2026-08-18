/**
 * Default English copy for the donate dialog. Consumers can override any
 * subset of these by passing a `strings` prop to {@link DonateButton} (or
 * {@link DonateDialogContent}) — only the keys they want to change need to
 * be supplied; the rest fall back to these defaults.
 *
 * The `presetOne` / `presetThree` / `presetFive` keys are the labels under
 * the 1/3/5-cup quick-pick buttons.
 */
export interface DonationStrings {
  button: string;
  title: string;
  description: string;
  unavailable: string;
  currencyLabel: string;
  presetOne: string;
  presetThree: string;
  presetFive: string;
  customLabel: string;
  customPlaceholder: string;
  continue: string;
  invalidAmount: string;
  error: string;
  payTitle: string;
  pay: string;
  processing: string;
  back: string;
  thankYouTitle: string;
  thankYouBody: string;
  close: string;
}

/** `invalidAmount` / `pay` / `payTitle` / `customLabel` are treated as
 *  ICU-style templates: `{min}`, `{max}`, `{amount}`, `{currency}` are
 *  substituted at render time. */
export const DEFAULT_DONATION_STRINGS: DonationStrings = {
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

/** Substitutes `{key}` placeholders in `template` with the values in
 *  `params`. Missing keys are left as-is. */
export function formatTemplate(
  template: string,
  params: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

/** Merges a consumer's partial `strings` override on top of the defaults. */
export function resolveStrings(
  override: Partial<DonationStrings> | undefined,
): DonationStrings {
  return { ...DEFAULT_DONATION_STRINGS, ...override };
}
