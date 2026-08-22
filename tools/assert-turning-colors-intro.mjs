#!/usr/bin/env node
/**
 * Source assertion: Turning Colors four-phase cold-load intro on
 * opening-start (black → setup line → gem → header), then the site's
 * original first-beat studio montage on opening-headline.
 *
 * The retired ring-only opening world is not a second rest. The prior
 * two-video (studio + ring) expectation encoded that obsolete carrier
 * and is corrected here: opening markup has exactly one film, the
 * original studio-opening-cluster-bench-engraving montage.
 *
 * Proves the recovered WebGL2 lineage is present without the omitted
 * historical treatments, and that the authored rest / decoder contracts
 * stay intact. Does not claim visual consumer verification.
 *
 * Usage: node tools/assert-turning-colors-intro.mjs
 *
 * Residue: turning-colors-intro tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator editing the homepage opening prologue
 * Activation: execute — node tools/assert-turning-colors-intro.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when the four-phase cold-load intro or its rest-map contract is retired
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
const helper = read("mobile-beat-settle.js");
const opening = index.slice(index.indexOf('id="opening"'), index.indexOf('id="hand"'));

if (!/id="setupLine">Some stones turn colors\.<\/p>/.test(index)) {
  fail('cold-load setup line must remain exactly "Some stones turn colors."');
}
if (!/id="headline"[\s\S]*Custom Gems Turn[\s\S]*Heads/.test(index)) {
  fail("opening-headline must remain Custom Gems Turn Heads");
}
if (!/id="worldGem"/.test(opening) || !/id="gemCanvas"/.test(opening)) {
  fail("opening must host the live-gem world and canvas");
}
if (!/id="gemFallback"/.test(opening)) {
  fail("opening must host a genuine-gem fallback image");
}
if (/<canvas\b[^>]*id="gemFallback"/.test(opening) || /<canvas[\s\S]{0,80}id="gemFallback"/.test(opening)) {
  fail("fallback must not remain a canvas");
}
const worldGemMarkup = opening.slice(opening.indexOf('id="worldGem"'), opening.indexOf('id="gemCanvas"'));
const fallbackImg = worldGemMarkup.match(/<img\b[\s\S]*?>/);
if (!fallbackImg || !/id="gemFallback"/.test(fallbackImg[0])) {
  fail("opening must host one semantic-hidden img#gemFallback");
}
if (!/data-src="assets\/turning-colors-gem-fallback\.png"/.test(fallbackImg[0])) {
  fail('fallback markup must keep data-src="assets/turning-colors-gem-fallback.png"');
}
if (!/aria-hidden="true"/.test(fallbackImg[0])) {
  fail("fallback image must stay semantically hidden");
}
{
  const withoutDataSrc = fallbackImg[0].replace(/data-src="[^"]*"/g, "");
  if (/\ssrc=/.test(withoutDataSrc) || /(?:^|[\s"'/])src=/.test(withoutDataSrc)) {
    fail("fallback must not assign a network src in markup; hydrate only after showFallback");
  }
}
if (!/id="worldStudio"/.test(opening) || !/id="studioStack"/.test(opening) || !/id="studioVideo"/.test(opening)) {
  fail("opening must keep the original worldStudio / studioStack / studioVideo first-beat carrier");
}

const openingVideos = opening.match(/<video\b/g) || [];
if (openingVideos.length !== 1) {
  fail("opening must contain exactly one video, the original studio first-beat montage");
}
const studioVideoBlock = opening.match(/id="studioVideo"[\s\S]*?<\/video>/);
if (!studioVideoBlock) fail("opening video must be studioVideo");
if (
  !/studio-opening-cluster-bench-engraving\.mp4/.test(studioVideoBlock[0]) ||
  !/data-desktop-src="assets\/studio-opening-cluster-bench-engraving\.mp4"/.test(studioVideoBlock[0]) ||
  !/data-mobile-src="assets\/studio-opening-cluster-bench-engraving-mobile-wide\.mp4"/.test(studioVideoBlock[0])
) {
  fail("opening video must be the original studio-opening-cluster-bench-engraving carrier with desktop/mobile sources");
}

if (/id="worldRing"|id="ringStack"|id="ringVideo"/.test(opening)) {
  fail("opening markup must not keep the retired ring-only world/stack/video");
}
if (/ring-alexandrite\.mp4/.test(opening)) {
  fail("opening markup must not keep ring-alexandrite.mp4 as an opening film");
}
if (/ring-poster(?:-portrait)?\.jpg/.test(opening)) {
  fail("opening markup must not keep a ring-only opening poster");
}

if (!/id="siteHeader"/.test(index) || !/id="sitePrimaryNav"/.test(index)) {
  fail("persistent header and primary nav must remain in markup");
}
if (/#siteHeader[\s\S]{0,200}display:\s*none/.test(index)) {
  fail("must not hide #siteHeader as an intro shortcut");
}
if (!/html:not\(\.is-opening-intro-done\)\s+#siteHeader[\s\S]{0,120}opacity:\s*0[\s\S]{0,80}visibility:\s*hidden/.test(index)) {
  fail("cold-load CSS must hide #siteHeader with opacity/visibility until the intro completes");
}
if (!/html:not\(\.is-opening-intro-done\)\s+\.setup[\s\S]{0,80}opacity:\s*0/.test(index)) {
  fail("cold-load CSS must keep the setup line off the first black frame");
}
if (!/html:not\(\.is-opening-intro-done\)\s+\.mark[\s\S]{0,80}opacity:\s*0/.test(index)) {
  fail("cold-load CSS must keep the official mark off the first black frame");
}
if (
  !/html:not\(\.is-opening-intro-done\)\s+\.world-gem canvas[\s\S]{0,160}#gemFallback[\s\S]{0,120}opacity:\s*0/.test(
    index
  )
) {
  fail("cold-load CSS must hide the live canvas and fallback image, not the black gem world");
}
if (/html:not\(\.is-opening-intro-done\)[\s\S]{0,220}#worldGem/.test(index)) {
  fail("cold-load CSS must not hide #worldGem; black cover has to stay up so studio cannot flash");
}

if (!/const GEM_VERT/.test(index) || !/const GEM_SCENE/.test(index)) {
  fail("must port the historical VERT/SCENE gemstone lineage");
}
if (!/min\(uRes\.x,\s*uRes\.y\)/.test(index)) {
  fail("gem projection must size the stone by the shorter axis so portrait widths keep the stone in frame");
}
{
  const gemScene = (index.match(/const GEM_SCENE = `[\s\S]*?`;/) || [])[0] || "";
  if (!gemScene) fail("GEM_SCENE source must remain extractable");
  if (!/\buniform float uShift, uSpin, uEnc, uZoom;/.test(gemScene)) {
    fail("GEM_SCENE must declare uZoom with the live scene uniforms");
  }
  if (!/vec2 uv=\(gl_FragCoord\.xy-\.5\*uRes\)\/s;\s*uv\/=uZoom;/.test(gemScene)) {
    fail("GEM_SCENE must scale ray-plane UV/lens coordinates by inverse uZoom at full canvas resolution");
  }
}
if (!/const GEM_BLUR/.test(index) || !/const GEM_COMP/.test(index)) {
  fail("must port the historical BLUR/COMP bloom composite, minus omitted treatments");
}
if (/const float GLOW/.test(index) || /float halo\s*=/.test(index)) {
  fail("historical SCENE halo / GLOW treatment must be omitted");
}
if (/c\s*\*=\s*1\.\s*-\s*\.\s*58\s*\*\s*dot\(q,\s*q\)/.test(index) || /dot\(q,\s*q\)\s*\*\s*1\.5/.test(index)) {
  fail("historical COMP vignette darkening must be omitted");
}
if (/id="noglx"|needs WebGL2|class="curtain"|class="boot"/.test(index)) {
  fail("must not transplant the historical error overlay, curtain, or boot toll");
}
if (/setTimeout\s*\(|setInterval\s*\(/.test(extractFn(index, "createTurningColorsGem"))) {
  fail("gem boot must not use a timed intro sequence");
}

const applyGem = extractFn(index, "applyGem");
if (!applyGem) fail("applyGem must exist so gesture progress owns the prologue handoff");
if (!/gemOutStart/.test(applyGem) || !/gemOutEnd/.test(applyGem)) {
  fail("applyGem must fade the gem on authored progress, not a timer");
}
if (!/setCover/.test(applyGem)) {
  fail("applyGem must tell the renderer when the prologue no longer covers");
}
if (!/worldStudio/.test(applyGem) || !/worldGem/.test(applyGem)) {
  fail("applyGem must yield the gem world to worldStudio and restore it in reverse");
}
if (/worldRing|ringStack|ringVideo/.test(applyGem)) {
  fail("applyGem must not depend on the retired ring-only opening carrier");
}

const createGem = extractFn(index, "createTurningColorsGem");
if (!createGem) fail("createTurningColorsGem must exist");
if (!/webgl2/.test(createGem)) {
  fail("live path must request a WebGL2 context");
}
if (!/uniform1f\(\s*U\(\s*pS,\s*["']uZoom["']\s*\)\s*,\s*state\.isMobile\s*\?\s*1\.5\s*:\s*1\s*\)/.test(createGem)) {
  fail("live WebGL uZoom must be 1.5 on mobile (state.isMobile) and 1 on desktop");
}
if (/style\.(transform|zoom)|canvas\.style\.transform/.test(createGem)) {
  fail("must not CSS-transform or raster-scale the live gem canvas");
}
if (/paintGemFallback/.test(createGem) || /paintGemFallback/.test(index)) {
  fail("paintGemFallback Canvas2D schematic must be absent");
}
if (!/showFallback/.test(createGem) || !/webglcontextlost/.test(createGem)) {
  fail("WebGL failure and context loss must select the genuine-gem image fallback");
}
if (!/webglcontextrestored/.test(createGem)) {
  fail("context restore must be handled so a restore event cannot hide the fallback");
}
if (/webglcontextrestored[\s\S]{0,500}lost\s*=\s*false/.test(createGem)) {
  fail("must not claim live restoration after context loss unless every GL resource is recreated");
}
if (/webglcontextrestored[\s\S]{0,500}fallbackCanvas\.style\.visibility\s*=\s*["']hidden["']/.test(createGem)) {
  fail("context restore must not hide the intentional fallback");
}
if (!/webglcontextrestored[\s\S]{0,400}showFallback\s*\(/.test(createGem)) {
  fail("context restore must keep the fallback visible for this engine instance");
}
const gemResize = extractFn(createGem, "resize");
if (!gemResize) fail("createTurningColorsGem resize must exist");
const releaseTarget = extractFn(createGem, "releaseTarget");
if (!releaseTarget || !/deleteTexture/.test(releaseTarget) || !/deleteFramebuffer/.test(releaseTarget)) {
  fail("resize-owned targets must be released with deleteTexture/deleteFramebuffer");
}
if (!/releaseTarget\s*\(\s*scn/.test(gemResize)) {
  fail("resize must release the previous scene target before allocating replacements");
}
{
  const releaseAt = gemResize.indexOf("releaseTarget");
  const allocAt = gemResize.search(/=\s*target\s*\(/);
  if (releaseAt < 0 || allocAt < 0 || releaseAt > allocAt) {
    fail("resize must release previous GL targets before allocating replacement targets");
  }
}
if (!/api\.dispose\s*=\s*function[\s\S]*releaseTarget\s*\(\s*scn/.test(createGem)) {
  fail("dispose must release resize-owned framebuffer/texture targets");
}
if (!/api\.dispose\s*=\s*function[\s\S]*deleteProgram/.test(createGem) || !/api\.dispose\s*=\s*function[\s\S]*deleteShader/.test(createGem) || !/api\.dispose\s*=\s*function[\s\S]*deleteBuffer/.test(createGem)) {
  fail("dispose must release tracked programs, shaders, and buffers");
}
if (!/api\.quiet \? 0 : GEM_SPIN/.test(createGem) && !/quiet \? 0 : GEM_SPIN/.test(createGem)) {
  fail("quiet mode must not force continuous spin");
}
if (!/GEM_STILL_TIME/.test(createGem)) {
  fail("quiet / still path must draw a fixed live-renderer pose");
}
if (/prefers-reduced-motion/.test(createGem)) {
  fail("gem renderer must not invent an OS reduced-motion spin override");
}
if (!/api\.cover < 0\.02/.test(createGem) && !/cover < 0\.02/.test(createGem)) {
  fail("renderer must skip the raytrace once the prologue no longer covers");
}

if (/function\s+paintGemFallback|function\s+convexGemSilhouette|function\s+gemRing|function\s+gemHueRgb|function\s+gemRgbCss|function\s+mixRgb/.test(index)) {
  fail("interim Canvas2D gem geometry and palette helpers must be absent");
}
if (/\ba0\b/.test(createGem) || /\ba1\b/.test(createGem) || /\baM\b/.test(createGem)) {
  fail("old radial a0/a1/aM star-wedge painter must be absent");
}
if (/moveTo\s*\(\s*cx\s*,\s*cy\s*\)/.test(index)) {
  fail("fallback must not paint radial wedges from a canvas center");
}
if (/getContext\s*\(\s*["']2d["']/.test(createGem)) {
  fail("gem engine must not open a Canvas2D fallback context");
}

const showFallback = extractFn(createGem, "showFallback");
if (!showFallback) fail("showFallback must exist");
if (!/getAttribute\s*\(\s*["']data-src["']\s*\)/.test(showFallback) || !/\.src\s*=/.test(showFallback)) {
  fail("showFallback must hydrate the fallback image from data-src onto src");
}
if (!/is-ready/.test(showFallback)) {
  fail("fallback image must reveal only after load");
}

if (!/get\(["']gem["']\)\s*===\s*["']fallback["']/.test(createGem)) {
  fail("createTurningColorsGem must honor the ?gem=fallback diagnostic");
}
{
  const forceAt = createGem.search(/get\(["']gem["']\)\s*===\s*["']fallback["']/);
  const glAt = createGem.search(/getContext\s*\(\s*["']webgl2["']/);
  if (forceAt < 0 || glAt < 0 || forceAt > glAt) {
    fail("?gem=fallback must skip WebGL context creation");
  }
  const between = createGem.slice(forceAt, glAt);
  if (!/forceFallback/.test(between) || !/return api/.test(between)) {
    fail("forced fallback must return the image path before getContext");
  }
  if (!/showFallback\s*\(/.test(between)) {
    fail("?gem=fallback must hydrate and reveal the genuine-gem image");
  }
  if (/getContext\s*\(\s*["']webgl2["']/.test(between)) {
    fail('forced fallback must never call getContext("webgl2")');
  }
}

if (!/api\.quiet\s*\?\s*GEM_STILL_TIME/.test(createGem)) {
  fail("quiet live path must draw a fixed renderer pose");
}
if (/runFallbackFrame|GEM_FALLBACK_FRAME_MS|1000\s*\/\s*18/.test(createGem)) {
  fail("fallback must not keep a Canvas2D repaint loop");
}
if (/requestAnimationFrame/.test(createGem)) {
  fail("gem engine must not add a second animation loop");
}
if (!/worldGem\.style\.visibility\s*=\s*gemT < 0\.02 \? ["']hidden["']/.test(applyGem)) {
  fail("when the gem world leaves, existing cover visibility must stop presenting the fallback");
}

const fallbackCss = [
  ...(index.match(/#gemFallback\s*\{[^}]+\}/g) || []),
  ...(index.match(/#gemFallback\.is-ready\s*\{[^}]+\}/g) || []),
  ...(index.match(/\.is-quiet\s+#gemFallback[\s\S]{0,80}\{[^}]+\}/g) || []),
  ...(index.match(/@keyframes\s+gem-fallback-spectral\s*\{[\s\S]*?\n    \}/) || [])
].join("\n");
if (!/@keyframes\s+gem-fallback-spectral/.test(index) || !/hue-rotate/.test(fallbackCss)) {
  fail("normal fallback must use one CSS spectral animation with hue-rotate");
}
if (!/#gemFallback\.is-ready[\s\S]{0,160}animation:/.test(index)) {
  fail("fallback animation must attach only after the image is ready");
}
if (!/brightness|saturate/.test(fallbackCss)) {
  fail("fallback motion must keep brightness/saturation inside a narrow spectral range");
}
if (/(?<![a-z-])rotate(?:Z)?\s*\(/.test(fallbackCss)) {
  fail("fallback animation must not rotate the image in its own 2D plane");
}
if (!/\.is-quiet\s+#gemFallback[\s\S]{0,80}animation:\s*none/.test(index)) {
  fail("quiet mode and ?motion=quiet must disable fallback animation");
}
if (!/#gemFallback[\s\S]{0,220}min\(100vmin,\s*50vw\)/.test(index)) {
  fail("desktop fallback square must size to min(100vmin, 50vw)");
}
if (!/@media \(max-width: 700px\)[\s\S]*#gemFallback[\s\S]{0,80}width:\s*150vmin[\s\S]{0,40}height:\s*150vmin/.test(index)) {
  fail("mobile fallback square must be 150vmin wide and 150vmin tall");
}
{
  const canvasCss = (index.match(/\.world-gem canvas\s*\{[^}]+\}/) || [])[0] || "";
  if (!canvasCss) fail("live gem canvas CSS must remain extractable");
  if (/transform:|scale\(/.test(canvasCss)) {
    fail("must not CSS-transform the live gem canvas; zoom belongs in WebGL scene math");
  }
}
if (/#gemFallback[\s\S]{0,280}(box-shadow|radial-gradient|vignette|mask-image|border-radius)/.test(index)) {
  fail("fallback image must not introduce a visible square, frame, mask, or vignette");
}

const collect = helper.slice(helper.indexOf("function collectRests"));
if (!/id:\s*"opening-start"/.test(collect) || !/id:\s*"opening-headline"/.test(collect)) {
  fail("collectRests must keep opening-start then opening-headline");
}
if (/id:\s*"opening-final"/.test(collect)) {
  fail("opening-final must not return as a swipe destination");
}
if (!/window\.OPENING_SPAN\s*=\s*OPENING_SPAN/.test(index)) {
  fail("OPENING_SPAN contract must remain exposed");
}
if (!/headInEnd\s*=\s*mobile\s*\?\s*0\.48/.test(index) || !/headOutStart\s*=\s*mobile\s*\?\s*0\.62/.test(index)) {
  fail("mobile headline composed interval must stay 0.48–0.62");
}
if (!/headlineChoreography:\s*0\.55/.test(index)) {
  fail("headlineChoreography must remain 0.55");
}

const motionBlock = index.match(/const MOTION = \{[\s\S]*?\n      \};/);
if (!motionBlock) fail("MOTION block must remain extractable");
function motionCue(name) {
  const m = motionBlock[0].match(new RegExp(name + ":\\s*(\\d+(?:\\.\\d+)?)"));
  return m ? Number(m[1]) : NaN;
}
const setupOutEnd = motionCue("setupOutEnd");
const gemOutStart = motionCue("gemOutStart");
const gemOutEnd = motionCue("gemOutEnd");
const headlineInStart = motionCue("headlineInStart");
const headlineInEnd = motionCue("headlineInEnd");
if (
  ![setupOutEnd, gemOutStart, gemOutEnd, headlineInStart, headlineInEnd].every(function (n) {
    return Number.isFinite(n);
  })
) {
  fail("MOTION must author setupOutEnd, gemOutStart, gemOutEnd, headlineInStart, headlineInEnd");
}
if (!(setupOutEnd <= gemOutStart)) {
  fail(
    "setup-out must complete before gem-out starts (got setupOutEnd=" +
      setupOutEnd +
      " gemOutStart=" +
      gemOutStart +
      ")"
  );
}
if (!(gemOutEnd <= headlineInStart)) {
  fail(
    "gem-out must complete before headline-in starts (got gemOutEnd=" +
      gemOutEnd +
      " headlineInStart=" +
      headlineInStart +
      ")"
  );
}
if (!(headlineInEnd <= 0.48)) {
  fail("headline-in must complete by the mobile composed boundary 0.48 (got " + headlineInEnd + ")");
}

const applyCopy = extractFn(index, "applyCopy");
if (!applyCopy) fail("applyCopy must exist so scroll owns the sequential copy handoff");
if (!/setupOutEnd\s*=\s*MOTION\.setupOutEnd/.test(applyCopy)) {
  fail("applyCopy must use MOTION.setupOutEnd so setup is gone before the gem yields");
}
if (!/headInStart\s*=\s*MOTION\.headlineInStart/.test(applyCopy)) {
  fail("applyCopy must use MOTION.headlineInStart so headline waits until gem-out completes");
}
if (/headInStart\s*=\s*mobile\s*\?\s*0\.28/.test(applyCopy) && /gemOutStart\s*=\s*mobile\s*\?\s*0\.28/.test(applyGem)) {
  fail("mobile headline must not begin at the same progress as gem fade");
}
if (/setTimeout\s*\(|setInterval\s*\(/.test(applyCopy) || /setTimeout\s*\(|setInterval\s*\(/.test(applyGem)) {
  fail("copy and gem handoff must stay scroll-owned; no timer destination");
}

const introBlock = index.match(/const INTRO = \{[\s\S]*?\n      \};/);
if (!introBlock) fail("INTRO block must remain extractable");
function introCue(name) {
  const m = introBlock[0].match(new RegExp(name + ":\\s*(\\d+(?:\\.\\d+)?)"));
  return m ? Number(m[1]) : NaN;
}
const blackHold = introCue("blackHold");
const lineFade = introCue("lineFade");
const lineHold = introCue("lineHold");
const gemFade = introCue("gemFade");
const headerDelay = introCue("headerDelay");
const headerFade = introCue("headerFade");
const leaveProgress = introCue("leaveProgress");
if (
  ![blackHold, lineFade, lineHold, gemFade, headerDelay, headerFade, leaveProgress].every(function (n) {
    return Number.isFinite(n);
  })
) {
  fail("INTRO must author blackHold, lineFade, lineHold, gemFade, headerDelay, headerFade, leaveProgress");
}
if (!(blackHold >= 0.35 && blackHold <= 0.5)) {
  fail("black hold must stay in the authored 0.35–0.5s window (got " + blackHold + ")");
}
if (!(lineFade >= 0.8 && lineFade <= 1.1)) {
  fail("line fade must stay in the authored 0.8–1.1s window (got " + lineFade + ")");
}
if (!(lineHold >= 0.25 && lineHold <= 0.4)) {
  fail("gem must wait 0.25–0.4s after the line is in (got lineHold=" + lineHold + ")");
}
if (!(headerDelay >= 0.45 && headerDelay <= 0.55)) {
  fail("header must wait 0.45–0.55s after the gem is visible (got headerDelay=" + headerDelay + ")");
}
if (!(gemFade >= 1.05 && gemFade <= 1.2)) {
  fail("gem fade must stay the authored slower reveal (got " + gemFade + ")");
}
if (!(headerFade >= 0.85 && headerFade <= 1)) {
  fail("header fade must stay the authored slower reveal (got " + headerFade + ")");
}
const lineEnd = blackHold + lineFade;
const gemStart = lineEnd + lineHold;
const gemEnd = gemStart + gemFade;
const headerStart = gemEnd + headerDelay;
const headerEnd = headerStart + headerFade;
if (!(blackHold < lineEnd && lineEnd < gemStart && gemEnd < headerStart)) {
  fail("intro phases must stay black → line → gem → header");
}
if (!(headerEnd > 3.6 && headerEnd <= 4.8)) {
  fail("intro must stay one opening, not a title-card show (headerEnd=" + headerEnd + ")");
}
if (!(leaveProgress > 0 && leaveProgress <= 0.02)) {
  fail("leaving opening-start must complete the intro before later cues (got " + leaveProgress + ")");
}

const syncIntro = extractFn(index, "syncOpeningIntro");
const applyIntro = extractFn(index, "applyOpeningIntro");
if (!syncIntro) fail("syncOpeningIntro must own the one-shot wall-time intro clock");
if (!applyIntro) fail("applyOpeningIntro must paint the four-phase intro");
if (/setTimeout\s*\(|setInterval\s*\(/.test(syncIntro) || /setTimeout\s*\(|setInterval\s*\(/.test(applyIntro)) {
  fail("intro must ride the existing page clock; no setTimeout destination");
}
if (/quietModeActive/.test(syncIntro) || /quietModeActive/.test(applyIntro)) {
  fail("quiet / reduced-motion / ?motion=quiet must still run black → line → diamond → header");
}
if (!/openingIntro\.passed/.test(syncIntro) || !/openingIntro\.done/.test(syncIntro)) {
  fail("intro must be one-shot and snap to the composed end-state on reverse");
}
if (!/armClock\s*===\s*false/.test(syncIntro)) {
  fail("first paint must hold black without starting the wall-time clock");
}
if (!/INTRO\.blackHold/.test(syncIntro) || !/INTRO\.lineFade/.test(syncIntro) || !/INTRO\.gemFade/.test(syncIntro)) {
  fail("syncOpeningIntro must author line then gem from INTRO");
}
if (!/INTRO\.headerDelay/.test(syncIntro) || !/INTRO\.headerFade/.test(syncIntro)) {
  fail("syncOpeningIntro must author header after the gem from INTRO");
}
const introWin = extractFn(index, "introWindow");
const easeOut = extractFn(index, "easeOutCubic");
if (!introWin) fail("introWindow must remain the intro opacity clock");
if (!easeOut) fail("gem and header fades must use cubic ease-out");
if (!/clamp\(\s*t,\s*0,\s*1\s*\)/.test(easeOut) || !/1 - inv \* inv \* inv/.test(easeOut)) {
  fail("cubic ease-out must stay 1-(1-t)^3 with no bounce or overshoot");
}
if (/bounce|elastic|overshoot|backIn|backOut/i.test(easeOut) || /bounce|elastic|overshoot/i.test(introWin)) {
  fail("intro easing must not bounce or overshoot");
}
if (!/smoothstep/.test(introWin)) {
  fail("introWindow must keep smoothstep for the line fade");
}
if (!/introWindow\(\s*elapsed,\s*lineStart,\s*INTRO\.lineFade\s*\)/.test(syncIntro)) {
  fail("line fade must keep the existing introWindow / smoothstep curve");
}
if (!/introWindow\(\s*elapsed,\s*gemStart,\s*INTRO\.gemFade,\s*easeOutCubic\s*\)/.test(syncIntro)) {
  fail("gem fade must use cubic ease-out");
}
if (!/introWindow\(\s*elapsed,\s*headerStart,\s*INTRO\.headerFade,\s*easeOutCubic\s*\)/.test(syncIntro)) {
  fail("header fade must use cubic ease-out");
}
if (!/setupLine[\s\S]*openingIntro\.line|const line = openingIntro\.line[\s\S]*setupLine/.test(applyIntro)) {
  fail("applyOpeningIntro must fade #setupLine on the line phase");
}
if (!/gemCanvas/.test(applyIntro) || !/gemFallback/.test(applyIntro)) {
  fail("applyOpeningIntro must reveal canvas and fallback on the gem phase, not the black world");
}
if (/worldGem/.test(applyIntro) || /worldStudio/.test(applyIntro)) {
  fail("applyOpeningIntro must not hide the black gem cover or reveal studio during the intro");
}
if (!/siteHeader/.test(applyIntro) || !/markEl/.test(applyIntro)) {
  fail("applyOpeningIntro must reveal the header host and official mark on the header phase");
}
if (!/pointerEvents\s*=\s*header < 0\.98 \? ["']none["']/.test(applyIntro)) {
  fail("header must stay inert until it appears, then become interactive");
}
if (!/sitePrimaryNav[\s\S]*pointerEvents\s*=\s*["']none["']/.test(applyIntro)) {
  fail("primary nav must not accept pointer events before the header phase");
}
if (!/is-opening-intro-done/.test(applyIntro)) {
  fail("completed intro must lift the first-paint hide class so reverse cannot restick the header");
}
if (/display\s*=\s*["']none["']/.test(applyIntro)) {
  fail("must not hide header with display:none");
}

const tickFn = extractFn(index, "tick");
if (!tickFn) fail("tick must exist");
if (!/syncOpeningIntro\s*\(\s*now/.test(tickFn) || !/applyOpeningIntro\s*\(\s*\)/.test(tickFn)) {
  fail("page tick must drive syncOpeningIntro then applyOpeningIntro");
}
{
  const syncAt = tickFn.search(/syncOpeningIntro\s*\(\s*now/);
  const renderAt = tickFn.search(/render\s*\(\s*openingTimeline/);
  const siteAt = tickFn.search(/__ranaSiteTick/);
  const applyAt = tickFn.search(/applyOpeningIntro\s*\(\s*\)/);
  if (syncAt < 0 || renderAt < 0 || siteAt < 0 || applyAt < 0 || syncAt > renderAt || applyAt < siteAt) {
    fail("intro sync must precede render; intro paint must follow the persistent-mark site tick");
  }
}
if (/if\s*\(\s*quietModeActive\s*\(\s*\)\s*\)\s*\{[\s\S]*return;[\s\S]*syncOpeningIntro/.test(tickFn)) {
  fail("quiet tick must not return before the authored intro");
}
if (!/gemOutStart\s*=\s*MOTION\.gemOutStart/.test(applyGem) || !/gemOutEnd\s*=\s*MOTION\.gemOutEnd/.test(applyGem)) {
  fail("applyGem must use the same MOTION gem-out window on desktop and mobile");
}

if (!/\.world-gem[\s\S]{0,180}background:\s*#000/.test(index)) {
  fail("gem world must be authored black, not a contained media island");
}
if (/world-gem[\s\S]{0,240}radial-gradient/.test(index) || /world-gem[\s\S]{0,240}vignette/.test(index)) {
  fail("gem world must not introduce radial surround or vignette grammar");
}

const studioRule = index.match(/\.world-studio\s*\{[^}]+\}/);
if (studioRule && /opacity:\s*0/.test(studioRule[0])) {
  fail("worldStudio must remain the visible first-beat carrier after the gem yields; do not hide it as a decoder leftover");
}

if (
  !/\.world-studio[\s\S]{0,420}\.media-stack[\s\S]{0,220}inset:\s*0/.test(index) ||
  !/\.media-stack[\s\S]{0,220}width:\s*100%/.test(index) ||
  !/\.media-stack[\s\S]{0,220}height:\s*100%/.test(index)
) {
  fail("studio first-beat stack must remain a full-viewport cover parent");
}
if (!/object-fit:\s*cover/.test(index)) {
  fail("opening media must keep cover crop, not contain letterbox");
}

const applyMedia = extractFn(index, "applyMediaTransforms");
if (applyMedia && !/studioScale\s*=\s*1/.test(applyMedia)) {
  fail("original first-beat crop must stay scale 1; no zoom changes");
}

const armVideos = extractFn(index, "armVideos");
if (!armVideos) fail("armVideos must exist");
if (!/ensureVideoSource\s*\(\s*studioVideo/.test(armVideos)) {
  fail("quiet/fallback path must still hydrate the studio first-beat when playback is allowed");
}
if (/ensureVideoSource\s*\(\s*ringVideo/.test(armVideos) || /ringVideo/.test(armVideos)) {
  fail("opening decoder must not hydrate a retired ring-only opening film");
}

if (/function\s+mobileOpeningDecoderAuthority\s*\(/.test(index)) {
  fail("must not retain a mobile-only opening decoder authority after the gemOutEnd boundary is universal");
}
const decoderAuth = extractFn(index, "openingDecoderAuthority");
if (!decoderAuth) {
  fail("openingDecoderAuthority must select exclusive cover|studio from the authored timeline");
}
if (!/openingTimeline\s*\(\s*state\.visualProgress\s*\)/.test(decoderAuth)) {
  fail("openingDecoderAuthority must use openingTimeline(state.visualProgress)");
}
if (!/timeline\s*>=\s*MOTION\.gemOutEnd\s*\?\s*["']studio["']\s*:\s*["']cover["']/.test(decoderAuth)) {
  fail("openingDecoderAuthority must return cover before MOTION.gemOutEnd and studio at the headline rest");
}

if (!/openingDecoderAuthority\s*\(\s*\)/.test(armVideos)) {
  fail("armVideos must consult openingDecoderAuthority on desktop and mobile");
}
if (/isMobileOpeningViewport\s*\(\s*\)/.test(armVideos)) {
  fail("armVideos must not keep a desktop-eager / mobile-only decoder split");
}
const armAuthAt = armVideos.search(/openingDecoderAuthority\s*\(\s*\)/);
const armHydrateAt = armVideos.search(/ensureVideoSource\s*\(\s*studioVideo/);
const armPlayAt = armVideos.search(/tryPlay\(\s*studioVideo\s*\)/);
if (armAuthAt < 0 || armHydrateAt < 0 || armHydrateAt < armAuthAt) {
  fail("desktop must not hydrate studioVideo under gem cover before openingDecoderAuthority");
}
if (armPlayAt < 0 || armPlayAt < armAuthAt) {
  fail("desktop must not play studioVideo under gem cover before openingDecoderAuthority");
}
if (
  !/want\s*!==\s*["']studio["'][\s\S]*return\s*;[\s\S]*ensureVideoSource\s*\(\s*studioVideo/.test(
    armVideos
  )
) {
  fail("studio hydration must wait until authored progress crosses MOTION.gemOutEnd");
}
if (/openingDecoderAuthority\s*=\s*["']studio["'][\s\S]{0,80}tryPlay\(\s*studioVideo/.test(armVideos)) {
  fail("desktop must not assign studio authority and play without consulting gemOutEnd");
}
if (!/want\s*!==\s*["']studio["'][\s\S]*pauseOpeningDecoder\s*\(\s*studioVideo/.test(armVideos)) {
  fail("cover authority must pause studioVideo on desktop and mobile");
}

const resetDecoder = extractFn(index, "resetOpeningDecoderToStart");
if (!resetDecoder) {
  fail("resetOpeningDecoderToStart must reset the studio film when metadata permits");
}
if (!/readyState\s*>=\s*1/.test(resetDecoder) || !/currentTime\s*=\s*0/.test(resetDecoder)) {
  fail("cover reset must seek to time zero only when metadata permits");
}
if (!/resetOpeningDecoderToStart\s*\(\s*studioVideo\s*\)/.test(armVideos)) {
  fail("armVideos cover path must reset studio to the montage beginning");
}

const manageOpening = extractFn(index, "manageOpeningVideoActivity");
if (!manageOpening) fail("manageOpeningVideoActivity must exist");
if (!/openingDecoderAuthority\s*\(\s*\)/.test(manageOpening)) {
  fail("manageOpeningVideoActivity must consult openingDecoderAuthority on desktop and mobile");
}
if (/else\s*\{\s*state\.openingDecoderAuthority\s*=\s*["']studio["']/.test(manageOpening)) {
  fail("desktop manageOpening must not force studio authority under gem cover");
}
if (
  !/want\s*!==\s*["']studio["'][\s\S]*pauseOpeningDecoder\s*\(\s*studioVideo\s*\)[\s\S]*resetOpeningDecoderToStart\s*\(\s*studioVideo\s*\)/.test(
    manageOpening
  )
) {
  fail("reverse cover authority must pause and reset the studio film to time zero");
}
const manageCoverAt = manageOpening.search(/want\s*!==\s*["']studio["']/);
const manageHydrateAt = manageOpening.search(/ensureVideoSource/);
if (manageCoverAt < 0 || manageHydrateAt < 0 || manageHydrateAt < manageCoverAt) {
  fail("manageOpening must not hydrate studioVideo under gem cover");
}

console.log(
  "PASS: turning-colors intro (four-phase cold-load black → Some stones turn colors. → gem → header on opening-start; original studio first-beat on opening-headline with Custom Gems Turn Heads; sequential setup-out then gem-out then headline-in by 0.48; one studio-opening-cluster-bench-engraving video; no opening ring world; WebGL2 lineage without halo/vignette/timed gem-boot; live uZoom 1.5 on mobile and 1 on desktop; mobile fallback 150vmin square; restore keeps fallback; resize/dispose release GL targets; quiet still; two-rest map opening-start then opening-headline; cover|studio decoder authority at gemOutEnd on desktop and mobile; reverse cover resets studio to time zero; forced ?gem=fallback genuine-gem image; lazy data-src hydration; no paintGemFallback/Canvas2D geometry; no 2D-plane rotation; quiet disables fallback animation; cover hides fallback; one-shot intro snaps to composed end-state on reverse)"
);
