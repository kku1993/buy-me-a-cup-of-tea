#!/usr/bin/env node
// Reads the repo-root VERSION file, verifies it matches the version in
// packages/donation-dialog/package.json, and prints the version to stdout
// (no trailing newline) so the build/dev scripts can stamp it into the
// Go binary via -ldflags "-X main.version=$(node scripts/version.js)".
//
// The VERSION file is the value stamped into the binary; the package.json
// version is the npm-published source of truth. They must agree — a drift
// here means the `--version` flag / X-Tea-Version header would lie about
// which client release the backend ships with, so we fail the build
// instead of silently picking one.

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..", "..");
const versionPath = path.join(root, "VERSION");
const pkgPath = path.join(root, "packages", "donation-dialog", "package.json");

const fileVersion = fs.readFileSync(versionPath, "utf8").trim();
const pkgVersion = JSON.parse(fs.readFileSync(pkgPath, "utf8")).version;

if (!fileVersion) {
  console.error(`VERSION file at ${versionPath} is empty`);
  process.exit(1);
}
if (fileVersion !== pkgVersion) {
  console.error(
    `VERSION file (${fileVersion}) does not match packages/donation-dialog/package.json (${pkgVersion}) — align them before building.`,
  );
  process.exit(1);
}

process.stdout.write(fileVersion);
