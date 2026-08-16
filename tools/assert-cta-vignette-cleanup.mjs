#!/usr/bin/env node
/**
 * Focused source assertion for the 2026-08-15 CTA hierarchy and vignette cleanup.
 *
 * Residue: homepage CTA hierarchy + full-bleed terminal cover framing + no terminal overscan/zoom + non-inventory vignette-kill tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator editing the homepage terminal dock, desktop terminal still, or route grounds
 * Activation: execute — node tools/assert-cta-vignette-cleanup.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when the owner-supplied terminal hierarchy, full-bleed cover framing, no-overscan/zoom contract, or no-vignette non-inventory contract is retired
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
  return out || "";
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
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped + "(?=\\s*[,{])", "g");
  const blocks = [];
  let match;
  while ((match = re.exec(src))) {
    const brace = src.indexOf("{", match.index);
    if (brace < 0) continue;
    const between = src.slice(match.index + match[0].length, brace);
    if (/[{}]/.test(between)) continue;
    let depth = 0;
    for (let j = brace; j < src.length; j++) {
      const ch = src[j];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          blocks.push(src.slice(brace + 1, j));
          break;
        }
      }
    }
  }
  return blocks;
}

function assertDisabled(block, label) {
  if (!block) fail(label + " rule missing");
  if (!/display\s*:\s*none/i.test(block) && !/content\s*:\s*none/i.test(block)) {
    fail(label + " must be disabled (display:none or content:none)");
  }
}

const index = read("index.html");
const styles = read("styles.css");
const shellCss = read("shell.css");
const siteJs = read("site.js");
const stylesMobile = extractMobileSlice(styles);
const indexMobile = extractMobileSlice(index);
const stylesDesktop = styles.slice(0, styles.indexOf("@media (max-width: 700px)"));
const indexDesktop = index.slice(0, index.indexOf("@media (max-width: 700px)"));

const HEADLINE_A = "Bring Your Vision To Life";
const HEADLINE_B = "Looking for Inspiration or Want something now?";
const SUPERSEDED_INVITE = "Work with Rana to bring your Custom Design to Life";
const SUPERSEDED_SINGLE = "Bring your Custom Design to Life with Rana";
const SUPERSEDED_INSPIRE =
  "Looking for Inspiration or Want something now? Click Ready Now Below";
const workSection = (index.match(/id="work"[\s\S]*?<\/section>/) || [""])[0];
const workDock = (workSection.match(
  /<div class="work-copy-dock" id="workCopyDock">[\s\S]*$/
) || [""])[0];

// a) exact two-headline CTA copy / order / grouping and gradient design-path classes
if (!/id="workThoughtRest"[^>]*>Bring Your Vision To Life<\/p>/.test(workDock)) {
  fail("first terminal headline must be exactly: " + HEADLINE_A);
}
if (/id="workThoughtRest"[^>]*>Bring Your Vision To Life With Rana</.test(workDock)) {
  fail("first terminal headline must drop only the trailing With Rana");
}
if (
  !/id="workThoughtReady"[^>]*>Looking for Inspiration or Want something now\?<\/p>/.test(workDock)
) {
  fail("second terminal headline must be exactly: " + HEADLINE_B);
}
if (
  !/id="workThoughtRest"[\s\S]*id="workLinks"[\s\S]*work-design-paths[\s\S]*choice-link--design[\s\S]*href="made\.html">Made To Order<[\s\S]*choice-link--design[\s\S]*href="consultation\.html">Custom Consultation<[\s\S]*id="workThoughtReady"[\s\S]*choice-link--ready[\s\S]*href="ready\.html">See What's Ready Now</.test(
    workDock
  )
) {
  fail(
    "terminal dock must be first headline, Made To Order + Custom Consultation, second headline, then See What's Ready Now"
  );
}
if (/id="workThoughtRest"[^>]*class="[^"]*\bheads\b/.test(workDock)) {
  fail("first terminal headline must not carry the italic Heads gradient class");
}
if (/id="workThoughtReady"[^>]*class="[^"]*\bheads\b/.test(workDock)) {
  fail("second terminal headline must not carry the italic Heads gradient class");
}
if (!/class="[^"]*\bwork-terminal-headline\b[^"]*"[^>]*>Bring Your Vision To Life</.test(workDock)) {
  fail("first terminal sentence must use the derived .work-terminal-headline display class");
}
if (
  !/class="[^"]*\bwork-terminal-headline\b[^"]*"[^>]*>Looking for Inspiration or Want something now\?</.test(
    workDock
  )
) {
  fail("second terminal sentence must use the derived .work-terminal-headline display class");
}
const desktopHeadline = extractBlock(stylesDesktop, ".work-terminal-headline");
if (!desktopHeadline) fail("desktop .work-terminal-headline rule missing");
if (!/font-weight\s*:\s*400/.test(desktopHeadline)) {
  fail("terminal headlines must use display weight 400");
}
if (!/letter-spacing\s*:\s*-0\.01em/.test(desktopHeadline)) {
  fail("terminal headlines must use the Custom Gems negative tracking");
}
if (!/line-height\s*:\s*0\.9/.test(desktopHeadline)) {
  fail("terminal headlines must use tight display leading");
}
if (!/clamp\(\s*2\.2rem\s*,\s*3\.05vw\s*,\s*3\.35rem\s*\)/.test(desktopHeadline)) {
  fail("desktop terminal headlines must use display clamp 2.2rem / 3.05vw / 3.35rem");
}
if (/font-style\s*:\s*italic/.test(desktopHeadline)) {
  fail("terminal headlines must not be italic");
}
if (/background-clip\s*:\s*text/i.test(desktopHeadline)) {
  fail("terminal headlines must not clip a gradient to text");
}
const mobileHeadlineRule = extractBlock(stylesMobile, ".work-terminal-headline");
if (!mobileHeadlineRule) fail("mobile .work-terminal-headline rule missing");
if (!/clamp\(\s*1\.48rem\s*,\s*6\.1vw\s*,\s*1\.88rem\s*\)/.test(mobileHeadlineRule)) {
  fail("mobile terminal headlines must use display clamp 1.48rem / 6.1vw / 1.88rem");
}
if (!/font-weight\s*:\s*400/.test(desktopHeadline + mobileHeadlineRule)) {
  fail("terminal headlines must stay 400 weight on every viewport");
}
const designRule = extractBlock(styles, ".choice-link--design");
if (!designRule) fail(".choice-link--design gradient class missing");
if (
  !/#d7b9ff/.test(designRule) ||
  !/#a98cff/.test(designRule) ||
  !/#ff9cc9/.test(designRule) ||
  !/#f4ddb0/.test(designRule)
) {
  fail(".choice-link--design must use the Heads violet-to-pink-to-warm-cream stops");
}
if (!/background-clip\s*:\s*text/i.test(designRule) || !/-webkit-background-clip\s*:\s*text/i.test(designRule)) {
  fail(".choice-link--design must clip the gradient to text like .heads");
}
if (!/text-decoration-color/i.test(designRule)) {
  fail(".choice-link--design must keep a visible underline/affordance color");
}
if (!/\.choice-link:focus[\s\S]{0,120}outline\s*:\s*2px solid/.test(stylesDesktop)) {
  fail("choice links must keep an accessible focus outline");
}
if (!/\.choice-link--ready/.test(styles)) {
  fail("ready alternative must keep a semantic .choice-link--ready hook class");
}
const readyRule = extractAllBlocks(stylesDesktop, ".choice-link--ready").join("\n");
if (!readyRule) fail(".choice-link--ready visual rule missing");
if (
  !/#d7b9ff/.test(readyRule) ||
  !/#a98cff/.test(readyRule) ||
  !/#ff9cc9/.test(readyRule) ||
  !/#f4ddb0/.test(readyRule)
) {
  fail(".choice-link--ready must share the violet-rose-gold gradient language");
}
if (!/background-clip\s*:\s*text/i.test(readyRule) || !/-webkit-background-clip\s*:\s*text/i.test(readyRule)) {
  fail(".choice-link--ready must clip the same gradient to text as .choice-link--design");
}
if (/font-size\s*:/.test(readyRule) || /font-weight\s*:/.test(readyRule) || /line-height\s*:/.test(readyRule) || /font-family\s*:/.test(readyRule)) {
  fail(".choice-link--ready must inherit .choice-link family/size/weight/line-height rather than override them");
}
if (/opacity\s*:\s*(0(?:\.\d+)?)\b/.test(readyRule) || /color\s*:\s*var\(--cream\)/.test(readyRule)) {
  fail(".choice-link--ready must not remain cream or reduced-opacity");
}
const mobileReadyRule = extractAllBlocks(stylesMobile, ".choice-link--ready").join("\n");
if (/font-size\s*:/.test(mobileReadyRule) || /opacity\s*:\s*(0(?:\.\d+)?)\b/.test(mobileReadyRule)) {
  fail("mobile .choice-link--ready must not remain smaller or reduced-opacity");
}

// b) superseded single-line copy / old Ready label absent from the terminal dock
if (workDock.includes(SUPERSEDED_INSPIRE) || workSection.includes(SUPERSEDED_INSPIRE)) {
  fail("superseded inspiration sentence must be absent from the terminal dock");
}
if (workDock.includes(SUPERSEDED_INVITE) || workSection.includes(SUPERSEDED_SINGLE)) {
  fail("superseded single-line invitation must be absent from the terminal dock");
}
if (/id="workThoughtRestB"/.test(index) || /work-thought-rest-b/.test(index + styles)) {
  fail("retired independently-pinned #workThoughtRestB host must be absent");
}
if (/href="ready\.html">Ready Now</.test(workDock)) {
  fail("old Ready Now label must be absent from the terminal dock");
}
if (/Click Ready Now Below/.test(workDock)) {
  fail("retired Click Ready Now Below instruction must be absent from the terminal dock");
}

// c) homepage vignette / echo / mask mechanisms disabled across desktop and mobile
assertDisabled(extractBlock(indexDesktop, ".veil"), "desktop .veil");
assertDisabled(extractBlock(indexMobile, ".veil") || extractBlock(indexDesktop, ".veil"), "mobile .veil");
assertDisabled(extractBlock(stylesDesktop, ".movement-veil"), "desktop .movement-veil");
assertDisabled(extractBlock(styles, ".movement-veil"), "base .movement-veil");
assertDisabled(extractBlock(stylesDesktop, ".work-rest-wash"), "desktop .work-rest-wash");
assertDisabled(extractBlock(stylesMobile, ".work-rest-wash"), "mobile .work-rest-wash");
assertDisabled(extractBlock(stylesDesktop, ".work-world-0::before"), "desktop .work-world-0::before");
assertDisabled(extractBlock(stylesMobile, ".work-world-0::before"), "mobile .work-world-0::before");

const desktopEcho = extractBlock(stylesDesktop, ".work-world-0::before") || "";
if (/filter\s*:\s*[^;]*blur/i.test(desktopEcho)) {
  fail("desktop work-world-0::before must not keep a live blur echo");
}
if (/background-image/i.test(desktopEcho)) {
  fail("desktop work-world-0::before must not keep a duplicate wallpaper image");
}

const desktopJewelMedia = extractBlock(stylesDesktop, ".work-world-0 .layer-media");
const desktopJewel = extractBlock(stylesDesktop, "#workStack0 > img");
const mobileJewelMedia = extractBlock(stylesMobile, ".work-world-0 .layer-media");
const mobileJewel = extractBlock(stylesMobile, "#workStack0 > img");
if (
  !desktopJewelMedia ||
  !/inset\s*:\s*0/.test(desktopJewelMedia) ||
  !/width\s*:\s*100%/.test(desktopJewelMedia) ||
  !/height\s*:\s*100%/.test(desktopJewelMedia)
) {
  fail("desktop .work-world-0 .layer-media must cancel inherited 112% overscan");
}
if (/inset\s*:\s*-/.test(desktopJewelMedia) || /width\s*:\s*112%/.test(desktopJewelMedia) || /height\s*:\s*112%/.test(desktopJewelMedia)) {
  fail("desktop terminal media must not keep the inherited overscan pad");
}
if (!desktopJewel || !/object-fit\s*:\s*cover/i.test(desktopJewel)) {
  fail("desktop #workStack0 > img must remain a full-bleed cover carrier without inherited overscan");
}
if (/object-fit\s*:\s*contain/i.test(desktopJewel)) {
  fail("desktop #workStack0 > img must not collapse into a contained portrait island");
}
if (/mask-image\s*:\s*[^;]*radial-gradient/i.test(desktopJewel) || /filter\s*:\s*[^;]*blur/i.test(desktopJewel)) {
  fail("desktop #workStack0 > img must not use a radial mask or blur/echo filler");
}
if (/transform\s*:\s*[^;]*scale/i.test(desktopJewel)) {
  fail("desktop #workStack0 > img must not add a zoom/scale transform");
}
if (!/object-position/i.test(desktopJewel)) {
  fail("desktop #workStack0 > img must keep an art-directed object-position");
}
if (
  !mobileJewelMedia ||
  !/inset\s*:\s*0/.test(mobileJewelMedia) ||
  !/width\s*:\s*100%/.test(mobileJewelMedia) ||
  !/height\s*:\s*100%/.test(mobileJewelMedia)
) {
  fail("mobile .work-world-0 .layer-media must remain a full media well above the copy dock");
}
if (!mobileJewel || !/object-fit\s*:\s*cover/i.test(mobileJewel)) {
  fail("mobile #workStack0 > img must remain a cover full-viewport carrier");
}
if (/object-fit\s*:\s*contain/i.test(mobileJewel || "")) {
  fail("mobile #workStack0 > img must not inherit the desktop contain exception");
}
if (/mask-image\s*:\s*[^;]*radial-gradient/i.test(mobileJewel || "")) {
  fail("mobile #workStack0 > img must not use a radial media mask");
}
if (/workRestWash/.test(siteJs) || /workThoughtRestB/.test(siteJs)) {
  fail("site.js must not animate workRestWash or the retired second terminal line");
}
if (/workScaleStart|workScaleEnd/.test(siteJs)) {
  fail("site.js must retire terminal workScaleStart/workScaleEnd rather than interpolate a work scale");
}
if (/function\s+workLocal\s*\(/.test(siteJs)) {
  fail("site.js must retire workLocal; it existed only to drive the terminal scale breath");
}
if (!/stack\.style\.transform\s*=\s*["']translate3d\(0,0,0\) scale\(1\)["']/.test(siteJs)) {
  fail("terminal work stack must pin translate3d(0,0,0) scale(1) for the whole movement");
}
if (/scale\("\s*\+\s*scale\s*\+/.test(siteJs) || /lerp\s*\([^;]*workScale/.test(siteJs)) {
  fail("terminal work stack must not interpolate a scale value into the transform");
}
if (/setWillChange\(\s*workStacks\[i\]\s*,\s*workActive\s*\?\s*["']transform["']/.test(siteJs)) {
  fail("terminal work stack must not promote will-change:transform for a retired zoom");
}

// d) non-inventory route overrides compute from source without radial/blur/mask filler
const inkPages = ["faq", "gallery", "privacy", "terms"];
const carrierPages = ["services", "journal"];
for (const page of inkPages) {
  const groundBlocks = extractAllBlocks(shellCss, `.page-${page} .shell-ground`);
  const imageBlocks = extractAllBlocks(shellCss, `.page-${page} .shell-ground__image`);
  const scrimBlocks = extractAllBlocks(shellCss, `.page-${page} .shell-ground__scrim`);
  if (!groundBlocks.length) fail(`.page-${page} .shell-ground override missing`);
  if (!imageBlocks.length) fail(`.page-${page} .shell-ground__image override missing`);
  if (!scrimBlocks.length) fail(`.page-${page} .shell-ground__scrim override missing`);
  for (const block of [...groundBlocks, ...scrimBlocks]) {
    if (/radial-gradient/i.test(block)) {
      fail(`.page-${page} ground/scrim override must not use radial-gradient filler`);
    }
  }
  for (const block of imageBlocks) {
    if (!/display\s*:\s*none/i.test(block)) {
      fail(`.page-${page} ground image must be disabled (native ink field)`);
    }
    if (/filter\s*:\s*[^;]*blur/i.test(block)) {
      fail(`.page-${page} ground image must not use blur wallpaper`);
    }
    if (/mask-image\s*:\s*[^;]*radial/i.test(block)) {
      fail(`.page-${page} ground image must not use a radial mask`);
    }
  }
}
for (const page of carrierPages) {
  const imageBlocks = extractAllBlocks(shellCss, `.page-${page} .shell-ground__image`);
  const scrimBlocks = extractAllBlocks(shellCss, `.page-${page} .shell-ground__scrim`);
  const groundBlocks = extractAllBlocks(shellCss, `.page-${page} .shell-ground`);
  if (!imageBlocks.length || !scrimBlocks.length || !groundBlocks.length) {
    fail(`.page-${page} sharp-carrier overrides missing`);
  }
  const imageJoined = imageBlocks.join("\n");
  if (/filter\s*:\s*[^;]*blur/i.test(imageJoined)) {
    fail(`.page-${page} carrier must stay sharp (no blur wallpaper)`);
  }
  if (/mask-image\s*:\s*[^;]*radial/i.test(imageJoined)) {
    fail(`.page-${page} carrier must not use a radial mask`);
  }
  if (!/object-fit\s*:\s*cover/i.test(imageJoined) || !/filter\s*:\s*none/i.test(imageJoined)) {
    fail(`.page-${page} carrier must be a sharp full-bleed cover`);
  }
  for (const block of [...groundBlocks, ...scrimBlocks]) {
    if (/radial-gradient/i.test(block)) {
      fail(`.page-${page} ground/scrim override must not use radial-gradient filler`);
    }
  }
}
const consultScrims = extractAllBlocks(shellCss, ".page-consultation .shell-ground__scrim");
if (!consultScrims.length) fail("consultation scrim override missing");
for (const block of consultScrims) {
  if (/radial-gradient/i.test(block)) {
    fail("consultation scrim must not keep radial vignette components");
  }
  if (!/linear-gradient/i.test(block)) {
    fail("consultation scrim must keep linear directional readability support");
  }
}
const consultImage = extractBlock(shellCss, ".page-consultation .shell-ground--sketch .shell-ground__image");
if (!consultImage || !/filter\s*:\s*none/i.test(consultImage)) {
  fail("consultation sketch must remain a sharp carrier");
}

// f) Services figures and Gallery cards/Held are sharp rectangles, not piece-mask islands
const proseFrame = extractBlock(shellCss, ".prose-figure__frame");
if (!proseFrame) fail("missing .prose-figure__frame");
if (/--piece-mask/.test(proseFrame) || /mask-image\s*:\s*[^;]*radial/i.test(proseFrame)) {
  fail("services .prose-figure__frame must not use --piece-mask or a radial mask");
}
if (!/mask-image\s*:\s*none/i.test(proseFrame)) {
  fail("services .prose-figure__frame must set mask-image: none");
}
if (!/overflow\s*:\s*hidden/i.test(proseFrame)) {
  fail("services .prose-figure__frame must clip as a rectangle (overflow: hidden)");
}
const proseImg = extractBlock(shellCss, ".prose-figure img");
if (!proseImg) fail("missing .prose-figure img");
if (/transform\s*:\s*scale/i.test(proseImg)) {
  fail("services figure images must not use scale overscan/halo");
}

const galleryFrames = extractAllBlocks(shellCss, ".gallery-item__frame");
if (!galleryFrames.length) fail("missing .gallery-item__frame");
for (const block of galleryFrames) {
  if (/--piece-mask/.test(block) || /mask-image\s*:\s*var\(--piece-mask\)/.test(block)) {
    fail("gallery-item__frame must not use --piece-mask at any viewport");
  }
  if (/inset\s*:\s*-/.test(block)) {
    fail("gallery-item__frame must not use negative overscan inset");
  }
  if (!/mask-image\s*:\s*none/i.test(block)) {
    fail("gallery-item__frame must set mask-image: none at every viewport");
  }
}
const galleryFrameDesktop = extractBlock(shellCss, ".gallery-item__frame", 0);
if (!galleryFrameDesktop || !/inset\s*:\s*0/.test(galleryFrameDesktop)) {
  fail("desktop .gallery-item__frame must be inset 0 (direct rectangle, no overscan)");
}
if (!/overflow\s*:\s*hidden/i.test(galleryFrameDesktop)) {
  fail("desktop .gallery-item__frame must overflow: hidden");
}

const galleryHeldFrame = extractBlock(shellCss, ".page-gallery .shell-held__frame");
if (!galleryHeldFrame) fail("missing .page-gallery .shell-held__frame override");
if (!/inset\s*:\s*0/.test(galleryHeldFrame)) {
  fail("gallery Held frame must be inset 0");
}
if (!/overflow\s*:\s*hidden/.test(galleryHeldFrame)) {
  fail("gallery Held frame must overflow: hidden");
}
if (!/mask-image\s*:\s*none/i.test(galleryHeldFrame)) {
  fail("gallery Held frame must set mask-image: none");
}
if (/--piece-mask/.test(galleryHeldFrame)) {
  fail("gallery Held frame must not use --piece-mask");
}
const galleryHeldImage = extractBlock(shellCss, ".page-gallery .shell-held__image");
if (!galleryHeldImage) fail("missing .page-gallery .shell-held__image override");
if (!/transform\s*:\s*none/.test(galleryHeldImage)) {
  fail("gallery Held image must set transform: none");
}
if (!/filter\s*:\s*none/.test(galleryHeldImage)) {
  fail("gallery Held image must set filter: none");
}

// e) ready/made inventory vignette and piece-mask rules remain present
if (!/--piece-mask\s*:\s*radial-gradient/.test(shellCss)) {
  fail("inventory --piece-mask radial dissolve must remain");
}
const pieceFrameDesktop = extractBlock(shellCss, ".piece__frame", 0);
if (!pieceFrameDesktop || !/mask-image\s*:\s*var\(--piece-mask\)/.test(pieceFrameDesktop)) {
  fail("desktop .piece__frame must keep the inventory piece-mask");
}
const pieceAfterDesktop = extractBlock(shellCss, ".piece__frame::after", 0);
if (!pieceAfterDesktop || !/radial-gradient/i.test(pieceAfterDesktop)) {
  fail("desktop inventory piece wash must remain");
}
const heldFrameDesktop = extractBlock(shellCss, ".shell-held__frame", 0);
if (!heldFrameDesktop || !/mask-image\s*:\s*var\(--piece-mask\)/.test(heldFrameDesktop)) {
  fail("desktop inventory Held .shell-held__frame must keep --piece-mask");
}
if (!/inset\s*:\s*-7%\s+-5\.5%/.test(heldFrameDesktop)) {
  fail("desktop inventory Held frame must keep the existing overscan inset");
}
const sharedGround = extractBlock(shellCss, ".shell-ground", 0);
if (!sharedGround || !/radial-gradient/i.test(sharedGround)) {
  fail("shared inventory shell-ground atmosphere must remain for ready/made");
}
if (/\.page-ready\s+\.piece__frame/.test(shellCss) || /\.page-made\s+\.piece__frame/.test(shellCss)) {
  fail("ready/made must not grow page-scoped piece-frame overrides that could strip the mask");
}
if (/\.page-ready\s+\.shell-held/.test(shellCss) || /\.page-made\s+\.shell-held/.test(shellCss)) {
  fail("ready/made must not grow page-scoped Held overrides; inventory Held stays on the unscoped frame");
}
if (/\.page-ready\s+\.shell-ground\s*\{/.test(shellCss) || /\.page-made\s+\.shell-ground\s*\{/.test(shellCss)) {
  fail("ready/made must keep the shared inventory ground rather than a page-scoped rewrite");
}

console.log(
  "PASS: CTA hierarchy and vignette cleanup (Bring Your Vision To Life + matching gradient CTA links; desktop terminal stays full-bleed cover without inherited overscan; terminal work stack stays exact scale 1; mobile terminal cover/crop preserved; superseded single-line invitation/old Ready absent from dock; homepage veil/echo/mask/wash disabled on desktop and mobile; non-inventory grounds have no radial/blur/mask filler; services/gallery/gallery-Held are sharp rectangles; ready/made piece-mask and Held vignette remain)"
);
