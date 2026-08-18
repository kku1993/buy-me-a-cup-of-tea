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
//	PORT                (optional, default 8787)
//	ALLOWED_ORIGIN      (optional, default "*" — set to your frontend origin
//	                    in production to lock down CORS)
package main

import (
	"encoding/json"
	"errors"
	"log"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"

	stripe "github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/paymentintent"
)

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

type paymentIntentRequest struct {
	Amount   float64 `json:"amount"`
	Currency string  `json:"currency"`
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
	params.SetStripeAccount("")

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

// cors wraps a handler with permissive CORS. In production set
// ALLOWED_ORIGIN to the frontend origin instead of leaving it open.
func cors(next http.Handler) http.Handler {
	allowed := os.Getenv("ALLOWED_ORIGIN")
	if allowed == "" {
		allowed = "*"
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("access-control-allow-origin", allowed)
		w.Header().Set("access-control-allow-methods", "POST, OPTIONS")
		w.Header().Set("access-control-allow-headers", "content-type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	secretKey := os.Getenv("STRIPE_SECRET_KEY")
	if secretKey == "" {
		log.Fatal("STRIPE_SECRET_KEY environment variable is required")
	}
	stripe.Key = secretKey

	port := os.Getenv("PORT")
	if port == "" {
		port = "8787"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/donations/payment-intent", handlePaymentIntent)
	// Tiny health check for smoke-testing the server is up.
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	addr := ":" + port
	log.Printf("donation backend listening on %s", addr)
	if err := http.ListenAndServe(addr, cors(mux)); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
