#!/usr/bin/env node
/**
 * Source assertion: mobile homepage media authority — one live carrier at a time.
 *
 * Locks the owner-observed stacked-video correction:
 * - mobile handBridgeVideo cannot hydrate/play/paint
 * - workBridge / studio-poster Work bridge is absent on every viewport
 * - opening video retirement removes is-live and pauses
 * - reverse re-entry restores is-live only after playback resumes
 * - Opening: only studioVideo may be unpaused+is-live; live gem is not a decoder
 * - arm/init pauses studio under the gem cover and plays it at the headline rest
 * - desktop must not hydrate or play studio under gem cover
 * - reverse cover authority pauses and resets the studio film to time zero
 * - inactive opening decoder paused + is-live removed; stale play cannot restore it
 * - reverse cover↔studio transfer uses the same exclusive authored-timeline authority
 * - Hand retirement pauses handVideo and drops is-live
 * - no representative boundary can arm more than one unpaused is-live path
 * - direct mobile Opening → Hand → first Work order (no bridge / blank / filler)
 * - desktop bridge paths remain present; opening has one studio film, not a ring decoder
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
if (/id="workBridge"/.test(index) || /work-bridge/.test(index) || /workBridge/.test(siteJs)) {
  fail("workBridge must be removed from homepage markup and site.js, not merely hidden");
}
const workSection = (index.match(/id="work"[\s\S]*?<\/section>/) || [""])[0];
if (/studio-poster/.test(workSection)) {
  fail("Work section must not keep a studio-poster paint or hydration path");
}
if (!/data-desktop-src="assets\/studio-poster\.jpg"/.test(index)) {
  fail("hand bench desktop poster sources must remain on the live Hand carrier");
}
// Desktop render paths still call applyBridgeOut when not mobile.
if (
  !/if\s*\(\s*mobile\s*\)\s*\{[\s\S]*?retireBridgeLayer\s*\(\s*handBridge\s*\)[\s\S]*?\}\s*else\s*\{[\s\S]*?applyBridgeOut\s*\(\s*handBridge/m.test(
    siteJs
  )
) {
  fail("renderHand must retire handBridge on mobile and applyBridgeOut on desktop");
}
if (/applyBridgeOut\s*\(\s*workBridge/.test(siteJs) || /retireBridgeLayer\s*\(\s*workBridge/.test(siteJs)) {
  fail("renderWork must not still choreograph workBridge");
}

// ——— Mobile CSS: bridges cannot paint ———
if (!/\.hand-bridge[\s\S]{0,500}visibility:\s*hidden\s*!important/i.test(stylesMobile)) {
  fail("mobile CSS must hide .hand-bridge (visibility:hidden !important)");
}
if (!/\.hand-bridge[\s\S]{0,500}opacity:\s*0\s*!important/i.test(stylesMobile)) {
  fail("mobile CSS must hide .hand-bridge (opacity:0 !important)");
}
if (/\.work-bridge/.test(styles) || /#workBridge/.test(styles)) {
  fail("styles must not keep a work-bridge paint path");
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

// ——— Exclusive gem-cover | studio opening decoder authority ———
// Prior counterexample: an opening ring decoder shared authority with studio.
// The live gem is a canvas world. Only studioVideo may be the opening decoder,
// paused under gem-cover and owned at the headline rest on desktop and mobile.
const armFn = index.match(/function\s+armVideos\s*\(\s*\)\s*\{[\s\S]*?\n      \}/);
if (!armFn) fail("index.html must define armVideos");
const armBody = armFn[0];

if (/function\s+mobileOpeningDecoderAuthority\s*\(/.test(index)) {
  fail("must not retain a mobile-only opening decoder authority after the gemOutEnd boundary is universal");
}
if (!/function\s+openingDecoderAuthority\s*\(/.test(index)) {
  fail("openingDecoderAuthority must select exclusive cover|studio from authored timeline");
}
const openingAuthFn = index.match(
  /function\s+openingDecoderAuthority\s*\(\s*\)\s*\{[\s\S]*?\n      \}/
);
if (!openingAuthFn) fail("openingDecoderAuthority body must be extractable");
if (!/openingTimeline\s*\(\s*state\.visualProgress\s*\)/.test(openingAuthFn[0])) {
  fail("opening decoder authority must use openingTimeline(state.visualProgress)");
}
if (!/MOTION\.gemOutEnd/.test(openingAuthFn[0])) {
  fail("opening decoder authority must use MOTION.gemOutEnd as the gem-cover vs headline transfer");
}
if (/handoffStart|ringVideo|["']ring["']/.test(openingAuthFn[0])) {
  fail("opening decoder authority must not use the retired studio|ring handoff");
}
if (
  !/timeline\s*>=\s*MOTION\.gemOutEnd\s*\?\s*["']studio["']\s*:\s*["']cover["']/.test(
    openingAuthFn[0]
  )
) {
  fail(
    "openingDecoderAuthority must return 'cover' under the gem and 'studio' at the headline rest"
  );
}

if (/isMobileOpeningViewport\s*\(\s*\)/.test(armBody)) {
  fail("armVideos must not keep a desktop-eager / mobile-only decoder split");
}
if (/ringVideo/.test(armBody) || /tryPlay\s*\(\s*ringVideo/.test(armBody)) {
  fail("armVideos must not play or name a retired opening ring decoder");
}
if (!/openingDecoderAuthority\s*\(\s*\)/.test(armBody)) {
  fail("armVideos must consult openingDecoderAuthority on desktop and mobile");
}
const armAuthAt = armBody.search(/openingDecoderAuthority\s*\(\s*\)/);
const armHydrateAt = armBody.search(/ensureVideoSource\s*\(\s*studioVideo/);
const armPlayAt = armBody.search(/tryPlay\(\s*studioVideo\s*\)/);
if (armAuthAt < 0 || armHydrateAt < 0 || armHydrateAt < armAuthAt) {
  fail("desktop must not hydrate studioVideo under gem cover before openingDecoderAuthority");
}
if (armPlayAt < 0 || armPlayAt < armAuthAt) {
  fail("desktop must not play studioVideo under gem cover before openingDecoderAuthority");
}
if (/openingDecoderAuthority\s*=\s*["']studio["'][\s\S]{0,80}tryPlay\(\s*studioVideo/.test(armBody)) {
  fail("desktop must not assign studio authority and play without consulting gemOutEnd");
}
if (!/pauseOpeningDecoder\s*\(\s*studioVideo\s*\)/.test(armBody)) {
  fail("gem-cover arm must pauseOpeningDecoder(studioVideo)");
}
if (!/resetOpeningDecoderToStart\s*\(\s*studioVideo\s*\)/.test(armBody)) {
  fail("gem-cover arm must reset studio to the montage beginning");
}
if (!/tryPlay\(\s*studioVideo\s*\)/.test(armBody)) {
  fail("studio authority must tryPlay(studioVideo) without a seek");
}
if (/tryPlay\(\s*studioVideo\s*,\s*[^)]+\)/.test(armBody)) {
  fail("studioVideo must not receive an initial tryPlay seek");
}
if (/openingDecoderAuthority\s*=\s*["']both["']/.test(armBody) || /tryPlay\s*\(\s*ringVideo/.test(armBody)) {
  fail("armVideos must not keep retired dual studio|ring 'both' authority");
}

if (!/openingDecoderAuthority\s*\(\s*\)/.test(manageBody)) {
  fail("manageOpeningVideoActivity must consult openingDecoderAuthority on desktop and mobile");
}
if (/else\s*\{\s*state\.openingDecoderAuthority\s*=\s*["']studio["']/.test(manageBody)) {
  fail("desktop manageOpening must not force studio authority under gem cover");
}
if (/ringVideo/.test(manageBody)) {
  fail("manageOpening must not refer to a retired opening ringVideo");
}
if (!/pauseOpeningDecoder\s*\(\s*studioVideo\s*\)/.test(manageBody)) {
  fail("gem-cover must pauseOpeningDecoder(studioVideo)");
}
if (
  !/want\s*!==\s*["']studio["'][\s\S]*pauseOpeningDecoder\s*\(\s*studioVideo\s*\)[\s\S]*resetOpeningDecoderToStart\s*\(\s*studioVideo\s*\)/.test(
    manageBody
  )
) {
  fail("reverse cover authority must pause and reset the studio film to time zero");
}
const manageCoverAt = manageBody.search(/want\s*!==\s*["']studio["']/);
const manageHydrateAt = manageBody.search(/ensureVideoSource/);
if (manageCoverAt < 0 || manageHydrateAt < 0 || manageHydrateAt < manageCoverAt) {
  fail("manageOpening must not hydrate studioVideo under gem cover");
}
if (!/let\s+openingDecoderToken\s*=\s*0/.test(index)) {
  fail("openingDecoderToken must exist for causal stale-play rejection");
}
if (!/openingDecoderToken\s*\+=\s*1/.test(manageBody)) {
  fail("manageOpening must bump openingDecoderToken on transfer/leave");
}
const playOpenFn = index.match(
  /function\s+playOpeningDecoder\s*\(\s*video\s*,\s*token\s*,\s*startAt\s*\)\s*\{[\s\S]*?\n      \}/
);
if (!playOpenFn) fail("playOpeningDecoder(video, token, startAt) must be defined");
if (!/token\s*!==\s*openingDecoderToken/.test(playOpenFn[0])) {
  fail("playOpeningDecoder must reject stale tokens before marking is-live");
}
if (
  !/\.then\s*\(\s*function\s*\(\s*\)\s*\{[\s\S]*?token\s*!==\s*openingDecoderToken[\s\S]*?classList\.add\(\s*["']is-live["']\s*\)/m.test(
    playOpenFn[0]
  )
) {
  fail(
    "playOpeningDecoder must gate is-live add on token === openingDecoderToken after play resolves"
  );
}
if (
  !/openingDecoderAuthority\s*!==\s*want[\s\S]{0,200}openingDecoderToken\s*\+=\s*1[\s\S]{0,160}pauseOpeningDecoder\s*\(\s*studioVideo\s*\)/m.test(
    manageBody
  )
) {
  fail(
    "reverse/forward cover↔studio transfer must bump token and pause studio before the other authority resumes"
  );
}

if (/openingDecoderAuthority\s*=\s*["']both["']/.test(manageBody)) {
  fail("desktop manageOpening must not keep retired dual studio|ring 'both' authority");
}
if (!/want\s*!==\s*["']studio["']/.test(manageBody)) {
  fail("manageOpening must own the one studio opening film only under studio authority");
}
const resetFn = index.match(
  /function\s+resetOpeningDecoderToStart\s*\(\s*video\s*\)\s*\{[\s\S]*?\n      \}/
);
if (!resetFn) fail("resetOpeningDecoderToStart must be defined");
if (!/readyState\s*>=\s*1/.test(resetFn[0]) || !/currentTime\s*=\s*0/.test(resetFn[0])) {
  fail("cover reset must seek to time zero only when metadata permits");
}
if (!/openingVideos\.forEach/.test(manageBody)) {
  fail("manageOpening must still iterate the opening studio decoder set");
}

// Source reuse: ensureVideoSource hydrates; authority changes must not clear src.
if (/removeAttribute\(\s*["']src["']\s*\)/.test(manageBody)) {
  fail("manageOpening must not unload opening sources on authority/scroll changes");
}
if (/video\.load\s*\(\s*\)/.test(manageBody)) {
  fail("manageOpening must not reload opening sources on authority/scroll changes");
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
  !/handActive\s*=\s*mobile\s*\?\s*handNear\s*&&\s*openingRetired/.test(siteJs)
) {
  fail(
    "mobile handActive must require openingRetired so handVideo cannot arm under a live Opening stack"
  );
}
if (!/!\s*handRetired/.test(siteJs)) {
  fail("handActive must drop when Hand is retired so the decoder yields on genuine Work transfer");
}
if (/setVideoActive\s*\(\s*handVideo\s*,\s*[^)]*handP\s*[<>]=?\s*/.test(siteJs)) {
  fail("handVideo must not use an artificial handP cutoff; that exposes the static poster mid-Hand");
}
if (
  !/setVideoActive\s*\(\s*handVideo\s*,\s*handActive\s*,\s*["']handVideoArmed["']\s*\)/.test(
    siteJs
  )
) {
  fail("hand activity must call setVideoActive(handVideo, handActive, 'handVideoArmed')");
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
if (!/#workStack0\s*>\s*(img|video)[\s\S]{0,400}object-fit\s*:\s*cover/i.test(stylesMobile)) {
  fail("mobile first Work carrier must remain object-fit:cover");
}
if (new RegExp("id=\"" + "ve" + "gasVideo\"").test(index) || new RegExp("setVideoActive\\s*\\(\\s*" + "ve" + "gasVideo").test(siteJs)) {
  fail("retired night montage must not remain a work video authority");
}
if (!/id="workWorld0"[\s\S]{0,240}assets\/ring-pink-star\.webp/.test(index)) {
  fail("work-0 must be the terminal pink-star still");
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
// Opening→Hand and Hand→Work boundaries (terminal still after Hand retires).
if (!/function\s+retireBridgeLayer\s*\(/.test(siteJs)) {
  fail("retireBridgeLayer must exist for causal mobile bridge paint retirement");
}

console.log(
  "PASS: mobile media authority (exclusive cover|studio decoder after gemOutEnd on desktop and mobile; reverse cover resets studio; no opening ring decoder; no workBridge; no mobile hand-bridge paint/play; honest is-live retirement; Hand montage unchanged)"
);
