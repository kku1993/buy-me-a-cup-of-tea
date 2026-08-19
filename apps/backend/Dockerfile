# syntax=docker/dockerfile:1

# Build stage — compiles a fully static binary (no cgo, no glibc).
#
# Build context is the REPO ROOT (not apps/backend/), so this Dockerfile
# can read the VERSION file and packages/donation-dialog/package.json to
# stamp and verify the version. Build from the repo root:
#
#	docker build -t donate-backend -f apps/backend/Dockerfile .
FROM golang:1.21-alpine AS build

WORKDIR /src

# Cache module downloads separately from source changes.
COPY apps/backend/go.mod apps/backend/go.sum ./apps/backend/
RUN cd apps/backend && go mod download

# Copy the backend source plus the repo-root VERSION file and the
# donation-dialog package.json (the npm source of truth for the version).
# The two must agree; the build verifies it below.
COPY apps/backend/ ./apps/backend/
COPY VERSION ./VERSION
COPY packages/donation-dialog/package.json ./packages/donation-dialog/package.json

# Verify the VERSION file matches packages/donation-dialog/package.json,
# then stamp it into the binary via -ldflags "-X main.version=...". A drift
# here fails the image build rather than shipping a backend that lies about
# its version in --version / X-Tea-Version.
ENV CGO_ENABLED=0 GOOS=linux GOFLAGS=-trimpath
RUN set -e && \
    FILE_VERSION="$(cat VERSION)" && \
    PKG_VERSION="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' packages/donation-dialog/package.json | head -n1)" && \
    if [ -z "$PKG_VERSION" ]; then echo "could not parse version from packages/donation-dialog/package.json" >&2; exit 1; fi && \
    if [ "$FILE_VERSION" != "$PKG_VERSION" ]; then \
      echo "VERSION file ($FILE_VERSION) does not match packages/donation-dialog/package.json ($PKG_VERSION)" >&2; \
      exit 1; \
    fi && \
    cd apps/backend && \
    go build -ldflags="-s -w -extldflags=-static -X main.version=$FILE_VERSION" -o /out/backend .

# Runtime stage — just the static binary + CA bundle on an empty
# filesystem. `scratch` has no shell, no libc, no package manager — the
# smallest possible image. The binary listens on :8888 by default
# (PORT env).
#
# The CA cert bundle is required: the binary makes outbound HTTPS calls
# to api.stripe.com, and `scratch` ships no CA store, so without it TLS
# verification fails with "certificate signed by unknown authority".
FROM scratch

# Copy the system CA bundle from the build stage so Go's crypto/tls can
# verify Stripe's TLS certificate. Go reads /etc/ssl/certs/ca-certificates.
# crt by default on Linux.
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

COPY --from=build /out/backend /backend

# Run as a non-root user. `scratch` has no /etc/passwd, so we can't
# create one — instead we rely on the numeric USER directive, which
# the kernel honors without a passwd entry.
USER 65532:65532

EXPOSE 8888

ENTRYPOINT ["/backend"]
