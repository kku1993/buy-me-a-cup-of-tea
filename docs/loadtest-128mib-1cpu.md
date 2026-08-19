# Load test: backend Docker container @ 128 MiB / 1 CPU

Date: 2026-08-19
Image: `donate-backend:loadtest` (v0.1.1, `scratch`-based static Go binary)
Target: `POST /v1/donations/payment-intent` with `{"amount":5,"currency":"USD"}`

## Goal

Find how many concurrent requests the backend container can handle before
being OOM-killed, with a hard 128 MiB memory limit and 1 CPU.

## Method

- **Load tool**: [`hey`](https://github.com/rakyll/hey) (Go), 20s per
  concurrency level, 30s per-request timeout.
- **Stripe was mocked.** The backend's hot path makes an outbound HTTPS
  call to Stripe's API on every request, so a local mock server returned
  a canned `payment_intent` JSON with **150ms fixed latency** to mimic
  real Stripe RTT. This lets in-flight concurrency build up and create
  real memory pressure — the whole point of an OOM test. Hitting real
  Stripe would rate-limit (~100 req/s) long before 128 MiB is exhausted
  and would measure Stripe, not the backend.
- The mock was wired in via a new `STRIPE_API_BASE_URL` env override in
  `apps/backend/main.go` (stripe-go v76.25.0 doesn't read it natively).
  It's a no-op when unset, so production behavior is unchanged.
- **Each concurrency level ran on a fresh container.** Go holds its heap
  high-water mark and returns memory to the OS slowly, so a warm
  container biases the result toward OOM. A fresh container per level
  gives the per-level peak; a separate cumulative ramp (below) shows the
  warm-container behavior.

Container invocation:

```sh
docker run -d --name donate-backend-lt \
  --memory=128m --memory-swap=128m --cpus=1 \
  --add-host=host.docker.internal:host-gateway \
  -e STRIPE_SECRET_KEY=sk_test_dummy \
  -e STRIPE_API_BASE_URL=http://host.docker.internal:12111 \
  -e PORT=8888 -e ALLOWED_ORIGIN=* \
  -p 8788:8888 donate-backend:loadtest
```

## Result

### OOM ceiling: ~1000 concurrent requests (variance ±~50)

| Concurrency | Result                          | Post-run memory |
|------------:|:--------------------------------|----------------:|
|         500 | survived                        |          53 MiB |
|         600 | survived                        |          62 MiB |
|         700 | survived                        |          73 MiB |
|         800 | survived                        |          98 MiB |
|         900 | survived (2/2 runs)             |   108–116 MiB |
|         950 | survived                        |         109 MiB |
|      **1000** | **borderline** — OOM once, survived once |  105 MiB |
|        1050 | OOM (exit 137, `OOMKilled=true`) |              — |
|        1100 | OOM                             |              — |
|        1200 | OOM                             |              — |
|        1400 | OOM                             |              — |

- **Reliable ceiling: ~900–950 concurrent requests.**
- **Borderline (probabilistic OOM): ~1000** — post-run memory sits at
  ~105–116 MiB of 128 MiB, and the in-run peak sometimes tips over.
- **Always OOMs: ≥1050** — kernel SIGKILL, exit 137, `OOMKilled=true`.

### Warm-container (cumulative) ramp

A single container was pushed through 50 → 100 → 200 → 400 → 800
without restart. It OOM'd at **800**, not ~1000, because the heap
high-water mark accumulated across levels.

| Concurrency | Result   | Post-run memory |
|------------:|:---------|----------------:|
|          50 | survived |        13.6 MiB |
|         100 | survived |        21.3 MiB |
|         200 | survived |        35.2 MiB |
|         400 | survived |        41.6 MiB |
|         800 | **OOM**  |              — |

## Latency under load (fresh container, p50 / p99)

| Concurrency | p50     | p99     |
|------------:|:--------|:--------|
|          50 | 152 ms  | 159 ms  |
|         100 | 152 ms  | 162 ms  |
|         200 | 203 ms  | 1.21 s  |
|         400 | 493 ms  | 2.30 s  |
|         800 | 698 ms  | 3.29 s  |
|         900 | 414 ms  | 4.10 s  |
|        1000 | 407 ms  | 5.09 s  |
|        1050 | 394 ms  | 1.09 s  (OOM before steady state) |

## What drives the OOM

1. **Memory scales ~linearly with concurrency.** Each in-flight request
   holds a goroutine stack + the stripe-go HTTP client's TLS buffers +
   JSON encode/decode buffers for the outbound Stripe call. At 150 ms
   latency, concurrency C means ~C simultaneous in-flight requests.
2. **The 1 CPU limit creates a feedback loop.** As concurrency rises,
   goroutines queue for CPU time, so latency degrades (p50: 152 ms @c=50
   → 414 ms @c=900 → 577 ms @c=1200). Higher latency → more in-flight
   requests piled up → more memory → death spiral. With more CPU the
   ceiling would be higher.
3. **Go returns heap to the OS slowly.** A warm container OOMs far
   earlier than a fresh one (800 vs ~1000). In production with sustained
   traffic, expect the warm-container behavior — so the practical
   **sustained** ceiling is closer to ~700–800, not the fresh-container
   peak of ~1000.

## Recommendations

- For sustained production traffic at 128 MiB / 1 CPU, size for
  **~700–800 concurrent requests** as the safe operating point (leaves
  headroom for the warm-container high-water mark).
- The single most effective lever for raising the ceiling is **more
  memory**; the second is **more CPU** (which reduces queueing latency
  and therefore in-flight request count).
- If you need to reproduce: the mock server and ramp scripts live at
  `/tmp/loadtest-mock-stripe/` and `/tmp/loadtest-ramp.sh` (plus
  `loadtest-narrow*.sh`). Rebuild the image with
  `docker build -t donate-backend:loadtest -f apps/backend/Dockerfile .`
  from the repo root.
