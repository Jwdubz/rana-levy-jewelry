#!/usr/bin/env node
/**
 * Source assertion: mobile live-viewport geometry for homepage stickies.
 *
 * Locks the owner-observed Samsung Internet failure:
 * - sticky scenes must track the dynamic/live viewport (dvh), not remain 100svh
 * - Opening / Hand / Work totals = live sticky + existing authored svh travel
 * - negative Hand/Work overlap offsets match the live sticky viewport
 * - desktop geometry stays on the approved svh contract
 * - travel must not be rewritten as total-dvh
 * - no forbidden frame-filler grammar is introduced to hide the floor
 *
 * Usage: node tools/assert-mobile-live-viewport.mjs
 *
 * Residue: mobile-live-viewport tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator editing homepage sticky / passage / overlap heights
 * Activation: execute — node tools/assert-mobile-live-viewport.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when the live-viewport homepage contract is retired or superseded
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

function extractBlock(src, selector, afterIndex = 0) {
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

function extractAllBlocks(src, selector) {
  const out = [];
  let from = 0;
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped + "\\s*\\{", "g");
  while (from < src.length) {
    re.lastIndex = from;
    let match = null;
    while ((match = re.exec(src))) {
      let i = match.index;
      while (i > 0 && /\s/.test(src[i - 1])) i--;
      if (i > 0 && src[i - 1] === ",") continue;
      break;
    }
    if (!match) break;
    const block = extractBlock(src, selector, match.index);
    if (!block) break;
    out.push(block);
    from = match.index + match[0].length;
  }
  return out;
}

function joinedBlocks(src, selector) {
  return extractAllBlocks(src, selector).join("\n");
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

function declarations(block, prop) {
  if (!block) return [];
  const re = new RegExp("(?:^|[\\s;])" + prop + "\\s*:\\s*([^;]+);", "gi");
  const out = [];
  let m;
  while ((m = re.exec(block))) out.push(m[1].replace(/\s+/g, " ").trim());
  return out;
}

function lastDecl(block, prop) {
  const all = declarations(block, prop);
  return all.length ? all[all.length - 1] : "";
}

function hasDecl(block, prop, value) {
  const wanted = value.replace(/\s+/g, "");
  return declarations(block, prop).some((v) => v.replace(/\s+/g, "") === wanted);
}

function parseLivePlusTravel(value) {
  const compact = String(value || "").replace(/\s+/g, "");
  const m = compact.match(/^calc\(100dvh\+(\d+(?:\.\d+)?)svh\)$/);
  return m ? Number(m[1]) : null;
}

function assertNoFiller(block, label) {
  if (!block) fail(`missing ${label}`);
  const compact = block.toLowerCase();
  const forbidden = [
    ["object-fit: contain", /object-fit\s*:\s*contain/i],
    ["letterbox", /letterbox/i],
    ["vignette", /vignette/i],
    ["radial media island", /mask-image\s*:\s*[^;]*radial-gradient/i],
    ["ellipse media island", /mask-image\s*:\s*[^;]*ellipse/i],
    ["blur filler", /filter\s*:\s*[^;]*blur\(/i],
    ["backdrop-filter", /backdrop-filter\s*:/i],
    ["source-ratio strip", /height\s*:\s*(50vw|100vw)\s*;/i]
  ];
  for (const [name, re] of forbidden) {
    if (re.test(block) || compact.includes(name)) {
      fail(`${label} must not introduce frame-filler grammar (${name})`);
    }
  }
}

const index = read("index.html");
const styles = read("styles.css");
const siteJs = read("site.js");

const mobileQuery = "@media (max-width: 700px)";
const indexMobileIdx = index.indexOf(mobileQuery);
const stylesMobileIdx = styles.indexOf(mobileQuery);
if (indexMobileIdx < 0) fail("index.html missing mobile max-width: 700px query");
if (stylesMobileIdx < 0) fail("styles.css missing mobile max-width: 700px query");

const indexDesktop = index.slice(0, indexMobileIdx);
const stylesDesktop = styles.slice(0, stylesMobileIdx);
const indexMobile = extractMobileSlice(index);
const stylesMobile = extractMobileSlice(styles);
if (!indexMobile) fail("could not extract index.html mobile slice");
if (!stylesMobile) fail("could not extract styles.css mobile slice");

// Authored travel from existing comments/constants — sticky is live, travel stays svh.
// Opening: 180 choreography (opening-final hold retired).
const OPENING_TRAVEL_SVH = 180;
// Mobile Hand: 120 choreography + 1 × 60 hold.
const HAND_MOBILE_TRAVEL_SVH = 180;
// Mobile Work: existing 450svh − 100svh sticky → 170 choreography + 3 × 60 holds.
const WORK_MOBILE_TRAVEL_SVH = 350;

// ——— Desktop geometry must remain the approved svh contract ———
const desktopScene = joinedBlocks(indexDesktop, ".scene");
const desktopPassage = joinedBlocks(indexDesktop, ".passage");
const desktopSticky = joinedBlocks(stylesDesktop, ".movement-sticky");
const desktopHand = joinedBlocks(stylesDesktop, ".movement-hand");
const desktopWork = joinedBlocks(stylesDesktop, ".movement-work");

if (lastDecl(desktopScene, "height") !== "100svh") {
  fail(`desktop .scene height must remain 100svh (got ${lastDecl(desktopScene, "height")})`);
}
if (/100dvh|calc\(/.test(desktopScene)) {
  fail("desktop .scene must not use dvh or calc live geometry");
}
if (lastDecl(desktopPassage, "height") !== "280svh") {
  fail(`desktop .passage height must remain 280svh (got ${lastDecl(desktopPassage, "height")})`);
}
if (/dvh/.test(desktopPassage)) {
  fail("desktop .passage must not use dvh");
}
if (lastDecl(desktopSticky, "height") !== "100svh") {
  fail(`desktop .movement-sticky height must remain 100svh (got ${lastDecl(desktopSticky, "height")})`);
}
if (/dvh/.test(desktopSticky)) {
  fail("desktop .movement-sticky must not use dvh");
}
if (lastDecl(desktopHand, "height") !== "320svh") {
  fail(`desktop .movement-hand height must remain 320svh (got ${lastDecl(desktopHand, "height")})`);
}
if (lastDecl(desktopWork, "height") !== "500svh") {
  fail(`desktop .movement-work height must remain 500svh (got ${lastDecl(desktopWork, "height")})`);
}
if (lastDecl(desktopHand, "margin-top") !== "-100svh") {
  fail(`desktop .movement-hand overlap must remain -100svh (got ${lastDecl(desktopHand, "margin-top")})`);
}
if (lastDecl(desktopWork, "margin-top") !== "-100svh") {
  fail(`desktop .movement-work overlap must remain -100svh (got ${lastDecl(desktopWork, "margin-top")})`);
}
if (/dvh/.test(desktopHand) || /dvh/.test(desktopWork)) {
  fail("desktop Hand/Work geometry must not use dvh");
}

// ——— Mobile sticky scenes must track the dynamic/live viewport ———
const mobileScene = joinedBlocks(indexMobile, ".scene");
const mobilePassage = joinedBlocks(indexMobile, ".passage");
const mobileSticky = joinedBlocks(stylesMobile, ".movement-sticky");
const mobileHand = joinedBlocks(stylesMobile, ".movement-hand");
const mobileWork = joinedBlocks(stylesMobile, ".movement-work");

if (!mobileScene) fail("mobile opening must override .scene height");
if (!hasDecl(mobileScene, "height", "100svh")) {
  fail("mobile .scene must keep height: 100svh as the honest no-dvh fallback");
}
if (lastDecl(mobileScene, "height") !== "100dvh") {
  fail(
    "mobile .scene must end on height: 100dvh so the opening sticky tracks the live viewport (current 100svh geometry fails here)"
  );
}

if (!mobileSticky) fail("mobile styles must override .movement-sticky height");
if (!hasDecl(mobileSticky, "height", "100svh")) {
  fail("mobile .movement-sticky must keep height: 100svh as the honest no-dvh fallback");
}
if (lastDecl(mobileSticky, "height") !== "100dvh") {
  fail(
    "mobile .movement-sticky must end on height: 100dvh so Hand/Work stickies track the live viewport"
  );
}

// ——— Totals = live sticky + existing authored travel; not total-dvh ———
if (!mobilePassage) fail("mobile opening must override .passage height");
if (!hasDecl(mobilePassage, "height", "280svh")) {
  fail("mobile .passage must keep 280svh fallback (100svh + 180svh authored travel)");
}
if (parseLivePlusTravel(lastDecl(mobilePassage, "height")) !== OPENING_TRAVEL_SVH) {
  fail(
    `mobile .passage last height must be calc(100dvh + ${OPENING_TRAVEL_SVH}svh) (got ${lastDecl(mobilePassage, "height")})`
  );
}

if (!mobileHand) fail("mobile styles must override .movement-hand");
if (!hasDecl(mobileHand, "height", "280svh")) {
  fail("mobile .movement-hand must keep 280svh fallback (100svh + 180svh authored travel)");
}
if (parseLivePlusTravel(lastDecl(mobileHand, "height")) !== HAND_MOBILE_TRAVEL_SVH) {
  fail(
    `mobile .movement-hand last height must be calc(100dvh + ${HAND_MOBILE_TRAVEL_SVH}svh) (got ${lastDecl(mobileHand, "height")})`
  );
}

if (!mobileWork) fail("mobile styles must override .movement-work");
if (!hasDecl(mobileWork, "height", "450svh")) {
  fail("mobile .movement-work must keep 450svh fallback (100svh + 350svh authored travel)");
}
if (parseLivePlusTravel(lastDecl(mobileWork, "height")) !== WORK_MOBILE_TRAVEL_SVH) {
  fail(
    `mobile .movement-work last height must be calc(100dvh + ${WORK_MOBILE_TRAVEL_SVH}svh) (got ${lastDecl(mobileWork, "height")})`
  );
}

const mobileHeights = [
  lastDecl(mobilePassage, "height"),
  lastDecl(mobileHand, "height"),
  lastDecl(mobileWork, "height")
];
if (mobileHeights.some((h) => /^(340|380|450|500)dvh$/.test(String(h).replace(/\s+/g, "")))) {
  fail("mobile totals must not become NNdvh (that would stretch authored travel with chrome)");
}

// ——— Overlap offsets match the live sticky viewport ———
if (!hasDecl(mobileHand, "margin-top", "-100svh")) {
  fail("mobile .movement-hand must keep margin-top: -100svh as the honest no-dvh fallback");
}
if (lastDecl(mobileHand, "margin-top") !== "-100dvh") {
  fail(
    `mobile .movement-hand overlap must end on -100dvh (got ${lastDecl(mobileHand, "margin-top")})`
  );
}
if (!hasDecl(mobileWork, "margin-top", "-100svh")) {
  fail("mobile .movement-work must keep margin-top: -100svh as the honest no-dvh fallback");
}
if (lastDecl(mobileWork, "margin-top") !== "-100dvh") {
  fail(
    `mobile .movement-work overlap must end on -100dvh (got ${lastDecl(mobileWork, "margin-top")})`
  );
}

// ——— Holds stay authored svh when the remapper converts plateaus ———
const remap = siteJs.match(
  /function\s+remapBeatProgress\s*\([\s\S]*?\n  function /
);
if (!remap) fail("could not isolate remapBeatProgress");
if (/plateauPx\s*=\s*\(\s*holdSvh\s*\/\s*100\s*\)\s*\*\s*window\.innerHeight/.test(remap[0])) {
  fail(
    "remapBeatProgress must not size holds from window.innerHeight; collapsing chrome would stretch plateaus"
  );
}
if (!/100svh/.test(remap[0]) && !/authoredSvhPx|svhPx/.test(remap[0])) {
  fail("remapBeatProgress must convert holdSvh through authored svh, not the live layout viewport");
}

// Opening remapper remains fraction-of-authored-svh (180 / 240), not live innerHeight holds.
if (!/choreographySvh:\s*180/.test(index) || !/terminalHoldSvh:\s*0/.test(index)) {
  fail("OPENING_SPAN authored choreography/hold svh constants must remain 180 / 0");
}

// ——— No filler grammar in the live-viewport overrides ———
assertNoFiller(mobileScene, "mobile .scene viewport override");
assertNoFiller(mobilePassage, "mobile .passage viewport override");
assertNoFiller(mobileSticky, "mobile .movement-sticky viewport override");
assertNoFiller(mobileHand, "mobile .movement-hand viewport override");
assertNoFiller(mobileWork, "mobile .movement-work viewport override");

// ——— Numeric handoff model: svh stays small while the live viewport grows.
// Desktop Chromium resize cannot split svh from dvh; this is the Samsung case. ———
function sectionModel(svhPx, livePx, travelSvh, stickyLive, overlapLive) {
  const sticky = stickyLive ? livePx : svhPx;
  const overlap = overlapLive ? livePx : svhPx;
  const travel = (travelSvh / 100) * svhPx;
  return { sticky, overlap, travel, total: sticky + travel };
}

function handoffAtTravelEnd(outgoing, incoming) {
  const scroll = outgoing.travel;
  return {
    outgoingBottom: outgoing.total - scroll,
    incomingTop: outgoing.total - incoming.overlap - scroll,
    floor: Math.max(0, livePx - outgoing.sticky),
    peekBelowOutgoing: Math.max(0, livePx - (outgoing.total - scroll))
  };
}

const svhPx = 667;
const livePx = 812;
const oldOpen = sectionModel(svhPx, livePx, OPENING_TRAVEL_SVH, false, false);
const oldHand = sectionModel(svhPx, livePx, HAND_MOBILE_TRAVEL_SVH, false, false);
const oldWork = sectionModel(svhPx, livePx, WORK_MOBILE_TRAVEL_SVH, false, false);
const newOpen = sectionModel(svhPx, livePx, OPENING_TRAVEL_SVH, true, true);
const newHand = sectionModel(svhPx, livePx, HAND_MOBILE_TRAVEL_SVH, true, true);
const newWork = sectionModel(svhPx, livePx, WORK_MOBILE_TRAVEL_SVH, true, true);

const oldRingBench = handoffAtTravelEnd(oldOpen, oldHand);
const oldBenchWork = handoffAtTravelEnd(oldHand, oldWork);
if (oldRingBench.floor <= 1 || oldRingBench.peekBelowOutgoing <= 1) {
  fail("old 100svh model must still exhibit the black-floor / next-beat peek (oracle check)");
}
if (oldBenchWork.floor <= 1 || oldBenchWork.peekBelowOutgoing <= 1) {
  fail("old 100svh Hand→Work model must still exhibit the black-floor / next-beat peek");
}

const newRingBench = handoffAtTravelEnd(newOpen, newHand);
const newBenchWork = handoffAtTravelEnd(newHand, newWork);
if (Math.abs(newOpen.sticky - livePx) > 0.01) {
  fail("repaired Opening sticky must equal the live viewport");
}
if (Math.abs(newHand.sticky - livePx) > 0.01 || Math.abs(newWork.sticky - livePx) > 0.01) {
  fail("repaired Hand/Work stickies must equal the live viewport");
}
if (Math.abs(newOpen.travel - (OPENING_TRAVEL_SVH / 100) * svhPx) > 0.01) {
  fail("repaired Opening travel must stay authored 180svh, not scale with dvh");
}
if (Math.abs(newRingBench.floor) > 0.01 || Math.abs(newRingBench.peekBelowOutgoing) > 0.01) {
  fail(
    `repaired ring→bench handoff must have no floor/peek (floor=${newRingBench.floor}, peek=${newRingBench.peekBelowOutgoing})`
  );
}
if (Math.abs(newRingBench.incomingTop) > 0.01 || Math.abs(newRingBench.outgoingBottom - livePx) > 0.01) {
  fail("repaired ring→bench must pin incoming top at 0 and outgoing bottom at the live viewport");
}
if (Math.abs(newBenchWork.floor) > 0.01 || Math.abs(newBenchWork.peekBelowOutgoing) > 0.01) {
  fail("repaired bench→work handoff must have no floor/peek");
}
if (Math.abs(newBenchWork.incomingTop) > 0.01 || Math.abs(newBenchWork.outgoingBottom - livePx) > 0.01) {
  fail("repaired bench→work must pin incoming top at 0 and outgoing bottom at the live viewport");
}

// When svh === dvh (desktop / chrome-expanded), totals match the previous svh contract.
const same = 812;
const desktopLikeOpen = sectionModel(same, same, OPENING_TRAVEL_SVH, true, true);
if (Math.abs(desktopLikeOpen.total - 2.8 * same) > 0.01) {
  fail("when svh equals dvh, Opening total must remain the approved 280svh measure");
}

console.log(
  "PASS: mobile live-viewport geometry (sticky 100dvh + authored svh travel; overlaps -100dvh; desktop svh unchanged; no frame-filler)"
);
