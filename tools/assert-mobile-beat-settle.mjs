#!/usr/bin/env node
/**
 * Source + math assertion: mobile-only beat settle after a finger gesture.
 *
 * Locks the owner correction that an ordinary mobile lift can stop between
 * authored rests, stacking or stranding adjacent moments:
 * - helper is homepage-only, gated to max-width 700px
 * - destinations invert OPENING_SPAN final rest, BEAT_DWELL plateaus, terminal
 * - forward/reverse choice uses direction + bounded nearest adjacent rest
 * - touch/pointer/wheel/keyboard/resize/pagehide/link/hash cancel immediately
 * - settle rAF cannot recursively schedule another settle
 * - no CSS section scroll-snap fallback
 *
 * Usage: node tools/assert-mobile-beat-settle.mjs
 *
 * Residue: mobile-beat-settle tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator editing homepage mobile settle / remap / snap
 * Activation: execute — node tools/assert-mobile-beat-settle.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when the mobile beat-settle contract is retired or superseded
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
if (!/sawContact/.test(scrollFn) || !/armed = true/.test(scrollFn)) {
  fail("onScroll must arm after a real contact so a fast flick still settles");
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
  fail("chooseBeatDestination must use the exact authored start..end, not the near zone");
}
if (!/y\s*>=\s*rest\.start\s*&&\s*y\s*<=\s*rest\.end/.test(chooseFn)) {
  fail("already-inside must be the exact inclusive authored rest range");
}
if (/if\s*\(\s*dist\s*<=\s*NEAR_PX\s*\)\s*return\s*;/.test(startFn)) {
  fail("tiny-distance optimization must not suppress the final alignment");
}
if (!/dist\s*<=\s*NEAR_PX/.test(startFn) || !/scrollTo\(\s*0\s*,\s*targetY\s*\)/.test(startFn)) {
  fail("tiny distances must still finish at the exact authored boundary");
}
if (/Math\.abs\(\s*target\s*-\s*y\s*\)\s*<=\s*NEAR_PX/.test(maybeFn)) {
  fail("maybeSettle must not treat a near-zone gap as already settled");
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
if (settle.MOBILE_MAX_WIDTH !== 700) fail("exported mobile gate must be 700");

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

console.log(
  "PASS: mobile beat settle (700px gate; opening-final + BEAT_DWELL invert; forward/reverse + cancel/reentrancy; no CSS scroll-snap)"
);
