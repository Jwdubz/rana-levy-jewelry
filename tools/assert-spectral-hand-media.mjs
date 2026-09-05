#!/usr/bin/env node

// Keep the Hand background regression in the ordinary assert-*.mjs suite.
if (process.argv.length > 2) {
  throw new Error("Usage: node tools/assert-spectral-hand-media.mjs");
}
process.argv.push("--hand");
await import("./assert-spectral-media.mjs");
