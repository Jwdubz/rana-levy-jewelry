#!/usr/bin/env node
/**
 * Source assertion: direct ring → bench/lap → Selected Work home passage.
 *
 * Locks the owner-observed Hand correction:
 * - no studio-portrait world in Hand or Hand→Work
 * - responsive bench poster authority on the work bridge
 * - exact scale 1 for the Hand bench carrier
 * - Cut by hand lives on the workbench, not the opening ring
 * - rejected facet / six-year copy is absent
 *
 * Usage: node tools/assert-hand-direct-bench-passage.mjs
 *
 * Residue: hand-direct-bench-passage tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator editing Hand / Hand→Work / workbench copy
 * Activation: execute — node tools/assert-hand-direct-bench-passage.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when the direct bench Hand passage is retired or superseded
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

const index = read("index.html");
const styles = read("styles.css");
const siteJs = read("site.js");

// --- Slice Hand + Work markup authorities (not later routes) ---
const handSection = index.match(
  /id="hand"[\s\S]*?id="work"/
);
if (!handSection) fail("could not isolate Hand section markup before Work");
const workSection = index.match(
  /id="work"[\s\S]*?<\/main>/
);
if (!workSection) fail("could not isolate Work section markup");

const handMarkup = handSection[0];
const workMarkup = workSection[0];

// A. Portrait world fully retired from this home passage.
if (/id="handPortrait"/.test(handMarkup) || /id="handPortraitFrame"/.test(handMarkup)) {
  fail("Hand markup must not include #handPortrait / #handPortraitFrame");
}
if (/hand-portrait/.test(handMarkup)) {
  fail("Hand markup must not include hand-portrait class world");
}
if (/rana-studio\.webp/.test(handMarkup)) {
  fail("Hand movement must not use assets/rana-studio.webp");
}
if (/rana-studio\.webp/.test(workMarkup)) {
  fail("Work / Hand→Work bridge must not use assets/rana-studio.webp");
}
if (/handPortrait|handPortraitFrame|handPortraitFeather|portraitFocusDesktop|portraitFocusMobile/.test(siteJs)) {
  fail("site.js must retire handPortrait / portrait focus choreography identifiers");
}
if (/hand-portrait|handPortrait/.test(styles)) {
  fail("styles.css must retire .hand-portrait rules");
}
if (/handBenchScaleStart|handBenchScaleEnd/.test(siteJs)) {
  fail("site.js must retire handBenchScaleStart/End lerped overscan");
}

// B. Work bridge uses responsive bench/lap still matching Hand carrier.
const workBridgeBlock = workMarkup.match(/id="workBridge"[\s\S]*?<\/div>\s*<\/div>/);
if (!workBridgeBlock) fail("workBridge markup must be present");
const bridge = workBridgeBlock[0];
if (!/data-desktop-src="assets\/studio-poster\.jpg"/.test(bridge)) {
  fail('workBridge must declare data-desktop-src="assets/studio-poster.jpg"');
}
if (!/data-mobile-src="assets\/studio-poster-portrait\.jpg"/.test(bridge)) {
  fail('workBridge must declare data-mobile-src="assets/studio-poster-portrait.jpg"');
}
if (/rana-studio/.test(bridge)) {
  fail("workBridge must not reference rana-studio");
}

// Hand bench poster authority unchanged (phase-coherent with bridge).
const handBenchStack = handMarkup.match(/id="handBenchStack"[\s\S]*?<\/div>/);
if (!handBenchStack) fail("handBenchStack must be present");
if (
  !/data-desktop-src="assets\/studio-poster\.jpg"/.test(handBenchStack[0]) ||
  !/data-mobile-src="assets\/studio-poster-portrait\.jpg"/.test(handBenchStack[0])
) {
  fail("handBenchStack must keep desktop/mobile studio-poster sources");
}

// Exact scale 1 on the Hand bench carrier.
if (!/handBenchStack\.style\.transform\s*=\s*["']translate3d\(0,0,0\) scale\(1\)["']/.test(siteJs)) {
  fail("renderHand must pin handBenchStack transform to scale(1)");
}
if (/scale\(\s*["']\s*\+\s*benchScale|scale\("\s*\+\s*benchScale/.test(siteJs)) {
  fail("renderHand must not lerp a benchScale into the Hand carrier");
}
// Bench media parent must not keep the global -6% overscan pad.
const handBenchMedia = styles.match(/\.hand-bench\s+\.layer-media\s*\{[^}]+\}/);
if (!handBenchMedia) fail(".hand-bench .layer-media rule must exist");
if (!/\binset:\s*0\s*;/.test(handBenchMedia[0]) || !/\bwidth:\s*100%\s*;/.test(handBenchMedia[0])) {
  fail(".hand-bench .layer-media must be full-viewport inset:0 / width:100% (no overscan pad)");
}

// Opening media order and later hand-cycle assets must stay intact.
if (!/studio-opening-cluster-bench-engraving\.mp4/.test(index)) {
  fail("opening cluster-bench-engraving film must remain");
}
if (!/studio-hand-work-cycle\.mp4/.test(handMarkup)) {
  fail("Hand cycle film must remain on the bench carrier");
}

// C. Cut by hand now belongs to the workbench, not the opening ring.
if (!/handThought0InStart\s*:\s*0\.14/.test(siteJs)) {
  fail("SITE_MOTION.handThought0InStart must remain 0.14");
}
if (!/handThought0InEnd\s*:\s*0\.26/.test(siteJs)) {
  fail("SITE_MOTION.handThought0InEnd must remain 0.26");
}
if (/id="finalLine"/.test(index) || /applyOpeningFinalExit/.test(siteJs)) {
  fail("opening-final line and applyOpeningFinalExit must be retired; Cut by hand is a Hand thought");
}

const handThoughtBlock = handMarkup.match(/id="handThought0"[\s\S]*?<\/p>/);
if (!handThoughtBlock || !/Cut by hand,/.test(handThoughtBlock[0]) || !/one at a time\./.test(handThoughtBlock[0])) {
  fail('Hand thought #handThought0 must carry "Cut by hand, / one at a time."');
}
if (/id="handThought1"/.test(index)) {
  fail("retired #handThought1 stack must be absent");
}
if (/Rana works each facet at the lap\./.test(index)) {
  fail('rejected copy "Rana works each facet at the lap." must be absent');
}
if (/Cutting stones for six years\./.test(index)) {
  fail('rejected copy "Cutting stones for six years." must be absent');
}

const t0In0 = 0.14;
const t0In1 = 0.26;
const t0Out0 = 0.88;
const t0Out1 = 0.96;
const samples = [0, 0.06, 0.12, 0.13, 0.14, 0.2, 0.26, 0.5, 0.7, 0.9];
for (let i = 0; i < samples.length; i++) {
  const p = samples[i];
  const handOp = thoughtOpacity(p, t0In0, t0In1, t0Out0, t0Out1);
  if (p <= t0In0 && handOp > 0.001) {
    fail("Cut-by-hand must not enter before p=" + t0In0 + " (got " + handOp + " at p=" + p + ")");
  }
  if (p >= t0In1 && p <= 0.7 && handOp < 0.85) {
    fail("Cut-by-hand must be fully composed at p=" + p + " (got " + handOp + ")");
  }
}

console.log(
  "PASS: hand direct bench passage (no portrait world; bench workBridge; scale 1; Cut by hand on workbench; rejected facet/six-year copy absent)"
);
