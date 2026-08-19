package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOriginMatches(t *testing.T) {
	cases := []struct {
		allowed string
		origin  string
		want    bool
	}{
		// Literal wildcard.
		{"*", "https://anything.example.com", true},
		{"*", "", true},

		// Exact match.
		{"https://app.example.com", "https://app.example.com", true},
		{"https://app.example.com", "http://app.example.com", false},
		{"https://app.example.com", "https://other.example.com", false},
		{"https://app.example.com:8080", "https://app.example.com:8080", true},
		{"https://app.example.com:8080", "https://app.example.com", false},

		// Wildcard subdomain with scheme.
		{"https://*.example.com", "https://foo.example.com", true},
		{"https://*.example.com", "https://foo.bar.example.com", true},
		{"https://*.example.com", "https://example.com", false}, // apex not matched
		{"https://*.example.com", "http://foo.example.com", false},
		{"https://*.example.com", "https://foo.notexample.com", false},
		{"https://*.example.com", "https://example.com.evil.com", false},

		// Wildcard subdomain without scheme (scheme unconstrained).
		{"*.example.com", "https://foo.example.com", true},
		{"*.example.com", "http://foo.example.com", true},
		{"*.example.com", "https://example.com", false},
		{"*.example.com", "https://foo.notexample.com", false},

		// Wildcard with port pinned.
		{"https://*.example.com:8443", "https://foo.example.com:8443", true},
		{"https://*.example.com:8443", "https://foo.example.com", false},

		// Garbage / unsupported forms.
		{"", "https://foo.example.com", false}, // empty allowed is not "*" here
		{"https://example.com/*", "https://example.com/foo", false},
		{"not a url", "https://foo.example.com", false},
	}
	for _, c := range cases {
		got := originMatches(c.allowed, c.origin)
		if got != c.want {
			t.Errorf("originMatches(%q, %q) = %v, want %v", c.allowed, c.origin, got, c.want)
		}
	}
}

// TestCORSMiddleware checks the Access-Control-Allow-Origin / Vary headers
// produced by the cors middleware for a few representative configurations.
func TestCORSMiddleware(t *testing.T) {
	cases := []struct {
		name           string
		allowedOrigin  string
		requestOrigin  string
		wantACAO       string // empty means header absent
		wantVaryOrigin bool
	}{
		{
			name:           "wildcard allowed, any origin",
			allowedOrigin:  "*",
			requestOrigin:  "https://foo.example.com",
			wantACAO:       "*",
			wantVaryOrigin: false,
		},
		{
			name:           "wildcard pattern matches subdomain",
			allowedOrigin:  "https://*.example.com",
			requestOrigin:  "https://app.example.com",
			wantACAO:       "https://app.example.com",
			wantVaryOrigin: true,
		},
		{
			name:           "wildcard pattern rejects apex",
			allowedOrigin:  "https://*.example.com",
			requestOrigin:  "https://example.com",
			wantACAO:       "",
			wantVaryOrigin: false,
		},
		{
			name:           "wildcard pattern rejects foreign origin",
			allowedOrigin:  "https://*.example.com",
			requestOrigin:  "https://evil.com",
			wantACAO:       "",
			wantVaryOrigin: false,
		},
		{
			name:           "exact match reflects origin",
			allowedOrigin:  "https://app.example.com",
			requestOrigin:  "https://app.example.com",
			wantACAO:       "https://app.example.com",
			wantVaryOrigin: true,
		},
		{
			name:           "exact match rejects other origin",
			allowedOrigin:  "https://app.example.com",
			requestOrigin:  "https://other.example.com",
			wantACAO:       "",
			wantVaryOrigin: false,
		},
		{
			name:           "no Origin header, non-wildcard allowed",
			allowedOrigin:  "https://app.example.com",
			requestOrigin:  "",
			wantACAO:       "",
			wantVaryOrigin: false,
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Setenv("ALLOWED_ORIGIN", c.allowedOrigin)

			handler := cors(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			}))

			req := httptest.NewRequest(http.MethodPost, "/v1/donations/payment-intent", nil)
			if c.requestOrigin != "" {
				req.Header.Set("Origin", c.requestOrigin)
			}
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			gotACAO := rec.Header().Get("Access-Control-Allow-Origin")
			if gotACAO != c.wantACAO {
				t.Errorf("Access-Control-Allow-Origin = %q, want %q", gotACAO, c.wantACAO)
			}
			hasVary := false
			for _, v := range rec.Header().Values("Vary") {
				if v == "Origin" {
					hasVary = true
				}
			}
			if hasVary != c.wantVaryOrigin {
				t.Errorf("Vary contains Origin = %v, want %v", hasVary, c.wantVaryOrigin)
			}
		})
	}
}

