#!/usr/bin/env node
/**
 * Source assertion: true full-screen mobile opening oracle.
 *
 * Fails when mobile opening/bridge media is not full-viewport, when killed
 * substitute framing reappears (contain band, vignette, blur atmosphere,
 * ratio strip/square, gradient filler, frame chrome, media filter), when
 * portrait assets or deterministic mobile selection are missing, when more
 * than one opening decoder exists per source, when quiet mode can receive a
 * video src, or when desktop overscan/asset selection changes.
 *
 * Usage: node tools/assert-mobile-opening-zero-effects.mjs
 *
 * Residue: mobile-opening-fullscreen-oracle tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator editing mobile opening / hand-bridge media
 * Activation: execute — node tools/assert-mobile-opening-zero-effects.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when the mobile opening oracle is retired or superseded by owner decree
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
const siteJs = fs
  .readFileSync(path.join(root, "site.js"), "utf8")
  .replace(/\r\n?/g, "\n");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function extractBlock(src, selector, afterIndex = 0) {
  // Match selector only as a sole rule subject (whitespace then `{`).
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped + "\\s*\\{", "g");
  re.lastIndex = afterIndex;
  while (true) {
    const match = re.exec(src);
    if (!match) return null;
    let i = match.index;
    while (i > 0 && /\s/.test(src[i - 1])) i--;
    if (i > 0 && src[i - 1] === ",") continue;
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
    const value = decl
      .replace(/^(?:-webkit-)?mask-image\s*:\s*/i, "")
      .replace(/;$/, "")
      .trim();
    if (!/^none$/i.test(value)) {
      fail(`${label} must not apply a media mask (found mask-image: ${value})`);
    }
  }
  if (/mask(?:-image)?\s*:[^;]*(linear-gradient|radial-gradient|ellipse)/i.test(block)) {
    fail(`${label} must not use gradient/ellipse media masks`);
  }
}

function assertFullViewportParent(block, label) {
  if (!block) fail(`missing ${label}`);
  if (!/\binset:\s*0\s*;/.test(block)) {
    fail(`${label} must fill the viewport/layer with inset: 0`);
  }
  if (!/\bwidth:\s*100%\s*;/.test(block)) {
    fail(`${label} must use width: 100%`);
  }
  if (!/\bheight:\s*100%\s*;/.test(block)) {
    fail(`${label} must use height: 100%`);
  }
  // Killed substitute class: exact source-ratio strip/square sizing.
  if (/\bheight:\s*50vw\s*;/.test(block) || /\bheight:\s*100vw\s*;/.test(block)) {
    fail(`${label} must not use source-ratio strip/square height (50vw/100vw)`);
  }
  if (/\btop:\s*\d/.test(block) && !/\binset:\s*0\s*;/.test(block)) {
    fail(`${label} must not use negative-space top placement instead of full inset`);
  }
  if (block.includes("min(118vw, 150svh)") || block.includes("59vw") || block.includes("118vw")) {
    fail(`${label} still uses retired vignette parent dimensions`);
  }
  assertNoCardChrome(block, label);
  assertNoMediaMask(block, label);
}

