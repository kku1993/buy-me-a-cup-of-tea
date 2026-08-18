import { useEffect, useState } from "react";
import {
  configureDonation,
  DonateButton,
  DONATION_CURRENCIES,
  TeaCupIcon,
  type DonationCurrencyConfig,
} from "@repo/donation-dialog";

// Configure the donation runtime once at module load.
// - `apiOrigin` is the Go backend that mints Stripe PaymentIntents. In dev
//   the Vite proxy forwards same-origin `/v1/...` requests to :8787, so we
//   can use an empty origin (relative URL). For a deployed build set this
//   to the backend's absolute origin.
// - `stripePublishableKey` comes from `VITE_STRIPE_PUBLIC_KEY`. When unset
//   the dialog shows its "unavailable" state instead of crashing — handy
//   for kicking the tires without a Stripe account.
configureDonation({
  apiOrigin: "",
  stripePublishableKey: import.meta.env.VITE_STRIPE_PUBLIC_KEY as
    string | undefined,
});

const supportedCurrencies = DONATION_CURRENCIES.map(
  (c: DonationCurrencyConfig) => c.code,
).join(", ");

export function App() {
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    setConfigured(Boolean(import.meta.env.VITE_STRIPE_PUBLIC_KEY));
  }, []);

  return (
    <main className="page">
      <header className="page-header">
        <span className="page-logo" aria-hidden="true">
          <TeaCupIcon size={36} />
        </span>
        <h1>Buy me a cup of tea</h1>
        <p className="page-tagline">
          A demo of the <code>@repo/donation-dialog</code> standalone React
          component, wired to a Go backend that mints Stripe PaymentIntents.
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
          <DonateButton />
          <DonateButton variant="default" />
          <DonateButton iconOnly aria-label="Donate" />
        </div>
        <p className="hint">
          Supported currencies: <strong>{supportedCurrencies}</strong>. The
          suggested currency is detected from your browser timezone.
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
        <span>Built with @repo/donation-dialog</span>
      </footer>
    </main>
  );
}
