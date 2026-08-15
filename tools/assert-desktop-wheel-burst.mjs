#!/usr/bin/env node
/**
 * Source + math assertion: desktop wheel/trackpad burst adjacency.
 *
 * A wheel gesture is a burst, not an event. One huge delta, a burst of
 * many small deltas, and a momentum tail must commit at most one adjacent
 * authored rest. Reverse is symmetric. A genuine quiet interval starts a
 * new burst. Native vertical wheel is owned while attached; Ctrl/zoom,
 * horizontal pan, and editable targets stay native.
 *
 * Usage: node tools/assert-desktop-wheel-burst.mjs
 *
 * Residue: desktop wheel-burst adjacency tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator editing homepage desktop wheel ownership / burst latch
 * Activation: execute — node tools/assert-desktop-wheel-burst.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when desktop wheel-burst adjacency is retired or superseded
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

const helper = read("mobile-beat-settle.js");
let settle;
try {
  settle = require(path.join(root, "mobile-beat-settle.js"));
} catch (err) {
  fail("mobile-beat-settle.js must load in Node for the wheel-burst contract: " + err.message);
}

if (typeof settle.advanceWheelBurst !== "function") {
  fail("helper must export advanceWheelBurst");
}
if (typeof settle.createWheelBurst !== "function") {
  fail("helper must export createWheelBurst");
}
if (typeof settle.normalizeWheelDeltaY !== "function") {
  fail("helper must export normalizeWheelDeltaY");
}
if (!(settle.WHEEL_THRESHOLD_PX > 0)) fail("WHEEL_THRESHOLD_PX must be a positive deliberate threshold");
if (!(settle.WHEEL_QUIET_MS > 0)) fail("WHEEL_QUIET_MS must be a positive quiet interval");

const onWheelFn = extractFn(helper, "onWheel");
if (!onWheelFn) fail("could not isolate onWheel");
if (!/preventDefault\s*\(/.test(onWheelFn)) {
  fail("owned vertical wheel must call preventDefault");
}
if (!/ctrlKey/.test(onWheelFn) || !/metaKey/.test(onWheelFn)) {
  fail("Ctrl/Meta wheel zoom gestures must remain native");
}
if (!/classifyWheelIntent|horizontal/.test(onWheelFn)) {
  fail("horizontal wheel/pan must remain native");
}
if (!/isEditableTarget/.test(onWheelFn)) {
  fail("editable controls must not be hijacked by wheel ownership");
}
if (!/advanceWheelBurst/.test(onWheelFn)) {
  fail("onWheel must run the burst state machine rather than treating each event as a beat");
}

const wheelBinds = [...helper.matchAll(/addEventListener\(\s*"wheel"\s*,\s*([^,]+)\s*,\s*(\{[^}]*\})/g)];
if (!wheelBinds.length) fail("wheel must be registered with an options object");
if (!wheelBinds.some((m) => /passive:\s*false/.test(m[2]))) {
  fail("wheel must be registered non-passive so preventDefault can cancel native vertical travel");
}
if (wheelBinds.some((m) => /passive:\s*true/.test(m[2]))) {
  fail("wheel must not be registered passively while the controller owns vertical travel");
}

const attachFn = extractFn(helper, "attach");
if (!attachFn) fail("could not isolate attach");
if (/isMobileViewport\(\)/.test(attachFn)) {
  fail("attach must not refuse desktop; wheel ownership requires desktop attach");
}
if (!/quietModeActive\(\)/.test(attachFn)) {
  fail("attach must still refuse explicit quiet mode");
}

const rests = [
  { id: "opening-start", start: 0, end: 0 },
  { id: "opening-headline", start: 700, end: 700 },
  { id: "hand-0", start: 1800, end: 2200 },
  { id: "work-0", start: 3600, end: 4200 }
];

function runBurst(deltas, originIndex) {
  const origin = rests[originIndex];
  const originY = origin.start === origin.end ? origin.start : Math.round((origin.start + origin.end) / 2);
  let burst = settle.createWheelBurst(originIndex, originY, 0);
  const steps = [];
  deltas.forEach((delta, i) => {
    const result = settle.advanceWheelBurst(burst, delta, rests, 10 + i);
    if (result.expired) fail("burst expired inside its own quiet window");
    steps.push(result);
  });
  return { burst, steps, originY };
}

{
  const huge = runBurst([2400], 0);
  const last = huge.steps[huge.steps.length - 1];
  if (last.action !== "commit" || last.destIndex !== 1) {
    fail("one huge forward delta must commit exactly one adjacent rest (got " + JSON.stringify(last) + ")");
  }
  if (last.destY !== 700) {
    fail("huge forward burst must land on opening-headline center (got " + last.destY + ")");
  }
}

{
  const tiny = [];
  for (let i = 0; i < 80; i++) tiny.push(2);
  const burst = runBurst(tiny, 0);
  const commits = burst.steps.filter((step) => step.action === "commit");
  const tails = burst.steps.filter((step) => step.action === "tail");
  if (commits.length !== 1) {
    fail("a burst of tiny forward deltas must commit exactly once (got " + commits.length + ")");
  }
  if (commits[0].destIndex !== 1) {
    fail("tiny-delta burst must still land on the next rest only");
  }
  if (!tails.length) {
    fail("momentum-tail deltas after commit must latch rather than start another beat");
  }
  if (tails.some((step) => step.destIndex !== 1)) {
    fail("momentum tail must keep the committed adjacent destination");
  }
}

{
  const reverse = runBurst([-2400], 2);
  const last = reverse.steps[reverse.steps.length - 1];
  if (last.action !== "commit" || last.destIndex !== 1) {
    fail("one huge reverse delta must commit exactly one adjacent rest backward (got " + JSON.stringify(last) + ")");
  }
}

{
  const tiny = [];
  for (let i = 0; i < 80; i++) tiny.push(-2);
  const burst = runBurst(tiny, 3);
  const commits = burst.steps.filter((step) => step.action === "commit");
  if (commits.length !== 1 || commits[0].destIndex !== 2) {
    fail("tiny reverse burst must commit exactly one rest backward onto hand-0");
  }
}

{
  const under = runBurst([1, 1, 1], 0);
  if (under.steps.some((step) => step.action === "commit")) {
    fail("deltas below the deliberate threshold must not commit a rest");
  }
}

{
  const first = settle.createWheelBurst(0, 0, 0);
  const commit = settle.advanceWheelBurst(first, 2000, rests, 10);
  if (commit.action !== "commit" || commit.destIndex !== 1) {
    fail("setup commit for quiet-interval test failed");
  }
  const expired = settle.advanceWheelBurst(first, 2000, rests, 10 + settle.WHEEL_QUIET_MS + 1);
  if (!expired.expired) {
    fail("a genuine quiet interval must expire the burst so the next gesture can own a new origin");
  }
  const second = settle.createWheelBurst(1, 700, 10 + settle.WHEEL_QUIET_MS + 2);
  const next = settle.advanceWheelBurst(second, 2000, rests, 10 + settle.WHEEL_QUIET_MS + 2);
  if (next.action !== "commit" || next.destIndex !== 2) {
    fail("after a quiet interval the next burst may advance exactly one more rest (got " + JSON.stringify(next) + ")");
  }
}

if (settle.normalizeWheelDeltaY(3, 1) !== 3 * settle.WHEEL_LINE_PX) {
  fail("line-mode wheel deltas must normalize through WHEEL_LINE_PX");
}
if (settle.normalizeWheelDeltaY(40, 0) !== 40) {
  fail("pixel-mode wheel deltas must stay in CSS pixels");
}

if (settle.classifyWheelIntent(80, 4) !== "horizontal") {
  fail("dominant horizontal wheel must classify as horizontal");
}
if (settle.classifyWheelIntent(2, 40) !== "vertical") {
  fail("dominant vertical wheel must classify as vertical");
}

console.log(
  "PASS: desktop wheel-burst adjacency (huge delta and tiny-delta burst commit ±1 rest only; tail latches; quiet interval starts a new burst; zoom/horizontal/editable stay unowned)"
);
