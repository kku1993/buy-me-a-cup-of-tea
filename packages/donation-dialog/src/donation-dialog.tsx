import { useState, type CSSProperties } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { TeaCupIcon } from "./tea-cup-icon";
import { SelectField } from "./select-field";
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  type ButtonProps,
} from "./ui";
import {
  createDonationIntent,
  DONATION_CURRENCIES,
  DONATION_CUP_PRESETS,
  DonationError,
  detectCurrencyFromTimezone,
  displayDecimalsFor,
  formatAmount,
  getCurrency,
  getStripe,
  getStripePublishableKey,
  type CurrencyConfig,
} from "./donate";
import {
  formatTemplate,
  resolveStrings,
  type DonationStrings,
} from "./strings";

type Step =
  | { kind: "amount" }
  | {
      kind: "pay";
      amount: number;
      currency: CurrencyConfig;
      clientSecret: string;
    }
  | { kind: "success" };

/** Builds the inline CSS-variable style that re-themes the dialog (and
 *  the trigger button) from a single user-supplied color. The dialog's
 *  stylesheet reads `--dd-primary` / `--dd-primary-hover` for buttons,
 *  focus rings, links, and the preset cup icons, so overriding those two
 *  variables on the dialog root (and on the trigger button) is enough to
 *  re-skin the whole thing. `--dd-primary-contrast` (the button text
 *  color) is left at its default white. The hover shade is derived via
 *  `color-mix` so consumers only have to pick one color. Returns
 *  `undefined` when `themeColor` is unset so the defaults from `:root`
 *  (purple) apply untouched. */
function themeStyle(themeColor?: string): CSSProperties | undefined {
  if (!themeColor) return undefined;
  return {
    "--dd-primary": themeColor,
    "--dd-primary-hover": `color-mix(in srgb, ${themeColor}, #000 12%)`,
  } as CSSProperties;
}

function CheckoutForm({
  amount,
  currency,
  strings,
  onSuccess,
  onBack,
}: {
  amount: number;
  currency: CurrencyConfig;
  strings: DonationStrings;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message ?? strings.error);
      return;
    }
    if (
      result.paymentIntent.status === "succeeded" ||
      result.paymentIntent.status === "processing"
    ) {
      onSuccess();
      return;
    }
    setError(strings.error);
  }

  return (
    <div className="dd-pay">
      <PaymentElement />
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <div className="dd-pay-actions">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={submitting}
        >
          {strings.back}
        </Button>
        <Button
          type="button"
          disabled={!stripe || !elements || submitting}
          onClick={() => void submit()}
        >
          {submitting
            ? strings.processing
            : formatTemplate(strings.pay, {
                amount: formatAmount(amount, currency),
              })}
        </Button>
      </div>
    </div>
  );
}

