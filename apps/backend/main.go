// Package main is a small standalone backend that mints Stripe
// PaymentIntents for the donate dialog. It exposes a single endpoint:
//
//	POST /v1/donations/payment-intent
//	  body: {"amount": <major units>, "currency": "<ISO code>"}
//	  200: {"data": {"clientSecret": "<pi_..._secret_...>"}}
//	  4xx/5xx: {"message": "<human-readable error>"}
//
// The amount is in major units (e.g. dollars or yen); the backend converts
// it to Stripe minor units using the currency's exponent from the same
// currency table the frontend uses, so the two sides agree by construction.
//
// Configure with environment variables:
//
//	STRIPE_SECRET_KEY   (required) sk_test_... / sk_live_...
//	STRIPE_ACCOUNT_ID   (optional) connected account ID for Stripe Connect
//	                    platforms; leave unset for a standalone account
//	PORT                (optional, default 8888)
//	ALLOWED_ORIGIN      (optional, default "*" — set to your frontend origin
//	                    in production to lock down CORS. Accepts a literal
//	                    "*" (any origin), an exact origin
//	                    ("https://app.example.com"), or a wildcard subdomain
//	                    pattern ("https://*.example.com" or "*.example.com")
//	                    that matches any subdomain of the given domain but not
//	                    the bare domain itself.)
package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"

	stripe "github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/paymentintent"
)

// version is the backend's version string. It is stamped into the binary
// at build time via -ldflags "-X main.version=..." (see the package's
// build/dev scripts and the Dockerfile). The value is kept in lockstep
// with the donation-dialog package version in
// packages/donation-dialog/package.json — the build verifies they match
// and refuses to compile otherwise. When unset (e.g. `go run .` without
// ldflags) it falls back to "dev".
var version = "dev"

// loadDotEnv reads a `.env` file from the working directory and sets any
// unset environment variables from it. Existing env vars win (so explicit
// shell exports / container env take precedence). Lines starting with `#`
// and blank lines are ignored. Values may be wrapped in matching single or
// double quotes (the quotes are stripped). This lets `go run .` pick up the
// `apps/backend/.env` file the README tells users to create, without a
// separate env-loader tool or a wrapper script.
func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		// Missing .env is fine — fall back to the real environment.
		return
	}
	defer f.Close()

	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		if len(value) >= 2 {
			first, last := value[0], value[len(value)-1]
			if (first == '"' && last == '"') || (first == '\'' && last == '\'') {
				value = value[1 : len(value)-1]
			}
		}
		// Don't override an existing env var.
		if _, set := os.LookupEnv(key); set {
			continue
		}
		os.Setenv(key, value)
	}
}

// currencyConfig mirrors @repo/donation-dialog's currency table. Both sides
// must agree on the per-currency exponent — a mismatch here silently
// multiplies or divides the charged amount by 100. Keep this in sync with
// packages/donation-dialog/src/currency.ts.
type currencyConfig struct {
	Code       string
	Decimals   int // Stripe minor-unit exponent for charges
	Min        float64
	Max        float64
	DisplayMin float64 // informational only; the UI enforces its own bounds
	DisplayMax float64
}

var donationCurrencies = map[string]currencyConfig{
	"USD": {Code: "USD", Decimals: 2, Min: 0.5, Max: 999999.99, DisplayMin: 1, DisplayMax: 500},
	"TWD": {Code: "TWD", Decimals: 2, Min: 30, Max: 999999.99, DisplayMin: 30, DisplayMax: 15000},
	"CNY": {Code: "CNY", Decimals: 2, Min: 0.5, Max: 999999.99, DisplayMin: 5, DisplayMax: 3500},
	"HKD": {Code: "HKD", Decimals: 2, Min: 4, Max: 999999.99, DisplayMin: 8, DisplayMax: 4000},
	"EUR": {Code: "EUR", Decimals: 2, Min: 0.5, Max: 999999.99, DisplayMin: 1, DisplayMax: 500},
	"GBP": {Code: "GBP", Decimals: 2, Min: 0.3, Max: 999999.99, DisplayMin: 1, DisplayMax: 500},
	"JPY": {Code: "JPY", Decimals: 0, Min: 50, Max: 99999999, DisplayMin: 150, DisplayMax: 75000},
}

// toStripeMinorUnits converts a major-unit amount to Stripe minor units
// using the currency's exponent. Matches the frontend's toStripeMinorUnits.
func toStripeMinorUnits(amount float64, cfg currencyConfig) int64 {
	return int64(math.Round(amount * math.Pow10(cfg.Decimals)))
}

// Stripe metadata limits, per
// https://docs.stripe.com/api/metadata. Validated up front so the caller
// gets a clear 400 instead of a generic Stripe API error.
const (
	maxMetadataKeys        = 50
	maxMetadataKeyLength   = 40
	maxMetadataValueLength = 500
)

