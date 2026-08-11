#!/usr/bin/env node
/**
 * Source assertion: mobile opening + hand-bridge media carry zero artificial
 * framing effects — no atmosphere pseudo-image, no blur/filter on media, no
 * radial/linear media mask, no gradient filler, exact source-ratio parents,
 * effective mobile media scale 1, hand-bridge parity with the opening ring,
 * one video decoder per opening source, and unchanged desktop overscan.
 *
 * Usage: node tools/assert-mobile-opening-zero-effects.mjs
 *
 * Residue: mobile-opening-zero-effects tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator editing mobile opening / hand-bridge media CSS-JS
 * Activation: execute — node tools/assert-mobile-opening-zero-effects.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when mobile opening is retired or a different composition contract
 *   supersedes zero artificial framing by owner decree
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
  const outlines = block.match(/outline\s*:\s*([^;]+);/gi) || [];
  for (const decl of outlines) {
    const value = decl.replace(/^outline\s*:\s*/i, "").replace(/;$/, "").trim();
    if (!/^none$/i.test(value)) {
      fail(`${label} must not use a non-none outline frame (found ${value})`);
    }
  }
}

function assertNoMediaMask(block, label) {
  if (!block) fail(`missing ${label}`);
  const masks = block.match(/(?:-webkit-)?mask-image\s*:\s*([^;]+);/gi) || [];
  for (const decl of masks) {
    const value = decl.replace(/^(?:-webkit-)?mask-image\s*:\s*/i, "").replace(/;$/, "").trim();
    if (!/^none$/i.test(value)) {
      fail(`${label} must not apply a media mask (found mask-image: ${value})`);
    }
  }
  // Any gradient mask grammar is a framing effect, even if written differently.
  if (/mask(?:-image)?\s*:[^;]*(linear-gradient|radial-gradient|ellipse)/i.test(block)) {
    fail(`${label} must not use gradient/ellipse media masks`);
  }
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
    fail(`${label} must not use full-viewport inset: 0 (media plane is ratio-boxed)`);
  }
  if (block.includes("min(118vw, 150svh)") || block.includes("59vw") || block.includes("118vw")) {
    fail(`${label} still uses retired vignette parent dimensions`);
  }
  assertNoCardChrome(block, label);
  assertNoMediaMask(block, label);
}

function assertUnfilteredMedia(block, label) {
  if (!block) fail(`missing ${label}`);
  if (!/\bobject-fit:\s*(cover|fill|contain)\s*;/.test(block)) {
    fail(`${label} must declare object-fit`);
  }
  if (!/\bobject-position\s*:/.test(block)) {
    fail(`${label} must declare object-position`);
  }
  // filter: none is allowed; any real filter is a framing/atmosphere effect.
  const filters = block.match(/filter\s*:\s*([^;]+);/gi) || [];
  for (const decl of filters) {
    const value = decl.replace(/^filter\s*:\s*/i, "").replace(/;$/, "").trim();
    if (!/^none$/i.test(value)) {
      fail(`${label} must remain unfiltered (found filter: ${value})`);
    }
  }
  if (/backdrop-filter\s*:/i.test(block)) {
    fail(`${label} must not use backdrop-filter`);
  }
}

