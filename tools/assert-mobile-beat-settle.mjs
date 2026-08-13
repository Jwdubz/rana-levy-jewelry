#!/usr/bin/env node
/**
 * Source + math assertion: mobile one-gesture / one-adjacent-beat touch lock.
 *
 * Locks the owner correction that native touch momentum must never own
 * passage distance. A continuous single-finger vertical gesture that
 * begins at authored rest N may finish only at N-1, N, or N+1:
 * - helper is homepage-only, gated to max-width 700px
 * - touchmove is non-passive; the vertical path calls preventDefault()
 * - quiet mode and prefers-reduced-motion cannot intercept touch
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
const bootFn = extractFn(helper, "boot");
const maybeFn = extractFn(helper, "maybeSettle");
const startFn = extractFn(helper, "startSettle");
if (!attachFn) fail("could not isolate attach");
if (!maybeFn) fail("could not isolate maybeSettle");
if (!startFn) fail("could not isolate startSettle");
if (/scrollTo\(/.test(attachFn) || /scrollTo\(/.test(bootFn)) {
  fail("attach/boot must not hijack native scroll restoration or deep links");
}
if (!/armed = false/.test(attachFn)) {
  fail("attach must leave settle unarmed until a real user gesture");
}

// Quiet + reduced-motion are explicit no-animate gates.
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

const bpFn = extractFn(helper, "onBreakpointChange");
if (!bpFn) fail("could not isolate onBreakpointChange");
if (!/quietModeActive\(\)/.test(bpFn) || !/prefersReducedMotion\(\)/.test(bpFn)) {
  fail("quiet mode and reduced-motion must prevent touch intercept attach, not only post-momentum settle");
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
  fail("quiet and reduced-motion paths must refuse intercept before preventDefault");
}
if (!/classifyTouchIntent|vertical/.test(touchMoveFn)) {
  fail("touchmove must distinguish vertical intent before locking native scroll");
}
if (/preventDefault\s*\(/.test(touchStartFn)) {
  fail("touchstart must not preventDefault; taps and links must stay native");
}
if (!/shouldCaptureTouch\(|quietModeActive\(|prefersReducedMotion\(/.test(touchStartFn)) {
  fail("touchstart must not snapshot or lock when quiet or reduced-motion");
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
  fail("collectRests must read live OPENING_SPAN for the opening final rest");
}
if (!/deriveOpeningFinalPhysical/.test(helper)) {
  fail("opening final rest must be derived from OPENING_SPAN");
}
if (!/plateauPhysicalRange/.test(helper)) {
  fail("Hand/Work rests must invert remapBeatProgress plateaus");
}
if (!/id:\s*"work-terminal"/.test(helper) && !/"work-terminal"/.test(helper)) {
  fail("terminal rest must be derived as work physical 1");
}
if (!/id:\s*"opening-final"/.test(helper) && !/"opening-final"/.test(helper)) {
  fail("opening final rest must be a named destination");
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
if (!/operationalRests\(\s*mergeRests\(\s*rests\s*,\s*NEAR_PX\s*\)\s*,\s*maxY\s*\)/.test(collectFn)) {
  fail("collectRests must operationalize after merge so runtime rests stay reachable");
}
if (!/function\s+operationalRest\s*\(/.test(helper) || !/Math\.ceil\(\s*rest\.start\s*\)/.test(helper) || !/Math\.floor\(\s*rest\.end\s*\)/.test(helper)) {
  fail("operationalRest must take first/last reachable integers inside an authored plateau");
}
if (!/Math\.round\(\s*\(\s*rest\.start\s*\+\s*rest\.end\s*\)\s*\/\s*2\s*\)/.test(helper)) {
  fail("a span with no reachable integer must become one nearest reachable point");
}
if (!/function\s+lastReachableScrollY\s*\(/.test(helper) || !/id === "work-terminal"/.test(helper)) {
  fail("Work terminal must map to the reachable max-scroll endpoint");
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

expectAdjacent(0, 0, 0, null, "a tap must stay at the origin rest");
expectAdjacent(2, threshold - 1, 2, null, "below-threshold upward travel must stay put");
expectAdjacent(2, -(threshold - 1), 2, null, "below-threshold downward finger travel must stay put");
expectAdjacent(0, -threshold, 1, 1000, "forward must target the immediate next rest start");
expectAdjacent(1, -50, 2, 2000, "forward from opening-final must choose hand-0 start");
expectAdjacent(2, 50, 1, 1400, "reverse must target the immediate previous rest end");
expectAdjacent(3, 80, 2, 2400, "reverse from hand-1 must choose hand-0 end");
expectAdjacent(0, 400, 0, null, "reverse at the first rest must clamp");
expectAdjacent(5, -400, 5, null, "forward at the last rest must clamp");

const provenWrongReplay = adjacent(0, 80 - 720);
if (provenWrongReplay.index !== 1 || provenWrongReplay.y !== 1000) {
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
    if (got.index > origin && got.y !== rests[got.index].start) {
      fail("forward adjacent destination must be the next rest start");
    }
    if (got.index < origin && got.y !== rests[got.index].end) {
      fail("reverse adjacent destination must be the previous rest end");
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
if (fracAdj.index !== 2 || fracAdj.y !== 4918) {
  fail("forward adjacent destination must use the next rest's reachable start (got " + JSON.stringify(fracAdj) + ")");
}
const fracAdjBack = settle.chooseAdjacentDestination(2, 40, fracRests);
if (fracAdjBack.index !== 1 || fracAdjBack.y !== 4854) {
  fail("reverse adjacent destination must use the previous rest's reachable end (got " + JSON.stringify(fracAdjBack) + ")");
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

console.log(
  "PASS: mobile one-adjacent-beat touch lock (non-passive preventDefault; quiet/reduced native; ±1 rest helper; reachable invert; no CSS scroll-snap)"
);
