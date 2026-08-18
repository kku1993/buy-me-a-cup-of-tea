import { de, en, es, fr, it, zhHant, zhHans } from "./locales";

/**
 * Built-in i18n for the donate dialog.
 *
 * The dialog ships with translations for seven locales (see
 * {@link BUNDLED_LOCALES}). Consumers can:
 *  - pick a locale via the `locale` prop on {@link DonateButton} (falls back
 *    to {@link detectLocale}, which reads the browser language);
 *  - override individual strings for any locale via the `strings` prop
 *    (a partial {@link DonationStrings} merged on top of the resolved
 *    locale's bundle);
 *  - replace a bundled locale app-wide, or register a brand-new locale,
 *    via {@link registerLocale} and then pass `locale="<code>"`.
 *
 * Resolution order for a given render is:
 *   `strings` prop  >  custom-registered locale  >  bundled locale  >  en
 *
 * `invalidAmount` / `pay` / `payTitle` / `customLabel` are treated as
 * ICU-style templates: `{min}`, `{max}`, `{amount}`, `{currency}` are
 * substituted at render time by {@link formatTemplate}.
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

/** Locale codes shipped with the package. The canonical English bundle is
 *  the fallback for any unknown locale or missing key. */
export type LocaleCode =
  "en" | "es" | "fr" | "de" | "zh-Hant" | "zh-Hans" | "it";

/** All bundled locale bundles, keyed by {@link LocaleCode}. Consumers can
 *  read these (e.g. to inspect or diff a translation) but should not mutate
 *  them — use {@link registerLocale} to override app-wide. */
export const BUNDLED_LOCALES: Record<LocaleCode, DonationStrings> = {
  en,
  es,
  fr,
  de,
  "zh-Hant": zhHant,
  "zh-Hans": zhHans,
  it,
};

/** English — the canonical source copy and the fallback for unknown
 *  locales. Kept as a named export for consumers who want the default
 *  bundle directly. */
export const DEFAULT_DONATION_STRINGS: DonationStrings = en;

/** Runtime registry for app-wide locale overrides and custom locales.
 *  Entries here take precedence over {@link BUNDLED_LOCALES} for the same
 *  code, so registering `"es"` replaces Spanish everywhere; registering
 *  `"ja"` adds Japanese (then pass `locale="ja"` to the dialog). */
const customLocales = new Map<string, DonationStrings>();

/** Registers (or replaces) a locale's full string bundle at runtime.
 *  Use this to:
 *   - override a bundled locale's translations app-wide (register the same
 *     code, e.g. `registerLocale("es", { ... })`), or
 *   - add a locale the package doesn't ship (e.g.
 *     `registerLocale("ja", { ... })`, then render `<DonateButton
 *     locale="ja" />`).
 *
 *  For per-render tweaks prefer the `strings` prop on `DonateButton`, which
 *  is merged on top of the resolved locale and leaves the registry alone. */
export function registerLocale(code: string, strings: DonationStrings): void {
  customLocales.set(normalizeLocaleCode(code), { ...strings });
}

/** Removes a previously-registered custom locale. Bundled locales cannot be
 *  removed (calls for bundled codes are a no-op). Mainly useful in tests. */
export function unregisterLocale(code: string): void {
  customLocales.delete(normalizeLocaleCode(code));
}

/** Returns the full string bundle for a locale code, applying the
 *  resolution order: custom-registered > bundled > English fallback.
 *  Unknown codes never throw — they fall back to English so the dialog
 *  always renders. */
export function getStringsForLocale(code: string | undefined): DonationStrings {
  if (!code) return en;
  const normalized = normalizeLocaleCode(code);
  const custom = customLocales.get(normalized);
  if (custom) return custom;
  if (normalized in BUNDLED_LOCALES) {
    return BUNDLED_LOCALES[normalized as LocaleCode];
  }
  return en;
}

/** Detects the best matching bundled locale from the browser's language
 *  preferences (`navigator.languages` / `navigator.language`). Maps common
 *  tags to the package's locale codes, including the zh-Hans / zh-Hant
 *  split. Falls back to `"en"` for unmapped languages. Safe to call in SSR
 *  (returns `"en"` when `navigator` is undefined). */
export function detectLocale(): LocaleCode {
  if (typeof navigator === "undefined") return "en";
  const candidates: string[] = [];
  if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
    candidates.push(...navigator.languages);
  }
  if (navigator.language) candidates.push(navigator.language);
  for (const tag of candidates) {
    const matched = matchLocale(tag);
    if (matched) return matched;
  }
  return "en";
}

/** Maps a single BCP-47 language tag to a bundled {@link LocaleCode}, or
 *  `undefined` if no bundled locale matches. Handles the zh-Hans / zh-Hant
 *  split via both the script subtag and the region subtag. */
function matchLocale(tag: string): LocaleCode | undefined {
  const lower = tag.toLowerCase().trim();
  if (!lower) return undefined;
  // Script subtag (e.g. zh-hant, zh-hans) wins over region for Chinese.
  if (lower.includes("zh-hant")) return "zh-Hant";
  if (lower.includes("zh-hans")) return "zh-Hans";
  const primary = lower.split(/[-_]/)[0];
  switch (primary) {
    case "en":
      return "en";
    case "es":
      return "es";
    case "fr":
      return "fr";
    case "de":
      return "de";
    case "it":
      return "it";
    case "zh": {
      // No script subtag — fall back to region. TW/HK/MO → Traditional,
      // everything else (CN, SG, or bare zh) → Simplified.
      const region = lower.split(/[-_]/)[1] ?? "";
      if (region === "tw" || region === "hk" || region === "mo") {
        return "zh-Hant";
      }
      return "zh-Hans";
    }
    default:
      return undefined;
  }
}

/** Normalizes a locale code for registry lookup: lowercased, with `_`
 *  converted to `-`. zh-Hant / zh-Hans keep their script casing by special
 *  case so they match {@link BUNDLED_LOCALES} keys. */
function normalizeLocaleCode(code: string): string {
  const lower = code.toLowerCase().replace(/_/g, "-").trim();
  if (lower === "zh-hant") return "zh-Hant";
  if (lower === "zh-hans") return "zh-Hans";
  return lower;
}

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

/** Options for {@link resolveStrings}. */
export interface ResolveStringsOptions {
  /** Locale code to resolve (e.g. `"es"`, `"zh-Hant"`, or a custom code
   *  registered via {@link registerLocale}). Omit to auto-detect from the
   *  browser language. */
  locale?: string;
  /** Per-render overrides merged on top of the resolved locale's bundle.
   *  Only the keys you supply are replaced; the rest come from the locale
   *  (or the English fallback). */
  strings?: Partial<DonationStrings>;
}

/** Resolves the final string bundle for a render. Resolution order:
 *  `strings` prop > custom-registered locale > bundled locale > en.
 *  When `locale` is omitted, {@link detectLocale} picks the browser's
 *  language. */
export function resolveStrings(
  options: ResolveStringsOptions = {},
): DonationStrings {
  const base = getStringsForLocale(options.locale ?? detectLocale());
  if (!options.strings) return base;
  return { ...base, ...options.strings };
}
