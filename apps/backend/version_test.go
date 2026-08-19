package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestVersionHeader sets a known stamped version and asserts the
// X-Tea-Version header is present on a normal response, an error
// response, and a CORS preflight (the middleware is outermost, so it
// runs even when an inner handler short-circuits).
func TestVersionHeader(t *testing.T) {
	want := "9.9.9-test"
	saved := version
	version = want
	t.Cleanup(func() { version = saved })

	t.Setenv("ALLOWED_ORIGIN", "*")

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/boom" {
			writeError(w, http.StatusBadRequest, "nope")
			return
		}
		w.WriteHeader(http.StatusOK)
	})
	handler := versionHeader(cors(inner))

	cases := []struct {
		name       string
		method     string
		path       string
		wantStatus int
	}{
		{"ok", http.MethodGet, "/", http.StatusOK},
		{"error response", http.MethodGet, "/boom", http.StatusBadRequest},
		{"cors preflight", http.MethodOptions, "/anything", http.StatusNoContent},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := httptest.NewRequest(c.method, c.path, nil)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			if got := rec.Header().Get("X-Tea-Version"); got != want {
				t.Errorf("X-Tea-Version = %q, want %q", got, want)
			}
			if rec.Code != c.wantStatus {
				t.Errorf("status = %d, want %d", rec.Code, c.wantStatus)
			}
		})
	}
}

// TestVersionHeaderDefault confirms the unstamped default version is
// "dev" so a bare `go run .` (no ldflags) still emits a non-empty header
// rather than crashing or sending an empty value. Under a stamped build
// (e.g. `go test -ldflags=...`) this is a no-op.
func TestVersionHeaderDefault(t *testing.T) {
	if version != "dev" {
		t.Logf("version = %q (stamped by build), skipping default check", version)
		return
	}
	handler := versionHeader(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if got := rec.Header().Get("X-Tea-Version"); got != "dev" {
		t.Errorf("X-Tea-Version = %q, want %q", got, "dev")
	}
}
