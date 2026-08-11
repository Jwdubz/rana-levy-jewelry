#!/usr/bin/env node
/**
 * Source assertion: mobile opening + hand-bridge media must form a continuous
 * photographic atmosphere — static poster atmosphere (images only), exact-ratio
 * edge-to-edge sharp parents, vertical linear alpha masks only (no radial/
 * ellipse/halo/copy wash), hand-bridge parity with the opening ring, one video
 * decoder per opening source, and unchanged desktop .layer-media / .media-stack
 * overscan.
 *
 * Usage: node tools/assert-mobile-opening-atmosphere.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Normalize CRLF/CR → LF so multi-line selector probes match Windows checkouts.
const styles = fs
  .readFileSync(path.join(root, "styles.css"), "utf8")
  .replace(/\r\n?/g, "\n");
const index = fs
  .readFileSync(path.join(root, "index.html"), "utf8")
  .replace(/\r\n?/g, "\n");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function extractBlock(src, selector, afterIndex = 0) {
  // Match selector only as a sole rule subject (whitespace then `{`).
  // Skip trailing members of combined selectors (e.g. ".a, .b {") so
  // ".b" does not latch onto a shared rule that lacks per-subject props.
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped + "\\s*\\{", "g");
  re.lastIndex = afterIndex;
  while (true) {
    const match = re.exec(src);
    if (!match) return null;
    let i = match.index;
    while (i > 0 && /\s/.test(src[i - 1])) i--;
    if (i > 0 && src[i - 1] === ",") {
      continue;
    }
    const brace = match.index + match[0].length - 1;
    let depth = 0;
    for (let j = brace; j < src.length; j++) {
      const ch = src[j];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return src.slice(brace + 1, j);
      }
    }
    return null;
  }
}

function extractMobileSlice(src) {
  const q = "@media (max-width: 700px)";
  const idx = src.indexOf(q);
  if (idx < 0) return null;
  const slice = src.slice(idx);
  const next = slice.indexOf("@media", 1);
  return next > 0 ? slice.slice(0, next) : slice;
}

function assertNoCardChrome(block, label) {
  if (!block) fail(`missing ${label}`);
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

function assertVerticalLinearMask(block, label) {
  if (!block) fail(`missing ${label}`);
  const masks = block.match(/(?:-webkit-)?mask-image\s*:\s*([^;]+);/gi) || [];
  if (masks.length === 0) {
    fail(`${label} must declare a vertical linear alpha mask`);
  }
  let sawLinear = false;
  for (const decl of masks) {
    const value = decl.replace(/^(?:-webkit-)?mask-image\s*:\s*/i, "").replace(/;$/, "").trim();
    if (/none/i.test(value)) {
      fail(`${label} must not disable its alpha mask (found ${value})`);
    }
    if (/radial-gradient|ellipse|closest-side|farthest-side|circle\s/i.test(value)) {
      fail(`${label} must not use radial/ellipse mask geometry (found ${value})`);
    }
    if (!/linear-gradient/i.test(value)) {
      fail(`${label} mask must be a linear-gradient (found ${value})`);
    }
    // Vertical only: 180deg, to bottom, or to top — not horizontal/angled.
    if (
      !/linear-gradient\(\s*(180deg|to\s+bottom|to\s+top)\b/i.test(value)
    ) {
      fail(
        `${label} mask must be a vertical linear gradient (180deg/to bottom/to top); found ${value}`
      );
    }
    sawLinear = true;
  }
  if (!sawLinear) fail(`${label} must declare a vertical linear alpha mask`);
}

function assertExactRatioParent(block, label, { width, height, top }) {
  if (!block) fail(`missing ${label}`);
  if (!new RegExp(`\\bwidth:\\s*${width}\\s*;`).test(block)) {
    fail(`${label} must use width: ${width}`);
  }
  if (!new RegExp(`\\bheight:\\s*${height}\\s*;`).test(block)) {
    fail(`${label} must use height: ${height}`);
  }
  if (!new RegExp(`\\btop:\\s*${top}\\s*;`).test(block)) {
    fail(`${label} must rest at top: ${top}`);
  }
  if (!/\bleft:\s*0\s*;/.test(block)) {
    fail(`${label} must be edge-to-edge (left: 0)`);
  }
  // Reject full-viewport contain-band parents and retired vignette sizes.
  if (/\binset:\s*0\s*;/.test(block)) {
    fail(`${label} must not use full-viewport inset: 0 (sharp plane is ratio-boxed)`);
  }
  if (block.includes("min(118vw, 150svh)") || block.includes("59vw") || block.includes("118vw")) {
    fail(`${label} still uses retired vignette parent dimensions`);
  }
  assertNoCardChrome(block, label);
  assertVerticalLinearMask(block, label);
}

