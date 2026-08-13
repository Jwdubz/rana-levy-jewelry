#!/usr/bin/env node
/**
 * Source assertion: catalog count summary has no stray availability slogan.
 *
 * Locks the owner-observed "available first, then sold" phrase:
 * - the shared countStatus renderer never emits that copy
 * - ready/made/gallery still report accurate piece/design/work counts
 * - filtered "Showing X of Y" and empty-match lines remain
 *
 * Usage: node tools/assert-catalog-count-summary.mjs
 *
 * Residue: catalog-count-summary tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator editing shell.js countStatus / tray summary copy
 * Activation: execute — node tools/assert-catalog-count-summary.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when the shared catalog count renderer is retired or superseded
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n?/g, "\n");
}

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

const forbidden = "available first, then sold";
const files = [
  "shell.js",
  "shell.css",
  "site.js",
  "index.html",
  "ready.html",
  "made.html",
  "gallery.html",
  "consultation.html",
  "faq.html",
  "services.html",
  "journal.html"
];
for (const rel of files) {
  const src = read(rel);
  if (src.includes(forbidden)) {
    fail(`${rel} still contains forbidden catalog phrase ${JSON.stringify(forbidden)}`);
  }
}

const shellJs = read("shell.js");
const fnMatch = shellJs.match(
  /function\s+countStatus\s*\(\s*visible\s*,\s*total\s*,\s*mode\s*\)\s*\{[\s\S]*?\n  \}/
);
if (!fnMatch) fail("could not isolate countStatus");
if (/available first/.test(fnMatch[0]) || /then sold/.test(fnMatch[0])) {
  fail("countStatus must not compose an availability slogan into the count");
}
if (!/return\s+visible\s*\+\s*" "\s*\+\s*noun\s*;/.test(fnMatch[0])) {
  fail('full-set countStatus must return visible + " " + noun with no extra phrase');
}
if (!/Showing "\s*\+\s*visible\s*\+\s*" of "\s*\+\s*total/.test(fnMatch[0])) {
  fail("filtered countStatus must keep Showing X of Y");
}
if (!/No "\s*\+\s*noun\s*\+\s*" match\./.test(fnMatch[0])) {
  fail("empty countStatus must keep No <noun> match.");
}
if (!/SHELL\.countStatus\s*=\s*countStatus/.test(shellJs)) {
  fail("SHELL.countStatus must remain the shared renderer");
}
if (!/countEl\.textContent\s*=\s*countStatus\s*\(\s*visible\.length\s*,\s*source\.length\s*,\s*mode\s*\)/.test(shellJs)) {
  fail("updateCount must still write countStatus(visible, total, mode)");
}

const countStatus = new Function(`${fnMatch[0]}; return countStatus;`)();
const cases = [
  [12, 12, "ready", "12 pieces"],
  [0, 12, "ready", "No pieces match."],
  [3, 12, "ready", "Showing 3 of 12 pieces"],
  [8, 8, "made", "8 designs"],
  [2, 8, "made", "Showing 2 of 8 designs"],
  [24, 24, "gallery", "24 works"],
  [1, 24, "gallery", "Showing 1 of 24 works"]
];
for (const [visible, total, mode, expected] of cases) {
  const got = countStatus(visible, total, mode);
  if (got !== expected) {
    fail(`countStatus(${visible}, ${total}, ${JSON.stringify(mode)}) => ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
  }
  if (String(got).includes(forbidden) || String(got).includes("available first")) {
    fail(`countStatus emitted forbidden phrase: ${JSON.stringify(got)}`);
  }
}

console.log(
  "PASS: catalog count summary (phrase removed; piece/design/work counts and filters unchanged)"
);
