import { useState } from "react";
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
  strings: stringsOverride,
}: {
  onClose: () => void;
  strings?: Partial<DonationStrings>;
}) {
  const strings = resolveStrings(stringsOverride);
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
            appearance: { theme: "night" },
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
  /** Optional copy overrides; only the keys you supply replace the
   *  built-in English defaults. */
  strings?: Partial<DonationStrings>;
}

export function DonateButton({
  variant = "outline",
  size,
  className,
  iconOnly,
  strings,
}: DonateButtonProps) {
  const [open, setOpen] = useState(false);

  const resolved = resolveStrings(strings);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size ?? (iconOnly ? "icon-sm" : "default")}
        className={className}
        onClick={() => setOpen(true)}
        aria-label={resolved.button}
      >
        <TeaCupIcon aria-hidden="true" />
        {iconOnly ? null : resolved.button}
      </Button>
      <Dialog open={open} onOpenChange={(next: boolean) => setOpen(next)}>
        <DialogContent showClose className="dd-donate-dialog">
          <DonateDialogContent
            onClose={() => setOpen(false)}
            strings={strings}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export { DonateDialogContent };
