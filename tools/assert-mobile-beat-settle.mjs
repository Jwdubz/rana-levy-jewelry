#!/usr/bin/env node
/**
 * Source + math assertion: mobile one-gesture / one-adjacent-beat touch lock.
 *
 * Locks the owner correction that native touch momentum must never own
 * passage distance. While the controller is attached, html and body use
 * touch-action: pan-x pinch-zoom. Body keeps a standing overflow-y:hidden
 * lock so the document is not a native vertical scroller (HTML overflow
 * propagation: when root overflow-y stays visible, the viewport takes
 * body's overflow-y). Root overflow stays exactly its prior value so
 * sticky scenes keep the viewport containing block — root overflow-y
 * hidden|clip unpins them (1babfa5 probe: hand-0 y=2126, #handScene
 * top=-446 / black half-height viewport). Programmatic scrollTo still
 * authors beat movement. A continuous single-finger vertical gesture
 * that begins at authored rest N may finish only at N-1, N, or N+1:
 * - helper is homepage-only, gated to max-width 700px
 * - attached controller applies touch-action: pan-x pinch-zoom on html+body
 * - attached controller must not mutate root overflow/overflowY
 * - attached controller locks body overflow-y so native vertical overflow is unavailable
 * - programmatic settle still moves the document while that body lock is active
 * - detach restores the exact prior inline touch-action and overflow values
 * - quiet mode and desktop never leave that policy applied
 * - prefers-reduced-motion must still attach, lock body overflow, and own
 *   one-gesture adjacency; it may refuse idle settle animation only
 * - touchmove is non-passive; the vertical path calls preventDefault()
 * - completed net motion, not the first-axis latch, owns the lift
 * - a second contact retains the origin and cannot escape more than ±1 rest
 * - quiet mode cannot intercept touch; reduced-motion still must
 * - destinations invert OPENING_SPAN final rest, BEAT_DWELL plateaus, terminal
 * - runtime rests/targets are reachable whole CSS pixels (operational ranges)
 * - an exported adjacent-destination helper cannot emit more than ±1 rest
 * - tap/below-threshold stays put; links/buttons remain usable
 * - touch/pointer/wheel/keyboard/resize/pagehide/link/hash cancel immediately
 * - settle rAF cannot recursively schedule another settle
 * - no CSS section scroll-snap fallback
 *
 * Usage: node tools/assert-mobile-beat-settle.mjs
 *
 * Residue: mobile-beat-settle tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator editing homepage mobile touch lock / settle / remap
 * Activation: execute — node tools/assert-mobile-beat-settle.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when the mobile one-adjacent-beat touch-lock contract is retired or superseded
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n?/g, "\n");
}

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

const helper = read("mobile-beat-settle.js");
const index = read("index.html");
const siteJs = read("site.js");
const styles = read("styles.css");
const shellCss = read("shell.css");

function extractFn(src, name) {
  const re = new RegExp("function\\s+" + name + "\\s*\\(");
  const match = re.exec(src);
  if (!match) return "";
  let i = match.index;
  let brace = src.indexOf("{", i);
  if (brace < 0) return "";
  let depth = 0;
  for (let j = brace; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") {
      depth--;
      if (depth === 0) return src.slice(i, j + 1);
    }
  }
  return "";
}

// ——— Homepage wires the helper after the motion clock, never as a snap CSS ———
if (!/script src="site\.js"/.test(index)) fail("index.html must still load site.js");
if (!/script src="site\.js"><\/script>\s*<script src="mobile-beat-settle\.js"><\/script>/.test(index)) {
  fail("index.html must load mobile-beat-settle.js immediately after site.js");
}

const cssSurfaces = [index, styles, shellCss, helper];
cssSurfaces.forEach((src, i) => {
  if (/scroll-snap-(?:type|align|stop)/i.test(src)) {
    fail(`must not introduce CSS scroll-snap (${["index.html", "styles.css", "shell.css", "mobile-beat-settle.js"][i]})`);
  }
});
if (/scroll-snap-(?:type|align|stop)\s*:/.test(helper) || /style\.scrollSnap/.test(helper)) {
  fail("helper must not implement a CSS scroll-snap fallback");
}

// Desktop geometry contract is untouched by this helper.
if (/mobile-beat-settle/.test(styles) || /mobile-beat-settle/.test(siteJs)) {
  fail("beat settle must not rewrite styles.css or site.js");
}

// ——— Mobile-only gate ———
if (!/MOBILE_MAX_WIDTH\s*=\s*700/.test(helper)) {
  fail("helper must gate on MOBILE_MAX_WIDTH = 700");
}
if (!/max-width:\s*" \+ MOBILE_MAX_WIDTH/.test(helper) && !/max-width: 700px/.test(helper)) {
  fail("helper must query max-width through the 700px mobile gate");
}
if (!/function\s+isMobileViewport\s*\(/.test(helper)) {
  fail("helper must isolate the mobile viewport gate");
}
if (!/function\s+attach\s*\(/.test(helper) || !/function\s+detach\s*\(/.test(helper)) {
  fail("helper must attach only on mobile and detach above 700px");
}
if (!/onBreakpointChange/.test(helper)) {
  fail("helper must bind/unbind when crossing the 700px breakpoint");
}

const attachFn = extractFn(helper, "attach");
const detachFn = extractFn(helper, "detach");
const bootFn = extractFn(helper, "boot");
const maybeFn = extractFn(helper, "maybeSettle");
const startFn = extractFn(helper, "startSettle");
if (!attachFn) fail("could not isolate attach");
if (!detachFn) fail("could not isolate detach");
if (!maybeFn) fail("could not isolate maybeSettle");
if (!startFn) fail("could not isolate startSettle");
if (/scrollTo\(/.test(attachFn) || /scrollTo\(/.test(bootFn)) {
  fail("attach/boot must not hijack native scroll restoration or deep links");
}
if (!/armed = false/.test(attachFn)) {
  fail("attach must leave settle unarmed until a real user gesture");
}

// Quiet is an attach-killing native gate. Reduced-motion may refuse idle
// settle animation but must not detach or refuse one-gesture ownership.
if (!/function\s+quietModeActive\s*\(/.test(helper)) {
  fail("helper must honor explicit quiet mode");
}
if (!/motion"\) === "quiet"/.test(helper) && !/motion=== "quiet"/.test(helper)) {
  fail("quiet gate must read ?motion=quiet");
}
if (!/prefers-reduced-motion:\s*reduce/.test(helper)) {
  fail("helper must consult prefers-reduced-motion");
}
if (!/quietModeActive\(\)\s*\|\|\s*prefersReducedMotion\(\)/.test(maybeFn)) {
  fail("maybeSettle must refuse quiet mode and reduced-motion before scrolling");
}

const captureFn = extractFn(helper, "shouldCaptureTouch");
if (!captureFn) fail("could not isolate shouldCaptureTouch");
if (!/live\(\)/.test(captureFn) || !/quietModeActive\(\)/.test(captureFn)) {
  fail("shouldCaptureTouch must still require a live mobile homepage and refuse quiet mode");
}
if (/prefersReducedMotion\(\)/.test(captureFn)) {
  fail("shouldCaptureTouch must not refuse prefers-reduced-motion; reduce must not disable adjacency ownership");
}

const bpFn = extractFn(helper, "onBreakpointChange");
if (!bpFn) fail("could not isolate onBreakpointChange");
if (!/quietModeActive\(\)/.test(bpFn)) {
  fail("quiet mode must prevent touch intercept attach, not only post-momentum settle");
}
if (/prefersReducedMotion\(\)/.test(bpFn)) {
  fail("onBreakpointChange must not detach or refuse attach for prefers-reduced-motion");
}
if (!/isMobileViewport\(\)/.test(bpFn)) {
  fail("desktop above 700px must not attach the touch controller or alter touch-action");
}
if (!/else\s+detach\(\)/.test(bpFn) && !/else\s*\{\s*detach\(\)/.test(bpFn)) {
  fail("leaving the mobile normal-motion homepage must detach and restore prior touch-action");
}

// ——— Document touch-action policy: keep vertical travel off the compositor ———
const TOUCH_ACTION_POLICY = "pan-x pinch-zoom";
const applyTouchFn = extractFn(helper, "applyDocumentTouchAction");
const restoreTouchFn = extractFn(helper, "restoreDocumentTouchAction");
if (!applyTouchFn) fail("could not isolate applyDocumentTouchAction");
if (!restoreTouchFn) fail("could not isolate restoreDocumentTouchAction");
if (!/applyDocumentTouchAction\s*\(/.test(attachFn)) {
  fail("attach must apply the document touch-action policy before any visitor gesture");
}
if (!/restoreDocumentTouchAction\s*\(/.test(detachFn)) {
  fail("every detach path must restore the exact prior inline touch-action values");
}
const applyAt = attachFn.indexOf("applyDocumentTouchAction");
const listenAt = attachFn.indexOf("addEventListener");
if (applyAt < 0 || listenAt < 0 || applyAt > listenAt) {
  fail("touch-action policy must be applied before listeners so it is in effect before any visitor gesture");
}
if (!/isMobileViewport\(\)/.test(attachFn) || !/quietModeActive\(\)/.test(attachFn)) {
  fail("attach must refuse desktop and quiet so they never alter touch-action");
}
if (/prefersReducedMotion\(\)/.test(attachFn)) {
  fail("attach must not refuse prefers-reduced-motion; OS reduce must not disable adjacency ownership");
}
if (!/TOUCH_ACTION_POLICY\s*=\s*"pan-x pinch-zoom"/.test(helper)) {
  fail("TOUCH_ACTION_POLICY must be exactly pan-x pinch-zoom");
}
if (!/style\.touchAction\s*=\s*TOUCH_ACTION_POLICY/.test(applyTouchFn)) {
  fail("apply must assign the exact pan-x pinch-zoom policy to style.touchAction");
}
if (!/documentElement/.test(applyTouchFn) || !/\.body\b/.test(applyTouchFn)) {
  fail("touch-action policy must target both documentElement and body");
}
if (!/style\.touchAction/.test(applyTouchFn) || !/style\.touchAction/.test(restoreTouchFn)) {
  fail("policy must snapshot and restore via each element's style.touchAction");
}
const firstTouchRead = applyTouchFn.indexOf("style.touchAction");
const policyAssign = applyTouchFn.search(/style\.touchAction\s*=\s*TOUCH_ACTION_POLICY/);
if (firstTouchRead < 0 || policyAssign < 0 || firstTouchRead > policyAssign) {
  fail("must snapshot each prior inline touch-action before applying the policy");
}
if ((applyTouchFn.match(/style\.touchAction/g) || []).length < 4) {
  fail("must snapshot and assign style.touchAction on both documentElement and body");
}
if ((restoreTouchFn.match(/style\.touchAction/g) || []).length < 2) {
  fail("detach must restore style.touchAction on both documentElement and body");
}
if (/touch-action\s*:\s*none\b/.test(helper) || /touchAction\s*=\s*["']none["']/.test(helper)) {
  fail("must not use touch-action:none");
}
if (/touch-action\s*:\s*pan-y\b/.test(helper) || /touchAction\s*=\s*["']pan-y["']/.test(helper)) {
  fail("must not use touch-action:pan-y; vertical document travel is controller-owned");
}
if (/overflow\s*=\s*["']hidden["']/.test(attachFn)) {
  fail("attach must not set overflow directly; the lock helper owns snapshot/restore");
}
if (/preventDefault\s*\(/.test(attachFn) || /preventDefault\s*\(/.test(applyTouchFn)) {
  fail("touch-action policy must not preventDefault on attach");
}

function extractIfStyleBlock(src, name) {
  const re = new RegExp("if\\s*\\(\\s*" + name + "\\s*&&\\s*" + name + "\\.style\\s*\\)\\s*\\{");
  const match = re.exec(src);
  if (!match) return "";
  let depth = 0;
  const start = src.indexOf("{", match.index);
  if (start < 0) return "";
  for (let j = start; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") {
      depth--;
      if (depth === 0) return src.slice(start, j + 1);
    }
  }
  return "";
}

const applyRootStyleBlock = extractIfStyleBlock(applyTouchFn, "root");
const applyBodyStyleBlock = extractIfStyleBlock(applyTouchFn, "body");
if (!applyRootStyleBlock) fail("apply must still target documentElement for touch-action");
if (!applyBodyStyleBlock) fail("apply must still target body for touch-action and the vertical lock");
if (/overflowY\s*=/.test(applyRootStyleBlock) || /overflow\s*=/.test(applyRootStyleBlock)) {
  fail(
    "apply must not assign overflow or overflowY on documentElement; root overflow-y hidden|clip unpins sticky full-viewport scenes (1babfa5 probe: hand-0 y=2126, #handScene top=-446)"
  );
}
if (!/style\.overflowY\s*=\s*(?:VERTICAL_OVERFLOW_LOCK|["']hidden["']|["']clip["'])/.test(applyBodyStyleBlock)) {
  fail("apply must assign overflowY hidden|clip on body as the standing native vertical lock");
}
if ((applyTouchFn.match(/style\.overflowY\s*=\s*(?:VERTICAL_OVERFLOW_LOCK|["']hidden["']|["']clip["'])/g) || []).length !== 1) {
  fail("overflowY lock must be assigned once, on body only");
}
const lockPredFn = extractFn(helper, "isNativeVerticalDocumentScrollLocked");
if (!lockPredFn) fail("could not isolate isNativeVerticalDocumentScrollLocked");
if (/nativeVerticalOverflowLocked\(\s*root/.test(lockPredFn)) {
  fail("isNativeVerticalDocumentScrollLocked must not require root overflow; root hidden|clip unpins sticky scenes");
}
if (!/nativeVerticalOverflowLocked\(\s*body/.test(lockPredFn)) {
  fail("isNativeVerticalDocumentScrollLocked must follow the body overflow lock");
}

const touchStartFn = extractFn(helper, "onTouchStart");
const touchMoveFn = extractFn(helper, "onTouchMove");
const touchEndFn = extractFn(helper, "onTouchEnd");
const touchCancelFn = extractFn(helper, "onTouchCancel");
if (!touchStartFn) fail("could not isolate onTouchStart");
if (!touchMoveFn) fail("could not isolate onTouchMove");
if (!touchEndFn) fail("could not isolate onTouchEnd");
if (!touchCancelFn) fail("could not isolate onTouchCancel");

const touchMoveBinds = [...helper.matchAll(/addEventListener\(\s*"touchmove"\s*,\s*([^,]+)\s*,\s*(\{[^}]*\})/g)];
if (!touchMoveBinds.length) fail("touchmove must be registered with an options object");
if (!touchMoveBinds.some((m) => /passive:\s*false/.test(m[2]))) {
  fail("touchmove must be registered non-passive so preventDefault can cancel native fling");
}
if (touchMoveBinds.some((m) => /passive:\s*true/.test(m[2]))) {
  fail("touchmove must not be registered passively; native momentum must not own passage");
}

if (!/preventDefault\s*\(/.test(touchMoveFn)) {
  fail("the vertical gesture path must call preventDefault()");
}
const touchMoveGate = touchMoveFn.search(/shouldCaptureTouch\(|quietModeActive\(|prefersReducedMotion\(/);
const touchMovePrevent = touchMoveFn.indexOf("preventDefault");
if (touchMoveGate < 0 || touchMovePrevent < 0 || touchMoveGate > touchMovePrevent) {
  fail("quiet paths must refuse intercept before preventDefault");
}
if (!/classifyTouchIntent|vertical/.test(touchMoveFn)) {
  fail("touchmove must distinguish vertical intent before locking native scroll");
}
if (/preventDefault\s*\(/.test(touchStartFn)) {
  fail("touchstart must not preventDefault; taps and links must stay native");
}
if (!/shouldCaptureTouch\(|quietModeActive\(/.test(touchStartFn)) {
  fail("touchstart must not snapshot or lock when quiet");
}

// No new visitor-facing chrome.
if (/class(List)?\.(add|toggle)\([^)]*(progress|pagination|dot|indicator|hint)/i.test(helper)) {
  fail("helper must not add visible progress/pagination chrome");
}
if (/createElement\(["'](div|nav|ol|ul|button)["']\)/.test(helper) && /appendChild/.test(helper)) {
  if (!/height:100svh/.test(helper)) {
    fail("helper must not inject visible settle chrome");
  }
}
if (/\bpagination\b|\bdot-nav\b|\bpage-indicator\b|\bscroll-hint\b/.test(helper)) {
  fail("helper must not add visible settle controls");
}

// ——— Targets derive from existing motion anchors, not a parallel timeline ———
if (!/window\.BEAT_DWELL/.test(helper)) {
  fail("collectRests must read live BEAT_DWELL anchors");
}
if (!/window\.OPENING_SPAN/.test(helper)) {
  fail("collectRests must read live OPENING_SPAN for the opening headline rest");
}
if (!/deriveOpeningHeadlinePhysical/.test(helper)) {
  fail("opening headline rest must be derived from OPENING_SPAN");
}
if (!/headlineChoreography/.test(helper)) {
  fail("collectRests must read live OPENING_SPAN.headlineChoreography");
}
if (!/id:\s*"opening-headline"/.test(helper) && !/"opening-headline"/.test(helper)) {
  fail("opening headline rest must be a named destination");
}
if (!/headlineChoreography:\s*0\.55/.test(index)) {
  fail("OPENING_SPAN must expose the mobile headline choreography anchor 0.55");
}
if (/id:\s*"opening-final"/.test(helper) && /collectRests[\s\S]*opening-final/.test(helper)) {
  const collectOnly = helper.slice(helper.indexOf("function collectRests"));
  if (/id:\s*"opening-final"/.test(collectOnly) || /"opening-final"/.test(collectOnly)) {
    fail("collectRests must not name opening-final as a swipe destination");
  }
}
if (!/plateauPhysicalRange/.test(helper)) {
  fail("Hand/Work rests must invert remapBeatProgress plateaus");
}
if (/\[[^\]]*0\.28[^\]]*0\.86/.test(helper) || /\[[^\]]*0\.28[^\]]*0\.55[^\]]*0\.88/.test(helper)) {
  fail("helper must not hardcode BEAT_DWELL anchors; derive them");
}

const siteRemap = extractFn(siteJs, "remapBeatProgress");
if (!siteRemap) fail("could not isolate site.js remapBeatProgress");
if (!/plateauPx\s*=\s*\(\s*holdSvh\s*\/\s*100\s*\)\s*\*\s*authoredSvhPx\s*\(\s*\)/.test(siteRemap)) {
  fail("settle invert must stay aligned with authored-svh remapBeatProgress");
}

// ——— Cancellation + reentrancy ———
["touchstart", "touchmove", "pointerdown", "pointermove", "wheel", "keydown", "resize", "pagehide", "hashchange", "popstate"].forEach(
  (name) => {
    if (!new RegExp('addEventListener\\("' + name + '"').test(helper)) {
      fail(`helper must listen for ${name} so a new gesture can cancel`);
    }
  }
);
if (!/addEventListener\("click", onActivate, true\)/.test(helper)) {
  fail("link/button interaction must cancel in capture");
}
const pointerMoveFn = extractFn(helper, "onPointerMove");
if (!pointerMoveFn || !/fingerDown/.test(pointerMoveFn) || !/buttons/.test(pointerMoveFn)) {
  fail("pointermove must ignore leftover hover/compat events or it can cancel the idle settle");
}

const cancelFn = extractFn(helper, "cancelSettle");
const finishFn = extractFn(helper, "finishSettle");
const scrollFn = extractFn(helper, "onScroll");
if (!cancelFn) fail("could not isolate cancelSettle");
if (!finishFn) fail("could not isolate finishSettle");
if (!scrollFn) fail("could not isolate onScroll");
if (!/settleGen\s*\+=\s*1/.test(cancelFn)) {
  fail("cancelSettle must invalidate any in-flight rAF generation");
}
if (/maybeSettle|scheduleIdle/.test(finishFn)) {
  fail("finishSettle must not recursively schedule another settle");
}
if (!/if\s*\(\s*!live\(\)\s*\|\|\s*settling\s*\)\s*return/.test(scrollFn)) {
  fail("onScroll must ignore the settle's own scrollTo events");
}
if (/sawContact/.test(scrollFn) && /armed = true/.test(scrollFn)) {
  fail("onScroll must not arm post-momentum settle from a touch contact");
}
if (!/cancelSettle/.test(touchStartFn)) {
  fail("a new touchstart must cancel any in-flight settle");
}
if (!/restIndexForY/.test(touchStartFn)) {
  fail("touchstart must snapshot the current or nearest authored rest as the gesture origin");
}
if (/scheduleIdle/.test(touchEndFn)) {
  fail("touchend must not queue post-momentum idle settle");
}
if (!/chooseAdjacentDestination/.test(touchEndFn)) {
  fail("touchend must choose an adjacent authored rest immediately");
}
if (!/startSettle/.test(touchEndFn)) {
  fail("a qualifying swipe must animate exactly once on lift");
}
if (/startSettle/.test(touchCancelFn) || /scheduleIdle/.test(touchCancelFn)) {
  fail("touchcancel must not queue a second movement");
}
if (!/cancelSettle/.test(touchCancelFn)) {
  fail("touchcancel must cancel any in-flight settle");
}
const pointerUpFn = extractFn(helper, "onPointerUp");
if (pointerUpFn && /scheduleIdle/.test(pointerUpFn)) {
  fail("pointerup must not queue a second settle after touch lift");
}
if (!/settling = true/.test(startFn) || !/requestAnimationFrame\(step\)/.test(startFn)) {
  fail("settle must be a cancellable rAF ease, not a native page snap");
}
if (/behavior:\s*["']smooth["']/.test(helper)) {
  fail("must not use native behavior:smooth (not immediately cancellable)");
}

const chooseFn = extractFn(helper, "chooseBeatDestination");
if (!chooseFn) fail("could not isolate chooseBeatDestination");
if (/start\s*-\s*near/.test(chooseFn) || /end\s*\+\s*near/.test(chooseFn)) {
  fail("chooseBeatDestination must use the exact operational start..end, not the near zone");
}
if (!/y\s*>=\s*rest\.start\s*&&\s*y\s*<=\s*rest\.end/.test(chooseFn)) {
  fail("already-inside must be the exact inclusive operational rest range");
}
if (!/operationalRests\s*\(\s*rests\s*\)/.test(chooseFn)) {
  fail("chooseBeatDestination must classify against reachable operational rests");
}
if (/if\s*\(\s*dist\s*<=\s*NEAR_PX\s*\)\s*return\s*;/.test(startFn)) {
  fail("tiny-distance optimization must not suppress the final alignment");
}
if (!/dist\s*<=\s*NEAR_PX/.test(startFn) || !/scrollTo\(\s*0\s*,\s*targetY\s*\)/.test(startFn)) {
  fail("tiny distances must still finish at the exact operational boundary");
}
if (/Math\.abs\(\s*target\s*-\s*y\s*\)\s*<=\s*NEAR_PX/.test(maybeFn)) {
  fail("maybeSettle must not treat a near-zone gap as already settled");
}

const collectFn = extractFn(helper, "collectRests");
if (!collectFn) fail("could not isolate collectRests");
if (!/opening-start[\s\S]*opening-headline[\s\S]*hand-/.test(collectFn)) {
  fail("collectRests must insert opening-headline between opening-start and the first Hand rest");
}
if (/id:\s*"opening-final"/.test(collectFn) || /"opening-final"/.test(collectFn)) {
  fail("collectRests must not collect opening-final");
}
if (/id:\s*"work-terminal"/.test(collectFn)) {
  fail("collectRests must not keep a duplicate work-terminal rest");
}
if (!/operationalRests\(\s*mergeRests\(\s*rests\s*,\s*NEAR_PX\s*\)\s*,\s*maxY\s*\)/.test(collectFn)) {
  fail("collectRests must operationalize after merge so runtime rests stay reachable");
}
if (!/function\s+operationalRest\s*\(/.test(helper) || !/Math\.ceil\(\s*rest\.start\s*\)/.test(helper) || !/Math\.floor\(\s*rest\.end\s*\)/.test(helper)) {
  fail("operationalRest must take first/last reachable integers inside an authored plateau");
}
if (!/Math\.round\(\s*\(\s*rest\.start\s*\+\s*rest\.end\s*\)\s*\/\s*2\s*\)/.test(helper)) {
  fail("a span with no reachable integer must become one nearest reachable point");
}
if (!/function\s+lastReachableScrollY\s*\(/.test(helper)) {
  fail("lastReachableScrollY must remain so the last rest can reach max-scroll");
}

// ——— Executable math: inverse plateaus + forward/reverse choice ———
let settle;
try {
  settle = require(path.join(root, "mobile-beat-settle.js"));
} catch (err) {
  fail("mobile-beat-settle.js must load in Node for the math contract: " + err.message);
}

if (!settle || typeof settle.chooseBeatDestination !== "function") {
  fail("helper must export chooseBeatDestination");
}
if (typeof settle.chooseAdjacentDestination !== "function") {
  fail("helper must export chooseAdjacentDestination");
}
if (typeof settle.restIndexForY !== "function") {
  fail("helper must export restIndexForY");
}
if (typeof settle.classifyTouchIntent !== "function") {
  fail("helper must export classifyTouchIntent");
}
if (settle.MOBILE_MAX_WIDTH !== 700) fail("exported mobile gate must be 700");
if (!(settle.SWIPE_THRESHOLD_PX > 0)) fail("SWIPE_THRESHOLD_PX must be a positive deliberate threshold");

const adjFn = extractFn(helper, "chooseAdjacentDestination");
if (!adjFn) fail("could not isolate chooseAdjacentDestination");
if (!/operationalRests\s*\(\s*rests\s*\)/.test(adjFn)) {
  fail("chooseAdjacentDestination must classify against reachable operational rests");
}

function remapBeatProgress(physicalProgress, totalTravel, holdSvh, svhPx, anchors) {
  const p = Math.max(0, Math.min(1, physicalProgress));
  if (!anchors || !anchors.length) return p;
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const travel = Math.max(1, totalTravel);
  const plateauPx = (holdSvh / 100) * svhPx;
  const choreographyTravel = Math.max(1, travel - anchors.length * plateauPx);
  let remaining = p * travel;
  let prev = 0;
  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i];
    const segPx = (anchor - prev) * choreographyTravel;
    if (remaining <= segPx + 1e-9) {
      if (segPx <= 1e-9) return anchor;
      return prev + (remaining / segPx) * (anchor - prev);
    }
    remaining -= segPx;
    if (remaining <= plateauPx + 1e-9) return anchor;
    remaining -= plateauPx;
    prev = anchor;
  }
  const last = anchors[anchors.length - 1];
  const finalPx = (1 - last) * choreographyTravel;
  if (finalPx <= 1e-9) return 1;
  return Math.max(0, Math.min(1, last + (remaining / finalPx) * (1 - last)));
}

const beatBlock = siteJs.match(
  /const\s+BEAT_DWELL\s*=\s*\{[\s\S]*?hand:\s*(\[[^\]]+\])[\s\S]*?work:\s*(\[[^\]]+\])/
);
if (!beatBlock) fail("could not read live BEAT_DWELL anchors from site.js");
const handAnchors = JSON.parse(beatBlock[1]);
const workAnchors = JSON.parse(beatBlock[2]);
if (!handAnchors.length || !workAnchors.length) fail("BEAT_DWELL anchors must not be empty");
const holdMatch = siteJs.match(/holdSvh:\s*(\d+(?:\.\d+)?)/);
const holdSvh = holdMatch ? Number(holdMatch[1]) : NaN;
if (!(holdSvh > 0)) fail("BEAT_DWELL.holdSvh must remain a positive authored svh hold");
const svhPx = 667;
const handTravel = (240 / 100) * svhPx;
const workTravel = (350 / 100) * svhPx;

handAnchors.forEach((anchor, index) => {
  const range = settle.plateauPhysicalRange(handTravel, holdSvh, svhPx, handAnchors, index);
  if (!range) fail("missing Hand plateau range " + index);
  const mid = (range.startP + range.endP) / 2;
  const held = remapBeatProgress(mid, handTravel, holdSvh, svhPx, handAnchors);
  if (Math.abs(held - anchor) > 1e-6) {
    fail(`Hand plateau ${index} does not invert remapBeatProgress (got ${held}, want ${anchor})`);
  }
  const atStart = remapBeatProgress(range.startP, handTravel, holdSvh, svhPx, handAnchors);
  if (Math.abs(atStart - anchor) > 1e-6) {
    fail(`Hand plateau ${index} start is not the fully composed anchor`);
  }
});

workAnchors.forEach((anchor, index) => {
  const range = settle.plateauPhysicalRange(workTravel, holdSvh, svhPx, workAnchors, index);
  if (!range) fail("missing Work plateau range " + index);
  const mid = (range.startP + range.endP) / 2;
  const held = remapBeatProgress(mid, workTravel, holdSvh, svhPx, workAnchors);
  if (Math.abs(held - anchor) > 1e-6) {
    fail(`Work plateau ${index} does not invert remapBeatProgress (got ${held}, want ${anchor})`);
  }
});

const openingFinal = settle.deriveOpeningFinalPhysical({
  choreographySvh: 180,
  terminalHoldSvh: 60,
  choreographyEnd: 180 / 240
});
if (!openingFinal || Math.abs(openingFinal.startP - 0.75) > 1e-9) {
  fail("opening final rest must start at OPENING_SPAN.choreographyEnd (180/240)");
}
if (typeof settle.deriveOpeningHeadlinePhysical !== "function") {
  fail("helper must export deriveOpeningHeadlinePhysical");
}
const openingHeadline = settle.deriveOpeningHeadlinePhysical({
  choreographySvh: 180,
  terminalHoldSvh: 60,
  choreographyEnd: 180 / 240,
  headlineChoreography: 0.55
});
if (!openingHeadline || openingHeadline.startP !== openingHeadline.endP) {
  fail("opening headline rest must be a stable composed point inverted from OPENING_SPAN");
}
if (Math.abs(openingHeadline.startP - 0.55 * 0.75) > 1e-9) {
  fail("opening headline rest must invert OPENING_SPAN.headlineChoreography through choreographyEnd");
}
if (!(openingHeadline.startP > 0) || !(openingHeadline.startP < openingFinal.startP)) {
  fail("opening headline rest must lie strictly between opening start and opening final");
}
if (!(openingFinal.endP > openingFinal.startP) || openingFinal.endP >= 1) {
  fail("opening final rest must occupy the terminal hold without sitting on the Hand pin");
}

const rests = [
  { id: "opening-start", start: 0, end: 0 },
  { id: "opening-final", start: 1000, end: 1400 },
  { id: "hand-0", start: 2000, end: 2400 },
  { id: "hand-1", start: 3000, end: 3400 },
  { id: "work-0", start: 4000, end: 4400 },
  { id: "work-terminal", start: 5200, end: 5200 }
];

function choose(y, dir) {
  return settle.chooseBeatDestination(y, dir, rests);
}

if (choose(1200, 1) !== null) fail("already-inside a rest must not resettle");
if (choose(1200, -1) !== null) fail("already-inside a rest must not resettle in reverse");
if (choose(1000, 1) !== null) fail("exact rest start must count as already inside");
if (choose(1400, -1) !== null) fail("exact rest end must count as already inside");
if (choose(1001, 1) !== null) fail("1px inside a rest start must stay put");
if (choose(1399, -1) !== null) fail("1px inside a rest end must stay put");
if (choose(0, 1) !== null) fail("exact point rest must count as already inside");
if (choose(5200, -1) !== null) fail("exact terminal point rest must count as already inside");

const nearPx = settle.NEAR_PX;
if (!(nearPx > 0)) fail("NEAR_PX must remain a positive near-zone width");

function expectChoose(y, dir, expected, msg) {
  const got = choose(y, dir);
  if (got !== expected) fail(msg + " (y=" + y + " dir=" + dir + " got " + got + ", want " + expected + ")");
}

for (const gap of [1, 5, nearPx]) {
  expectChoose(1400 + gap, 1, 1400, gap + "px past a rest end must settle to that end going forward");
  expectChoose(1400 + gap, -1, 1400, gap + "px past a rest end must settle to that end in reverse");
  expectChoose(1000 - gap, 1, 1000, gap + "px before a rest start must settle to that start going forward");
  expectChoose(1000 - gap, -1, 1000, gap + "px before a rest start must settle to that start in reverse");
  expectChoose(gap, 1, 0, gap + "px past a point rest must settle onto it going forward");
  expectChoose(gap, -1, 0, gap + "px past a point rest must settle onto it in reverse");
  expectChoose(5200 + gap, 1, 5200, gap + "px past the terminal must settle onto it going forward");
  expectChoose(5200 - gap, 1, 5200, gap + "px before the terminal must settle onto it going forward");
  expectChoose(5200 - gap, -1, 5200, gap + "px before the terminal must settle onto it in reverse");
}

if (choose(1600, 1) !== 2000) {
  fail("forward idle between rests must choose the next rest start (got " + choose(1600, 1) + ")");
}
if (choose(1600, -1) !== 1400) {
  fail("reverse idle between rests must choose the previous rest end (got " + choose(1600, -1) + ")");
}

if (choose(1424, 1) !== 1400) {
  fail("tiny forward overshoot must snap back into the rest just left");
}
if (choose(1976, -1) !== 2000) {
  fail("tiny reverse overshoot must snap back into the rest just left");
}

if (choose(1800, 1) !== 2000) {
  fail("committed forward travel must continue to the next authored rest");
}
if (choose(1800, -1) !== 1400) {
  fail("committed reverse travel must continue to the previous authored rest");
}

const weakForward = choose(80, 1);
if (weakForward !== 0) {
  fail("bounded nearest must not launch across a long opening gap from a weak forward nudge (got " + weakForward + ")");
}
const committedOpening = choose(500, 1);
if (committedOpening !== 1000) {
  fail("a committed forward move through Opening must settle to the opening final rest");
}

if (choose(4800, 1) !== 5200) {
  fail("forward past the last Work plateau must choose the terminal rest");
}
if (choose(4800, -1) !== 4400) {
  fail("reverse from the terminal approach must return to the last Work rest");
}

if (typeof settle.operationalRest !== "function" || typeof settle.operationalRests !== "function") {
  fail("helper must export operationalRest / operationalRests");
}
if (typeof settle.lastReachableScrollY !== "function") {
  fail("helper must export lastReachableScrollY");
}
if (settle.lastReachableScrollY(6740) !== 6740) {
  fail("integer max-scroll must stay reachable");
}
if (settle.lastReachableScrollY(6739.59375) !== 6739) {
  fail("last reachable pixel must be the last integer inside max-scroll");
}
if (settle.lastReachableScrollY(0) !== 0) {
  fail("empty document max-scroll must stay at 0");
}

function expectOperational(rest, start, end, msg) {
  const got = settle.operationalRest(rest);
  if (got.start !== start || got.end !== end) {
    fail(msg + " (got " + got.start + ".." + got.end + ", want " + start + ".." + end + ")");
  }
  if (!Number.isInteger(got.start) || !Number.isInteger(got.end)) {
    fail(msg + " must return reachable integers");
  }
}

expectOperational({ id: "work-1", start: 4434.5, end: 4854.5 }, 4435, 4854, ".5-end plateau must shrink to first/last integer inside");
expectOperational({ id: "work-0", start: 4917.23, end: 5476.42575 }, 4918, 5476, ".23-start plateau must shrink to first/last integer inside");
expectOperational({ id: "work-terminal", start: 6739.59375, end: 6739.59375 }, 6740, 6740, "375 fractional terminal must become the nearest reachable point");
expectOperational({ id: "work-terminal", start: 7735.59375, end: 7735.59375 }, 7736, 7736, "430 fractional terminal must become the nearest reachable point");
expectOperational({ id: "opening-final", start: 1000, end: 1400 }, 1000, 1400, "integer plateau must stay exact");
expectOperational({ id: "opening-start", start: 0, end: 0 }, 0, 0, "integer point rest must stay exact");

const once = settle.operationalRest({ id: "work-1", start: 4434.5, end: 4854.5 });
const twice = settle.operationalRest(once);
if (twice.start !== once.start || twice.end !== once.end) {
  fail("operationalRest must be idempotent");
}

const mergedAuthored = settle.mergeRests(
  [
    { id: "a", start: 100.4, end: 200.6 },
    { id: "b", start: 208.2, end: 300.8 }
  ],
  nearPx
);
if (mergedAuthored.length !== 1 || mergedAuthored[0].start !== 100.4 || mergedAuthored[0].end !== 300.8) {
  fail("merge must still use authored distances before operationalize");
}
expectOperational(mergedAuthored[0], 101, 300, "merged authored range then operationalizes inward");

const unmerged = settle.mergeRests(
  [
    { id: "a", start: 100, end: 200 },
    { id: "b", start: 213, end: 300 }
  ],
  nearPx
);
if (unmerged.length !== 2) fail("authored gaps wider than NEAR_PX must stay unmerged");

const termSnapped = settle.operationalRests(
  [
    { id: "work-2", start: 6086.74575, end: 6573.94575 },
    { id: "work-terminal", start: 6739.59375, end: 6739.59375 }
  ],
  6740
);
if (termSnapped[1].start !== 6740 || termSnapped[1].end !== 6740) {
  fail("Work terminal must map to the reachable max-scroll endpoint");
}
if (termSnapped[0].start !== 6087 || termSnapped[0].end !== 6573) {
  fail("Work plateau next to the terminal must still operationalize inward");
}

const fracRests = [
  { id: "opening-start", start: 0, end: 0 },
  { id: "work-1", start: 4434.5, end: 4854.5 },
  { id: "work-0", start: 4917.23, end: 5476.42575 },
  { id: "work-terminal", start: 6739.59375, end: 6739.59375 }
];

function chooseFrac(y, dir) {
  return settle.chooseBeatDestination(y, dir, fracRests);
}

function restContaining(y, rests) {
  return rests.find((rest) => y >= rest.start && y <= rest.end) || null;
}

const fracOperational = settle.operationalRests(fracRests);
fracOperational.forEach((rest) => {
  if (!Number.isInteger(rest.start) || !Number.isInteger(rest.end)) {
    fail("operational rests must be reachable integers (" + rest.id + ")");
  }
});

if (chooseFrac(4854, 1) !== null) fail("last reachable pixel of a .5-end rest must count as inside");
if (chooseFrac(4435, -1) !== null) fail("first reachable pixel of a .5-end rest must count as inside");
if (chooseFrac(4918, 1) !== null) fail("first reachable pixel of a .23-start rest must count as inside");
if (chooseFrac(6740, -1) !== null) fail("nearest reachable terminal pixel must count as inside");

if (chooseFrac(4854.5, 1) !== 4854) {
  fail("authored .5 end is not reachable; settle must aim at the last integer inside (got " + chooseFrac(4854.5, 1) + ")");
}
if (chooseFrac(4917.23, 1) !== 4918) {
  fail("authored .23 start is not reachable; settle must aim at the first integer inside (got " + chooseFrac(4917.23, 1) + ")");
}
if (chooseFrac(6739.59375, 1) !== 6740) {
  fail("authored fractional terminal is not reachable; settle must aim at the nearest pixel (got " + chooseFrac(6739.59375, 1) + ")");
}

for (const gap of [1, 5, nearPx]) {
  const pastEnd = chooseFrac(4854 + gap, 1);
  if (pastEnd !== 4854) fail(gap + "px past a .5 operational end must settle to that end (got " + pastEnd + ")");
  const pastEndRev = chooseFrac(4854 + gap, -1);
  if (pastEndRev !== 4854) fail(gap + "px past a .5 operational end must settle to that end in reverse (got " + pastEndRev + ")");
  const beforeStart = chooseFrac(4435 - gap, 1);
  if (beforeStart !== 4435) fail(gap + "px before a .5 operational start must settle to that start (got " + beforeStart + ")");
  const beforeStartRev = chooseFrac(4435 - gap, -1);
  if (beforeStartRev !== 4435) fail(gap + "px before a .5 operational start must settle to that start in reverse (got " + beforeStartRev + ")");
  const beforeDot23 = chooseFrac(4918 - gap, 1);
  if (beforeDot23 !== 4918) fail(gap + "px before a .23 operational start must settle to that start (got " + beforeDot23 + ")");
  const beforeDot23Rev = chooseFrac(4918 - gap, -1);
  if (beforeDot23Rev !== 4918) fail(gap + "px before a .23 operational start must settle to that start in reverse (got " + beforeDot23Rev + ")");
  const beforeTerm = chooseFrac(6740 - gap, 1);
  if (beforeTerm !== 6740) fail(gap + "px before the fractional terminal must settle onto it (got " + beforeTerm + ")");
  const pastTerm = chooseFrac(6740 + gap, 1);
  if (pastTerm !== 6740) fail(gap + "px past the fractional terminal must settle onto it (got " + pastTerm + ")");
}

const consumerCases = [
  {
    label: "320 work-1 .5 end",
    rests: [{ id: "work-1", start: 4434.5, end: 4854.5 }],
    observedY: 4855,
    wantTarget: 4854
  },
  {
    label: "430 work-0 .23 start",
    rests: [{ id: "work-0", start: 4917.23, end: 5476.42575 }],
    observedY: 4917,
    wantTarget: 4918
  },
  {
    label: "375 fractional terminal",
    rests: [{ id: "work-terminal", start: 6739.59375, end: 6739.59375 }],
    observedY: 6740,
    wantTarget: null
  },
  {
    label: "430 fractional terminal",
    rests: [{ id: "work-terminal", start: 7735.59375, end: 7735.59375 }],
    observedY: 7736,
    wantTarget: null
  }
];

consumerCases.forEach((item) => {
  const operational = settle.operationalRests(item.rests);
  const target = settle.chooseBeatDestination(item.observedY, 1, item.rests);
  if (target !== item.wantTarget) {
    fail(item.label + " choose must return " + item.wantTarget + " (got " + target + ")");
  }
  const finalY = target == null ? item.observedY : target;
  if (!Number.isInteger(finalY)) fail(item.label + " final y must be a reachable integer");
  if (!restContaining(finalY, operational)) {
    fail(item.label + " final y " + finalY + " must lie inside the exact operational rest");
  }
});

[
  0,
  4434.5,
  4435,
  4854,
  4854.5,
  4855,
  4917,
  4917.23,
  4918,
  5476,
  6739.59375,
  6740,
  5000
].forEach((y) => {
  const target = chooseFrac(y, 1);
  if (target != null && !Number.isInteger(target)) {
    fail("chooseBeatDestination must return a reachable integer (y=" + y + " got " + target + ")");
  }
  if (target != null && !restContaining(target, fracOperational)) {
    fail("chosen y " + target + " must lie inside an exact operational rest");
  }
});

const threshold = settle.SWIPE_THRESHOLD_PX;
if (settle.classifyTouchIntent(0, 0, threshold) !== null) {
  fail("zero movement must stay a tap, not a swipe");
}
if (settle.classifyTouchIntent(3, threshold - 1, threshold) !== null) {
  fail("below-threshold travel must stay a tap");
}
if (settle.classifyTouchIntent(0, threshold, threshold) !== "vertical") {
  fail("threshold vertical travel must be a vertical swipe");
}
if (settle.classifyTouchIntent(threshold + 8, 4, threshold) !== "horizontal") {
  fail("horizontal-dominant travel must not lock the vertical passage");
}
if (settle.classifyTouchIntent(threshold, threshold, threshold) !== "vertical") {
  fail("equal-axis travel at threshold must prefer the vertical passage axis");
}

function adjacent(origin, dy) {
  return settle.chooseAdjacentDestination(origin, dy, rests);
}

function expectAdjacent(origin, dy, wantIndex, wantY, msg) {
  const got = adjacent(origin, dy);
  if (!got || got.index !== wantIndex || got.y !== wantY) {
    fail(
      msg +
        " (origin=" +
        origin +
        " dy=" +
        dy +
        " got " +
        JSON.stringify(got) +
        ", want {index:" +
        wantIndex +
        ", y:" +
        wantY +
        "})"
    );
  }
}

if (typeof settle.restAimY !== "function") {
  fail("helper must export restAimY so adjacent landings aim at composed plateau centers");
}

function aimY(rest) {
  return settle.restAimY(settle.operationalRest(rest));
}

expectAdjacent(0, 0, 0, null, "a tap must stay at the origin rest");
expectAdjacent(2, threshold - 1, 2, null, "below-threshold upward travel must stay put");
expectAdjacent(2, -(threshold - 1), 2, null, "below-threshold downward finger travel must stay put");
expectAdjacent(0, -threshold, 1, aimY(rests[1]), "forward must target the immediate next composed rest center");
expectAdjacent(1, -50, 2, aimY(rests[2]), "forward from opening-final must choose the hand-0 composed center");
expectAdjacent(2, 50, 1, aimY(rests[1]), "reverse must target the immediate previous composed rest center");
expectAdjacent(3, 80, 2, aimY(rests[2]), "reverse from hand-1 must choose the hand-0 composed center");
expectAdjacent(0, 400, 0, null, "reverse at the first rest must clamp");
expectAdjacent(5, -400, 5, null, "forward at the last rest must clamp");

const provenWrongReplay = adjacent(0, 80 - 720);
if (provenWrongReplay.index !== 1 || provenWrongReplay.y !== aimY(rests[1])) {
  fail(
    "the proven-wrong 375x812 long swipe from opening-start must advance exactly one rest, not land at hand-1 (got " +
      JSON.stringify(provenWrongReplay) +
      ")"
  );
}

const hugeDeltas = [-1e9, -10000, -640, -threshold, threshold, 640, 10000, 1e9];
for (let origin = 0; origin < rests.length; origin++) {
  for (const dy of hugeDeltas) {
    const got = adjacent(origin, dy);
    if (!got || Math.abs(got.index - origin) > 1) {
      fail(
        "adjacent destination must never move more than one rest (origin=" +
          origin +
          " dy=" +
          dy +
          " got " +
          JSON.stringify(got) +
          ")"
      );
    }
    if (got.y != null && !Number.isInteger(got.y)) {
      fail("adjacent destination y must be a reachable integer");
    }
    if (got.y != null && !restContaining(got.y, rests)) {
      fail("adjacent destination y " + got.y + " must lie inside an authored rest");
    }
    if (got.y != null && got.y !== aimY(rests[got.index])) {
      fail("adjacent destination must be the composed rest center, not a plateau edge");
    }
    if (got.index === origin && got.y !== null) {
      fail("a clamped or below-threshold gesture must stay put (y=null)");
    }
  }
}

if (settle.restIndexForY(0, rests) !== 0) fail("y=0 must snapshot opening-start");
if (settle.restIndexForY(1200, rests) !== 1) fail("inside opening-final must snapshot that rest");
if (settle.restIndexForY(1400, rests) !== 1) fail("exact rest end must count as current");
if (settle.restIndexForY(1700, rests) !== 1) fail("mid-gap must snapshot the nearest rest");
if (settle.restIndexForY(5200, rests) !== 5) fail("terminal point rest must snapshot as current");

const fracAdj = settle.chooseAdjacentDestination(1, -40, fracRests);
const fracAdjWant = aimY(fracOperational[2]);
if (fracAdj.index !== 2 || fracAdj.y !== fracAdjWant) {
  fail("forward adjacent destination must use the next rest's composed center (got " + JSON.stringify(fracAdj) + ", want " + fracAdjWant + ")");
}
const fracAdjBack = settle.chooseAdjacentDestination(2, 40, fracRests);
const fracAdjBackWant = aimY(fracOperational[1]);
if (fracAdjBack.index !== 1 || fracAdjBack.y !== fracAdjBackWant) {
  fail("reverse adjacent destination must use the previous rest's composed center (got " + JSON.stringify(fracAdjBack) + ", want " + fracAdjBackWant + ")");
}

const resizeFn = extractFn(helper, "onResize");
const hideFn = extractFn(helper, "onPageHide");
const navFn = extractFn(helper, "onHashOrNav");
if (!resizeFn || !/cancelSettle/.test(resizeFn)) fail("resize must cancel the in-flight gesture");
if (!hideFn || !/cancelSettle/.test(hideFn)) fail("pagehide must cancel the in-flight gesture");
if (!navFn || !/cancelSettle/.test(navFn)) fail("navigation must cancel the in-flight gesture");
if (!/cancelGesture|gesture = null/.test(resizeFn) || !/cancelGesture|gesture = null/.test(hideFn) || !/cancelGesture|gesture = null/.test(navFn)) {
  fail("resize, pagehide, and navigation must drop gesture ownership without a queued movement");
}

// ——— Completed net motion owns the lift; the first-axis latch does not ———
if (typeof settle.completedVerticalIntent !== "function") {
  fail("helper must export completedVerticalIntent so lift authority is executable");
}
if (settle.TOUCH_ACTION_POLICY !== TOUCH_ACTION_POLICY) {
  fail("exported TOUCH_ACTION_POLICY must be exactly " + TOUCH_ACTION_POLICY);
}
if (settle.VERTICAL_OVERFLOW_LOCK != null && settle.VERTICAL_OVERFLOW_LOCK !== "hidden") {
  fail("exported VERTICAL_OVERFLOW_LOCK must be exactly hidden when present");
}
if (typeof settle.nativeVerticalOverflowLocked === "function") {
  if (settle.nativeVerticalOverflowLocked({ overflowY: "hidden" }) !== true) {
    fail("nativeVerticalOverflowLocked must treat overflowY hidden as locked");
  }
  if (settle.nativeVerticalOverflowLocked({ overflowY: "", overflow: "" }) !== false) {
    fail("nativeVerticalOverflowLocked must treat empty overflow as native-momentum-available");
  }
  if (settle.nativeVerticalOverflowLocked({ overflowY: "auto" }) !== false) {
    fail("nativeVerticalOverflowLocked must treat overflowY auto as native-momentum-available");
  }
}
if (typeof settle.rootOverflowPreservesStickyContainingBlock !== "function") {
  fail("helper must export rootOverflowPreservesStickyContainingBlock so root overflow ownership is executable");
}
if (settle.rootOverflowPreservesStickyContainingBlock({ overflowY: "" }) !== true) {
  fail("empty root overflowY must preserve the sticky containing relationship");
}
if (settle.rootOverflowPreservesStickyContainingBlock({ overflowY: "hidden" }) !== false) {
  fail("root overflowY hidden must not preserve the sticky containing relationship");
}
if (settle.rootOverflowPreservesStickyContainingBlock({ overflowY: "clip" }) !== false) {
  fail("root overflowY clip must not preserve the sticky containing relationship");
}
if (typeof settle.attach !== "function" || typeof settle.detach !== "function") {
  fail("helper must export attach and detach so the touch-action policy is executable");
}
if (typeof settle.onBreakpointChange !== "function") {
  fail("helper must export onBreakpointChange so breakpoint and quiet restore is executable");
}
if (typeof settle.boot !== "function") {
  fail("helper must export boot so cold-start reduced-motion attach is executable");
}

if (/axis\s*!==\s*["']vertical["']/.test(touchEndFn) || /axis\s*===\s*["']vertical["']/.test(touchEndFn)) {
  fail("touchend must not treat the initial axis latch as the settle authority");
}
if (!/lastX\s*-\s*gesture\.startX/.test(touchEndFn) || !/lastY\s*-\s*gesture\.startY/.test(touchEndFn)) {
  fail("touchend must compute net dx and dy from the retained start and last coordinates");
}
if (!/completedVerticalIntent\s*\(\s*dx\s*,\s*dy/.test(touchEndFn)) {
  fail("touchend must classify the completed net motion, not the first delivered move");
}
if (!/originIndex/.test(touchEndFn) || !/stopNativeMomentum\(\s*originY\s*\)/.test(touchEndFn)) {
  fail("before settling, touchend must restore the snapshotted origin and kill native momentum");
}
if (/chooseAdjacentDestination\([^)]*(?:currentScrollY|scrollY)/.test(touchEndFn)) {
  fail("touchend must never derive the destination from the scrolled position");
}

function liftFromNet(origin, dx, dy) {
  if (!settle.completedVerticalIntent(dx, dy)) {
    return { index: origin, y: null, native: true };
  }
  const dest = settle.chooseAdjacentDestination(origin, dy, rests);
  return { index: dest.index, y: dest.y, native: false };
}

function expectLift(origin, dx, dy, wantIndex, wantY, native, msg) {
  const got = liftFromNet(origin, dx, dy);
  if (got.native !== native || got.index !== wantIndex || got.y !== wantY) {
    fail(
      msg +
        " (origin=" +
        origin +
        " dx=" +
        dx +
        " dy=" +
        dy +
        " got " +
        JSON.stringify(got) +
        ", want {index:" +
        wantIndex +
        ", y:" +
        wantY +
        ", native:" +
        native +
        "})"
    );
  }
}

// Observed Chromium escape: first delivered move (dx=20, dy=-3) latched
// horizontal; completed motion was ~20px lateral and hundreds vertical.
expectLift(
  0,
  20,
  -670,
  1,
  aimY(rests[1]),
  false,
  "horizontally latched + net-vertical completed motion must use the adjacent path"
);
expectLift(
  0,
  30,
  -670,
  1,
  aimY(rests[1]),
  false,
  "a 30px lateral lead with net-vertical completion must still take the adjacent path"
);
expectLift(
  0,
  45,
  -670,
  1,
  aimY(rests[1]),
  false,
  "a 45px lateral lead with net-vertical completion must still take the adjacent path"
);
expectLift(0, 80, -4, 0, null, true, "genuinely horizontal net motion must remain native and must not advance a beat");
expectLift(0, 80, -30, 0, null, true, "horizontal-dominant completed motion must remain native");
expectLift(2, 3, -3, 2, null, true, "a tap/below-threshold gesture must stay put");
expectLift(2, threshold - 1, -(threshold - 1), 2, null, true, "below-threshold diagonal travel must stay put");

expectLift(1, 20, -50, 2, aimY(rests[2]), false, "diagonal forward must use the same adjacent composed center as a straight swipe");
expectLift(1, 20, 50, 0, 0, false, "diagonal reverse must use the same adjacent composed center as a straight swipe");
expectLift(1, -20, -50, 2, aimY(rests[2]), false, "diagonal forward must be symmetric in lateral sign");
expectLift(1, -20, 50, 0, 0, false, "diagonal reverse must be symmetric in lateral sign");
expectLift(2, 20, 50, 1, aimY(rests[1]), false, "diagonal reverse from hand-0 must target opening-final's composed center");
expectLift(2, 20, -50, 3, aimY(rests[3]), false, "diagonal forward from hand-0 must target hand-1 composed center");

if (settle.completedVerticalIntent(20, -3, threshold) !== false) {
  fail("the observed first delivered lead (20, -3) must remain a horizontal latch during contact");
}
if (settle.completedVerticalIntent(20, -670, threshold) !== true) {
  fail("the observed completed diagonal (20, -670) must count as net vertical intent");
}
if (settle.classifyTouchIntent(20, -3, threshold) !== "horizontal") {
  fail("early contact classification must still latch the 20px lead as horizontal");
}

const hugeCompleted = [-1e9, -10000, -640, 640, 10000, 1e9];
for (let origin = 0; origin < rests.length; origin++) {
  for (const dy of hugeCompleted) {
    const got = liftFromNet(origin, 20, dy);
    if (!got || Math.abs(got.index - origin) > 1) {
      fail(
        "arbitrarily large net vertical deltas must still produce only ±1 index (origin=" +
          origin +
          " dy=" +
          dy +
          " got " +
          JSON.stringify(got) +
          ")"
      );
    }
    if (got.native) {
      fail("qualifying net-vertical completion must not stay native (origin=" + origin + " dy=" + dy + ")");
    }
  }
}

// Second contact retains the origin; lift still cannot escape more than one rest.
if (/cancelGesture/.test(touchMoveFn)) {
  fail("a second contact on touchmove must not erase the origin record");
}
const interruptFn = extractFn(helper, "interruptGesture");
if (!interruptFn || !/interrupted\s*=\s*true/.test(interruptFn) || !/locked\s*=\s*false/.test(interruptFn)) {
  fail("interruptGesture must mark ownership interrupted and release the native lock");
}
if (!/interruptGesture/.test(touchStartFn) || !/interruptGesture/.test(touchMoveFn) || !/interruptGesture/.test(touchEndFn)) {
  fail("a second contact must mark ownership interrupted without inventing pinch behavior");
}
const remainingContacts = touchEndFn.match(/touches\.length\s*>\s*0[\s\S]*?return;/);
if (!remainingContacts) {
  fail("touchend must keep a distinct remaining-contact branch");
}
if (/cancelGesture/.test(remainingContacts[0]) || /gesture\s*=\s*null/.test(remainingContacts[0])) {
  fail("remaining contacts must retain the origin record through the final lift");
}
if (/startSettle/.test(remainingContacts[0])) {
  fail("a mid-gesture second contact must not invent a settle or pinch destination");
}
if (/cancelGesture\(\);\s*if\s*\(\s*!shouldCaptureTouch/.test(touchStartFn.replace(/\s+/g, " "))) {
  fail("touchstart must not erase the origin record before checking for a second contact");
}

expectLift(
  0,
  18,
  -1e9,
  1,
  aimY(rests[1]),
  false,
  "an interrupted primary whose net completed motion is vertical still advances exactly one rest"
);
expectLift(
  3,
  22,
  1e9,
  2,
  aimY(rests[2]),
  false,
  "an interrupted reverse primary still cannot escape more than one adjacent rest"
);
expectLift(
  1,
  90,
  -8,
  1,
  null,
  true,
  "interrupted multi-touch whose net motion stays horizontal must remain native"
);

function installHomepageHarness(options) {
  const opts = options || {};
  const state = {
    width: opts.width == null ? 375 : opts.width,
    quiet: !!opts.quiet,
    reduced: !!opts.reduced
  };
  const root = {
    style: {
      touchAction: opts.rootTouchAction == null ? "" : opts.rootTouchAction,
      overflow: opts.rootOverflow == null ? "" : opts.rootOverflow,
      overflowX: opts.rootOverflowX == null ? "" : opts.rootOverflowX,
      overflowY: opts.rootOverflowY == null ? "" : opts.rootOverflowY
    },
    classList: {
      contains: (name) => state.quiet && name === "is-quiet"
    },
    offsetHeight: 1
  };
  const body = {
    style: {
      touchAction: opts.bodyTouchAction == null ? "" : opts.bodyTouchAction,
      overflow: opts.bodyOverflow == null ? "" : opts.bodyOverflow,
      overflowX: opts.bodyOverflowX == null ? "" : opts.bodyOverflowX,
      overflowY: opts.bodyOverflowY == null ? "" : opts.bodyOverflowY
    },
    offsetHeight: 1
  };
  const sections = opts.missingSections
    ? {}
    : {
        opening: { id: "opening" },
        hand: { id: "hand" },
        work: { id: "work" }
      };
  const matchMedia = (query) => {
    const q = String(query);
    let matches = false;
    if (q.indexOf("max-width") >= 0) matches = state.width <= 700;
    if (q.indexOf("prefers-reduced-motion") >= 0) matches = state.reduced;
    return {
      matches,
      addEventListener() {},
      addListener() {},
      removeEventListener() {},
      removeListener() {}
    };
  };
  const listeners = new Map();
  function addListener(target, name, fn) {
    const key = target + ":" + name;
    if (!listeners.has(key)) listeners.set(key, []);
    listeners.get(key).push(fn);
  }
  function removeListener(target, name, fn) {
    const key = target + ":" + name;
    const list = listeners.get(key) || [];
    listeners.set(
      key,
      list.filter((item) => item !== fn)
    );
  }
  function emit(target, name, event) {
    (listeners.get(target + ":" + name) || []).forEach((fn) => fn(event));
  }
  if (opts.geometry) {
    const inner = opts.innerHeight == null ? 700 : opts.innerHeight;
    const makeSection = (id, documentTop, height) => ({
      id,
      offsetHeight: height,
      getBoundingClientRect: () => ({
        top: documentTop - (global.window ? global.window.scrollY : 0),
        height: inner
      })
    });
    sections.opening = makeSection("opening", 0, inner * 2.8);
    sections.hand = makeSection("hand", inner * 1.8, inner * 2.8);
    sections.work = makeSection("work", inner * 3.6, inner * 4.5);
    root.scrollHeight = inner * 8.2;
    body.scrollHeight = inner * 8.2;
    root.appendChild = () => {};
  }
  global.window = {
    matchMedia,
    addEventListener(name, fn) {
      addListener("window", name, fn);
    },
    removeEventListener(name, fn) {
      removeListener("window", name, fn);
    },
    scrollY: 0,
    pageYOffset: 0,
    innerHeight: opts.innerHeight == null ? 812 : opts.innerHeight,
    scrollTo(a, b) {
      const top = a && typeof a === "object" ? a.top || 0 : b || 0;
      this.scrollY = top;
      this.pageYOffset = top;
    },
    BEAT_DWELL: opts.geometry
      ? { holdSvh: 60, hand: [0.50], work: [0.28, 0.55, 0.88] }
      : undefined,
    OPENING_SPAN: opts.geometry
      ? { choreographySvh: 180, terminalHoldSvh: 0, choreographyEnd: 1, headlineChoreography: 0.55 }
      : undefined,
    __ranaQuietModeActive: state.quiet ? () => true : undefined
  };
  global.document = {
    documentElement: root,
    body,
    getElementById: (id) => sections[id] || null,
    addEventListener(name, fn) {
      addListener("document", name, fn);
    },
    removeEventListener(name, fn) {
      removeListener("document", name, fn);
    },
    hidden: false,
    createElement: () => ({
      setAttribute() {},
      style: { cssText: "" },
      getBoundingClientRect: () => ({ height: opts.innerHeight == null ? 700 : opts.innerHeight }),
      remove() {}
    })
  };
  global.window.document = global.document;
  global.location = { search: state.quiet ? "?motion=quiet" : "" };
  global.requestAnimationFrame =
    global.requestAnimationFrame ||
    function (fn) {
      fn((typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()) + 1000);
      return 1;
    };
  global.cancelAnimationFrame = global.cancelAnimationFrame || function () {};
  return { root, body, state, emit, listeners };
}

function uninstallHomepageHarness() {
  try {
    settle.detach();
  } catch (err) {}
  delete global.window;
  delete global.document;
  delete global.location;
}

function expectTouchAction(root, body, rootValue, bodyValue, msg) {
  if (root.style.touchAction !== rootValue || body.style.touchAction !== bodyValue) {
    fail(
      msg +
        " (got root=" +
        JSON.stringify(root.style.touchAction) +
        " body=" +
        JSON.stringify(body.style.touchAction) +
        ", want root=" +
        JSON.stringify(rootValue) +
        " body=" +
        JSON.stringify(bodyValue) +
        ")"
    );
  }
}

function inlineVerticalOverflowAvailable(style) {
  if (!style) return true;
  if (typeof settle.nativeVerticalOverflowLocked === "function") {
    return !settle.nativeVerticalOverflowLocked(style);
  }
  const y = style.overflowY;
  if (y === "hidden" || y === "clip") return false;
  const all = style.overflow;
  if (!y && all) {
    const parts = String(all).trim().split(/\s+/);
    const axisY = parts.length > 1 ? parts[1] : parts[0];
    if (axisY === "hidden" || axisY === "clip") return false;
  }
  return true;
}

function expectVerticalOverflowLock(root, body, locked, msg) {
  const rootAvailable = inlineVerticalOverflowAvailable(root.style);
  const bodyAvailable = inlineVerticalOverflowAvailable(body.style);
  if (locked) {
    if (bodyAvailable) {
      fail(
        msg +
          " — attached controller left body native vertical overflow available (body overflowY=" +
          JSON.stringify(body.style.overflowY) +
          " overflow=" +
          JSON.stringify(body.style.overflow) +
          ")"
      );
    }
    if (typeof settle.isNativeVerticalDocumentScrollLocked === "function" && !settle.isNativeVerticalDocumentScrollLocked()) {
      fail(msg + " — isNativeVerticalDocumentScrollLocked() must be true from the body lock while attached");
    }
  } else if (!rootAvailable || !bodyAvailable) {
    fail(
      msg +
        " (got root overflowY=" +
        JSON.stringify(root.style.overflowY) +
        " body overflowY=" +
        JSON.stringify(body.style.overflowY) +
        ")"
    );
  }
}

function expectRootOverflowUnchanged(root, prior, msg) {
  const want = {
    overflow: prior.rootOverflow == null ? "" : prior.rootOverflow,
    overflowX: prior.rootOverflowX == null ? "" : prior.rootOverflowX,
    overflowY: prior.rootOverflowY == null ? "" : prior.rootOverflowY
  };
  ["overflow", "overflowX", "overflowY"].forEach((name) => {
    if (root.style[name] !== want[name]) {
      fail(
        msg +
          " — controller attach must not mutate root " +
          name +
          " (got " +
          JSON.stringify(root.style[name]) +
          ", want " +
          JSON.stringify(want[name]) +
          "; root overflow-y hidden|clip unpins sticky scenes)"
      );
    }
  });
}

function expectOverflowRestore(root, body, prior, msg) {
  const fields = [
    ["overflow", prior.rootOverflow == null ? "" : prior.rootOverflow, prior.bodyOverflow == null ? "" : prior.bodyOverflow],
    ["overflowX", prior.rootOverflowX == null ? "" : prior.rootOverflowX, prior.bodyOverflowX == null ? "" : prior.bodyOverflowX],
    ["overflowY", prior.rootOverflowY == null ? "" : prior.rootOverflowY, prior.bodyOverflowY == null ? "" : prior.bodyOverflowY]
  ];
  fields.forEach(([name, rootWant, bodyWant]) => {
    if (root.style[name] !== rootWant || body.style[name] !== bodyWant) {
      fail(
        msg +
          " (" +
          name +
          " got root=" +
          JSON.stringify(root.style[name]) +
          " body=" +
          JSON.stringify(body.style[name]) +
          ", want root=" +
          JSON.stringify(rootWant) +
          " body=" +
          JSON.stringify(bodyWant) +
          ")"
      );
    }
  });
}

{
  const priorPairs = [
    { root: "", body: "", rootOverflow: "", bodyOverflow: "", rootOverflowX: "", bodyOverflowX: "", rootOverflowY: "", bodyOverflowY: "" },
    { root: "auto", body: "manipulation", rootOverflow: "auto", bodyOverflow: "visible", rootOverflowX: "", bodyOverflowX: "", rootOverflowY: "", bodyOverflowY: "" },
    { root: "manipulation", body: "pan-y", rootOverflow: "", bodyOverflow: "", rootOverflowX: "hidden", bodyOverflowX: "auto", rootOverflowY: "auto", bodyOverflowY: "scroll" },
    { root: "pan-y", body: "none", rootOverflow: "hidden", bodyOverflow: "auto", rootOverflowX: "", bodyOverflowX: "", rootOverflowY: "", bodyOverflowY: "" },
    { root: "none", body: "pan-x pinch-zoom", rootOverflow: "", bodyOverflow: "hidden", rootOverflowX: "", bodyOverflowX: "", rootOverflowY: "visible", bodyOverflowY: "" },
    { root: "pan-x pinch-zoom", body: "", rootOverflow: "", bodyOverflow: "", rootOverflowX: "", bodyOverflowX: "", rootOverflowY: "", bodyOverflowY: "" }
  ];
  priorPairs.forEach((prior) => {
    const { root, body } = installHomepageHarness({
      width: 375,
      rootTouchAction: prior.root,
      bodyTouchAction: prior.body,
      rootOverflow: prior.rootOverflow,
      bodyOverflow: prior.bodyOverflow,
      rootOverflowX: prior.rootOverflowX,
      bodyOverflowX: prior.bodyOverflowX,
      rootOverflowY: prior.rootOverflowY,
      bodyOverflowY: prior.bodyOverflowY
    });
    settle.attach();
    expectTouchAction(
      root,
      body,
      TOUCH_ACTION_POLICY,
      TOUCH_ACTION_POLICY,
      "attach must apply pan-x pinch-zoom to both root and body (prior " +
        JSON.stringify(prior) +
        ")"
    );
    expectRootOverflowUnchanged(
      root,
      prior,
      "attach must leave root overflow exactly as authored (prior " + JSON.stringify(prior) + ")"
    );
    expectVerticalOverflowLock(
      root,
      body,
      true,
      "attach must lock body native vertical overflow (prior " + JSON.stringify(prior) + ")"
    );
    if (root.style.overflow !== prior.rootOverflow || body.style.overflow !== prior.bodyOverflow) {
      fail("vertical lock must not clobber the overflow shorthand (prior " + JSON.stringify(prior) + ")");
    }
    if (root.style.overflowX !== prior.rootOverflowX || body.style.overflowX !== prior.bodyOverflowX) {
      fail("vertical lock must not clobber inline overflowX (prior " + JSON.stringify(prior) + ")");
    }
    settle.attach();
    expectTouchAction(
      root,
      body,
      TOUCH_ACTION_POLICY,
      TOUCH_ACTION_POLICY,
      "a second attach must not change the already-applied policy"
    );
    expectVerticalOverflowLock(root, body, true, "a second attach must keep the standing vertical lock");
    settle.detach();
    expectTouchAction(
      root,
      body,
      prior.root,
      prior.body,
      "detach must restore the exact prior inline touch-action values"
    );
    expectOverflowRestore(root, body, prior, "detach must restore the exact prior inline overflow values");
    settle.detach();
    expectTouchAction(
      root,
      body,
      prior.root,
      prior.body,
      "a second detach must not invent or clear restored touch-action values"
    );
    expectOverflowRestore(
      root,
      body,
      prior,
      "a second detach must not invent or clear restored overflow values"
    );
    uninstallHomepageHarness();
  });
}

{
  const refused = [
    { width: 701, quiet: false, reduced: false, label: "desktop above 700px" },
    { width: 1024, quiet: false, reduced: false, label: "desktop 1024px" },
    { width: 701, quiet: false, reduced: true, label: "desktop + prefers-reduced-motion" },
    { width: 375, quiet: true, reduced: false, label: "quiet mode" },
    { width: 320, quiet: true, reduced: true, label: "quiet + reduced-motion" }
  ];
  refused.forEach((item) => {
    const { root, body } = installHomepageHarness({
      width: item.width,
      quiet: item.quiet,
      reduced: item.reduced,
      rootTouchAction: "manipulation",
      bodyTouchAction: "auto"
    });
    settle.attach();
    expectTouchAction(
      root,
      body,
      "manipulation",
      "auto",
      item.label + " must not attach the controller or alter touch-action"
    );
    expectVerticalOverflowLock(root, body, false, item.label + " must not carry the vertical overflow lock");
    settle.detach();
    expectTouchAction(
      root,
      body,
      "manipulation",
      "auto",
      item.label + " detach must not invent a touch-action restore when attach never owned the style"
    );
    expectOverflowRestore(
      root,
      body,
      { rootOverflow: "", bodyOverflow: "", rootOverflowX: "", bodyOverflowX: "", rootOverflowY: "", bodyOverflowY: "" },
      item.label + " detach must not invent an overflow restore when attach never owned the style"
    );
    uninstallHomepageHarness();
  });
}

{
  const { root, body } = installHomepageHarness({
    width: 375,
    missingSections: true,
    rootTouchAction: "auto",
    bodyTouchAction: "manipulation"
  });
  settle.attach();
  expectTouchAction(
    root,
    body,
    "auto",
    "manipulation",
    "a non-homepage document must not receive the touch-action policy"
  );
  expectVerticalOverflowLock(root, body, false, "a non-homepage document must not receive the vertical overflow lock");
  uninstallHomepageHarness();
}

{
  const { root, body, state } = installHomepageHarness({
    width: 375,
    rootTouchAction: "manipulation",
    bodyTouchAction: "pan-y",
    rootOverflowY: "auto",
    bodyOverflowY: "scroll"
  });
  const prior = {
    rootOverflow: "",
    bodyOverflow: "",
    rootOverflowX: "",
    bodyOverflowX: "",
    rootOverflowY: "auto",
    bodyOverflowY: "scroll"
  };
  settle.attach();
  expectTouchAction(root, body, TOUCH_ACTION_POLICY, TOUCH_ACTION_POLICY, "mobile normal-motion attach applies the policy");
  expectRootOverflowUnchanged(root, prior, "mobile normal-motion attach must not mutate root overflow");
  expectVerticalOverflowLock(root, body, true, "mobile normal-motion attach must lock body native vertical overflow");
  state.width = 800;
  settle.onBreakpointChange();
  expectTouchAction(
    root,
    body,
    "manipulation",
    "pan-y",
    "crossing above 700px must restore the exact prior inline touch-action values"
  );
  expectOverflowRestore(root, body, prior, "crossing above 700px must restore the exact prior inline overflow values");
  state.width = 375;
  settle.onBreakpointChange();
  expectTouchAction(
    root,
    body,
    TOUCH_ACTION_POLICY,
    TOUCH_ACTION_POLICY,
    "returning to the mobile normal-motion homepage must re-apply the policy"
  );
  expectRootOverflowUnchanged(root, prior, "returning to the mobile normal-motion homepage must not mutate root overflow");
  expectVerticalOverflowLock(root, body, true, "returning to the mobile normal-motion homepage must re-lock body vertical overflow");
  state.reduced = true;
  settle.onBreakpointChange();
  expectTouchAction(
    root,
    body,
    TOUCH_ACTION_POLICY,
    TOUCH_ACTION_POLICY,
    "crossing to prefers-reduced-motion must retain the attached touch-action policy"
  );
  expectRootOverflowUnchanged(
    root,
    prior,
    "crossing to prefers-reduced-motion must not mutate root overflow or detach"
  );
  expectVerticalOverflowLock(
    root,
    body,
    true,
    "crossing to prefers-reduced-motion must retain/reapply the body-only vertical lock"
  );
  state.reduced = false;
  settle.onBreakpointChange();
  expectTouchAction(
    root,
    body,
    TOUCH_ACTION_POLICY,
    TOUCH_ACTION_POLICY,
    "leaving prefers-reduced-motion for mobile normal mode must remain attached"
  );
  expectVerticalOverflowLock(
    root,
    body,
    true,
    "leaving prefers-reduced-motion for mobile normal mode must keep the body lock"
  );
  state.quiet = true;
  settle.onBreakpointChange();
  expectTouchAction(
    root,
    body,
    "manipulation",
    "pan-y",
    "quiet mode after a restore must not re-apply the touch-action policy"
  );
  expectVerticalOverflowLock(root, body, false, "quiet mode after a restore must not re-apply the vertical overflow lock");
  state.quiet = false;
  settle.onBreakpointChange();
  expectTouchAction(
    root,
    body,
    TOUCH_ACTION_POLICY,
    TOUCH_ACTION_POLICY,
    "leaving quiet for mobile normal-motion must apply the policy again"
  );
  expectRootOverflowUnchanged(root, prior, "leaving quiet for mobile normal-motion must not mutate root overflow");
  expectVerticalOverflowLock(root, body, true, "leaving quiet for mobile normal-motion must lock body vertical overflow again");
  uninstallHomepageHarness();
}

{
  const { root, body } = installHomepageHarness({ width: 375 });
  const programmaticPrior = {
    rootOverflow: "",
    bodyOverflow: "",
    rootOverflowX: "",
    bodyOverflowX: "",
    rootOverflowY: "",
    bodyOverflowY: ""
  };
  settle.attach();
  expectRootOverflowUnchanged(
    root,
    programmaticPrior,
    "programmatic settle attach must not mutate root overflow"
  );
  expectVerticalOverflowLock(
    root,
    body,
    true,
    "programmatic settle must run while body native vertical overflow is locked"
  );
  window.scrollTo(0, 1400);
  if (window.scrollY !== 1400) {
    fail("programmatic scrollTo must still move the document while the vertical lock is active");
  }
  expectVerticalOverflowLock(
    root,
    body,
    true,
    "programmatic scrollTo must not drop the standing vertical lock"
  );
  if (typeof settle.startSettle === "function") {
    global.requestAnimationFrame = function (fn) {
      fn((typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()) + 1000);
      return 1;
    };
    global.cancelAnimationFrame = function () {};
    window.scrollTo(0, 0);
    settle.startSettle(2000);
    if (window.scrollY !== 2000) {
      fail("startSettle must still move the document while the vertical lock is active (got " + window.scrollY + ")");
    }
    expectVerticalOverflowLock(root, body, true, "startSettle must not drop the standing vertical lock");
  }
  settle.detach();
  uninstallHomepageHarness();
}

{
  const { root, body, emit } = installHomepageHarness({
    width: 360,
    innerHeight: 700,
    geometry: true
  });
  settle.attach();
  expectRootOverflowUnchanged(
    root,
    { rootOverflow: "", rootOverflowX: "", rootOverflowY: "" },
    "geometry homepage attach must not mutate root overflow"
  );
  expectVerticalOverflowLock(
    root,
    body,
    true,
    "geometry homepage attach must lock body native vertical overflow before any gesture"
  );
  const rests = settle.collectRests();
  const authoredIds = [
    "opening-start",
    "opening-headline",
    "hand-0",
    "work-0",
    "work-1",
    "work-2"
  ];
  const geometryIds = (rests || []).map((rest) => rest.id);
  if (
    !rests ||
    geometryIds.length !== authoredIds.length ||
    geometryIds.some((id, i) => id !== authoredIds[i])
  ) {
    fail("geometry homepage must expose the six ordered authored rests (got " + JSON.stringify(geometryIds) + ")");
  }
  const origin = rests[0];
  const next = rests[1];
  const last = rests[rests.length - 1];
  window.scrollTo(0, origin.start);
  emit("window", "touchstart", {
    touches: [{ identifier: 1, clientX: 180, clientY: 620 }],
    changedTouches: [{ identifier: 1, clientX: 180, clientY: 620 }],
    cancelable: true,
    preventDefault() {
      this.prevented = true;
    }
  });
  emit("window", "touchmove", {
    touches: [{ identifier: 1, clientX: 176, clientY: 40 }],
    changedTouches: [{ identifier: 1, clientX: 176, clientY: 40 }],
    cancelable: true,
    preventDefault() {
      this.prevented = true;
    }
  });
  if (window.scrollY !== origin.start) {
    fail("during a locked vertical swipe the document must remain at the snapshotted origin (got " + window.scrollY + ")");
  }
  emit("window", "touchend", {
    touches: [],
    changedTouches: [{ identifier: 1, clientX: 176, clientY: 40 }],
    cancelable: true,
    preventDefault() {
      this.prevented = true;
    }
  });
  const wantFirst = settle.chooseAdjacentDestination(0, -580, rests);
  if (!wantFirst || wantFirst.index !== 1 || wantFirst.y == null) {
    fail("geometry swipe must have an adjacent composed destination for rest 1");
  }
  if (window.scrollY !== wantFirst.y) {
    fail(
      "a long/fast completed swipe from rest 0 must finish only at rest 1 (got y=" +
        window.scrollY +
        ", want " +
        wantFirst.y +
        "; last rest is " +
        last.start +
        ")"
    );
  }
  if (next.end > next.start && (window.scrollY === next.start || window.scrollY === next.end)) {
    fail("a completed swipe must finish on the composed interior of rest 1, not a plateau edge");
  }
  if (Math.abs(window.scrollY - last.start) < 1) {
    fail("a long/fast swipe must not coast to the terminal rest");
  }
  expectVerticalOverflowLock(root, body, true, "after lift the standing vertical lock must still be active");
  settle.detach();
  uninstallHomepageHarness();
}

if (!/style\.overflowY\s*=\s*(?:VERTICAL_OVERFLOW_LOCK|["']hidden["']|["']clip["'])/.test(applyTouchFn)) {
  fail("apply must assign overflowY hidden|clip as the standing body vertical lock");
}
if ((applyTouchFn.match(/style\.overflowY\s*=\s*(?:VERTICAL_OVERFLOW_LOCK|["']hidden["']|["']clip["'])/g) || []).length !== 1) {
  fail("overflowY lock must be assigned once, on body only");
}
if (!/overflowY/.test(applyTouchFn) || applyTouchFn.search(/overflowY/) > applyTouchFn.search(/style\.overflowY\s*=/)) {
  fail("must snapshot prior inline overflowY before applying the body vertical lock");
}
if (!/overflowY/.test(restoreTouchFn)) {
  fail("detach must restore the exact prior inline overflowY values");
}
if (!/documentElement/.test(restoreTouchFn) || !/\.body\b/.test(restoreTouchFn)) {
  fail("detach must still restore root and body overflow snapshots even though only body is locked");
}
const stopFn = extractFn(helper, "stopNativeMomentum");
if (!stopFn) fail("could not isolate stopNativeMomentum");
if (/style\.overflow\s*=/.test(stopFn) || /style\.overflowY\s*=/.test(stopFn)) {
  fail("stopNativeMomentum must not pulse-restore overflow; that re-opens native vertical momentum");
}
if (!/scrollTo\(/.test(stopFn)) {
  fail("stopNativeMomentum must still programmatically scroll while the standing lock is active");
}

// ——— Root overflow ownership + sticky containing-block compatibility ———
// CSS Overflow 3 / CSS2.1 11.1.1: if the root's overflow-y is visible
// (empty inline on this homepage), the viewport's used overflow-y is
// taken from the body. Body overflow-y hidden|clip is therefore the
// document native vertical scroller lock — Samsung Internet's document
// momentum surface — without making html itself a scroll container.
// CSS Positioned Layout: sticky is contained by the nearest ancestor
// scroll container. Root overflow-y hidden|clip makes html that
// scrollport and, in the 1babfa5 Chromium probe, leaves the scene at
// its static position (hand-0 y=2126, #handScene top=-446, bottom=254).
// Body hidden|clip with root untouched kept top=0, bottom=700.
function effectiveInlineOverflowY(style) {
  if (!style) return "";
  if (style.overflowY) return style.overflowY;
  if (!style.overflow) return "";
  const parts = String(style.overflow).trim().split(/\s+/);
  return parts.length > 1 ? parts[1] : parts[0];
}

function viewportNativeVerticalScrollAvailable(rootStyle, bodyStyle) {
  const rootY = effectiveInlineOverflowY(rootStyle);
  if (rootY === "hidden" || rootY === "clip") return false;
  if (rootY === "auto" || rootY === "scroll") return true;
  const bodyY = effectiveInlineOverflowY(bodyStyle);
  if (bodyY === "hidden" || bodyY === "clip") return false;
  return true;
}

function stickySceneViewportRect(scrollY, sectionDocumentTop, viewportHeight, rootStyle) {
  const staticTop = sectionDocumentTop - scrollY;
  const rootY = effectiveInlineOverflowY(rootStyle);
  if (rootY === "hidden" || rootY === "clip") {
    return { top: staticTop, bottom: staticTop + viewportHeight, height: viewportHeight, pinned: false };
  }
  return { top: 0, bottom: viewportHeight, height: viewportHeight, pinned: true };
}

const STICKY_PROBE = {
  y: 2126,
  viewport: 700,
  handSectionTop: 1680,
  broken: { top: -446, bottom: 254, height: 700 },
  pinned: { top: 0, bottom: 700, height: 700 }
};

const brokenProbe = stickySceneViewportRect(
  STICKY_PROBE.y,
  STICKY_PROBE.handSectionTop,
  STICKY_PROBE.viewport,
  { overflowY: "hidden" }
);
if (
  brokenProbe.top !== STICKY_PROBE.broken.top ||
  brokenProbe.bottom !== STICKY_PROBE.broken.bottom ||
  brokenProbe.pinned !== false
) {
  fail(
    "root overflow-y hidden must encode the 1babfa5 unpinned sticky geometry (got " +
      JSON.stringify(brokenProbe) +
      ")"
  );
}
const brokenClip = stickySceneViewportRect(
  STICKY_PROBE.y,
  STICKY_PROBE.handSectionTop,
  STICKY_PROBE.viewport,
  { overflowY: "clip" }
);
if (brokenClip.pinned !== false || brokenClip.top !== STICKY_PROBE.broken.top) {
  fail("root overflow-y clip must be in the same sticky-breaking set as hidden");
}
const bodyOnlyPinned = stickySceneViewportRect(
  STICKY_PROBE.y,
  STICKY_PROBE.handSectionTop,
  STICKY_PROBE.viewport,
  { overflowY: "" }
);
if (
  bodyOnlyPinned.top !== STICKY_PROBE.pinned.top ||
  bodyOnlyPinned.bottom !== STICKY_PROBE.pinned.bottom ||
  bodyOnlyPinned.pinned !== true
) {
  fail("untouched root overflow must keep the normal sticky viewport pin (top=0, bottom=700)");
}

{
  const { root, body } = installHomepageHarness({ width: 360, innerHeight: 700, geometry: true });
  settle.attach();
  expectRootOverflowUnchanged(
    root,
    { rootOverflow: "", rootOverflowX: "", rootOverflowY: "" },
    "sticky-geometry attach must not mutate root overflow/overflowY"
  );
  expectVerticalOverflowLock(
    root,
    body,
    true,
    "sticky-geometry attach must lock the body's native vertical overflow"
  );
  if (viewportNativeVerticalScrollAvailable(root.style, body.style)) {
    fail(
      "body overflow-y lock must make viewport native vertical scroll unavailable via HTML overflow propagation (root overflowY=" +
        JSON.stringify(root.style.overflowY) +
        " body overflowY=" +
        JSON.stringify(body.style.overflowY) +
        ")"
    );
  }
  if (typeof settle.rootOverflowPreservesStickyContainingBlock === "function") {
    if (settle.rootOverflowPreservesStickyContainingBlock(root.style) !== true) {
      fail("attached root overflow must preserve the sticky containing relationship");
    }
    if (settle.rootOverflowPreservesStickyContainingBlock({ overflowY: "hidden" }) !== false) {
      fail("rootOverflowPreservesStickyContainingBlock must reject overflowY hidden");
    }
    if (settle.rootOverflowPreservesStickyContainingBlock({ overflowY: "clip" }) !== false) {
      fail("rootOverflowPreservesStickyContainingBlock must reject overflowY clip");
    }
  }
  const liveRect = stickySceneViewportRect(
    STICKY_PROBE.y,
    STICKY_PROBE.handSectionTop,
    STICKY_PROBE.viewport,
    root.style
  );
  if (!liveRect.pinned || liveRect.top !== 0 || liveRect.bottom !== 700) {
    fail(
      "attached root overflow must leave the normal sticky containing relationship available (predicted handScene " +
        JSON.stringify(liveRect) +
        ", want top=0 bottom=700; 1babfa5 measured top=-446 bottom=254)"
    );
  }
  window.scrollTo(0, STICKY_PROBE.y);
  if (window.scrollY !== STICKY_PROBE.y) {
    fail("programmatic scrollTo must still reach a composed rest while the body lock is active");
  }
  expectRootOverflowUnchanged(
    root,
    { rootOverflow: "", rootOverflowX: "", rootOverflowY: "" },
    "programmatic scrollTo must not invent a root overflow lock"
  );
  expectVerticalOverflowLock(
    root,
    body,
    true,
    "programmatic scrollTo must keep the body native vertical lock"
  );
  settle.detach();
  expectOverflowRestore(
    root,
    body,
    { rootOverflow: "", bodyOverflow: "", rootOverflowX: "", bodyOverflowX: "", rootOverflowY: "", bodyOverflowY: "" },
    "sticky-geometry detach must restore the exact prior inline overflow values"
  );
  uninstallHomepageHarness();
}

function emitVerticalSwipe(emit, startY, endY) {
  emit("window", "touchstart", {
    touches: [{ identifier: 1, clientX: 180, clientY: startY }],
    changedTouches: [{ identifier: 1, clientX: 180, clientY: startY }],
    cancelable: true,
    preventDefault() {
      this.prevented = true;
    }
  });
  emit("window", "touchmove", {
    touches: [{ identifier: 1, clientX: 176, clientY: endY }],
    changedTouches: [{ identifier: 1, clientX: 176, clientY: endY }],
    cancelable: true,
    preventDefault() {
      this.prevented = true;
    }
  });
  emit("window", "touchend", {
    touches: [],
    changedTouches: [{ identifier: 1, clientX: 176, clientY: endY }],
    cancelable: true,
    preventDefault() {
      this.prevented = true;
    }
  });
}

{
  const prior = {
    rootOverflow: "",
    rootOverflowX: "",
    rootOverflowY: "",
    bodyOverflow: "",
    bodyOverflowX: "",
    bodyOverflowY: ""
  };
  const { root, body, emit } = installHomepageHarness({
    width: 375,
    innerHeight: 700,
    geometry: true,
    reduced: true,
    rootTouchAction: "",
    bodyTouchAction: ""
  });
  settle.boot();
  expectTouchAction(
    root,
    body,
    TOUCH_ACTION_POLICY,
    TOUCH_ACTION_POLICY,
    "cold boot at <=700 with reduce=true must attach and apply pan-x pinch-zoom"
  );
  expectRootOverflowUnchanged(
    root,
    prior,
    "cold boot at <=700 with reduce=true must leave root overflow untouched"
  );
  expectVerticalOverflowLock(
    root,
    body,
    true,
    "cold boot at <=700 with reduce=true must apply the body-only vertical lock"
  );
  const rests = settle.collectRests();
  const reduceIds = (rests || []).map((rest) => rest.id);
  const reduceWant = [
    "opening-start",
    "opening-headline",
    "hand-0",
    "work-0",
    "work-1",
    "work-2"
  ];
  if (
    !rests ||
    reduceIds.length !== reduceWant.length ||
    reduceIds.some((id, i) => id !== reduceWant[i])
  ) {
    fail("cold boot at <=700 with reduce=true must expose the six ordered authored rests (got " + JSON.stringify(reduceIds) + ")");
  }
  const last = rests[rests.length - 1];
  window.scrollTo(0, rests[0].start);
  emitVerticalSwipe(emit, 620, 40);
  const wantForward = settle.chooseAdjacentDestination(0, -580, rests);
  if (!wantForward || wantForward.index !== 1 || wantForward.y == null) {
    fail("reduce=true forward swipe must have an adjacent composed destination for rest 1");
  }
  if (window.scrollY !== wantForward.y) {
    fail(
      "a long vertical gesture in reduce=true must resolve exactly one adjacent rest forward (got y=" +
        window.scrollY +
        ", want " +
        wantForward.y +
        "; last rest is " +
        last.start +
        ")"
    );
  }
  if (Math.abs(window.scrollY - last.start) < 1) {
    fail("a long vertical gesture in reduce=true must not coast to the terminal rest");
  }
  const forwardY = window.scrollY;
  emit("window", "scroll", {});
  if (window.scrollY !== forwardY) {
    fail("after dwell, reduce=true must stay at the adjacent forward rest (got y=" + window.scrollY + ", want " + forwardY + ")");
  }
  emitVerticalSwipe(emit, 40, 620);
  const wantReverse = settle.chooseAdjacentDestination(1, 580, rests);
  if (!wantReverse || wantReverse.index !== 0 || wantReverse.y == null) {
    fail("reduce=true reverse swipe must have an adjacent composed destination for rest 0");
  }
  if (window.scrollY !== wantReverse.y) {
    fail(
      "a long vertical gesture in reduce=true must resolve exactly one adjacent rest reverse (got y=" +
        window.scrollY +
        ", want " +
        wantReverse.y +
        ")"
    );
  }
  const reverseY = window.scrollY;
  emit("window", "scroll", {});
  if (window.scrollY !== reverseY) {
    fail("after dwell, reduce=true must stay at the adjacent reverse rest (got y=" + window.scrollY + ", want " + reverseY + ")");
  }
  expectRootOverflowUnchanged(
    root,
    prior,
    "reduce=true gesture ownership must not invent a root overflow lock"
  );
  expectVerticalOverflowLock(
    root,
    body,
    true,
    "reduce=true gesture ownership must keep the body-only vertical lock"
  );
  uninstallHomepageHarness();
}

{
  const prior = {
    rootOverflow: "",
    bodyOverflow: "",
    rootOverflowX: "",
    bodyOverflowX: "",
    rootOverflowY: "auto",
    bodyOverflowY: "scroll"
  };
  const { root, body, state } = installHomepageHarness({
    width: 375,
    reduced: false,
    rootTouchAction: "manipulation",
    bodyTouchAction: "pan-y",
    rootOverflowY: "auto",
    bodyOverflowY: "scroll"
  });
  settle.attach();
  expectVerticalOverflowLock(root, body, true, "normal-mode attach must lock before a reduce toggle");
  state.reduced = true;
  settle.onBreakpointChange();
  expectTouchAction(
    root,
    body,
    TOUCH_ACTION_POLICY,
    TOUCH_ACTION_POLICY,
    "toggling normal -> reduce while attached must not detach touch-action"
  );
  expectRootOverflowUnchanged(root, prior, "toggling normal -> reduce must leave root overflow untouched");
  expectVerticalOverflowLock(
    root,
    body,
    true,
    "toggling normal -> reduce while attached must retain/reapply the body-only lock"
  );
  uninstallHomepageHarness();
}

{
  const prior = {
    rootOverflow: "",
    bodyOverflow: "",
    rootOverflowX: "",
    bodyOverflowX: "",
    rootOverflowY: "",
    bodyOverflowY: ""
  };
  const { root, body, state } = installHomepageHarness({
    width: 375,
    reduced: true,
    rootTouchAction: "",
    bodyTouchAction: ""
  });
  settle.boot();
  expectVerticalOverflowLock(root, body, true, "reduce=true cold attach must own the lock before toggling normal");
  state.reduced = false;
  settle.onBreakpointChange();
  expectTouchAction(
    root,
    body,
    TOUCH_ACTION_POLICY,
    TOUCH_ACTION_POLICY,
    "toggling reduce -> normal must remain attached"
  );
  expectRootOverflowUnchanged(root, prior, "toggling reduce -> normal must leave root overflow untouched");
  expectVerticalOverflowLock(root, body, true, "toggling reduce -> normal must remain locked");
  uninstallHomepageHarness();
}

console.log(
  "PASS: mobile one-adjacent-beat touch lock (body-only standing overflow-y lock; root overflow unmutated for sticky; programmatic scrollTo preserved; document pan-x pinch-zoom; completed-net lift; second-contact retains origin; reduce keeps adjacency ownership; quiet/desktop restore; ±1 rest helper; reachable invert; no CSS scroll-snap)"
);