// validateMetadata enforces Stripe's PaymentIntent metadata limits: at
// most 50 keys, key names up to 40 characters, values up to 500
// characters. Empty keys are rejected. Returns a descriptive error the
// handler forwards to the client.
func validateMetadata(m map[string]string) error {
	if len(m) > maxMetadataKeys {
		return errors.New("metadata may contain at most " + strconv.Itoa(maxMetadataKeys) + " keys")
	}
	for k, v := range m {
		if k == "" {
			return errors.New("metadata keys must not be empty")
		}
		if len(k) > maxMetadataKeyLength {
			return errors.New("metadata key exceeds " + strconv.Itoa(maxMetadataKeyLength) + " characters: " + k)
		}
		if len(v) > maxMetadataValueLength {
			return errors.New("metadata value for key \"" + k + "\" exceeds " + strconv.Itoa(maxMetadataValueLength) + " characters")
		}
	}
	return nil
}

type paymentIntentRequest struct {
	Amount   float64           `json:"amount"`
	Currency string            `json:"currency"`
	Metadata map[string]string `json:"metadata,omitempty"`
}

type errorResponse struct {
	Message string `json:"message"`
}

type successResponse struct {
	Data struct {
		ClientSecret string `json:"clientSecret"`
	} `json:"data"`
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		log.Printf("write response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, errorResponse{Message: message})
}

// handlePaymentIntent creates a Stripe PaymentIntent for a donation.
func handlePaymentIntent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req paymentIntentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	cfg, ok := donationCurrencies[strings.ToUpper(strings.TrimSpace(req.Currency))]
	if !ok {
		writeError(w, http.StatusBadRequest, "unsupported currency: "+req.Currency)
		return
	}

	if math.IsNaN(req.Amount) || math.IsInf(req.Amount, 0) || req.Amount <= 0 {
		writeError(w, http.StatusBadRequest, "amount must be a positive number")
		return
	}
	// Enforce a sane server-side floor. Stripe rejects amounts below its
	// per-currency minimum (e.g. $0.50 USD); we surface that error verbatim
	// below, but this guard catches zero/negative before the API call.
	if req.Amount < cfg.Min {
		writeError(
			w,
			http.StatusBadRequest,
			"amount must be at least "+strconv.FormatFloat(cfg.Min, 'f', -1, 64)+" "+cfg.Code,
		)
		return
	}

	amountMinor := toStripeMinorUnits(req.Amount, cfg)

	params := &stripe.PaymentIntentParams{
		Amount:   stripe.Int64(amountMinor),
		Currency: stripe.String(cfg.Code),
		// The Stripe PaymentElement needs automatic payment methods
		// enabled on the PaymentIntent so it can render card (and any
		// other enabled) payment method types dynamically.
		AutomaticPaymentMethods: &stripe.PaymentIntentAutomaticPaymentMethodsParams{
			Enabled: stripe.Bool(true),
		},
	}
	// Attach caller-supplied metadata (arbitrary string tags) to the
	// PaymentIntent so donations can be attributed to a campaign, page,
	// placement, etc. in the Stripe dashboard. Stripe enforces its own
	// limits too, but we validate up front to return a clear 400 instead
	// of a generic Stripe API failure.
	if len(req.Metadata) > 0 {
		if err := validateMetadata(req.Metadata); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		params.Metadata = req.Metadata
	}
	// Stripe Connect platforms act on behalf of a connected account by
	// setting the Stripe-Account header. For a standalone (non-Connect)
	// account this must NOT be set — an empty value makes Stripe reject
	// the request with account_invalid (403). Opt in via STRIPE_ACCOUNT_ID.
	if accountID := os.Getenv("STRIPE_ACCOUNT_ID"); accountID != "" {
		params.SetStripeAccount(accountID)
	}

	pi, err := paymentintent.New(params)
	if err != nil {
		// Forward Stripe's error message (e.g. "Amount must be at least
		// $0.50 USD") so the donate dialog can show it to the user.
		var serr *stripe.Error
		if errors.As(err, &serr) {
			writeError(w, http.StatusBadRequest, serr.Msg)
			return
		}
		log.Printf("paymentintent.New: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to create payment intent")
		return
	}

	resp := successResponse{}
	resp.Data.ClientSecret = pi.ClientSecret
	writeJSON(w, http.StatusOK, resp)
}

