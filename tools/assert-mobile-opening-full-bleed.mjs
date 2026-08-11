#!/usr/bin/env node
/**
 * Source assertion: mobile opening + hand-bridge media must be full-bleed
 * passage geometry — not a vignette. No media-echo, no radial/elliptical
 * perimeter masks on opening/hand-bridge stacks, no .scene::after copy wash,
 * and desktop .layer-media / .media-stack overscan remains unchanged.
 *
 * Usage: node tools/assert-mobile-opening-full-bleed.mjs
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

function assertFullViewport(block, label) {
  if (!block) fail(`missing ${label}`);
  if (!/\binset:\s*0\s*;/.test(block)) {
    fail(`${label} must use inset: 0 full-viewport geometry`);
  }
  if (!/\bwidth:\s*100%\s*;/.test(block)) {
    fail(`${label} must use width: 100%`);
  }
  if (!/\bheight:\s*100%\s*;/.test(block)) {
    fail(`${label} must use height: 100%`);
  }
  const margins = block.match(/margin(?:-top|-left|-right|-bottom)?\s*:[^;]+;/g) || [];
  for (const m of margins) {
    if (!/margin(?:-top|-left|-right|-bottom)?\s*:\s*0\s*;/.test(m)) {
      fail(`${label} must not use non-zero margins (found ${m.trim()})`);
    }
  }
  if (/mask-image\s*:\s*[^;]*radial-gradient/i.test(block)) {
    fail(`${label} must not apply a radial/elliptical perimeter mask`);
  }
  if (/mask-image\s*:\s*[^;]*ellipse/i.test(block)) {
    fail(`${label} must not apply an elliptical perimeter mask`);
  }
  // Reject the retired square / banded vignette parent expressions.
  if (block.includes("min(118vw, 150svh)") || block.includes("59vw")) {
    fail(`${label} still uses retired vignette parent dimensions`);
  }
}

const mobileQuery = "@media (max-width: 700px)";
const stylesMobileIdx = styles.indexOf(mobileQuery);
if (stylesMobileIdx < 0) fail("styles.css missing mobile max-width: 700px query");

const indexMobileIdx = index.indexOf(mobileQuery);
if (indexMobileIdx < 0) fail("index.html missing mobile max-width: 700px query");

// --- Markup / residue: media-echo is gone ---
if (/\bmedia-echo\b/.test(index)) {
  fail("index.html still contains media-echo residue");
}
if (/\bstudioEcho\b|\bringEcho\b/.test(index)) {
  fail("index.html still references studioEcho/ringEcho");
}
if (/\bmedia-echo\b/.test(styles)) {
  fail("styles.css still contains media-echo residue");
}

// --- No mobile radial copy wash on .scene::after ---
const sceneAfterMobile = extractBlock(index, ".scene::after", indexMobileIdx);
if (sceneAfterMobile) {
  fail("mobile .scene::after copy wash must be removed (found a mobile block)");
}
// Also reject any mobile-query slice that reintroduces a radial scene wash.
const indexMobileSlice = index.slice(indexMobileIdx);
const nextMediaEnd = indexMobileSlice.indexOf("@media", 1);
const mobileOnlyCss =
  nextMediaEnd > 0 ? indexMobileSlice.slice(0, nextMediaEnd) : indexMobileSlice;
if (
  /\.scene::after/.test(mobileOnlyCss) ||
  (/radial-gradient/.test(mobileOnlyCss) &&
    /rgba\(\s*2\s*,\s*0\s*,\s*5/.test(mobileOnlyCss) &&
    /scene/.test(mobileOnlyCss))
) {
  fail("mobile opening CSS must not reintroduce a .scene radial copy wash");
}

// --- Opening stacks: full-viewport, no vignette mask ---
// Prefer the combined selector; fall back to each world if split later.
let openingStacks = extractBlock(
  index,
  ".world-studio .media-stack,\n      .world-ring .media-stack",
  indexMobileIdx
);
if (!openingStacks) {
  openingStacks = extractBlock(
    index,
    ".world-studio .media-stack, .world-ring .media-stack",
    indexMobileIdx
  );
}
if (!openingStacks) {
  const studio = extractBlock(index, ".world-studio .media-stack", indexMobileIdx);
  const ring = extractBlock(index, ".world-ring .media-stack", indexMobileIdx);
  assertFullViewport(studio, "mobile .world-studio .media-stack");
  assertFullViewport(ring, "mobile .world-ring .media-stack");
} else {
  assertFullViewport(
    openingStacks,
    "mobile .world-studio/.world-ring .media-stack"
  );
}

// Explicitly forbid radial mask grammar anywhere in the mobile opening query
// on media-stack parents (not object-position rules).
const forbiddenMaskTokens = [
  "closest-side",
  "ellipse 50% 50% at 50% 50%",
  "#000 52%",
  "rgba(0, 0, 0, 0.94) 68%",
];
for (const token of forbiddenMaskTokens) {
  if (mobileOnlyCss.includes(token)) {
    fail(`mobile opening CSS still carries vignette mask grammar: ${token}`);
  }
}

// --- Hand bridge mobile parent mirrors full-bleed opening ring ---
const handMediaMobile = extractBlock(
  styles,
  ".hand-bridge .layer-media",
  stylesMobileIdx
);
assertFullViewport(handMediaMobile, "mobile .hand-bridge .layer-media");

const stylesMobileSlice = styles.slice(stylesMobileIdx);
const stylesNextMedia = stylesMobileSlice.indexOf("@media", 1);
const stylesMobileOnly =
  stylesNextMedia > 0
    ? stylesMobileSlice.slice(0, stylesNextMedia)
    : stylesMobileSlice;
for (const token of forbiddenMaskTokens) {
  // Only fail if the token appears in the hand-bridge media block region.
  if (handMediaMobile && handMediaMobile.includes(token)) {
    fail(`hand-bridge mobile parent still carries vignette mask grammar: ${token}`);
  }
}
// Square vignette parent expressions must not reappear on hand-bridge.
if (stylesMobileOnly.includes(".hand-bridge .layer-media")) {
  if (
    /hand-bridge\s+\.layer-media\s*\{[^}]*min\(118vw,\s*150svh\)/s.test(
      stylesMobileOnly
    )
  ) {
    fail("hand-bridge mobile parent still uses square vignette dimensions");
  }
}

// --- Desktop overscan contracts unchanged ---
const desktopMediaStack = extractBlock(index, ".media-stack", 0);
if (!desktopMediaStack) fail("missing desktop base .media-stack block in index.html");
const baseMediaStackIdx = index.indexOf(".media-stack");
if (baseMediaStackIdx < 0 || baseMediaStackIdx > indexMobileIdx) {
  fail("desktop .media-stack must be defined before the mobile query");
}
if (!desktopMediaStack.includes("inset: -6%")) {
  fail("desktop .media-stack lost inset: -6% overscan");
}
if (
  !desktopMediaStack.includes("width: 112%") ||
  !desktopMediaStack.includes("height: 112%")
) {
  fail("desktop .media-stack lost 112% overscan geometry");
}

const desktopLayer = extractBlock(styles, ".layer-media", 0);
if (!desktopLayer) fail("missing desktop base .layer-media block");
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
  const preMobile = styles.slice(0, stylesMobileIdx);
  const parentGeometryInDesktop =
    /\.hand-bridge\s+\.layer-media\s*\{[^}]*\b(width|height|inset|mask-image)\b/s.test(
      preMobile
    );
  if (parentGeometryInDesktop) {
    fail("desktop .hand-bridge .layer-media must not redefine parent geometry");
  }
}

console.log(
  "PASS: mobile opening/hand-bridge is full-bleed (no vignette, no echo, no scene copy wash); desktop overscan unchanged"
);
