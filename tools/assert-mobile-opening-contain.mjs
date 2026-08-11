#!/usr/bin/env node
/**
 * Source assertion: mobile opening + hand-bridge media must preserve source
 * geometry — full-viewport stack parents, object-fit: contain children, solid
 * neutral grounds (no vignette/echo/radial wash), hand-bridge parity with the
 * opening ring, and unchanged desktop .layer-media / .media-stack overscan.
 *
 * Usage: node tools/assert-mobile-opening-contain.mjs
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
  // Cinematic field, not a card silhouette.
  const radii = block.match(/border-radius\s*:\s*([^;]+);/gi) || [];
  for (const decl of radii) {
    const value = decl.replace(/^border-radius\s*:\s*/i, "").replace(/;$/, "").trim();
    if (!/^0(px)?$/i.test(value)) {
      fail(`${label} must not use a non-zero border-radius card silhouette (found ${value})`);
    }
  }
  const shadows = block.match(/box-shadow\s*:\s*([^;]+);/gi) || [];
  for (const decl of shadows) {
    const value = decl.replace(/^box-shadow\s*:\s*/i, "").replace(/;$/, "").trim();
    if (!/^none$/i.test(value)) {
      fail(`${label} must not use a box-shadow perimeter effect (found ${value})`);
    }
  }
}

function assertContainMedia(block, label) {
  if (!block) fail(`missing ${label}`);
  if (!/\bobject-fit:\s*contain\s*;/.test(block)) {
    fail(`${label} must use object-fit: contain`);
  }
  if (/\bobject-fit:\s*cover\s*;/.test(block)) {
    fail(`${label} must not use object-fit: cover`);
  }
  if (!/\bobject-position\s*:/.test(block)) {
    fail(`${label} must declare object-position art direction`);
  }
}

function assertSolidGround(block, label) {
  if (!block) fail(`missing ${label}`);
  const bg = block.match(/background\s*:\s*([^;]+);/);
  if (!bg) fail(`${label} must declare a solid background ground`);
  const value = bg[1].trim();
  if (/gradient/i.test(value)) {
    fail(`${label} ground must be solid, not a gradient (found ${value})`);
  }
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) && !/^rgb(a)?\(/i.test(value)) {
    fail(`${label} ground must be a solid color token (found ${value})`);
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

// --- Opening worlds: solid neutral grounds (no gradient) ---
const studioWorld = extractBlock(index, ".world-studio", indexMobileIdx);
const ringWorld = extractBlock(index, ".world-ring", indexMobileIdx);
assertSolidGround(studioWorld, "mobile .world-studio");
assertSolidGround(ringWorld, "mobile .world-ring");
// Studio ground should be deep (dark), ring ground quieter/lighter room tone.
const studioBg = studioWorld.match(/background\s*:\s*([^;]+);/)[1].trim();
const ringBg = ringWorld.match(/background\s*:\s*([^;]+);/)[1].trim();
if (studioBg === ringBg) {
  fail("studio and ring mobile grounds must differ (studio deep, ring room tone)");
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

// --- Child media: contain, not cover ---
const studioMedia = extractBlock(
  index,
  ".world-studio .media-stack img,\n      .world-studio .media-stack video",
  indexMobileIdx
);
const studioMediaAlt = studioMedia
  ? null
  : extractBlock(
      index,
      ".world-studio .media-stack img, .world-studio .media-stack video",
      indexMobileIdx
    );
assertContainMedia(
  studioMedia || studioMediaAlt,
  "mobile studio stack media"
);

const ringMedia = extractBlock(
  index,
  ".world-ring .media-stack img,\n      .world-ring .media-stack video",
  indexMobileIdx
);
const ringMediaAlt = ringMedia
  ? null
  : extractBlock(
      index,
      ".world-ring .media-stack img, .world-ring .media-stack video",
      indexMobileIdx
    );
assertContainMedia(ringMedia || ringMediaAlt, "mobile ring stack media");

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

// --- Hand bridge mobile parent mirrors opening ring contain composition ---
const handMediaMobile = extractBlock(
  styles,
  ".hand-bridge .layer-media",
  stylesMobileIdx
);
assertFullViewport(handMediaMobile, "mobile .hand-bridge .layer-media");
assertSolidGround(handMediaMobile, "mobile .hand-bridge .layer-media");
const handBg = handMediaMobile.match(/background\s*:\s*([^;]+);/)[1].trim();
if (handBg !== ringBg) {
  fail(
    `hand-bridge mobile ground (${handBg}) must match opening ring ground (${ringBg})`
  );
}

const handMediaChildren = extractBlock(
  styles,
  ".hand-bridge .layer-media img,\n  .hand-bridge .layer-media video",
  stylesMobileIdx
);
const handMediaChildrenAlt = handMediaChildren
  ? null
  : extractBlock(
      styles,
      ".hand-bridge .layer-media img, .hand-bridge .layer-media video",
      stylesMobileIdx
    );
assertContainMedia(
  handMediaChildren || handMediaChildrenAlt,
  "mobile .hand-bridge .layer-media children"
);

// Parity: hand-bridge object-position must match ring object-position.
const ringPosMatch = (ringMedia || ringMediaAlt).match(
  /object-position\s*:\s*([^;]+);/
);
const handPosMatch = (handMediaChildren || handMediaChildrenAlt).match(
  /object-position\s*:\s*([^;]+);/
);
if (!ringPosMatch || !handPosMatch) {
  fail("ring and hand-bridge must both declare object-position");
}
if (ringPosMatch[1].trim() !== handPosMatch[1].trim()) {
  fail(
    `hand-bridge object-position (${handPosMatch[1].trim()}) must match ring (${ringPosMatch[1].trim()})`
  );
}

const stylesMobileSlice = styles.slice(stylesMobileIdx);
const stylesNextMedia = stylesMobileSlice.indexOf("@media", 1);
const stylesMobileOnly =
  stylesNextMedia > 0
    ? stylesMobileSlice.slice(0, stylesNextMedia)
    : stylesMobileSlice;
for (const token of forbiddenMaskTokens) {
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
// Desktop child media must remain cover (contain is mobile-only).
const desktopStackMedia = extractBlock(index, ".media-stack img,\n    .media-stack video", 0);
const desktopStackMediaAlt = desktopStackMedia
  ? null
  : extractBlock(index, ".media-stack img, .media-stack video", 0);
const desktopMediaBlock = desktopStackMedia || desktopStackMediaAlt;
if (!desktopMediaBlock || !/\bobject-fit:\s*cover\s*;/.test(desktopMediaBlock)) {
  fail("desktop .media-stack children must keep object-fit: cover");
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
    /\.hand-bridge\s+\.layer-media\s*\{[^}]*\b(width|height|inset|mask-image|background)\b/s.test(
      preMobile
    );
  if (parentGeometryInDesktop) {
    fail("desktop .hand-bridge .layer-media must not redefine parent geometry");
  }
}

console.log(
  "PASS: mobile opening/hand-bridge preserves source (contain, solid grounds, no vignette/echo/copy wash); desktop overscan unchanged"
);