function assertCoverZeroCropMedia(block, label) {
  if (!block) fail(`missing ${label}`);
  if (!/\bobject-fit:\s*(cover|fill)\s*;/.test(block)) {
    fail(`${label} must use object-fit: cover or fill at exact parent ratio`);
  }
  if (/\bobject-fit:\s*contain\s*;/.test(block)) {
    fail(`${label} must not use object-fit: contain (hard band regression)`);
  }
  if (!/\bobject-position\s*:/.test(block)) {
    fail(`${label} must declare object-position`);
  }
}

function assertAtmosphereImageOnly(block, label, expectedUrl, { requireBlur = true } = {}) {
  if (!block) fail(`missing ${label}`);
  if (!/background-image\s*:\s*url\(/.test(block)) {
    fail(`${label} must paint atmosphere via background-image url(...)`);
  }
  if (expectedUrl && !block.includes(expectedUrl)) {
    fail(`${label} must use ${expectedUrl}`);
  }
  // Atmosphere is static poster only — never a video element or decoder hook.
  if (/<video|video\s*\{|getUserMedia|HTMLVideoElement/i.test(block)) {
    fail(`${label} atmosphere must not introduce a video decoder`);
  }
  if (requireBlur && !/filter\s*:[^;]*blur\(/i.test(block)) {
    fail(`${label} must apply a uniform blur treatment`);
  }
  // Reject the retired darkened-halo atmosphere (brightness crush).
  if (/brightness\(\s*0?\.\d+\s*\)/i.test(block)) {
    fail(`${label} must not darken the perimeter via brightness() < 1`);
  }
}

function assertAtmosphereBlurPresent(blocks, label) {
  const ok = (blocks || []).some(
    (b) => b && /filter\s*:[^;]*blur\(/i.test(b)
  );
  if (!ok) fail(`${label} must apply a uniform blur treatment`);
  for (const b of blocks || []) {
    if (b && /brightness\(\s*0?\.\d+\s*\)/i.test(b)) {
      fail(`${label} must not darken the perimeter via brightness() < 1`);
    }
  }
}

const mobileQuery = "@media (max-width: 700px)";
const stylesMobileIdx = styles.indexOf(mobileQuery);
if (stylesMobileIdx < 0) fail("styles.css missing mobile max-width: 700px query");

const indexMobileIdx = index.indexOf(mobileQuery);
if (indexMobileIdx < 0) fail("index.html missing mobile max-width: 700px query");

const indexMobileOnly = extractMobileSlice(index);
const stylesMobileOnly = extractMobileSlice(styles);
if (!indexMobileOnly) fail("could not extract index.html mobile slice");
if (!stylesMobileOnly) fail("could not extract styles.css mobile slice");

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
if (
  /\.scene::after/.test(indexMobileOnly) ||
  (/radial-gradient/.test(indexMobileOnly) &&
    /rgba\(\s*2\s*,\s*0\s*,\s*5/.test(indexMobileOnly) &&
    /scene/.test(indexMobileOnly))
) {
  fail("mobile opening CSS must not reintroduce a .scene radial copy wash");
}

// Forbidden vignette / halo grammar anywhere in mobile opening CSS.
const forbiddenMaskTokens = [
  "closest-side",
  "ellipse 50% 50% at 50% 50%",
  "#000 52%",
  "rgba(0, 0, 0, 0.94) 68%",
  "ellipse 96% 94%",
];
for (const token of forbiddenMaskTokens) {
  if (indexMobileOnly.includes(token)) {
    fail(`mobile opening CSS still carries vignette mask grammar: ${token}`);
  }
}
if (/mask-image\s*:\s*[^;]*radial-gradient/i.test(indexMobileOnly)) {
  fail("mobile opening CSS must not use radial-gradient masks");
}
if (/mask-image\s*:\s*[^;]*ellipse/i.test(indexMobileOnly)) {
  fail("mobile opening CSS must not use elliptical masks");
}

// --- Atmosphere layers: images only, no darkening ---
const studioAtmosphere = extractBlock(index, ".world-studio::before", indexMobileIdx);
const ringAtmosphere = extractBlock(index, ".world-ring::before", indexMobileIdx);
// Combined selector may also declare shared atmosphere treatment.
const sharedAtmosphere =
  extractBlock(
    index,
    ".world-studio::before,\n      .world-ring::before",
    indexMobileIdx
  ) ||
  extractBlock(
    index,
    ".world-studio::before, .world-ring::before",
    indexMobileIdx
  );

assertAtmosphereImageOnly(
  studioAtmosphere,
  "mobile .world-studio::before atmosphere",
  "assets/studio-poster.jpg",
  { requireBlur: false }
);
assertAtmosphereImageOnly(
  ringAtmosphere,
  "mobile .world-ring::before atmosphere",
  "assets/ring-poster.jpg",
  { requireBlur: false }
);
assertAtmosphereBlurPresent(
  [studioAtmosphere, sharedAtmosphere],
  "mobile studio atmosphere"
);
assertAtmosphereBlurPresent(
  [ringAtmosphere, sharedAtmosphere],
  "mobile ring atmosphere"
);

// Atmosphere must not be implemented as extra <video> nodes in opening worlds.
const openingSection = index.slice(
  index.indexOf('id="opening"'),
  index.indexOf('id="hand"')
);
const openingVideos = openingSection.match(/<video\b/g) || [];
if (openingVideos.length !== 2) {
  fail(
    `opening must keep exactly one live decoder per source (studio+ring); found ${openingVideos.length} <video>`
  );
}
if ((openingSection.match(/media-atmosphere|atmosphere-layer/g) || []).length) {
  // If explicit DOM atmosphere layers exist, they must be images only.
  const atmImgs = (openingSection.match(/class="[^"]*atmosphere[^"]*"/g) || []).length;
  if (atmImgs && /atmosphere[^>]*>\s*<video/i.test(openingSection)) {
    fail("atmosphere DOM layers must contain images only, never video");
  }
}

// --- Sharp parents: exact source ratios, edge-to-edge, vertical linear masks ---
const studioStack = extractBlock(index, ".world-studio .media-stack", indexMobileIdx);
const ringStack = extractBlock(index, ".world-ring .media-stack", indexMobileIdx);
assertExactRatioParent(studioStack, "mobile .world-studio .media-stack", {
  width: "100vw",
  height: "50vw",
  top: "31svh",
});
assertExactRatioParent(ringStack, "mobile .world-ring .media-stack", {
  width: "100vw",
  height: "100vw",
  top: "25svh",
});

// Combined full-viewport stack rule must not reappear as the sharp plane.
const combinedStacks =
  extractBlock(
    index,
    ".world-studio .media-stack,\n      .world-ring .media-stack",
    indexMobileIdx
  ) ||
  extractBlock(
    index,
    ".world-studio .media-stack, .world-ring .media-stack",
    indexMobileIdx
  );
if (combinedStacks && /\binset:\s*0\s*;/.test(combinedStacks) && /\bheight:\s*100%\s*;/.test(combinedStacks)) {
  fail("mobile opening must not use a combined full-viewport contain-band stack parent");
}

// --- Child media: cover/fill at exact ratio (zero crop), not contain band ---
const studioMedia =
  extractBlock(
    index,
    ".world-studio .media-stack img,\n      .world-studio .media-stack video",
    indexMobileIdx
  ) ||
  extractBlock(
    index,
    ".world-studio .media-stack img, .world-studio .media-stack video",
    indexMobileIdx
  );
const ringMedia =
  extractBlock(
    index,
    ".world-ring .media-stack img,\n      .world-ring .media-stack video",
    indexMobileIdx
  ) ||
  extractBlock(
    index,
    ".world-ring .media-stack img, .world-ring .media-stack video",
    indexMobileIdx
  );
assertCoverZeroCropMedia(studioMedia, "mobile studio stack media");
assertCoverZeroCropMedia(ringMedia, "mobile ring stack media");

// --- Hand bridge: atmosphere + sharp parent parity with opening ring ---
const handAtmosphere = extractBlock(styles, ".hand-bridge::before", stylesMobileIdx);
assertAtmosphereImageOnly(
  handAtmosphere,
  "mobile .hand-bridge::before atmosphere",
  "assets/ring-poster.jpg"
);

const handMediaMobile = extractBlock(
  styles,
  ".hand-bridge .layer-media",
  stylesMobileIdx
);
assertExactRatioParent(handMediaMobile, "mobile .hand-bridge .layer-media", {
  width: "100vw",
  height: "100vw",
  top: "25svh",
});

// Mask values must match opening ring (parity under the Turn).
const ringMask = (ringStack.match(/mask-image\s*:\s*([^;]+);/i) || [])[1];
const handMask = (handMediaMobile.match(/mask-image\s*:\s*([^;]+);/i) || [])[1];
if (!ringMask || !handMask) {
  fail("ring and hand-bridge must both declare mask-image");
}
const norm = (s) => s.replace(/\s+/g, " ").trim();
if (norm(ringMask) !== norm(handMask)) {
  fail(
    `hand-bridge mask-image must match opening ring mask-image\n  ring: ${norm(ringMask)}\n  hand: ${norm(handMask)}`
  );
}

const handMediaChildren =
  extractBlock(
    styles,
    ".hand-bridge .layer-media img,\n  .hand-bridge .layer-media video",
    stylesMobileIdx
  ) ||
  extractBlock(
    styles,
    ".hand-bridge .layer-media img, .hand-bridge .layer-media video",
    stylesMobileIdx
  );
assertCoverZeroCropMedia(
  handMediaChildren,
  "mobile .hand-bridge .layer-media children"
);

const ringPos = (ringMedia.match(/object-position\s*:\s*([^;]+);/) || [])[1];
const handPos = (handMediaChildren.match(/object-position\s*:\s*([^;]+);/) || [])[1];
if (!ringPos || !handPos) {
  fail("ring and hand-bridge must both declare object-position");
}
if (ringPos.trim() !== handPos.trim()) {
  fail(
    `hand-bridge object-position (${handPos.trim()}) must match ring (${ringPos.trim()})`
  );
}

// Hand-bridge must not reintroduce radial vignette grammar.
for (const token of forbiddenMaskTokens) {
  if (handMediaMobile && handMediaMobile.includes(token)) {
    fail(`hand-bridge mobile parent still carries vignette mask grammar: ${token}`);
  }
}
if (/mask-image\s*:\s*[^;]*radial-gradient/i.test(stylesMobileOnly)) {
  // Allow non-hand radial elsewhere only if not on hand-bridge — still forbid
  // hand-bridge radial specifically (already checked). Opening-adjacent hand
  // composition must stay linear.
  if (/hand-bridge[\s\S]*mask-image\s*:\s*[^;]*radial-gradient/i.test(stylesMobileOnly)) {
    fail("hand-bridge mobile CSS must not use radial-gradient masks");
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
const desktopStackMedia =
  extractBlock(index, ".media-stack img,\n    .media-stack video", 0) ||
  extractBlock(index, ".media-stack img, .media-stack video", 0);
if (!desktopStackMedia || !/\bobject-fit:\s*cover\s*;/.test(desktopStackMedia)) {
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

// Desktop must not pick up the mobile atmosphere pseudo-layers.
const preIndexMobile = index.slice(0, indexMobileIdx);
if (/\.world-studio::before|\.world-ring::before/.test(preIndexMobile)) {
  fail("opening atmosphere ::before must remain mobile-only");
}
const preStylesMobile = styles.slice(0, stylesMobileIdx);
if (/\.hand-bridge::before/.test(preStylesMobile)) {
  fail("hand-bridge atmosphere ::before must remain mobile-only");
}

console.log(
  "PASS: mobile opening/hand-bridge photographic atmosphere (exact-ratio parents, vertical linear masks, image-only atmosphere, hand-bridge parity, one video/source); desktop overscan unchanged"
);
