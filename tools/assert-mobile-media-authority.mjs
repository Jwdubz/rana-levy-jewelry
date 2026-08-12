#!/usr/bin/env node
/**
 * Source assertion: mobile homepage media authority — one live carrier at a time.
 *
 * Locks the owner-observed stacked-video correction:
 * - mobile handBridgeVideo cannot hydrate/play/paint
 * - mobile workBridge cannot paint
 * - opening video retirement removes is-live and pauses
 * - reverse re-entry restores is-live only after playback resumes
 * - Hand retirement pauses handVideo and drops is-live
 * - no representative boundary can arm more than one unpaused is-live path
 * - direct mobile Opening → Hand → first Work order (no bridge / blank / filler)
 * - desktop bridge paths remain present
 * - exact Hand montage media/order/duration unchanged
 *
 * Usage: node tools/assert-mobile-media-authority.mjs
 *
 * Residue: mobile-media-authority tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator editing homepage media lifecycle / bridges
 * Activation: execute — node tools/assert-mobile-media-authority.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when the single-authority mobile passage is retired or superseded
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

function extractMobileSlice(src) {
  const q = "@media (max-width: 700px)";
  let out = "";
  let from = 0;
  while (true) {
    const i = src.indexOf(q, from);
    if (i < 0) break;
    const slice = src.slice(i);
    const brace = slice.indexOf("{");
    if (brace < 0) break;
    let depth = 0;
    let end = -1;
    for (let j = brace; j < slice.length; j++) {
      if (slice[j] === "{") depth++;
      else if (slice[j] === "}") {
        depth--;
        if (depth === 0) {
          end = j + 1;
          break;
        }
      }
    }
    if (end < 0) break;
    out += slice.slice(0, end) + "\n";
    from = i + end;
  }
  return out || null;
}

const index = read("index.html");
const styles = read("styles.css");
const siteJs = read("site.js");
const stylesMobile = extractMobileSlice(styles);
if (!stylesMobile) fail("styles.css missing mobile max-width: 700px query");

// ——— Exact Hand montage media / order / duration preserved ———
const handVideoBlock = index.match(/id="handVideo"[\s\S]*?<\/video>/);
if (!handVideoBlock) fail("handVideo element must be present");
if (!/data-src="assets\/studio-hand-work-cycle\.mp4"/.test(handVideoBlock[0])) {
  fail('handVideo must keep data-src="assets/studio-hand-work-cycle.mp4"');
}
if (
  !/data-desktop-src="assets\/studio-hand-work-cycle\.mp4"/.test(handVideoBlock[0]) ||
  !/data-mobile-src="assets\/studio-hand-work-cycle-portrait\.mp4"/.test(handVideoBlock[0])
) {
  fail("handVideo desktop/mobile cycle sources must remain unchanged");
}
const handWindow = siteJs.match(
  /const\s+BENCH_WINDOWS\s*=\s*\{[\s\S]*?hand\s*:\s*(\[[^\]]+\])/
);
if (!handWindow || handWindow[1].replace(/\s+/g, "") !== "[0,4.466667]") {
  fail("BENCH_WINDOWS.hand must remain exactly [0, 4.466667]");
}

// ——— Desktop bridge paths remain (not deleted for the mobile fix) ———
if (!/function\s+applyBridgeOut\s*\(/.test(siteJs)) {
  fail("applyBridgeOut must remain for desktop angled bridge Turns");
}
if (!/function\s+armHandBridgePlayback\s*\(/.test(siteJs)) {
  fail("armHandBridgePlayback must remain for desktop bridge ring playback");
}
if (!/id="handBridge"/.test(index) || !/id="handBridgeVideo"/.test(index)) {
  fail("handBridge markup must remain present for desktop");
}
if (!/id="workBridge"/.test(index)) {
  fail("workBridge markup must remain present for desktop");
}
if (!/data-desktop-src="assets\/studio-poster\.jpg"/.test(index)) {
  fail("workBridge / hand bench desktop poster sources must remain");
}
// Desktop render paths still call applyBridgeOut when not mobile.
if (
  !/if\s*\(\s*mobile\s*\)\s*\{[\s\S]*?retireBridgeLayer\s*\(\s*handBridge\s*\)[\s\S]*?\}\s*else\s*\{[\s\S]*?applyBridgeOut\s*\(\s*handBridge/m.test(
    siteJs
  )
) {
  fail("renderHand must retire handBridge on mobile and applyBridgeOut on desktop");
}
if (
  !/if\s*\(\s*mobile\s*\)\s*\{[\s\S]*?retireBridgeLayer\s*\(\s*workBridge\s*\)[\s\S]*?\}\s*else\s*\{[\s\S]*?applyBridgeOut\s*\(\s*workBridge/m.test(
    siteJs
  )
) {
  fail("renderWork must retire workBridge on mobile and applyBridgeOut on desktop");
}

// ——— Mobile CSS: bridges cannot paint ———
if (!/\.hand-bridge[\s\S]{0,500}visibility:\s*hidden\s*!important/i.test(stylesMobile)) {
  fail("mobile CSS must hide .hand-bridge (visibility:hidden !important)");
}
if (!/\.hand-bridge[\s\S]{0,500}opacity:\s*0\s*!important/i.test(stylesMobile)) {
  fail("mobile CSS must hide .hand-bridge (opacity:0 !important)");
}
if (!/\.work-bridge[\s\S]{0,500}visibility:\s*hidden\s*!important/i.test(stylesMobile)) {
  fail("mobile CSS must hide .work-bridge (visibility:hidden !important)");
}
if (!/\.work-bridge[\s\S]{0,500}opacity:\s*0\s*!important/i.test(stylesMobile)) {
  fail("mobile CSS must hide .work-bridge (opacity:0 !important)");
}

// ——— Mobile runtime: handBridgeVideo never hydrates/plays ———
if (!/function\s+retireHandBridgeVideo\s*\(/.test(siteJs)) {
  fail("site.js must define retireHandBridgeVideo for honest bridge teardown");
}
const armBridgeFn = siteJs.match(
  /function\s+armHandBridgePlayback\s*\(\s*\)\s*\{[\s\S]*?\n  \}/
);
if (!armBridgeFn) fail("armHandBridgePlayback body must be extractable");
if (!/if\s*\(\s*state\.isMobile\s*\)\s*return\s*;/.test(armBridgeFn[0])) {
  fail("armHandBridgePlayback must early-return on mobile (never hydrate/play)");
}
// updateActivity must force-retire the bridge on mobile rather than arming it.
if (
  !/if\s*\(\s*mobile\s*\|\|\s*mediaQuietActive\s*\(\s*\)\s*\)\s*\{[\s\S]*?retireHandBridgeVideo\s*\(\s*\)/m.test(
    siteJs
  )
) {
  fail("updateActivity must call retireHandBridgeVideo on mobile (and quiet)");
}
// Must not keep the retired mobile arm shape: arm when handActive && handP < 0.18 without mobile gate.
if (
  /if\s*\(\s*handBridgeVideo\s*&&\s*!mediaQuietActive\s*\(\s*\)\s*\)\s*\{[\s\S]*?if\s*\(\s*handActive\s*&&\s*handP\s*<\s*0\.18\s*\)\s*\{[\s\S]*?armHandBridgePlayback/m.test(
    siteJs
  )
) {
  fail(
    "retired mobile-unsafe path: arming handBridge whenever handActive&&handP<0.18 without mobile retirement"
  );
}

// ——— Opening video authority: pause + remove is-live; restore only after play ———
const manageFn = index.match(
  /function\s+manageOpeningVideoActivity\s*\(\s*\)\s*\{[\s\S]*?\n      \}/
);
if (!manageFn) fail("index.html must define manageOpeningVideoActivity");
const manageBody = manageFn[0];
if (/rect\.bottom\s*>\s*-vh\s*\*\s*0\.35\s*&&\s*rect\.top\s*<\s*vh\s*\*\s*1\.35/.test(manageBody)) {
  fail(
    "manageOpeningVideoActivity must not use the broad near band that left opening videos live under Hand"
  );
}
if (!/is-retired/.test(manageBody)) {
  fail("manageOpeningVideoActivity must consult opening is-retired for section authority");
}
if (!/classList\.remove\(\s*["']is-live["']\s*\)/.test(manageBody)) {
  fail("opening retirement must remove is-live (not pause-only)");
}
// Leave path must pause AND drop is-live.
if (
  !/video\.pause\s*\(\s*\)[\s\S]{0,120}classList\.remove\(\s*["']is-live["']\s*\)/.test(
    manageBody
  )
) {
  fail("opening leave path must pause then remove is-live");
}
// Re-entry: is-live only inside play().then (after playback resumes).
if (
  !/\.then\s*\(\s*function\s*\(\s*\)\s*\{[\s\S]*?classList\.add\(\s*["']is-live["']\s*\)/m.test(
    manageBody
  )
) {
  fail("opening reverse re-entry must add is-live only after play() resolves");
}
// Per-frame authority after siteTick (not scroll-only).
if (
  !/__ranaSiteTick[\s\S]{0,200}manageOpeningVideoActivity\s*\(\s*\)/m.test(index)
) {
  fail(
    "tick must call manageOpeningVideoActivity after __ranaSiteTick so retirement cannot lag to next scroll"
  );
}

// ——— Hand video leave / reverse: setVideoActive remains coherent ———
const setVideoActiveFn = siteJs.match(
  /function\s+setVideoActive\s*\(\s*video\s*,\s*active\s*,\s*armedFlag\s*\)\s*\{[\s\S]*?\n  \}/
);
if (!setVideoActiveFn) fail("setVideoActive must remain");
if (!/classList\.remove\(\s*["']is-live["']\s*\)/.test(setVideoActiveFn[0])) {
  fail("setVideoActive leave must remove is-live for handVideo retirement");
}
if (!/invalidateDeferredArm\s*\(\s*video\s*\)/.test(setVideoActiveFn[0])) {
  fail("setVideoActive leave must invalidateDeferredArm for reverse re-entry");
}
// Mobile hand ownership requires opening retired (single authority).
if (
  !/handActive\s*=\s*mobile\s*\?\s*handNear\s*&&\s*openingRetired\s*:\s*handNear/.test(
    siteJs
  )
) {
  fail(
    "mobile handActive must require openingRetired so handVideo cannot arm under a live Opening stack"
  );
}
if (
  !/setVideoActive\s*\(\s*handVideo\s*,\s*handActive\s*&&\s*handP\s*>\s*0\s*&&\s*handP\s*<\s*0\.95\s*,\s*["']handVideoArmed["']\s*\)/.test(
    siteJs
  )
) {
  fail("hand activity must still call setVideoActive(handVideo, handActive && handP > 0 && handP < 0.95, …)");
}

// ——— Desktop bridge leave also drops is-live (honest shared semantics) ———
if (
  !/handBridgeVideo\.classList\.remove\(\s*["']is-live["']\s*\)/.test(siteJs)
) {
  fail("handBridgeVideo leave/retire paths must remove is-live");
}

// ——— Direct mobile authority order: no blank/filler/contain/vignette substitute ———
// Hand bench remains full-viewport scale 1; Work stills stay cover full-bleed.
if (!/handBenchStack\.style\.transform\s*=\s*["']translate3d\(0,0,0\) scale\(1\)["']/.test(siteJs)) {
  fail("Hand bench carrier must remain exact scale(1)");
}
if (!/\.hand-bench\s+\.layer-media\s*\{[^}]*inset:\s*0/i.test(styles)) {
  fail("hand-bench layer-media must remain full-viewport inset:0");
}
if (!/#workStack0\s*>\s*img[\s\S]{0,400}object-fit\s*:\s*cover/i.test(stylesMobile)) {
  fail("mobile first Work still must remain object-fit:cover full-viewport authority");
}
// Forbidden mobile filler grammar for this handoff.
const forbidden = [
  "object-fit: contain",
  "letterbox",
  "vignette",
  "blur(28px)",
];
for (const token of forbidden) {
  if (stylesMobile.includes(token)) {
    fail(`mobile media authority must not introduce filler grammar: ${token}`);
  }
}

// ——— Representative boundary exclusivity (source-level ownership predicates) ———
// Boundary A: Opening retired ⇒ manageOpening forces owns=false ⇒ is-live removed.
if (!/if\s*\(\s*retired\s*\)\s*\{\s*owns\s*=\s*false\s*;\s*\}/.test(manageBody)) {
  fail("when opening is retired, owns must be forced false");
}
// Boundary B: mobile updateActivity always retires handBridgeVideo (never co-live with handVideo).
// Boundary C: handVideo only when handActive (which on mobile needs openingRetired).
// These three predicates together imply at most one unpaused is-live authority at
// Opening→Hand and Hand→Work boundaries (Work is still-only).
if (!/function\s+retireBridgeLayer\s*\(/.test(siteJs)) {
  fail("retireBridgeLayer must exist for causal mobile bridge paint retirement");
}

console.log(
  "PASS: mobile media authority (no mobile bridge paint/play; honest is-live retirement; desktop bridges retained; Hand montage unchanged)"
);