// cors wraps a handler with CORS support. ALLOWED_ORIGIN may be:
//   - "*" (default): allow any origin; the literal "*" is sent back.
//   - an exact origin ("https://app.example.com"): only that origin is
//     reflected back.
//   - a wildcard subdomain pattern ("https://*.example.com" or
//     "*.example.com"): any subdomain of the given domain is reflected
//     back. The bare domain itself ("example.com") is NOT matched — at
//     least one subdomain label is required. When a scheme (or port) is
//     given on the pattern, the request origin's scheme (or port) must
//     match; omitting them makes them unconstrained.
//
// When the reflected value depends on the request's Origin header (i.e.
// anything other than the literal "*"), a "Vary: Origin" header is added
// so caches don't serve one origin's response to another.
func cors(next http.Handler) http.Handler {
	allowed := os.Getenv("ALLOWED_ORIGIN")
	if allowed == "" {
		allowed = "*"
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		var allowOrigin string
		switch {
		case allowed == "*":
			allowOrigin = "*"
		case origin != "" && originMatches(allowed, origin):
			allowOrigin = origin
		}
		if allowOrigin != "" {
			w.Header().Set("access-control-allow-origin", allowOrigin)
			if allowOrigin != "*" {
				w.Header().Add("vary", "Origin")
			}
		}
		w.Header().Set("access-control-allow-methods", "POST, OPTIONS")
		w.Header().Set("access-control-allow-headers", "content-type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// originMatches reports whether the request origin is permitted by the
// configured ALLOWED_ORIGIN value. See the cors doc comment for the
// accepted forms. The wildcard form requires at least one subdomain
// label between the "*" and the apex domain (so "*.example.com" does
// not match "https://example.com").
func originMatches(allowed, origin string) bool {
	if allowed == "*" || allowed == origin {
		return true
	}
	// Only wildcard patterns contain "*.".
	if !strings.Contains(allowed, "*.") {
		return false
	}

	// Split the pattern into scheme/host parts. A pattern without "://"
	// (e.g. "*.example.com") is treated as host-only: scheme and port on
	// the request origin are unconstrained.
	allowedScheme := ""
	allowedHost := allowed
	if i := strings.Index(allowed, "://"); i >= 0 {
		allowedScheme = allowed[:i]
		allowedHost = allowed[i+3:]
	}
	if !strings.HasPrefix(allowedHost, "*.") {
		// The "*." wasn't in the host component (e.g. a path wildcard);
		// not a form we support.
		return false
	}
	// allowedHost may also pin a port: "*.example.com:8443".
	allowedPort := ""
	if i := strings.Index(allowedHost, ":"); i >= 0 {
		allowedPort = allowedHost[i+1:]
		allowedHost = allowedHost[:i]
	}
	suffix := allowedHost[1:] // ".example.com"

	originURL, err := url.Parse(origin)
	if err != nil {
		return false
	}
	originHost := originURL.Hostname()
	if !strings.HasSuffix(originHost, suffix) {
		return false
	}
	// Require at least one subdomain label; the apex domain itself is
	// not a match for "*.example.com".
	if originHost == suffix[1:] { // "example.com"
		return false
	}
	if allowedScheme != "" && allowedScheme != originURL.Scheme {
		return false
	}
	if allowedPort != "" && allowedPort != originURL.Port() {
		return false
	}
	return true
}

// versionHeader sets the `X-Tea-Version` response header to the stamped
// binary version on every response (including CORS preflight and errors),
// so consumers can tell which version of the backend they're talking to.
// It is the outermost middleware so the header is present even when an
// inner handler short-circuits (e.g. CORS OPTIONS or a 404).
func versionHeader(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("x-tea-version", version)
		next.ServeHTTP(w, r)
	})
}

func main() {
	// --version prints the stamped version and exits. The flag is parsed
	// before loading .env / requiring STRIPE_SECRET_KEY so it works on a
	// bare machine with no config (useful for `docker run --rm img
	// --version` and release smoke-checks).
	showVersion := flag.Bool("version", false, "print the backend version and exit")
	flag.Parse()
	if *showVersion {
		fmt.Println(version)
		return
	}

	// Load `.env` from the working directory so `go run .` (and the
	// `npm run dev` task) pick up STRIPE_SECRET_KEY / PORT / ALLOWED_ORIGIN
	// without a wrapper script. Real env vars take precedence.
	loadDotEnv(".env")

	secretKey := os.Getenv("STRIPE_SECRET_KEY")
	if secretKey == "" {
		log.Fatal("STRIPE_SECRET_KEY environment variable is required")
	}
	stripe.Key = secretKey

	port := os.Getenv("PORT")
	if port == "" {
		port = "8888"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/donations/payment-intent", handlePaymentIntent)
	// Tiny health check for smoke-testing the server is up.
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	addr := ":" + port
	log.Printf("donation backend listening on %s (version %s)", addr, version)
	if err := http.ListenAndServe(addr, versionHeader(cors(mux))); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