function assertFlatDarkGround(block, label) {
  if (!block) fail(`missing ${label}`);
  if (!/background\s*:\s*#020005\s*;/i.test(block)) {
    fail(`${label} must use flat native dark ground #020005`);
  }
  if (/linear-gradient|radial-gradient|url\(/i.test(block)) {
    fail(`${label} ground must not use gradient or image-derived filler`);
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

// --- No atmosphere pseudo-image layers on mobile opening or hand-bridge ---
const atmosphereSelectors = [
  ".world-studio::before",
  ".world-ring::before",
  ".hand-bridge::before",
];
for (const sel of atmosphereSelectors) {
  if (indexMobileOnly.includes(sel) || stylesMobileOnly.includes(sel)) {
    fail(`mobile opening must not declare atmosphere pseudo-layer ${sel}`);
  }
  // extractBlock would also catch sole-subject rules.
  const fromIndex = extractBlock(index, sel, indexMobileIdx);
  const fromStyles = extractBlock(styles, sel, stylesMobileIdx);
  if (fromIndex || fromStyles) {
    fail(`mobile atmosphere rule still present for ${sel}`);
  }
}
if (/studio-poster\.jpg|ring-poster\.jpg/.test(indexMobileOnly)) {
  fail("mobile opening CSS must not paint poster atmosphere backgrounds");
}
if (/studio-poster\.jpg|ring-poster\.jpg/.test(stylesMobileOnly)) {
  fail("mobile styles must not paint poster atmosphere backgrounds");
}
if (/filter\s*:[^;]*blur\(/i.test(indexMobileOnly)) {
  fail("mobile opening CSS must not apply blur filters (atmosphere regression)");
}
if (/hand-bridge[\s\S]{0,400}filter\s*:[^;]*blur\(/i.test(stylesMobileOnly)) {
  fail("mobile hand-bridge must not apply blur filters");
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

// Forbidden vignette / halo / linear edge-fade grammar in mobile opening CSS.
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
// Linear media-edge fades on stacks are the rejected blur-substitute failure class.
if (
  /\.media-stack[\s\S]{0,500}mask-image\s*:\s*[^;]*linear-gradient/i.test(
    indexMobileOnly
  )
) {
  fail("mobile .media-stack must not use linear-gradient edge fades");
}

// --- Flat native dark grounds (no image-derived filler) ---
const studioWorld =
  extractBlock(index, ".world-studio", indexMobileIdx) ||
  extractBlock(index, ".world-studio,\n      .world-ring", indexMobileIdx) ||
  extractBlock(index, ".world-studio, .world-ring", indexMobileIdx);
const ringWorld =
  extractBlock(index, ".world-ring", indexMobileIdx) ||
  extractBlock(index, ".world-studio,\n      .world-ring", indexMobileIdx) ||
  extractBlock(index, ".world-studio, .world-ring", indexMobileIdx);
assertFlatDarkGround(studioWorld, "mobile .world-studio ground");
assertFlatDarkGround(ringWorld, "mobile .world-ring ground");

// --- One live decoder per opening source ---
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
  fail("opening must not introduce atmosphere DOM layers");
}

// --- Exact source-ratio parents, unmasked, square, edge-to-edge ---
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

// Combined full-viewport stack rule must not reappear as the media plane.
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
if (
  combinedStacks &&
  /\binset:\s*0\s*;/.test(combinedStacks) &&
  /\bheight:\s*100%\s*;/.test(combinedStacks)
) {
  fail("mobile opening must not use a combined full-viewport contain-band stack parent");
}

// --- Child media: unfiltered, positioned, no contain-band regression required ---
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
assertUnfilteredMedia(studioMedia, "mobile studio stack media");
assertUnfilteredMedia(ringMedia, "mobile ring stack media");

// --- Effective mobile media scale must be exactly 1 ---
const mediaTransformsFn = index.match(
  /function applyMediaTransforms\s*\([^)]*\)\s*\{[\s\S]*?\n      \}/
);
if (!mediaTransformsFn) {
  fail("could not locate applyMediaTransforms in index.html");
}
const fnBody = mediaTransformsFn[0];
// Mobile branch must assign scale 1 (not a crop-producing overscan zoom).
if (
  !/if\s*\(\s*mobile\s*\)\s*\{[\s\S]*?studioScale\s*=\s*1\s*;[\s\S]*?ringScale\s*=\s*1\s*;/m.test(
    fnBody
  )
) {
  fail("mobile applyMediaTransforms must set studioScale and ringScale to exactly 1");
}
// Reject residual mobile start-scale overscan constants.
if (/mobile\s*\?\s*1\.0[3-9]/i.test(fnBody) || /mobile\s*\?\s*1\.[1-9]/i.test(fnBody)) {
  fail("mobile applyMediaTransforms must not keep crop-producing start scales");
}

// --- Hand bridge: parity with opening ring (unmasked square 1:1) ---
const handBridgeGround = extractBlock(styles, ".hand-bridge", stylesMobileIdx);
assertFlatDarkGround(handBridgeGround, "mobile .hand-bridge ground");

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
assertUnfilteredMedia(
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

// Hand-bridge must not reintroduce radial/linear media mask grammar.
for (const token of forbiddenMaskTokens) {
  if (handMediaMobile && handMediaMobile.includes(token)) {
    fail(`hand-bridge mobile parent still carries vignette mask grammar: ${token}`);
  }
}
if (/hand-bridge[\s\S]*mask-image\s*:\s*[^;]*radial-gradient/i.test(stylesMobileOnly)) {
  fail("hand-bridge mobile CSS must not use radial-gradient masks");
}
if (
  /\.hand-bridge\s+\.layer-media[\s\S]{0,500}mask-image\s*:\s*[^;]*linear-gradient/i.test(
    stylesMobileOnly
  )
) {
  fail("hand-bridge .layer-media must not use linear-gradient edge fades");
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

// Desktop must not pick up mobile-only zero-effects ratio parents.
const preIndexMobile = index.slice(0, indexMobileIdx);
if (
  /\.world-studio\s+\.media-stack\s*\{[^}]*height:\s*50vw/s.test(preIndexMobile) ||
  /\.world-ring\s+\.media-stack\s*\{[^}]*height:\s*100vw/s.test(preIndexMobile)
) {
  fail("exact-ratio mobile media parents must remain mobile-only");
}
const preStylesMobile = styles.slice(0, stylesMobileIdx);
if (/\.hand-bridge\s+\.layer-media\s*\{[^}]*height:\s*100vw/s.test(preStylesMobile)) {
  fail("hand-bridge exact-ratio parent must remain mobile-only");
}

console.log(
  "PASS: mobile opening/hand-bridge zero artificial framing (no atmosphere/blur/media-mask/gradient filler; exact-ratio parents; mobile scale 1; hand-bridge parity; one video/source); desktop overscan unchanged"
);