// TestCORSPreflight verifies OPTIONS short-circuits with 204 and the
// preflight headers regardless of whether the origin is allowed.
func TestCORSPreflight(t *testing.T) {
	t.Setenv("ALLOWED_ORIGIN", "https://*.example.com")
	handler := cors(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Errorf("downstream handler should not run for OPTIONS")
	}))
	req := httptest.NewRequest(http.MethodOptions, "/v1/donations/payment-intent", nil)
	req.Header.Set("Origin", "https://app.example.com")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusNoContent)
	}
	if got := rec.Header().Get("Access-Control-Allow-Methods"); got != "POST, OPTIONS" {
		t.Errorf("Access-Control-Allow-Methods = %q, want %q", got, "POST, OPTIONS")
	}
}

// TestCORSMultipleOrigins covers the comma-separated ALLOWED_ORIGIN form:
// a request is allowed if its Origin matches any entry, and a literal "*"
// anywhere in the list disables all origin checks.
func TestCORSMultipleOrigins(t *testing.T) {
	cases := []struct {
		name           string
		allowedOrigin  string
		requestOrigin  string
		wantACAO       string
		wantVaryOrigin bool
	}{
		{
			name:           "two wildcard patterns, matches first",
			allowedOrigin:  "https://*.example.com, https://*.abc.com",
			requestOrigin:  "https://app.example.com",
			wantACAO:       "https://app.example.com",
			wantVaryOrigin: true,
		},
		{
			name:           "two wildcard patterns, matches second",
			allowedOrigin:  "https://*.example.com, https://*.abc.com",
			requestOrigin:  "https://foo.abc.com",
			wantACAO:       "https://foo.abc.com",
			wantVaryOrigin: true,
		},
		{
			name:           "two wildcard patterns, matches neither",
			allowedOrigin:  "https://*.example.com, https://*.abc.com",
			requestOrigin:  "https://evil.com",
			wantACAO:       "",
			wantVaryOrigin: false,
		},
		{
			name:           "extra whitespace around entries is trimmed",
			allowedOrigin:  "  https://*.example.com ,  https://*.abc.com  ",
			requestOrigin:  "https://app.example.com",
			wantACAO:       "https://app.example.com",
			wantVaryOrigin: true,
		},
		{
			name:           "exact origin plus wildcard pattern",
			allowedOrigin:  "https://app.example.com, https://*.abc.com",
			requestOrigin:  "https://app.example.com",
			wantACAO:       "https://app.example.com",
			wantVaryOrigin: true,
		},
		{
			name:           "exact origin plus wildcard pattern, matches wildcard",
			allowedOrigin:  "https://app.example.com, https://*.abc.com",
			requestOrigin:  "https://sub.abc.com",
			wantACAO:       "https://sub.abc.com",
			wantVaryOrigin: true,
		},
		{
			name:           "literal * anywhere disables origin checks",
			allowedOrigin:  "https://*.example.com, *",
			requestOrigin:  "https://evil.com",
			wantACAO:       "*",
			wantVaryOrigin: false,
		},
		{
			name:           "trailing comma is ignored",
			allowedOrigin:  "https://*.example.com,",
			requestOrigin:  "https://app.example.com",
			wantACAO:       "https://app.example.com",
			wantVaryOrigin: true,
		},
		{
			name:           "empty entries collapse to wildcard default",
			allowedOrigin:  "   ,  ",
			requestOrigin:  "https://anything.com",
			wantACAO:       "*",
			wantVaryOrigin: false,
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Setenv("ALLOWED_ORIGIN", c.allowedOrigin)
			handler := cors(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			}))
			req := httptest.NewRequest(http.MethodPost, "/v1/donations/payment-intent", nil)
			if c.requestOrigin != "" {
				req.Header.Set("Origin", c.requestOrigin)
			}
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			gotACAO := rec.Header().Get("Access-Control-Allow-Origin")
			if gotACAO != c.wantACAO {
				t.Errorf("Access-Control-Allow-Origin = %q, want %q", gotACAO, c.wantACAO)
			}
			hasVary := false
			for _, v := range rec.Header().Values("Vary") {
				if v == "Origin" {
					hasVary = true
				}
			}
			if hasVary != c.wantVaryOrigin {
				t.Errorf("Vary contains Origin = %v, want %v", hasVary, c.wantVaryOrigin)
			}
		})
	}
}