function DonateDialogContent({
  onClose,
  locale,
  strings: stringsOverride,
  themeColor,
}: {
  onClose: () => void;
  /** Locale code (e.g. `"es"`, `"zh-Hant"`, or a custom code registered
   *  via `registerLocale`). Omit to auto-detect from the browser
   *  language. */
  locale?: string;
  /** Per-render overrides merged on top of the resolved locale's bundle. */
  strings?: Partial<DonationStrings>;
  /** Theme color (any CSS color) for the dialog's primary accent —
   *  buttons, focus rings, links, and the preset cup icons. Omit to
   *  keep the default purple. The hover shade is derived automatically. */
  themeColor?: string;
}) {
  const strings = resolveStrings({ locale, strings: stringsOverride });
  const [step, setStep] = useState<Step>({ kind: "amount" });
  const [currencyCode, setCurrencyCode] = useState(() =>
    detectCurrencyFromTimezone(),
  );
  const currency = getCurrency(currencyCode);
  const [customAmount, setCustomAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Normalizes the raw input value for the current currency. For
   *  zero-display-decimal currencies (e.g. TWD, JPY) the fractional part
   *  is stripped immediately as the user types — `inputMode`/`step` are
   *  only hints, so the browser still lets you type a decimal point into
   *  `<input type="number">`. */
  function normalizeAmountInput(raw: string): string {
    if (displayDecimalsFor(currency) === 0) {
      const dotIndex = raw.indexOf(".");
      return dotIndex === -1 ? raw : raw.slice(0, dotIndex);
    }
    return raw;
  }

  async function chooseAmount(amount: number) {
    if (
      !Number.isFinite(amount) ||
      amount < currency.min ||
      amount > currency.max
    ) {
      setError(
        formatTemplate(strings.invalidAmount, {
          min: formatAmount(currency.min, currency),
          max: formatAmount(currency.max, currency),
        }),
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const clientSecret = await createDonationIntent(amount, currency.code);
      setStep({ kind: "pay", amount, currency, clientSecret });
    } catch (err) {
      setError(err instanceof DonationError ? err.message : strings.error);
    } finally {
      setLoading(false);
    }
  }

  if (!getStripePublishableKey()) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{strings.title}</DialogTitle>
        </DialogHeader>
        <Alert>{strings.unavailable}</Alert>
      </>
    );
  }

  if (step.kind === "success") {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{strings.thankYouTitle}</DialogTitle>
          <DialogDescription>{strings.thankYouBody}</DialogDescription>
        </DialogHeader>
        <Button type="button" onClick={onClose}>
          {strings.close}
        </Button>
      </>
    );
  }

  if (step.kind === "pay") {
    return (
      <>
        <DialogHeader>
          <DialogTitle>
            {formatTemplate(strings.payTitle, {
              amount: formatAmount(step.amount, step.currency),
            })}
          </DialogTitle>
        </DialogHeader>
        <Elements
          stripe={getStripe()}
          options={{
            clientSecret: step.clientSecret,
            appearance: {
              theme: "night",
              variables: themeColor ? { colorPrimary: themeColor } : undefined,
            },
          }}
        >
          <CheckoutForm
            amount={step.amount}
            currency={step.currency}
            strings={strings}
            onSuccess={() => setStep({ kind: "success" })}
            onBack={() => setStep({ kind: "amount" })}
          />
        </Elements>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{strings.title}</DialogTitle>
        <DialogDescription>{strings.description}</DialogDescription>
      </DialogHeader>
      <SelectField
        label={strings.currencyLabel}
        value={currencyCode}
        options={DONATION_CURRENCIES.map((c) => ({
          value: c.code,
          label: `${c.code} — ${c.symbol}`,
        }))}
        onValueChange={(next) => {
          setCurrencyCode(next);
          // Re-normalize any existing custom amount against the new
          // currency's display decimals (e.g. switching from USD to TWD
          // strips the fractional part).
          const nextCurrency = getCurrency(next);
          if (displayDecimalsFor(nextCurrency) === 0) {
            setCustomAmount((prev) => {
              const dotIndex = prev.indexOf(".");
              return dotIndex === -1 ? prev : prev.slice(0, dotIndex);
            });
          }
        }}
      />
      <div className="dd-presets">
        {DONATION_CUP_PRESETS.map((preset, index) => (
          <button
            key={preset.cups}
            type="button"
            className="dd-preset"
            disabled={loading}
            onClick={() => void chooseAmount(currency.presets[index])}
          >
            <span className="dd-preset-cups" aria-hidden="true">
              {Array.from({ length: preset.cups }, (_, i) => (
                <TeaCupIcon key={i} />
              ))}
            </span>
            <span className="dd-preset-amount">
              {formatAmount(currency.presets[index], currency)}
            </span>
            <span className="dd-preset-label">{strings[preset.labelKey]}</span>
          </button>
        ))}
      </div>
      <div className="dd-custom">
        <label className="dd-field">
          <span>
            {formatTemplate(strings.customLabel, { currency: currency.code })}
          </span>
          <Input
            type="number"
            inputMode={
              displayDecimalsFor(currency) === 0 ? "numeric" : "decimal"
            }
            min={currency.min}
            max={currency.max}
            step={displayDecimalsFor(currency) === 0 ? "1" : "any"}
            placeholder={strings.customPlaceholder}
            value={customAmount}
            onChange={(event) =>
              setCustomAmount(normalizeAmountInput(event.target.value))
            }
          />
        </label>
        <Button
          type="button"
          variant="outline"
          disabled={loading || !customAmount}
          onClick={() => void chooseAmount(Number(customAmount))}
        >
          {strings.continue}
        </Button>
      </div>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
    </>
  );
}

export interface DonateButtonProps {
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  /** Hides the text label, showing only the tea icon (for tight spots
   *  like a footer). */
  iconOnly?: boolean;
  /** Locale code (e.g. `"es"`, `"zh-Hant"`, or a custom code registered
   *  via `registerLocale`). Omit to auto-detect from the browser
   *  language. */
  locale?: string;
  /** Per-render overrides merged on top of the resolved locale's bundle.
   *  Only the keys you supply are replaced; the rest come from the locale
   *  (or the English fallback). */
  strings?: Partial<DonationStrings>;
  /** Theme color (any CSS color string, e.g. `"#10b981"` or `"orange"`)
   *  for the primary accent — the trigger button (when `variant="default"
   *  or "settings-action"`), the dialog's buttons, focus rings, links, the
   *  preset cup icons, and the Stripe Elements accent. Omit to keep the
   *  default purple (`#646cff`). The hover shade is derived automatically
   *  via `color-mix`. */
  themeColor?: string;
}

export function DonateButton({
  variant = "outline",
  size,
  className,
  iconOnly,
  locale,
  strings,
  themeColor,
}: DonateButtonProps) {
  const [open, setOpen] = useState(false);

  const resolved = resolveStrings({ locale, strings });
  const style = themeStyle(themeColor);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size ?? (iconOnly ? "icon-sm" : "default")}
        className={className}
        style={style}
        onClick={() => setOpen(true)}
        aria-label={resolved.button}
      >
        <TeaCupIcon aria-hidden="true" />
        {iconOnly ? null : resolved.button}
      </Button>
      <Dialog open={open} onOpenChange={(next: boolean) => setOpen(next)}>
        <DialogContent showClose className="dd-donate-dialog" style={style}>
          <DonateDialogContent
            onClose={() => setOpen(false)}
            locale={locale}
            strings={strings}
            themeColor={themeColor}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export { DonateDialogContent };
