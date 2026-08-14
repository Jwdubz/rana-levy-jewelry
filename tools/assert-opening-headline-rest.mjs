#!/usr/bin/env node
/**
 * Fail-before / pass-after: the fully composed opening headline must be
 * an authored adjacent rest. Exact parent 63e095c collects
 * opening-start → opening-final and therefore skips “Custom Gems Turn
 * Heads” on a long swipe. The candidate must insert opening-headline
 * between those rests. This correction then retires opening-final as a
 * swipe destination so the next rest is the workbench. Headline invert
 * stays 0.55 inside 0.48–0.62.
 *
 * Usage: node tools/assert-opening-headline-rest.mjs
 *
 * Residue: opening-headline authored rest tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator editing homepage opening rests / OPENING_SPAN / collectRests
 * Activation: execute — node tools/assert-opening-headline-rest.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when opening-headline is retired or the adjacent-rest contract is superseded
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const PARENT = "63e095c6c976288874769056e2c95b46e1b04b72";

const EXPECTED_IDS = [
  "opening-start",
  "opening-headline",
  "hand-0",
  "work-0",
  "work-1"
];
const PARENT_IDS = [
  "opening-start",
  "opening-final",
  "hand-0",
  "hand-1",
  "work-0",
  "work-1",
  "work-2",
  "work-terminal"
];
const HEADLINE_COMPOSED_START = 0.48;
const HEADLINE_COMPOSED_END = 0.62;
const HEADLINE_ANCHOR = 0.55;
const GEOMETRIES = [
  { width: 320, height: 700 },
  { width: 360, height: 700 },
  { width: 375, height: 812 },
  { width: 430, height: 932 }
];

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n?/g, "\n");
}

function gitShow(commit, rel) {
  return execFileSync("git", ["show", commit + ":" + rel], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024
  }).replace(/\r\n?/g, "\n");
}

function parseOpeningSpan(src) {
  const svh = src.match(/choreographySvh:\s*(\d+)[\s\S]*?terminalHoldSvh:\s*(\d+)/);
  if (!svh) fail("could not read OPENING_SPAN authored svh");
  const choreographySvh = Number(svh[1]);
  const terminalHoldSvh = Number(svh[2]);
  const choreographyEnd = choreographySvh / (choreographySvh + terminalHoldSvh);
  const headlineMatch = src.match(/headlineChoreography:\s*(\d+(?:\.\d+)?)/);
  return {
    choreographySvh,
    terminalHoldSvh,
    choreographyEnd,
    headlineChoreography: headlineMatch ? Number(headlineMatch[1]) : null
  };
}

function loadHelper(src, tag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rana-opening-headline-"));
  const file = path.join(dir, tag + ".js");
  fs.writeFileSync(file, src);
  try {
    const resolved = require.resolve(file);
    delete require.cache[resolved];
    return require(file);
  } finally {
    try {
      fs.unlinkSync(file);
      fs.rmdirSync(dir);
    } catch (err) {}
  }
}

function installHarness(opts) {
  const width = opts.width;
  const inner = opts.height;
  const quiet = !!opts.quiet;
  const reduced = !!opts.reduced;
  const span = opts.span;
  const legacy = !!opts.legacyGeometry;
  const openMul = legacy ? 3.4 : 2.8;
  const handTopMul = legacy ? 2.4 : 1.8;
  const handMul = legacy ? 3.4 : 2.8;
  const workTopMul = legacy ? 4.8 : 3.6;
  const rootEl = {
    style: { touchAction: "", overflow: "", overflowX: "", overflowY: "" },
    classList: { contains: (name) => quiet && name === "is-quiet" },
    offsetHeight: 1,
    scrollHeight: Math.round(inner * (legacy ? 9.3 : 7.5)),
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
    opening: makeSection("opening", 0, inner * openMul),
    hand: makeSection("hand", inner * handTopMul, inner * handMul),
    work: makeSection("work", inner * workTopMul, inner * (legacy ? 4.5 : 3.9))
  };
  const matchMedia = (query) => {
    const q = String(query);
    let matches = false;
    if (q.indexOf("max-width") >= 0) matches = width <= 700;
    if (q.indexOf("prefers-reduced-motion") >= 0) matches = reduced;
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
    listeners.set(
      key,
      (listeners.get(key) || []).filter((item) => item !== fn)
    );
  }
  function emit(target, name, event) {
    (listeners.get(target + ":" + name) || []).forEach((fn) => fn(event));
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
    innerHeight: inner,
    innerWidth: width,
    scrollTo(a, b) {
      const top = a && typeof a === "object" ? a.top || 0 : b || 0;
      this.scrollY = top;
      this.pageYOffset = top;
    },
    BEAT_DWELL: legacy
      ? { holdSvh: 60, hand: [0.28, 0.86], work: [0.28, 0.55, 0.88] }
      : { holdSvh: 60, hand: [0.50], work: [0.28, 0.88] },
    OPENING_SPAN: {
      choreographySvh: span.choreographySvh,
      terminalHoldSvh: span.terminalHoldSvh,
      choreographyEnd: span.choreographyEnd,
      headlineChoreography: span.headlineChoreography
    }
  };
  global.document = {
    documentElement: rootEl,
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
      getBoundingClientRect: () => ({ height: inner }),
      remove() {}
    })
  };
  global.window.document = global.document;
  global.location = { search: quiet ? "?motion=quiet" : "" };
  global.requestAnimationFrame = function (fn) {
    fn((typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()) + 1000);
    return 1;
  };
  global.cancelAnimationFrame = function () {};
  return { root: rootEl, body, emit, inner, sections };
}

function uninstall(helper) {
  try {
    if (helper && typeof helper.detach === "function") helper.detach();
  } catch (err) {}
  delete global.window;
  delete global.document;
  delete global.location;
}

function emitSwipe(emit, startY, endY) {
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

function idsOf(rests) {
  return (rests || []).map((rest) => rest.id);
}

function sameIds(got, want) {
  return got.length === want.length && got.every((id, i) => id === want[i]);
}

const parentSha = execFileSync("git", ["rev-parse", "--verify", PARENT], {
  cwd: root,
  encoding: "utf8"
}).trim();
if (parentSha !== PARENT) fail("exact parent " + PARENT + " must be present in this worktree");

const candidateIndex = read("index.html");
const candidateHelperSrc = read("mobile-beat-settle.js");
const parentIndex = gitShow(PARENT, "index.html");
const parentHelperSrc = gitShow(PARENT, "mobile-beat-settle.js");

if (!/id="headline"/.test(candidateIndex) || !/Custom Gems/.test(candidateIndex)) {
  fail("index.html must still render the opening headline at #headline");
}
if (!/headInEnd\s*=\s*mobile\s*\?\s*0\.48/.test(candidateIndex) || !/headOutStart\s*=\s*mobile\s*\?\s*0\.62/.test(candidateIndex)) {
  fail("mobile headline composed interval must stay 0.48–0.62; do not retime the opening");
}
if (!/window\.OPENING_SPAN\s*=\s*OPENING_SPAN/.test(candidateIndex)) {
  fail("headline choreography must be exposed through the existing OPENING_SPAN contract");
}

const candidateSpan = parseOpeningSpan(candidateIndex);
const parentSpan = parseOpeningSpan(parentIndex);
if (candidateSpan.headlineChoreography !== HEADLINE_ANCHOR) {
  fail(
    "OPENING_SPAN.headlineChoreography must be the fully composed mobile center 0.55 (got " +
      candidateSpan.headlineChoreography +
      ")"
  );
}
if (
  !(candidateSpan.headlineChoreography > HEADLINE_COMPOSED_START) ||
  !(candidateSpan.headlineChoreography < HEADLINE_COMPOSED_END)
) {
  fail("headlineChoreography must lie strictly inside the fully composed 0.48–0.62 interval");
}
if (parentSpan.headlineChoreography != null) {
  fail("exact parent 63e095c OPENING_SPAN must not already expose headlineChoreography");
}
if (/opening-headline/.test(parentHelperSrc)) {
  fail("exact parent 63e095c collectRests must not already name opening-headline");
}

const parentHelper = loadHelper(parentHelperSrc, "parent");
const candidateHelper = loadHelper(candidateHelperSrc, "candidate");

{
  const harness = installHarness({
    width: 360,
    height: 700,
    span: parentSpan,
    legacyGeometry: true
  });
  parentHelper.attach();
  const parentRests = parentHelper.collectRests();
  const parentIds = idsOf(parentRests);
  if (parentIds.indexOf("opening-headline") >= 0) {
    fail("exact parent 63e095c collected rests must lack opening-headline (got " + JSON.stringify(parentIds) + ")");
  }
  if (!sameIds(parentIds, PARENT_IDS)) {
    fail(
      "exact parent 63e095c rest order must be the eight-rest sequence without the headline (got " +
        JSON.stringify(parentIds) +
        ")"
    );
  }
  const parentSwipe = parentHelper.chooseAdjacentDestination(0, -580, parentRests);
  if (!parentSwipe || parentSwipe.index !== 1 || parentRests[parentSwipe.index].id !== "opening-final") {
    fail(
      "exact parent 63e095c long swipe from opening-start must skip the omitted headline and land on opening-final (got " +
        JSON.stringify(parentSwipe) +
        " ids=" +
        JSON.stringify(parentIds) +
        ")"
    );
  }
  uninstall(parentHelper);
}

const reported = [];
GEOMETRIES.forEach((geo) => {
  const harness = installHarness({
    width: geo.width,
    height: geo.height,
    span: candidateSpan
  });
  candidateHelper.attach();
  const rests = candidateHelper.collectRests();
  const ids = idsOf(rests);
  if (!sameIds(ids, EXPECTED_IDS)) {
    fail(
      geo.width +
        "x" +
        geo.height +
        " must collect the five ordered rests (got " +
        JSON.stringify(ids) +
        ")"
    );
  }
  if (ids.indexOf("opening-final") >= 0) {
    fail("opening-final must not remain a mobile swipe destination");
  }
  const start = rests[0];
  const headline = rests[1];
  const next = rests[2];
  if (start.id !== "opening-start" || headline.id !== "opening-headline" || next.id !== "hand-0") {
    fail("candidate order must start opening-start, opening-headline, hand-0");
  }
  if (!(headline.start === headline.end)) {
    fail("opening-headline must be a stable composed point rest, not a re-timed plateau");
  }
  if (!(headline.start > start.end) || !(headline.end < next.start)) {
    fail(
      "opening-headline must lie strictly between opening-start and hand-0 at " +
        geo.width +
        "x" +
        geo.height +
        " (got " +
        headline.start +
        " in " +
        start.end +
        ".." +
        next.start +
        ")"
    );
  }
  const openingTravel = geo.height * 2.8 - geo.height;
  const physical = headline.start / openingTravel;
  const choreo = physical / candidateSpan.choreographyEnd;
  if (choreo < HEADLINE_COMPOSED_START || choreo > HEADLINE_COMPOSED_END) {
    fail(
      "opening-headline choreography " +
        choreo.toFixed(4) +
        " is outside the fully composed 0.48–0.62 interval at " +
        geo.width +
        "x" +
        geo.height
    );
  }
  if (Math.abs(choreo - HEADLINE_ANCHOR) > 0.01) {
    fail(
      "opening-headline must invert OPENING_SPAN.headlineChoreography 0.55 (got choreo=" +
        choreo.toFixed(4) +
        " at " +
        geo.width +
        "x" +
        geo.height +
        ")"
    );
  }
  const wantPhysical = HEADLINE_ANCHOR * candidateSpan.choreographyEnd;
  const wantY = candidateHelper.operationalRest({
    id: "opening-headline",
    start: wantPhysical * openingTravel,
    end: wantPhysical * openingTravel
  });
  if (headline.start !== wantY.start || headline.end !== wantY.end) {
    fail(
      "opening-headline y must be the reachable invert of 0.55 (got " +
        headline.start +
        ".." +
        headline.end +
        ", want " +
        wantY.start +
        ".." +
        wantY.end +
        " at " +
        geo.width +
        "x" +
        geo.height +
        ")"
    );
  }

  const forward1 = candidateHelper.chooseAdjacentDestination(0, -580, rests);
  if (!forward1 || forward1.index !== 1 || rests[forward1.index].id !== "opening-headline") {
    fail(
      "long forward swipe from opening-start must land at opening-headline at " +
        geo.width +
        "x" +
        geo.height +
        " (got " +
        JSON.stringify(forward1) +
        ")"
    );
  }
  const forward2 = candidateHelper.chooseAdjacentDestination(1, -580, rests);
  if (!forward2 || forward2.index !== 2 || rests[forward2.index].id !== "hand-0") {
    fail(
      "next forward swipe from opening-headline must land at hand-0 at " +
        geo.width +
        "x" +
        geo.height +
        " (got " +
        JSON.stringify(forward2) +
        ")"
    );
  }
  const reverse1 = candidateHelper.chooseAdjacentDestination(2, 580, rests);
  if (!reverse1 || reverse1.index !== 1 || rests[reverse1.index].id !== "opening-headline") {
    fail(
      "reverse from hand-0 must return through opening-headline at " +
        geo.width +
        "x" +
        geo.height +
        " (got " +
        JSON.stringify(reverse1) +
        ")"
    );
  }
  const reverse2 = candidateHelper.chooseAdjacentDestination(1, 580, rests);
  if (!reverse2 || reverse2.index !== 0 || rests[reverse2.index].id !== "opening-start") {
    fail(
      "reverse from opening-headline must return to opening-start at " +
        geo.width +
        "x" +
        geo.height +
        " (got " +
        JSON.stringify(reverse2) +
        ")"
    );
  }

  let cursor = 0;
  const pathIds = [rests[0].id];
  for (let i = 1; i < rests.length; i++) {
    const step = candidateHelper.chooseAdjacentDestination(cursor, -400, rests);
    if (!step || step.index !== cursor + 1) {
      fail("forward adjacency escaped ±1 at " + rests[cursor].id);
    }
    pathIds.push(rests[step.index].id);
    cursor = step.index;
  }
  if (!sameIds(pathIds, EXPECTED_IDS)) {
    fail("forward adjacency path must include the added rest without losing any existing rest (got " + JSON.stringify(pathIds) + ")");
  }
  for (let i = 1; i < rests.length; i++) {
    const step = candidateHelper.chooseAdjacentDestination(cursor, 400, rests);
    if (!step || step.index !== cursor - 1) {
      fail("reverse adjacency escaped ±1 at " + rests[cursor].id);
    }
    cursor = step.index;
  }
  if (cursor !== 0) fail("reverse adjacency path must finish on opening-start");

  window.scrollTo(0, start.start);
  emitSwipe(harness.emit, 620, 40);
  if (window.scrollY !== forward1.y) {
    fail(
      "simulated long swipe from opening-start must settle on opening-headline y=" +
        forward1.y +
        " (got " +
        window.scrollY +
        " at " +
        geo.width +
        "x" +
        geo.height +
        ")"
    );
  }
  emitSwipe(harness.emit, 620, 40);
  if (window.scrollY !== forward2.y) {
    fail(
      "simulated next swipe must settle on hand-0 y=" +
        forward2.y +
        " (got " +
        window.scrollY +
        " at " +
        geo.width +
        "x" +
        geo.height +
        ")"
    );
  }
  emitSwipe(harness.emit, 40, 620);
  if (window.scrollY !== reverse1.y) {
    fail(
      "simulated reverse swipe must return through opening-headline y=" +
        reverse1.y +
        " (got " +
        window.scrollY +
        " at " +
        geo.width +
        "x" +
        geo.height +
        ")"
    );
  }

  reported.push({
    geometry: geo.width + "x" + geo.height,
    ids: ids,
    headline: { start: headline.start, end: headline.end, choreo: Number(choreo.toFixed(4)) },
    hand0: { start: next.start, end: next.end }
  });
  uninstall(candidateHelper);
});

{
  const harness = installHarness({
    width: 375,
    height: 812,
    span: candidateSpan,
    reduced: true
  });
  candidateHelper.boot();
  if (harness.body.style.overflowY !== "hidden") {
    fail("reduced-motion must still attach and lock body overflow so adjacency owns the gesture");
  }
  const rests = candidateHelper.collectRests();
  if (!sameIds(idsOf(rests), EXPECTED_IDS)) {
    fail("reduced-motion must retain the same five ordered rests (got " + JSON.stringify(idsOf(rests)) + ")");
  }
  window.scrollTo(0, rests[0].start);
  emitSwipe(harness.emit, 620, 40);
  const wantHeadline = candidateHelper.chooseAdjacentDestination(0, -580, rests);
  if (!wantHeadline || rests[wantHeadline.index].id !== "opening-headline" || window.scrollY !== wantHeadline.y) {
    fail(
      "reduced-motion long swipe from opening-start must land at opening-headline (got y=" +
        window.scrollY +
        ", dest=" +
        JSON.stringify(wantHeadline) +
        ")"
    );
  }
  emitSwipe(harness.emit, 620, 40);
  const wantFinal = candidateHelper.chooseAdjacentDestination(1, -580, rests);
  if (!wantFinal || rests[wantFinal.index].id !== "hand-0" || window.scrollY !== wantFinal.y) {
    fail("reduced-motion next swipe must land at hand-0");
  }
  emitSwipe(harness.emit, 40, 620);
  if (window.scrollY !== wantHeadline.y) {
    fail("reduced-motion reverse must return through opening-headline");
  }
  uninstall(candidateHelper);
}

{
  const harness = installHarness({
    width: 375,
    height: 812,
    span: candidateSpan,
    quiet: true
  });
  candidateHelper.boot();
  if (harness.body.style.overflowY === "hidden" || harness.root.style.touchAction) {
    fail("quiet mode must remain native (no body lock / touch-action policy)");
  }
  const quietRests = candidateHelper.collectRests();
  if (quietRests && quietRests.length) {
    fail("quiet mode must not attach the beat controller or expose owned rests (got " + JSON.stringify(idsOf(quietRests)) + ")");
  }
  uninstall(candidateHelper);
}

{
  const harness = installHarness({
    width: 800,
    height: 812,
    span: candidateSpan
  });
  candidateHelper.boot();
  if (harness.body.style.overflowY === "hidden" || harness.root.style.touchAction) {
    fail("desktop must remain native (no body lock / touch-action policy)");
  }
  const desktopRests = candidateHelper.collectRests();
  if (desktopRests && desktopRests.length) {
    fail("desktop must not attach the beat controller (got " + JSON.stringify(idsOf(desktopRests)) + ")");
  }
  uninstall(candidateHelper);
}

if (typeof candidateHelper.deriveOpeningHeadlinePhysical !== "function") {
  fail("helper must export deriveOpeningHeadlinePhysical so the headline invert is executable");
}
const inverted = candidateHelper.deriveOpeningHeadlinePhysical(candidateSpan);
if (!inverted || inverted.startP !== inverted.endP) {
  fail("headline invert must be a point at the composed frame");
}
if (Math.abs(inverted.startP - HEADLINE_ANCHOR * candidateSpan.choreographyEnd) > 1e-12) {
  fail("headline invert must be headlineChoreography * choreographyEnd");
}

console.log(
  "PASS: opening-headline authored rest (parent 63e095c skips headline; candidate five rests start opening-start, opening-headline, hand-0; 0.55 invert inside 0.48–0.62; opening-final retired; forward/reverse adjacency; reduce keeps ownership; quiet/desktop native)"
);
console.log(JSON.stringify(reported));
