#!/usr/bin/env node
/**
 * Source + clock assertion: normal-motion mobile homepage rests must be
 * fully composed rendered beats, not black / empty transitions.
 *
 * The 52ffdd3 Chromium touch journey landed only on adjacent authored
 * rests, but several middle landings were almost-black HUD holds. Cause:
 * chooseAdjacentDestination aimed at plateau start (forward) / end
 * (reverse). site.js damps RAW physical progress (sectionTau) then remaps,
 * so a landing on the leading edge keeps the visual clock in the
 * inter-beat fade / decoder-handoff / retirement zone.
 *
 * This is not a string probe and not a weakened rest-count check. It
 * derives the live 360x700 rests, takes every adjacent gesture landing,
 * and requires the damped visual sample at settle-end to still be a
 * fully composed render state (copy + world reveal laws from index.html
 * and site.js).
 *
 * Usage: node tools/assert-mobile-composed-rest-landings.mjs
 *
 * Residue: mobile composed-rest landing tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator editing homepage mobile rest derivation / landing aim
 * Activation: execute — node tools/assert-mobile-composed-rest-landings.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when mobile per-beat settle is retired or superseded
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

const siteJs = read("site.js");
const index = read("index.html");
const helperSrc = read("mobile-beat-settle.js");
const styles = read("styles.css");

const REQUIRED_REST_IDS = [
  "opening-start",
  "opening-headline",
  "hand-0",
  "work-0",
  "work-1",
  "work-2"
];

const COMPOSED_MIN = 0.85;
const INNER = 700;
const VIEWPORT = { width: 360, height: INNER };

const beatBlock = siteJs.match(
  /const\s+BEAT_DWELL\s*=\s*\{[\s\S]*?hand:\s*(\[[^\]]+\])[\s\S]*?work:\s*(\[[^\]]+\])/
);
if (!beatBlock) fail("could not read live BEAT_DWELL anchors from site.js");
const handAnchors = JSON.parse(beatBlock[1]);
const workAnchors = JSON.parse(beatBlock[2]);
const holdMatch = siteJs.match(/holdSvh:\s*(\d+(?:\.\d+)?)/);
const holdSvh = holdMatch ? Number(holdMatch[1]) : NaN;
if (!(holdSvh > 0) || !handAnchors.length || !workAnchors.length) {
  fail("BEAT_DWELL anchors / holdSvh must remain authored");
}

const tauMatch = siteJs.match(/sectionTau:\s*(\d+(?:\.\d+)?)/);
const sectionTau = tauMatch ? Number(tauMatch[1]) : NaN;
if (!(sectionTau > 0)) fail("SITE_MOTION.sectionTau must remain a positive damping time");

const spanMatch = index.match(
  /choreographySvh:\s*(\d+)[\s\S]*?terminalHoldSvh:\s*(\d+)/
);
if (!spanMatch) fail("could not read OPENING_SPAN authored svh from index.html");
const choreographySvh = Number(spanMatch[1]);
const terminalHoldSvh = Number(spanMatch[2]);
const choreographyEnd = choreographySvh / (choreographySvh + terminalHoldSvh);
const headlineMatch = index.match(/headlineChoreography:\s*(\d+(?:\.\d+)?)/);
const headlineChoreography = headlineMatch ? Number(headlineMatch[1]) : NaN;
if (!(headlineChoreography > 0.48) || !(headlineChoreography < 0.62)) {
  fail("OPENING_SPAN.headlineChoreography must sit inside the fully composed 0.48–0.62 headline interval");
}

if (/finalInStart\s*=\s*mobile\s*\?\s*0\.76/.test(index) || /id="finalLine"/.test(index)) {
  fail("opening-final copy window must be retired");
}
if (!/handThought0InStart:\s*0\.14/.test(siteJs) || !/handThought0InEnd:\s*0\.26/.test(siteJs)) {
  fail("Hand thought 0 in-window must stay 0.14–0.26");
}
if (!/handThought0OutStart:\s*0\.88/.test(siteJs) || !/handThought0OutEnd:\s*0\.96/.test(siteJs)) {
  fail("Hand Cut-by-hand out-window must stay 0.88–0.96");
}
if (!/thoughtOpacity\(p,\s*0\.14,\s*0\.26,\s*0\.40,\s*0\.52\)/.test(siteJs)) {
  fail("Vegas decade thought window must stay 0.14–0.26 / 0.40–0.52");
}
if (!/thoughtOpacity\(p,\s*0\.78,\s*0\.88,\s*null,\s*null\)/.test(siteJs)) {
  fail("Work rest thought window must stay 0.78–0.88");
}

const workSpanMatch = siteJs.match(/workSpans:\s*(\[[^\]]+\])/);
const workHoldMatch = siteJs.match(/workHoldFraction:\s*(\d+(?:\.\d+)?)/);
if (!workSpanMatch || !workHoldMatch) fail("could not read work span / hold fraction");
const workSpans = JSON.parse(workSpanMatch[1]);
const workHoldFraction = Number(workHoldMatch[1]);
const workSpanTotal = workSpans.reduce(function (a, b) {
  return a + b;
}, 0);
const workNorm = workSpans.map(function (s) {
  return s / workSpanTotal;
});
const workStarts = [];
{
  let acc = 0;
  for (let i = 0; i < workNorm.length; i++) {
    workStarts.push(acc);
    acc += workNorm[i];
  }
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function smoothstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function windowProgress(p, start, end) {
  if (end <= start) return p >= end ? 1 : 0;
  return smoothstep((p - start) / (end - start));
}

function thoughtOpacity(progress, inStart, inEnd, outStart, outEnd) {
  const enter = windowProgress(progress, inStart, inEnd);
  if (outStart == null) return enter;
  const leave = windowProgress(progress, outStart, outEnd);
  if (leave > 0) return Math.max(0, 1 - leave);
  return enter;
}

function remapBeatProgress(p, travel, hold, svhPx, anchors) {
  const totalTravel = Math.max(1, travel);
  const plateauPx = (hold / 100) * svhPx;
  const choreographyTravel = Math.max(1, totalTravel - anchors.length * plateauPx);
  let remaining = clamp(p, 0, 1) * totalTravel;
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
  return clamp(last + (remaining / finalPx) * (1 - last), 0, 1);
}

function workWorldReveal(p, index) {
  if (index === 0) return 1;
  const start = workStarts[index];
  const len = workNorm[index];
  if (p < start - 0.001) return 0;
  if (p >= start + len * 0.35) return 1;
  const turnEnd = start + len * (1 - workHoldFraction) * 0.85;
  const revealEnd = Math.min(turnEnd, start + len * 0.42);
  return windowProgress(p, start, revealEnd);
}

function openingTimeline(physical) {
  return clamp(physical / choreographyEnd, 0, 1);
}

function describeComposition(section, physical, choreo) {
  if (section === "opening") {
    const setup = 1 - windowProgress(choreo, 0.12, 0.26);
    const headIn = windowProgress(choreo, 0.28, 0.48);
    const headOut = windowProgress(choreo, 0.62, 0.74);
    const head = headOut > 0 ? 1 - headOut : headIn;
    if (physical <= 0.02 && setup >= COMPOSED_MIN) {
      return { id: "opening-start", ok: true };
    }
    if (head >= COMPOSED_MIN && setup <= 1 - COMPOSED_MIN) {
      return { id: "opening-headline", ok: true };
    }
    return {
      id: null,
      ok: false,
      detail:
        "opening setup=" +
        setup.toFixed(3) +
        " head=" +
        head.toFixed(3) +
        " choreo=" +
        choreo.toFixed(3)
    };
  }
  if (section === "hand") {
    const t0 = thoughtOpacity(choreo, 0.14, 0.26, 0.88, 0.96);
    const endFade = 1 - windowProgress(choreo, 0.9, 0.98);
    if (t0 * endFade >= COMPOSED_MIN) {
      return { id: "hand-0", ok: true };
    }
    return {
      id: null,
      ok: false,
      detail:
        "hand t0=" +
        t0.toFixed(3) +
        " endFade=" +
        endFade.toFixed(3) +
        " choreo=" +
        choreo.toFixed(3)
    };
  }
  const vegasThought = thoughtOpacity(choreo, 0.14, 0.26, 0.4, 0.52);
  const restThought = thoughtOpacity(choreo, 0.78, 0.88, null, null);
  const world1 = workWorldReveal(choreo, 1);
  const world2 = workWorldReveal(choreo, 2);
  if (vegasThought >= COMPOSED_MIN && world1 < 0.5) {
    return { id: "work-0", ok: true };
  }
  if (world1 >= COMPOSED_MIN && vegasThought <= 1 - COMPOSED_MIN && restThought <= 1 - COMPOSED_MIN) {
    return { id: "work-1", ok: true };
  }
  if (restThought >= COMPOSED_MIN && world2 >= COMPOSED_MIN) {
    return { id: "work-2", ok: true };
  }
  return {
    id: null,
    ok: false,
    detail:
      "work vegas=" +
      vegasThought.toFixed(3) +
      " rest=" +
      restThought.toFixed(3) +
      " world1=" +
      world1.toFixed(3) +
      " world2=" +
      world2.toFixed(3) +
      " choreo=" +
      choreo.toFixed(3)
  };
}

let settle;
try {
  settle = require(path.join(root, "mobile-beat-settle.js"));
} catch (err) {
  fail("could not load mobile-beat-settle.js: " + err.message);
}

if (typeof settle.chooseAdjacentDestination !== "function" || typeof settle.collectRests !== "function") {
  fail("helper must export chooseAdjacentDestination and collectRests");
}

const settleMaxMatch = helperSrc.match(/SETTLE_MAX_MS\s*=\s*(\d+)/);
const SETTLE_MAX_MS = settleMaxMatch ? Number(settleMaxMatch[1]) : NaN;
if (!(SETTLE_MAX_MS > 0)) fail("SETTLE_MAX_MS must remain a positive settle duration");
const arriveK = 1 - Math.exp(-(SETTLE_MAX_MS / 1000) / sectionTau);

function installSamsungGeometry() {
  const width = VIEWPORT.width;
  const inner = VIEWPORT.height;
  const rootEl = {
    style: { touchAction: "", overflow: "", overflowX: "", overflowY: "" },
    classList: { contains: () => false },
    offsetHeight: 1,
    scrollHeight: Math.round(inner * 8.2),
    appendChild() {}
  };
  const body = {
    style: { touchAction: "", overflow: "", overflowX: "", overflowY: "" },
    offsetHeight: 1,
    scrollHeight: rootEl.scrollHeight
  };
  const makeSection = (id, documentTop, height) => ({
    id,
    offsetHeight: height,
    getBoundingClientRect: () => ({
      top: documentTop - (global.window ? global.window.scrollY : 0),
      height: inner
    })
  });
  const sections = {
    opening: makeSection("opening", 0, inner * 2.8),
    hand: makeSection("hand", inner * 1.8, inner * 2.8),
    work: makeSection("work", inner * 3.6, inner * 4.5)
  };
  const matchMedia = (query) => {
    const q = String(query);
    let matches = false;
    if (q.indexOf("max-width") >= 0) matches = width <= 700;
    if (q.indexOf("prefers-reduced-motion") >= 0) matches = false;
    return {
      matches,
      addEventListener() {},
      addListener() {},
      removeEventListener() {},
      removeListener() {}
    };
  };
  global.window = {
    matchMedia,
    addEventListener() {},
    removeEventListener() {},
    scrollY: 0,
    pageYOffset: 0,
    innerHeight: inner,
    innerWidth: width,
    scrollTo(a, b) {
      const top = a && typeof a === "object" ? a.top || 0 : b || 0;
      this.scrollY = top;
      this.pageYOffset = top;
    },
    BEAT_DWELL: { holdSvh: holdSvh, hand: handAnchors, work: workAnchors },
    OPENING_SPAN: {
      choreographySvh: choreographySvh,
      terminalHoldSvh: terminalHoldSvh,
      choreographyEnd: choreographyEnd,
      headlineChoreography: headlineChoreography
    }
  };
  global.document = {
    documentElement: rootEl,
    body,
    getElementById: (id) => sections[id] || null,
    addEventListener() {},
    removeEventListener() {},
    hidden: false,
    createElement: () => ({
      setAttribute() {},
      style: { cssText: "" },
      getBoundingClientRect: () => ({ height: inner }),
      remove() {}
    })
  };
  global.window.document = global.document;
  global.location = { search: "" };
  return { sections, inner };
}

function uninstallHarness() {
  try {
    settle.detach();
  } catch (err) {}
  delete global.window;
  delete global.document;
  delete global.location;
}

const geometry = installSamsungGeometry();
settle.attach();
const rests = settle.collectRests();
if (!rests || !rests.length) fail("360x700 homepage must expose authored rests");

const restIds = rests.map((rest) => rest.id);
if (
  restIds.length !== REQUIRED_REST_IDS.length ||
  restIds.some((id, i) => id !== REQUIRED_REST_IDS[i])
) {
  fail(
    "authored rest order must be exactly the six rests [" +
      REQUIRED_REST_IDS.join(", ") +
      "] (got " +
      JSON.stringify(restIds) +
      ")"
  );
}

const openingTravel = geometry.inner * 2.8 - geometry.inner;
const handTop = geometry.inner * 1.8;
const handTravel = geometry.inner * 2.8 - geometry.inner;
const workTop = geometry.inner * 3.6;
const workTravel = geometry.inner * 4.5 - geometry.inner;

function owningSection(y) {
  if (y < handTop) return "opening";
  if (y < workTop) return "hand";
  return "work";
}

function physicalFor(section, y) {
  if (section === "opening") return clamp(y / openingTravel, 0, 1);
  if (section === "hand") return clamp((y - handTop) / handTravel, 0, 1);
  return clamp((y - workTop) / workTravel, 0, 1);
}

function choreoFor(section, physical) {
  if (section === "opening") return openingTimeline(physical);
  if (section === "hand") {
    return remapBeatProgress(physical, handTravel, holdSvh, geometry.inner, handAnchors);
  }
  return remapBeatProgress(physical, workTravel, holdSvh, geometry.inner, workAnchors);
}

function compositionAtY(y) {
  const section = owningSection(y);
  const physical = physicalFor(section, y);
  const choreo = choreoFor(section, physical);
  const composed = describeComposition(section, physical, choreo);
  return {
    y: y,
    section: section,
    physical: physical,
    choreo: choreo,
    composed: composed
  };
}

function laggedY(fromY, toY) {
  return fromY + (toY - fromY) * arriveK;
}

function plateauInteriorMargin(rest) {
  const width = rest.end - rest.start;
  if (!(width > 0)) return 0;
  return Math.max(1, Math.floor(width * 0.25));
}

const recorded = {
  "opening-headline": { start: 693, end: 693 }
};

rests.forEach((rest) => {
  const want = recorded[rest.id];
  if (!want) return;
  if (Math.abs(rest.start - want.start) > 2 || Math.abs(rest.end - want.end) > 2) {
    fail(
      "360x700 rest " +
        rest.id +
        " drifted from the recorded Samsung geometry (got " +
        rest.start +
        ".." +
        rest.end +
        ", recorded " +
        want.start +
        ".." +
        want.end +
        ")"
    );
  }
});

function assertLanding(originIndex, originY, dy, dir) {
  const got = settle.chooseAdjacentDestination(originIndex, dy, rests);
  if (!got) fail("chooseAdjacentDestination returned nothing from " + rests[originIndex].id);
  if (got.index === originIndex || got.y == null) {
    fail(dir + " from " + rests[originIndex].id + " must advance one rest");
  }
  if (Math.abs(got.index - originIndex) !== 1) {
    fail("adjacent landing escaped ±1 rest from " + rests[originIndex].id);
  }
  const dest = rests[got.index];
  if (got.y < dest.start || got.y > dest.end) {
    fail(dir + " landing from " + rests[originIndex].id + " must lie inside " + dest.id);
  }
  const exact = compositionAtY(got.y);
  if (!exact.composed.ok) {
    fail(
      dir +
        " landing y=" +
        got.y +
        " on " +
        dest.id +
        " is not itself a composed render state (" +
        exact.composed.detail +
        ")"
    );
  }
  const margin = plateauInteriorMargin(dest);
  if (margin > 0 && (got.y < dest.start + margin || got.y > dest.end - margin)) {
    fail(
      dir +
        " landing on " +
        dest.id +
        " aims at the plateau edge y=" +
        got.y +
        " (" +
        dest.start +
        ".." +
        dest.end +
        "). Edge aim leaves the damped visual clock in the empty/black transition; aim at the composed interior."
    );
  }
  let visualY = got.y;
  let sample = exact;
  if (margin > 0) {
    visualY = laggedY(originY, got.y);
    sample = compositionAtY(visualY);
    if (!sample.composed.ok) {
      fail(
        dir +
          " " +
          rests[originIndex].id +
          " → " +
          dest.id +
          " lands at y=" +
          got.y +
          " but the damped visual sample y=" +
          Math.round(visualY) +
          " is not a composed beat (" +
          sample.composed.detail +
          ")"
      );
    }
    if (sample.composed.id !== dest.id) {
      fail(
        dir +
          " " +
          dest.id +
          " landing visual is composed as " +
          sample.composed.id +
          " instead of " +
          dest.id
      );
    }
  }
  return {
    from: rests[originIndex].id,
    to: dest.id,
    dir: dir,
    index: got.index,
    y: got.y,
    visual: Math.round(visualY),
    beat: sample.composed.id
  };
}

const landings = [];
let cursorIndex = 0;
let cursorY = rests[0].start;
for (let step = 1; step < rests.length; step++) {
  const landing = assertLanding(cursorIndex, cursorY, -80, "forward");
  landings.push(landing);
  cursorIndex = landing.index;
  cursorY = landing.y;
}
if (cursorIndex !== rests.length - 1) {
  fail("forward passage must finish on the last authored rest");
}
for (let step = 1; step < rests.length; step++) {
  const landing = assertLanding(cursorIndex, cursorY, 80, "reverse");
  landings.push(landing);
  cursorIndex = landing.index;
  cursorY = landing.y;
}
if (cursorIndex !== 0) fail("reverse passage must finish on opening-start");

if (landings.length !== 10) {
  fail("expected the 10 forward/reverse adjacent landings across six rests, got " + landings.length);
}

const swipeFromStart = settle.chooseAdjacentDestination(0, -400, rests);
if (!swipeFromStart || swipeFromStart.index !== 1) {
  fail("a long forward swipe from opening-start must still advance exactly one rest");
}
const firstPlateau = rests[1];
const firstSample = compositionAtY(laggedY(rests[0].start, swipeFromStart.y));
if (!firstSample.composed.ok || firstSample.composed.id !== "opening-headline") {
  fail(
    "the first forward landing must visually resolve to the opening-headline composed beat, not opening-final or the studio→ring black handoff (got " +
      JSON.stringify(firstSample.composed) +
      " at y=" +
      swipeFromStart.y +
      ")"
  );
}
if (
  firstPlateau.end > firstPlateau.start &&
  (swipeFromStart.y === firstPlateau.start || swipeFromStart.y === firstPlateau.end)
) {
  fail(
    "opening-headline landing y=" +
      swipeFromStart.y +
      " is the plateau edge; the composed hold is the interior of " +
      firstPlateau.start +
      ".." +
      firstPlateau.end
  );
}

if (!/height:\s*calc\(\s*100dvh\s*\+\s*180svh\s*\)/.test(styles) || !/height:\s*calc\(\s*100dvh\s*\+\s*350svh\s*\)/.test(styles)) {
  fail("mobile Hand/Work travel used by this geometry must remain 180svh / 350svh");
}

uninstallHarness();

console.log(
  "PASS: mobile composed rest landings (10 adjacent gestures; damped visual sample stays on a fully composed beat; opening-headline/hand/vegas/heirloom/terminal interiors; six authored rest identities preserved)"
);
