#!/usr/bin/env node
/**
 * Source assertion: mobile #handBridgeStack / .hand-bridge .layer-media must
 * inherit the opening ring square parent + radial mask grammar, while desktop
 * .layer-media overscan geometry remains unchanged.
 *
 * Usage: node tools/assert-hand-bridge-mobile-composition.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function extractBlock(src, selector, afterIndex = 0) {
  const start = src.indexOf(selector, afterIndex);
  if (start < 0) return null;
  const brace = src.indexOf("{", start);
  if (brace < 0) return null;
  let depth = 0;
  for (let i = brace; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return src.slice(brace + 1, i);
    }
  }
  return null;
}

const mobileQuery = "@media (max-width: 700px)";
const stylesMobileIdx = styles.indexOf(mobileQuery);
if (stylesMobileIdx < 0) fail("styles.css missing mobile max-width: 700px query");

const indexMobileIdx = index.indexOf(mobileQuery);
if (indexMobileIdx < 0) fail("index.html missing mobile max-width: 700px query");

// Opening ring mobile parent (approved geometry — do not rewrite; only mirror).
const ringBlock = extractBlock(index, ".world-ring .media-stack", indexMobileIdx);
if (!ringBlock) fail("missing mobile .world-ring .media-stack block in index.html");

const squareDim = "min(118vw, 150svh)";
const radialStops = [
  "closest-side",
  "#000 52%",
  "rgba(0, 0, 0, 0.94) 68%",
  "rgba(0, 0, 0, 0.42) 86%",
  "transparent 100%",
];

if (!ringBlock.includes(`width: ${squareDim}`)) {
  fail("opening ring mobile parent missing square width expression");
}
if (!ringBlock.includes(`height: ${squareDim}`)) {
  fail("opening ring mobile parent missing square height expression");
}
for (const stop of radialStops) {
  if (!ringBlock.includes(stop)) {
    fail(`opening ring mobile parent missing radial mask grammar: ${stop}`);
  }
}

// Hand bridge mobile parent must share the same expressions.
const handMediaMobile = extractBlock(
  styles,
  ".hand-bridge .layer-media",
  stylesMobileIdx
);
if (!handMediaMobile) {
  fail("missing mobile .hand-bridge .layer-media block in styles.css");
}

if (!handMediaMobile.includes(`width: ${squareDim}`)) {
  fail("hand-bridge mobile parent missing square width expression");
}
if (!handMediaMobile.includes(`height: ${squareDim}`)) {
  fail("hand-bridge mobile parent missing square height expression");
}
if (!handMediaMobile.includes(`margin-top: calc(${squareDim} * -0.5)`)) {
  fail("hand-bridge mobile parent missing centered square margin-top");
}
if (!handMediaMobile.includes(`margin-left: calc(${squareDim} * -0.5)`)) {
  fail("hand-bridge mobile parent missing centered square margin-left");
}
for (const stop of radialStops) {
  if (!handMediaMobile.includes(stop)) {
    fail(`hand-bridge mobile parent missing radial mask grammar: ${stop}`);
  }
}

// Desktop base .layer-media stays full-viewport overscan (unchanged contract).
const desktopLayer = extractBlock(styles, ".layer-media", 0);
if (!desktopLayer) fail("missing desktop base .layer-media block");

// Ensure we captured the base rule, not a nested one: it must appear before mobile query.
const baseLayerIdx = styles.indexOf(".layer-media");
if (baseLayerIdx < 0 || baseLayerIdx > stylesMobileIdx) {
  fail("desktop .layer-media must be defined before the mobile query");
}
if (!desktopLayer.includes("inset: -6%")) {
  fail("desktop .layer-media lost inset: -6% overscan");
}
if (!desktopLayer.includes("width: 112%") || !desktopLayer.includes("height: 112%")) {
  fail("desktop .layer-media lost 112% overscan geometry");
}

// Desktop hand-bridge must not redefine parent geometry outside mobile query.
const desktopHandMediaIdx = styles.indexOf(".hand-bridge .layer-media");
if (desktopHandMediaIdx >= 0 && desktopHandMediaIdx < stylesMobileIdx) {
  // Only child media object-position rules are expected before mobile.
  const preMobile = styles.slice(0, stylesMobileIdx);
  const parentGeometryInDesktop = /\.hand-bridge\s+\.layer-media\s*\{[^}]*\b(width|height|inset|mask-image)\b/s.test(
    preMobile
  );
  if (parentGeometryInDesktop) {
    fail("desktop .hand-bridge .layer-media must not redefine parent geometry");
  }
}

console.log(
  "PASS: hand-bridge mobile parent mirrors opening-ring square + radial mask; desktop .layer-media overscan unchanged"
);
