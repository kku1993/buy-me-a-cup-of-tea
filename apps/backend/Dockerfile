# syntax=docker/dockerfile:1

# Build stage — compiles a fully static binary (no cgo, no glibc).
FROM golang:1.21-alpine AS build

WORKDIR /src

# Cache module downloads separately from source changes.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# CGO_ENABLED=0 + netgo builds a pure-Go binary with no libc dependency,
# so the final image can be `FROM scratch`. -ldflags -s -w strips the
# debug/DWARF info to shrink the binary further. -trimpath removes the
# build host's absolute paths from the binary.
ENV CGO_ENABLED=0 GOOS=linux GOFLAGS=-trimpath
RUN go build -ldflags="-s -w -extldflags=-static" -o /out/backend .

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
