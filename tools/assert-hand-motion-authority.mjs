#!/usr/bin/env node
/**
 * Source assertion: Hand montage stays live for the whole Hand occupancy.
 *
 * Locks the owner-observed frozen-poster failure:
 * - no artificial handP cutoff (including the retired 0 / 0.95 window)
 * - studio-hand-work-cycle remains the sole Hand decoder while Hand owns
 * - retirement happens only via genuine Hand is-retired transfer
 * - poster fallback remains for loading and explicit ?motion=quiet
 * - no second Hand video, no scroll-seek, montage window/order unchanged
 *
 * Usage: node tools/assert-hand-motion-authority.mjs
 *
 * Residue: hand-motion-authority tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator editing Hand video arm/leave / updateActivity
 * Activation: execute — node tools/assert-hand-motion-authority.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when the continuous Hand montage contract is retired or superseded
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

const index = read("index.html");
const siteJs = read("site.js");

const updateActivity = siteJs.match(
  /function\s+updateActivity\s*\(\s*handP\s*,\s*workP\s*,\s*handNear\s*\)\s*\{[\s\S]*?\n  function /
);
if (!updateActivity) fail("could not isolate updateActivity");
const activity = updateActivity[0];

if (/setVideoActive\s*\(\s*handVideo\s*,\s*[^)]*handP\s*[<>]=?\s*/.test(activity)) {
  fail("updateActivity must not gate handVideo on a handP comparison");
}
if (/handActive\s*&&\s*handP\s*>\s*0/.test(activity) || /handP\s*<\s*0\.95/.test(activity)) {
  fail("retired artificial window handP > 0 && handP < 0.95 must stay gone");
}
if (
  !/setVideoActive\s*\(\s*handVideo\s*,\s*handActive\s*,\s*["']handVideoArmed["']\s*\)/.test(
    activity
  )
) {
  fail("handVideo must arm from handActive ownership, not a progress slice");
}

if (!/const\s+handRetired\s*=/.test(activity)) {
  fail("updateActivity must compute handRetired from Hand is-retired");
}
if (!/is-retired/.test(activity) || !/!\s*handRetired/.test(activity)) {
  fail("handActive must include !handRetired so the decoder yields only on genuine transfer");
}
if (!/openingRetired/.test(activity)) {
  fail("mobile exclusive authority still requires openingRetired before Hand arms");
}

// Honest leave path still exists for reverse re-entry.
const setVideoActiveFn = siteJs.match(
  /function\s+setVideoActive\s*\(\s*video\s*,\s*active\s*,\s*armedFlag\s*\)\s*\{[\s\S]*?\n  \}/
);
if (!setVideoActiveFn) fail("setVideoActive must remain");
if (!/classList\.remove\(\s*["']is-live["']\s*\)/.test(setVideoActiveFn[0])) {
  fail("setVideoActive leave must drop is-live so the poster can show after ownership leaves");
}
if (!/mediaQuietActive\s*\(\s*\)/.test(setVideoActiveFn[0])) {
  fail("setVideoActive must keep the quiet poster-only gate");
}

// Poster fallback remains for loading / quiet; it must not become the mid-beat authority.
const handBenchStack = index.match(/id="handBenchStack"[\s\S]*?<\/div>/);
if (!handBenchStack) fail("handBenchStack must remain");
if (
  !/data-desktop-src="assets\/studio-poster\.jpg"/.test(handBenchStack[0]) ||
  !/data-mobile-src="assets\/studio-poster-portrait\.jpg"/.test(handBenchStack[0])
) {
  fail("studio-poster fallback images must remain on the Hand stack");
}
const handVideoBlock = index.match(/id="handVideo"[\s\S]*?<\/video>/);
if (!handVideoBlock) fail("handVideo must remain");
if (!/data-src="assets\/studio-hand-work-cycle\.mp4"/.test(handVideoBlock[0])) {
  fail("handVideo must remain the studio-hand-work-cycle decoder");
}
if ((index.match(/id="handVideo"/g) || []).length !== 1) {
  fail("must not add another Hand video decoder");
}

const handWindow = siteJs.match(
  /const\s+BENCH_WINDOWS\s*=\s*\{[\s\S]*?hand\s*:\s*(\[[^\]]+\])/
);
if (!handWindow || handWindow[1].replace(/\s+/g, "") !== "[0,4.466667]") {
  fail("BENCH_WINDOWS.hand must remain exactly [0, 4.466667]");
}

// No scroll-driven currentTime writes in updateActivity / renderHand.
if (/currentTime\s*=/.test(activity)) {
  fail("updateActivity must not scroll-seek Hand video");
}
if (/function\s+renderHand[\s\S]*?currentTime\s*=/.test(siteJs)) {
  fail("renderHand must not scroll-seek Hand video");
}

console.log(
  "PASS: hand motion authority (cycle video owns the full Hand occupancy; no handP poster cutoff; quiet/poster fallback kept)"
);