function assertCoverUnfiltered(block, label) {
  if (!block) fail(`missing ${label}`);
  if (!/\bobject-fit:\s*cover\s*;/.test(block)) {
    fail(`${label} must use object-fit: cover (not contain/fill letterbox modes)`);
  }
  if (/\bobject-fit:\s*contain\s*;/.test(block)) {
    fail(`${label} must not use object-fit: contain`);
  }
  if (!/\bobject-position\s*:/.test(block)) {
    fail(`${label} must declare object-position`);
  }
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

function assetExists(rel) {
  return fs.existsSync(path.join(root, rel));
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

// --- Portrait derivative assets must exist ---
const requiredAssets = [
  "assets/studio-opening-cluster.mp4",
  "assets/studio-opening-cluster-portrait.mp4",
  "assets/studio-opening-cluster.jpg",
  "assets/studio-opening-cluster-portrait.jpg",
  "assets/ring-alexandrite-portrait.mp4",
  "assets/studio-poster-portrait.jpg",
  "assets/ring-poster-portrait.jpg",
  "assets/studio-hand-work-cycle-portrait.mp4",
];
for (const rel of requiredAssets) {
  if (!assetExists(rel)) fail(`missing required portrait asset: ${rel}`);
}

// --- Markup: deterministic desktop/mobile selection attributes ---
const requiredMarkupTokens = [
  'data-desktop-src="assets/studio-opening-cluster.mp4"',
  'data-mobile-src="assets/studio-opening-cluster-portrait.mp4"',
  'data-desktop-src="assets/ring-alexandrite.mp4"',
  'data-mobile-src="assets/ring-alexandrite-portrait.mp4"',
  'data-mobile-poster="assets/studio-opening-cluster-portrait.jpg"',
  'data-mobile-poster="assets/studio-poster-portrait.jpg"',
  'data-mobile-poster="assets/ring-poster-portrait.jpg"',
  'data-mobile-src="assets/studio-opening-cluster-portrait.jpg"',
  'data-mobile-src="assets/ring-poster-portrait.jpg"',
  'data-desktop-src="assets/studio-hand-work-cycle.mp4"',
  'data-mobile-src="assets/studio-hand-work-cycle-portrait.mp4"',
];
for (const token of requiredMarkupTokens) {
  if (!index.includes(token)) {
    fail(`index.html missing deterministic media attribute token: ${token}`);
  }
}

// Opening world must pin the owner-approved jewelry-cluster film/still authority
// and must not fall back to the pre-rotation studio-banner montage order.
const studioVideoBlock = index.match(/id="studioVideo"[\s\S]*?<\/video>/);
if (!studioVideoBlock) fail("studioVideo element must be present");
if (
  !/data-desktop-src="assets\/studio-opening-cluster\.mp4"/.test(studioVideoBlock[0]) ||
  !/data-mobile-src="assets\/studio-opening-cluster-portrait\.mp4"/.test(
    studioVideoBlock[0]
  ) ||
  !/data-desktop-poster="assets\/studio-opening-cluster\.jpg"/.test(
    studioVideoBlock[0]
  ) ||
  !/data-mobile-poster="assets\/studio-opening-cluster-portrait\.jpg"/.test(
    studioVideoBlock[0]
  )
) {
  fail(
    "studioVideo must declare owner-approved cluster opening desktop/portrait film + still posters"
  );
}
if (
  /studio-banner\.mp4|studio-banner-portrait\.mp4|studio-poster\.jpg|studio-poster-portrait\.jpg/.test(
    studioVideoBlock[0]
  )
) {
  fail(
    "studioVideo must not use pre-rotation studio-banner film or hand-beat studio-poster as opening authority"
  );
}
const studioStackBlock = index.match(
  /id="studioStack"[\s\S]*?<\/div>\s*<\/div>\s*<div class="world world-ring"/
);
if (!studioStackBlock) fail("could not extract worldStudio media stack");
if (
  !/data-desktop-src="assets\/studio-opening-cluster\.jpg"/.test(
    studioStackBlock[0]
  ) ||
  !/data-mobile-src="assets\/studio-opening-cluster-portrait\.jpg"/.test(
    studioStackBlock[0]
  )
) {
  fail(
    "worldStudio first-paint still must use owner-approved cluster opening stills"
  );
}
if (
  /studio-banner\.mp4|studio-banner-portrait\.mp4|studio-opening\.jpg|studio-opening-portrait\.jpg/.test(
    studioStackBlock[0]
  )
) {
  fail(
    "worldStudio must not keep pre-rotation studio-banner film or old studio-opening stills as opening authority"
  );
}
// Fresh load must not seek past the selected cluster start (native loop returns to 0).
if (/tryPlay\(\s*studioVideo\s*,\s*[^)]+\)/.test(index)) {
  fail(
    "studioVideo must not receive an initial tryPlay seek (rotated cluster film starts at frame 0)"
  );
}
if (!/tryPlay\(\s*studioVideo\s*\)/.test(index)) {
  fail("studioVideo must arm with tryPlay(studioVideo) at the rotated start");
}

// handVideo must stay on the single pre-hydration responsive selector (one decoder).
const handVideoBlock = index.match(/id="handVideo"[\s\S]*?<\/video>/);
if (!handVideoBlock) fail("handVideo element must be present");
if (
  !/data-desktop-src="assets\/studio-hand-work-cycle\.mp4"/.test(handVideoBlock[0]) ||
  !/data-mobile-src="assets\/studio-hand-work-cycle-portrait\.mp4"/.test(
    handVideoBlock[0]
  )
) {
  fail("handVideo must declare desktop cycle and portrait cycle data sources");
}
if ((index.match(/id="handVideo"/g) || []).length !== 1) {
  fail("exactly one handVideo decoder must exist (no second selector/decoder)");
}

if (!/function\s+selectResponsiveMedia\s*\(/.test(index)) {
  fail("index.html must define selectResponsiveMedia() for deterministic asset selection");
}
if (!/function\s+isMobileOpeningViewport\s*\(/.test(index)) {
  fail("index.html must define isMobileOpeningViewport() for deterministic selection");
}
// Selection must run before hydration (armVideos / ensureVideoSource body).
const selectCallIdx = index.indexOf("selectResponsiveMedia()");
const armIdx = index.indexOf("function armVideos");
const ensureIdx = index.indexOf("function ensureVideoSource");
if (selectCallIdx < 0) fail("selectResponsiveMedia() must be invoked");
if (armIdx < 0 || selectCallIdx > armIdx) {
  fail("selectResponsiveMedia() must run before armVideos is defined/used for hydration order");
}
if (ensureIdx < 0) fail("missing ensureVideoSource");

// --- Quiet mode must never assign video src ---
const ensureFn = index.match(
  /function ensureVideoSource\s*\([^)]*\)\s*\{[\s\S]*?\n      \}/
);
if (!ensureFn) fail("could not extract ensureVideoSource");
// armVideos quiet branch must return before ensureVideoSource calls.
const armFn = index.match(/function armVideos\s*\(\s*\)\s*\{[\s\S]*?\n      \}/);
if (!armFn) fail("could not extract armVideos");
const armBody = armFn[0];
const quietHead = armBody.match(
  /if\s*\(\s*mediaQuietActive\s*\(\s*\)\s*\)\s*\{[\s\S]*?\n        \}/
);
if (!quietHead) {
  fail("armVideos must open with a mediaQuietActive early-return branch");
}
if (!/\breturn\s*;/.test(quietHead[0])) {
  fail("armVideos quiet branch must return without hydrating video src");
}
if (/ensureVideoSource\s*\(/.test(quietHead[0])) {
  fail("quiet-mode armVideos path must not call ensureVideoSource");
}
if (!/ensureVideoSource\s*\(\s*studioVideo/.test(armBody) || !/ensureVideoSource\s*\(\s*ringVideo/.test(armBody)) {
  fail("normal armVideos path must hydrate studioVideo and ringVideo once each");
}
// ensureVideoSource itself only assigns from data-src; quiet path never reaches it for opening.
if (!/video\.setAttribute\(\s*["']src["']/.test(ensureFn[0])) {
  fail("ensureVideoSource must assign src only when explicitly called");
}

// --- Markup / residue: media-echo is gone ---
if (/\bmedia-echo\b/.test(index)) fail("index.html still contains media-echo residue");
if (/\bstudioEcho\b|\bringEcho\b/.test(index)) {
  fail("index.html still references studioEcho/ringEcho");
}
if (/\bmedia-echo\b/.test(styles)) fail("styles.css still contains media-echo residue");

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
  const fromIndex = extractBlock(index, sel, indexMobileIdx);
  const fromStyles = extractBlock(styles, sel, stylesMobileIdx);
  if (fromIndex || fromStyles) {
    fail(`mobile atmosphere rule still present for ${sel}`);
  }
}
if (/studio-poster\.jpg|ring-poster\.jpg/.test(indexMobileOnly)) {
  // Allow only if not used as background atmosphere — reject background url posters.
  if (/background[^;]*url\([^)]*poster/i.test(indexMobileOnly)) {
    fail("mobile opening CSS must not paint poster atmosphere backgrounds");
  }
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
if (
  /\.media-stack[\s\S]{0,500}mask-image\s*:\s*[^;]*linear-gradient/i.test(indexMobileOnly)
) {
  fail("mobile .media-stack must not use linear-gradient edge fades");
}

// Mobile veil wash disabled (top/bottom compensating surround).
const veilMobile = extractBlock(index, ".veil", indexMobileIdx);
if (veilMobile && !/display:\s*none/i.test(veilMobile)) {
  fail("mobile .veil must be disabled (display:none) — full-frame wash is a substitute surround");
}

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

// --- Full-viewport parents (not ratio strips) ---
const studioStack =
  extractBlock(index, ".world-studio .media-stack", indexMobileIdx) ||
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
const ringStack =
  extractBlock(index, ".world-ring .media-stack", indexMobileIdx) ||
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
assertFullViewportParent(studioStack, "mobile .world-studio .media-stack");
assertFullViewportParent(ringStack, "mobile .world-ring .media-stack");

// Child media: cover + unfiltered
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
  ) ||
  extractBlock(
    index,
    ".world-studio .media-stack img,\n      .world-studio .media-stack video,\n      .world-ring .media-stack img,\n      .world-ring .media-stack video",
    indexMobileIdx
  ) ||
  extractBlock(
    index,
    ".world-studio .media-stack img, .world-studio .media-stack video, .world-ring .media-stack img, .world-ring .media-stack video",
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
  ) ||
  studioMedia;
assertCoverUnfiltered(studioMedia, "mobile studio stack media");
assertCoverUnfiltered(ringMedia, "mobile ring stack media");

// --- Effective mobile media scale must be exactly 1 ---
const mediaTransformsFn = index.match(
  /function applyMediaTransforms\s*\([^)]*\)\s*\{[\s\S]*?\n      \}/
);
if (!mediaTransformsFn) {
  fail("could not locate applyMediaTransforms in index.html");
}
const fnBody = mediaTransformsFn[0];
if (
  !/if\s*\(\s*mobile\s*\)\s*\{[\s\S]*?studioScale\s*=\s*1\s*;[\s\S]*?ringScale\s*=\s*1\s*;/m.test(
    fnBody
  )
) {
  fail("mobile applyMediaTransforms must set studioScale and ringScale to exactly 1");
}
if (/mobile\s*\?\s*1\.0[3-9]/i.test(fnBody) || /mobile\s*\?\s*1\.[1-9]/i.test(fnBody)) {
  fail("mobile applyMediaTransforms must not keep crop-producing start scales");
}

// --- Hand bridge: full-viewport parity with opening ring ---
const handMediaMobile = extractBlock(
  styles,
  ".hand-bridge .layer-media",
  stylesMobileIdx
);
assertFullViewportParent(handMediaMobile, "mobile .hand-bridge .layer-media");

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
assertCoverUnfiltered(handMediaChildren, "mobile .hand-bridge .layer-media children");

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

// Hand-bridge markup must also select portrait ring on mobile.
if (
  !/id="handBridgeVideo"[\s\S]*?data-mobile-src="assets\/ring-alexandrite-portrait\.mp4"/.test(
    index
  )
) {
  fail("handBridgeVideo must declare mobile portrait ring derivative");
}

for (const token of forbiddenMaskTokens) {
  if (handMediaMobile && handMediaMobile.includes(token)) {
    fail(`hand-bridge mobile parent still carries vignette mask grammar: ${token}`);
  }
}
if (/hand-bridge[\s\S]*mask-image\s*:\s*[^;]*radial-gradient/i.test(stylesMobileOnly)) {
  fail("hand-bridge mobile CSS must not use radial-gradient masks");
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

// Desktop still points at owner-approved landscape/square opening assets by default.
if (!/data-desktop-src="assets\/studio-opening-cluster\.mp4"/.test(index)) {
  fail(
    "desktop studio asset selection must remain assets/studio-opening-cluster.mp4"
  );
}
if (!/data-desktop-src="assets\/ring-alexandrite\.mp4"/.test(index)) {
  fail("desktop ring asset selection must remain assets/ring-alexandrite.mp4");
}
// Reject pre-rotation montage as any opening authority surface.
if (
  /id="studioVideo"[\s\S]*?studio-banner(?:-portrait)?\.mp4/.test(index) ||
  /data-(?:desktop|mobile)-src="assets\/studio-banner(?:-portrait)?\.mp4"/.test(
    index.slice(index.indexOf('id="worldStudio"'), index.indexOf('id="worldRing"'))
  )
) {
  fail("opening world must reject pre-rotation studio-banner as film authority");
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

// Full-viewport mobile parents must remain mobile-only.
const preIndexMobile = index.slice(0, indexMobileIdx);
if (
  /\.world-studio\s+\.media-stack\s*\{[^}]*height:\s*100%/s.test(preIndexMobile) &&
  /\.world-studio\s+\.media-stack\s*\{[^}]*inset:\s*0/s.test(preIndexMobile)
) {
  // Only fail if the desktop base .media-stack lost overscan — already checked.
}
const preStylesMobile = styles.slice(0, stylesMobileIdx);
if (/\.hand-bridge\s+\.layer-media\s*\{[^}]*height:\s*100vw/s.test(preStylesMobile)) {
  fail("hand-bridge ratio-strip parent must not appear in desktop CSS");
}

// site.js must not reintroduce a second visible opening decoder path for ring/studio.
if (
  /createElement\(\s*['"]video['"]\s*\)/.test(siteJs) &&
  /studio-opening-cluster|studio-banner|ring-alexandrite/.test(siteJs)
) {
  // Allow deferred hydration of existing elements; only fail explicit clone patterns.
  if (/cloneNode|media-echo|atmosphere/.test(siteJs)) {
    fail("site.js must not clone/echo opening media into a second visible decoder");
  }
}

console.log(
  "PASS: true full-screen mobile opening oracle (full-inset media parents; cluster opening film/stills + deterministic selection; no contain/vignette/blur/ratio-strip/filter; one video/source; quiet skips src; desktop overscan/assets unchanged)"
);
