# Development guide

Guide for contributors working on this repo. For using the published
library, see [README.md](./README.md).

## Repository layout

| Path                         | What it is                                                       |
| ---------------------------- | ---------------------------------------------------------------- |
| `packages/donation-dialog`   | The standalone React component (`@repo/donation-dialog`).        |
| `apps/demo-web`              | Vite + React demo that showcases the dialog.                     |
| `apps/backend`               | Go backend (`net/http` + `stripe-go`) that mints PaymentIntents. |
| `packages/eslint-config`     | Shared ESLint config.                                            |
| `packages/typescript-config` | Shared tsconfig bases.                                           |

npm workspaces + turbo monorepo.

## Setup

```sh
npm install            # install all workspaces
```

## Running the demo locally

1. Copy env files and fill in your Stripe keys:

   ```sh
   cp apps/demo-web/.env.example apps/demo-web/.env
   cp apps/backend/.env.example apps/backend/.env
   ```

   - `apps/demo-web/.env` → `VITE_STRIPE_PUBLIC_KEY=pk_test_...`
   - `apps/backend/.env` → `STRIPE_SECRET_KEY=sk_test_...`

2. Start everything (the Go backend loads `apps/backend/.env` automatically;
   the Vite dev server proxies `/v1` → `:8787`):

   ```sh
   npm run dev
   ```

   This runs all dev tasks in parallel via turbo:

   - `backend` → Go server on `http://localhost:8787`
   - `demo-web` → Vite dev server on `http://localhost:5173`
   - `@repo/donation-dialog` → watch build of the package

   Open `http://localhost:5173`.

## Commands

```sh
npm install            # install all workspaces
npm run dev            # start backend + demo-web + package watch (turbo)
npm run build          # build all packages/apps (turbo)
npm run lint           # eslint across workspaces
npm run format         # prettier
```

Per-package (run inside the workspace):

```sh
npx tsc --noEmit       # typecheck
npx vite build         # build the package/app
```

Go backend:

```sh
cd apps/backend && go build ./... && go vet ./...
```

## Operation notes

- Always run `tsc --noEmit`, `eslint`, and `vite build` for any TS
  workspace you touch before considering work done. `tsc --noEmit` is the
  fastest signal that types are sound — run it first.
- Run `gofmt -w .` and `go vet ./...` after touching the Go backend.
- Run `npm run format` (prettier) from repo root when done.

## Deploying the backend (Docker)

The backend ships with a multi-stage `Dockerfile` that builds a fully
static binary (no cgo, no glibc) and runs it on `scratch` — the final
image is ~2.6 MB. The system CA bundle is copied in so Stripe TLS
verification works.

```sh
docker build -t donate-backend -f apps/backend/Dockerfile .
docker run --rm -p 8787:8787 -e STRIPE_SECRET_KEY=sk_test_... donate-backend
```

The build context is the **repo root** (not `apps/backend/`) so the
Dockerfile can read the `VERSION` file and
`packages/donation-dialog/package.json`, verify they match, and stamp the
version into the binary (see `--version` and the `X-Tea-Version` response
header). Run the command above from the repo root.

The container runs as a non-root user (UID 65532). Configure with the
same env vars as the bare binary (`STRIPE_SECRET_KEY`, `PORT`,
`ALLOWED_ORIGIN`); pass `-e` flags or mount an `.env` file.

## Publishing `@kku1993/buy-me-a-cup-of-tea`

Run from the package dir:

```sh
cd packages/donation-dialog
npm login              # once, if not already logged in to npmjs.org
npm version patch      # bumps version + tags git release (or minor/major)
npm publish            # prepublishOnly runs check-types + lint + build first
```

`prepublishOnly` guards the publish: it runs `check-types`, `lint`, and
`build` before npm packs the tarball, so a broken build can't ship. The
package is scoped + `publishConfig.access: "public"`, so it publishes
publicly under the `@kku1993` scope. Verify with `npm publish --dry-run`
or `npm pack` first.

When bumping the donation-dialog version, also update the root `VERSION`
file to match — the backend build verifies `VERSION` ==
`package.json` version and fails on drift.
