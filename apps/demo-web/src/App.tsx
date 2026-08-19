import { useEffect, useMemo, useState } from "react";
import {
  BUNDLED_LOCALES,
  configureDonation,
  detectLocale,
  DonateButton,
  DONATION_CURRENCIES,
  registerLocale,
  TeaCupIcon,
  type DonationCurrencyConfig,
  type LocaleCode,
} from "@kku1993/buy-me-a-cup-of-tea";

// Configure the donation runtime once at module load.
// - `apiOrigin` is the Go backend that mints Stripe PaymentIntents. In dev
//   the Vite proxy forwards same-origin `/v1/...` requests to :8787, so we
//   can use an empty origin (relative URL). For a deployed build set this
//   to the backend's absolute origin.
// - `stripePublishableKey` comes from `VITE_STRIPE_PUBLIC_KEY`. When unset
//   the dialog shows its "unavailable" state instead of crashing — handy
//   for kicking the tires without a Stripe account.
configureDonation({
  // In dev the Vite proxy forwards same-origin `/v1/...` to the Go backend
  // on :8787, so an empty origin (relative URL) works. In production builds
  // `VITE_API_ORIGIN` is defined (see vite.config.ts) to the deployed
  // backend origin, so the bundle talks to it directly.
  apiOrigin: (import.meta.env.VITE_API_ORIGIN as string | undefined) ?? "",
  stripePublishableKey: import.meta.env.VITE_STRIPE_PUBLIC_KEY as
    string | undefined,
});

// Demonstrate `registerLocale`: add a locale the package doesn't ship
// (Pirate English) so the "support another language" path is live in the
// demo. Pick it from the locale dropdown below to see it in the dialog.
registerLocale("xx-pirate", {
  button: "Buy me a cup o' tea, matey",
  title: "Buy me a cup o' tea, matey",
  description:
    "If ye enjoyed this, consider buyin' me a cup o' tea. Every cup keeps me brewin'. Ye have me thanks!",
  unavailable: "Donations be unavailable right now. Try again later, matey.",
  currencyLabel: "Doubloons",
  presetOne: "A sip",
  presetThree: "A cup",
  presetFive: "A whole pot",
  customLabel: "Yer own amount ({currency})",
  customPlaceholder: "Enter amount",
  continue: "Onward",
  invalidAmount: "Amount must be between {min} and {max}.",
  error: "Somethin' went wrong. Try again.",
  payTitle: "Hand over {amount}",
  pay: "Hand over {amount}",
  processing: "Brewin'…",
  back: "Aft",
  thankYouTitle: "Ye have me thanks!",
  thankYouBody: "Yer cup o' tea be on its way. I appreciate the support!",
  close: "Shut it",
});

const supportedCurrencies = DONATION_CURRENCIES.map(
  (c: DonationCurrencyConfig) => c.code,
).join(", ");

// Bundled locales + the custom one registered above, for the dropdown.
const LOCALE_OPTIONS: { value: string; label: string }[] = [
  ...Object.keys(BUNDLED_LOCALES).map((code) => ({
    value: code,
    label: localeLabel(code as LocaleCode),
  })),
  { value: "xx-pirate", label: "Pirate English (custom, via registerLocale)" },
];

function localeLabel(code: LocaleCode): string {
  const names: Record<LocaleCode, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    "zh-Hans": "Chinese (Simplified)",
    "zh-Hant": "Chinese (Traditional)",
  };
  return names[code];
}

