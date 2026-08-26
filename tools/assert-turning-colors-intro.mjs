#!/usr/bin/env node
/**
 * Source assertion: rings-first opening oracle.
 *
 * Cold load begins on the many-ring studio film with Custom Gems Turn
 * Heads already composed. The spinning gem, "Some stones turn colors.",
 * black void, timed prologue, and second opening rest are retired.
 *
 * Does not claim visual consumer verification.
 *
 * Usage: node tools/assert-turning-colors-intro.mjs
 *
 * Residue: rings-first opening tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator editing the homepage opening
 * Activation: execute — node tools/assert-turning-colors-intro.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when the rings-first opening contract is retired
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n?/g, "\n");
}

function extractFn(src, name) {
  const re = new RegExp("function\\s+" + name + "\\s*\\(");
  const match = re.exec(src);
  if (!match) return "";
  const brace = src.indexOf("{", match.index);
  if (brace < 0) return "";
  let depth = 0;
  for (let j = brace; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") {
      depth--;
      if (depth === 0) return src.slice(match.index, j + 1);
    }
  }
  return "";
}

const index = read("index.html");
const styles = read("styles.css");
const helper = read("mobile-beat-settle.js");
const opening = index.slice(index.indexOf('id="opening"'), index.indexOf('id="hand"'));

if (/Some stones turn colors/.test(index)) {
  fail("setup line Some stones turn colors. must be retired from this draft");
}
if (/id="setupLine"/.test(index)) {
  fail("setupLine markup must be retired");
}
if (/id="worldGem"|id="gemCanvas"|id="gemHost"|id="gemFallback"|id="gemReveal"/.test(index)) {
  fail("spinning-gem markup must be retired from this draft");
}
if (/createTurningColorsGem|GEM_VERT|GEM_SCENE|GEM_BLUR|GEM_COMP/.test(index)) {
  fail("WebGL gem renderer must be retired from this draft");
}
if (/turning-colors-gem-fallback/.test(index)) {
  fail("gem fallback image must not remain wired");
}
if (/const INTRO\s*=/.test(index) || /window\.INTRO/.test(index)) {
  fail("prologue INTRO clock must be retired");
}
if (/gemOutStart|gemOutEnd|setupOutStart|headlineInStart|headlineChoreography/.test(index)) {
  fail("retired gem/setup/headline-in/second-rest cues must not remain authored");
}
if (/background:\s*#000|#020005/.test(index.slice(0, index.indexOf("</style>")))) {
  fail("opening stylesheet must not keep the black void as the opening paper");
}
if (!/background:\s*#F4E3E8/.test(index)) {
  fail("opening paper must be the porcelain-blush #F4E3E8");
}
if (!/\.type\s*\{[\s\S]{0,220}color:\s*#fffaf5/.test(index)) {
  fail("opening headline must preserve the original cream ink #fffaf5");
}
if (/html:not\(\.is-later-world\)[\s\S]{0,120}color:\s*#2A171F/.test(index + styles)) {
  fail("opening navigation must not retain the unrequested plum recolor");
}

if (!/id="scrollCue"[^>]*>SCROLL<\/p>/.test(index)) {
  fail('desktop must host a #scrollCue that reads exactly "SCROLL"');
}
if (!/id="scrollCueOpening"[^>]*>SCROLL<\/p>/.test(index)) {
  fail("opening sticky must host its own SCROLL so the phone can show it");
}
if (!/id="scrollCueHand"[^>]*>SCROLL<\/p>/.test(index)) {
  fail("hand sticky must host its own SCROLL so the phone can show it");
}
if (/id="workScene"[\s\S]{0,400}scrollCue/.test(index) || /id="work"[\s\S]{0,800}scroll-cue--scene/.test(index)) {
  fail("SCROLL must not appear on the last / terminal beat");
}
if (!/\.scroll-cue[\s\S]{0,900}#d7b9ff[\s\S]{0,80}#a98cff[\s\S]{0,80}#ff9cc9[\s\S]{0,80}#f4ddb0/.test(index)) {
  fail("SCROLL must use the Heads spectral gradient on desktop and mobile");
}
if (!/id="headline"[\s\S]*Custom Gems Turn[\s\S]*Heads/.test(index)) {
  fail("opening must remain Custom Gems Turn Heads");
}
if (!/\.headline[\s\S]{0,240}opacity:\s*1/.test(index)) {
  fail("headline must be composed at progress zero, not faded in after a gem");
}

if (!/id="worldStudio"/.test(opening) || !/id="studioStack"/.test(opening) || !/id="studioVideo"/.test(opening)) {
  fail("opening must keep the worldStudio / studioStack / studioVideo first-beat carrier");
}

const openingVideos = opening.match(/<video\b/g) || [];
if (openingVideos.length !== 1) {
  fail("opening must contain exactly one video, the studio first-beat montage");
}
const studioVideoBlock = opening.match(/id="studioVideo"[\s\S]*?<\/video>/);
if (!studioVideoBlock) fail("opening video must be studioVideo");
if (
  !/studio-opening-cluster-bench-engraving\.mp4/.test(studioVideoBlock[0]) ||
  !/data-desktop-src="assets\/studio-opening-cluster-bench-engraving\.mp4"/.test(studioVideoBlock[0]) ||
  !/data-mobile-src="assets\/studio-opening-cluster-bench-engraving-mobile-wide-blush\.mp4"/.test(studioVideoBlock[0])
) {
  fail("opening video must keep the desktop montage and the blush-band mobile derivative");
}

if (/id="worldRing"|id="ringStack"|id="ringVideo"/.test(opening)) {
  fail("opening markup must not keep the retired ring-only world/stack/video");
}
if (!/id="siteHeader"/.test(index) || !/id="sitePrimaryNav"/.test(index)) {
  fail("persistent header and primary nav must remain in markup");
}
if (/html:not\(\.is-opening-intro-done\)\s+#siteHeader/.test(index)) {
  fail("cold-load CSS must not hide #siteHeader behind a retired gem intro");
}
if (/html:not\(\.is-opening-intro-done\)\s+\.mark/.test(index)) {
  fail("cold-load CSS must not hide the official mark behind a retired gem intro");
}

const applyCopy = extractFn(index, "applyCopy");
if (!applyCopy) fail("applyCopy must exist so scroll still owns headline yield");
if (/setupLine|setupOutStart|headlineInStart/.test(applyCopy)) {
  fail("applyCopy must not revive the setup line or a delayed headline-in");
}
if (!/headlineOutStart/.test(applyCopy)) {
  fail("applyCopy must still yield the headline before Hand");
}
if (/headOpacity = headIn/.test(applyCopy)) {
  fail("headline must start composed, not interpolate in from zero");
}

if (/function\s+applyGem\s*\(/.test(index) || /function\s+createTurningColorsGem\s*\(/.test(index)) {
  fail("applyGem / createTurningColorsGem must be retired");
}

const applyStudio = extractFn(index, "applyStudioWorld");
if (!applyStudio) fail("applyStudioWorld must keep the studio film visible");
if (!/worldStudio/.test(applyStudio)) {
  fail("applyStudioWorld must show worldStudio");
}

const decoderAuth = extractFn(index, "openingDecoderAuthority");
if (!decoderAuth) {
  fail("openingDecoderAuthority must select studio when Opening owns the viewport");
}
if (!/openingTimeline\s*\(\s*state\.visualProgress\s*\)/.test(decoderAuth)) {
  fail("openingDecoderAuthority must still consult openingTimeline(state.visualProgress)");
}
if (!/return\s*"studio"/.test(decoderAuth)) {
  fail("openingDecoderAuthority must return studio immediately; no gem-cover gate");
}
if (/"cover"/.test(decoderAuth) || /gemOutEnd/.test(decoderAuth)) {
  fail("openingDecoderAuthority must not return cover or wait for gemOutEnd");
}

const armVideos = extractFn(index, "armVideos");
if (!armVideos) fail("armVideos must exist");
if (!/openingDecoderAuthority\s*\(\s*\)/.test(armVideos)) {
  fail("armVideos must consult openingDecoderAuthority");
}
if (!/ensureVideoSource\s*\(\s*studioVideo/.test(armVideos) || !/tryPlay\(\s*studioVideo\s*\)/.test(armVideos)) {
  fail("armVideos must hydrate and play the studio film when Opening owns");
}
if (/gem cover|live gem/.test(armVideos)) {
  fail("armVideos must not describe a gem-cover delay");
}

const manageOpening = extractFn(index, "manageOpeningVideoActivity");
if (!manageOpening) fail("manageOpeningVideoActivity must exist");
if (!/openingDecoderAuthority\s*\(\s*\)/.test(manageOpening)) {
  fail("manageOpeningVideoActivity must consult openingDecoderAuthority");
}
if (!/is-later-world/.test(manageOpening)) {
  fail("leaving Opening must yield chrome to the later dark movements");
}
if (!/openingAtStart/.test(manageOpening) || !/resetOpeningDecoderToStart\s*\(\s*studioVideo/.test(manageOpening)) {
  fail("reverse to the opening rest must restore the first studio frame");
}

const applyIntro = extractFn(index, "applyOpeningIntro");
if (!applyIntro) fail("applyOpeningIntro must still compose chrome immediately");
if (/setupLine|gemHost|gemReveal|gemCanvas/.test(applyIntro)) {
  fail("applyOpeningIntro must not paint a gem wipe or setup line");
}
if (!/paintScrollCue\s*\(\s*\)/.test(applyIntro)) {
  fail("applyOpeningIntro must still paint SCROLL");
}

const paintScroll = extractFn(index, "paintScrollCue");
if (!paintScroll) fail("paintScrollCue must own the SCROLL cue");
if (!/pastLastScrollableBeat/.test(paintScroll)) {
  fail("SCROLL must stay through every rest except the last authored beat");
}
if (/openingIntro\.header/.test(paintScroll) && /if\s*\(\s*!openingIntro\.done/.test(paintScroll)) {
  fail("SCROLL must not wait for a retired gem intro header phase");
}

const collect = helper.slice(helper.indexOf("function collectRests"));
if (!/id:\s*"opening-start"/.test(collect)) {
  fail("collectRests must keep the composed opening-start rest");
}
if (/id:\s*"opening-headline"/.test(collect)) {
  fail("opening-headline must not remain a second swipe destination");
}
if (/id:\s*"opening-final"/.test(collect)) {
  fail("opening-final must not return as a swipe destination");
}

const tickFn = extractFn(index, "tick");
if (!tickFn) fail("tick must exist");
if (!/syncOpeningIntro\s*\(\s*\)/.test(tickFn) || !/applyOpeningIntro\s*\(\s*\)/.test(tickFn)) {
  fail("page tick must still compose the opening and paint chrome");
}
if (/createTurningColorsGem|gemEngine\.frame/.test(tickFn)) {
  fail("tick must not drive a gem renderer");
}

if (!/rebuildLogo/.test(index) || !/data\[i\] = 255/.test(index) || !/data\[i \+ 1\] = 255/.test(index)) {
  fail("official mark must preserve its original cream treatment");
}

console.log(
  "PASS: rings-first opening (cold-load studio film + Custom Gems Turn Heads at progress zero; blush paper #F4E3E8; original cream headline/chrome preserved; no gem/setup/black void/INTRO/second rest; studio decoder immediate; reverse restores first frame; SCROLL preserved)"
);