export function App() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  // `auto` = let the dialog detect from the browser language; otherwise
  // the selected code is passed straight to `locale`.
  const [locale, setLocale] = useState<string>("auto");
  // Toggle a per-render `strings` override so the "override individual
  // strings" path is also live in the demo.
  const [overrideButton, setOverrideButton] = useState(false);
  // Theme color picker — empty string means "default purple".
  const [themeColor, setThemeColor] = useState<string>("");

  const detected = useMemo(() => detectLocale(), []);

  useEffect(() => {
    setConfigured(Boolean(import.meta.env.VITE_STRIPE_PUBLIC_KEY));
  }, []);

  const stringsOverride = overrideButton
    ? { button: "Support this project 💛" }
    : undefined;
  const localeProp = locale === "auto" ? undefined : locale;
  const themeColorProp = themeColor || undefined;

  return (
    <main className="page">
      <header className="page-header">
        <span className="page-logo" aria-hidden="true">
          <TeaCupIcon size={36} />
        </span>
        <h1>Buy me a cup of tea</h1>
        <p className="page-tagline">
          A demo of the <code>@kku1993/buy-me-a-cup-of-tea</code> standalone
          React component, wired to a Go backend that mints Stripe
          PaymentIntents.
        </p>
      </header>

      <section className="card">
        <h2>Try it</h2>
        <p>
          Click the button to open the donate dialog. Pick a currency, choose a
          preset or enter a custom amount, and Stripe Elements takes over for
          card entry.
        </p>
        <div className="card-actions">
          <DonateButton
            locale={localeProp}
            strings={stringsOverride}
            themeColor={themeColorProp}
          />
          <DonateButton
            variant="default"
            locale={localeProp}
            strings={stringsOverride}
            themeColor={themeColorProp}
            metadata={{
              campaign: "demo-web",
              placement: "primary",
            }}
          />
          <DonateButton
            iconOnly
            aria-label="Donate"
            locale={localeProp}
            strings={stringsOverride}
            themeColor={themeColorProp}
          />
        </div>
        <p className="hint">
          Supported currencies: <strong>{supportedCurrencies}</strong>. The
          suggested currency is detected from your browser timezone.
        </p>
      </section>

      <section className="card">
        <h2>Theme color</h2>
        <p>
          The dialog's primary accent defaults to purple (<code>#646cff</code>).
          Pass any CSS color to the <code>themeColor</code> prop to re-skin the
          trigger button, the dialog's buttons, focus rings, links, the preset
          cup icons, and the Stripe Elements accent. The hover shade is derived
          automatically.
        </p>
        <label className="field-row">
          <span>Theme color</span>
          <input
            type="color"
            value={themeColor || "#646cff"}
            onChange={(e) => setThemeColor(e.target.value)}
            className="color-picker"
            aria-label="Theme color"
          />
          <button
            type="button"
            className="select"
            onClick={() => setThemeColor("")}
          >
            Reset to default
          </button>
        </label>
        <div className="swatches">
          {[
            "#646cff",
            "#10b981",
            "#f97316",
            "#ec4899",
            "#0ea5e9",
            "#eab308",
          ].map((c) => (
            <button
              key={c}
              type="button"
              className="swatch"
              style={{ backgroundColor: c }}
              aria-label={`Use ${c}`}
              onClick={() => setThemeColor(c)}
            />
          ))}
        </div>
        <p className="hint">
          Current: <strong>{themeColor || "default (purple #646cff)"}</strong>
        </p>
      </section>

      <section className="card">
        <h2>i18n</h2>
        <p>
          The package ships built-in translations for English, Spanish, French,
          German, Italian, and Simplified / Traditional Chinese. Leave the
          selector on <code>auto</code> to detect from the browser language
          (your browser reports <strong>{detected}</strong>), or pick one to
          force it.
        </p>
        <label className="field-row">
          <span>Locale</span>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="select"
          >
            <option value="auto">auto (browser — detected {detected})</option>
            {LOCALE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-row">
          <input
            type="checkbox"
            checked={overrideButton}
            onChange={(e) => setOverrideButton(e.target.checked)}
          />
          <span>
            Override the button label per-render via the <code>strings</code>{" "}
            prop
          </span>
        </label>
        <p className="hint">
          The <strong>Pirate English</strong> entry is registered at module load
          via <code>registerLocale()</code> — that's the “support another
          language” path. The checkbox demonstrates the “override individual
          strings” path (a partial <code>strings</code> prop merged on top of
          the resolved locale).
        </p>
      </section>

      <section className="card">
        <h2>Metadata</h2>
        <p>
          Pass a <code>metadata</code> record to attach arbitrary string tags to
          the resulting Stripe payment (visible in the Stripe dashboard /
          webhooks). Useful for attributing donations to a campaign, page, or
          placement. The primary button above sends{" "}
          <code>{'{ campaign: "demo-web", placement: "primary" }'}</code>. The
          backend forwards it to the PaymentIntent and validates Stripe's limits
          (≤50 keys, 40-char key names, 500-char values).
        </p>
      </section>

      <section className="card">
        <h2>Setup</h2>
        <p>This demo reads two pieces of runtime config:</p>
        <ul>
          <li>
            <code>VITE_STRIPE_PUBLIC_KEY</code> — your Stripe publishable key.
            When unset, the dialog shows its “unavailable” state.
          </li>
          <li>
            The Go backend at <code>apps/backend</code> (port <code>8787</code>)
            holding your Stripe secret key and serving{" "}
            <code>POST /v1/donations/payment-intent</code>.
          </li>
        </ul>
        <p className="hint">
          Stripe publishable key status:{" "}
          {configured === null
            ? "checking…"
            : configured
              ? "loaded ✓"
              : "not set — dialog will show its unavailable state"}
        </p>
        <p className="hint">
          Copy <code>apps/demo-web/.env.example</code> to{" "}
          <code>apps/demo-web/.env</code> and fill in your publishable key to
          test end-to-end.
        </p>
      </section>

      <footer className="page-footer">
        <span>Built with @kku1993/buy-me-a-cup-of-tea</span>
      </footer>
    </main>
  );
}
