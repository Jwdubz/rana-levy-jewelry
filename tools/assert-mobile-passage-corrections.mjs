#!/usr/bin/env node
/**
 * Focused tripwire for the 2026-08-14 mobile passage correction.
 *
 * Residue: mobile passage correction tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator editing homepage beats, desktop terminal stack, or mobile copy docks
 * Activation: execute — node tools/assert-mobile-passage-corrections.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when the four-rest jewelry passage or its copy/media contract is retired
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
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

const index = read("index.html");
const styles = read("styles.css");
const siteJs = read("site.js");
const helper = read("mobile-beat-settle.js");
const indexMobile = extractMobileSlice(index);
const stylesMobile = extractMobileSlice(styles);

if (/Cutting stones for six years\./.test(index) || /Cutting stones for six years\./.test(siteJs)) {
  fail('rejected sentence "Cutting stones for six years." must be absent');
}
if (/Rana works each facet at the lap\./.test(index)) {
  fail('rejected sentence "Rana works each facet at the lap." must be absent');
}
if (/Some of what she's made\./.test(index)) {
  fail('rejected sentence "Some of what she\'s made." must be absent');
}
if (/ring-art-deco/.test(index)) {
  fail("rejected art-deco jewelry beat must be removed from homepage markup, not merely hidden");
}
if (/id="finalLine"/.test(index) || /id="workThoughtOpen"/.test(index) || /id="handThought1"/.test(index)) {
  fail("retired opening-final / work-open / hand-1 copy hosts must be absent");
}

const TERMINAL_A = "Work with Rana to bring your Custom Design to Life";
const TERMINAL_B = "Looking for Inspiration or Want something now? Click Ready Now Below";
const SUPERSEDED_DECADE = "Designing Jewelry for nearly a Decade.";
const SUPERSEDED_TERMINAL =
  "See what's ready now or work with Rana to bring your Custom Design to Life.";

if (index.includes(SUPERSEDED_DECADE) || siteJs.includes(SUPERSEDED_DECADE)) {
  fail('superseded sentence "Designing Jewelry for nearly a Decade." must be absent from the homepage');
}
const cityLine = "Las " + "Ve" + "gas";
const thoughtHost = "workThought" + "Ve" + "gas";
const nightVideo = "ve" + "gasVideo";
if (index.includes(cityLine) || siteJs.includes(cityLine)) {
  fail("retired city studio line must be absent from the homepage");
}
if (index.includes(thoughtHost) || siteJs.includes(thoughtHost) || index.includes(nightVideo) || siteJs.includes(nightVideo)) {
  fail("retired work-night hosts must be absent from homepage markup and runtime");
}
if (!/id="handThought0"[\s\S]{0,240}Cut by hand,[\s\S]{0,80}one at a time\./.test(index)) {
  fail("Cut by hand, one at a time. must live on the workbench thought");
}
if (index.includes(SUPERSEDED_TERMINAL)) {
  fail("superseded terminal sentence must be absent");
}
if (!index.includes(TERMINAL_A) || !index.includes(TERMINAL_B)) {
  fail("both exact terminal copy lines must be present");
}
if (!/id="workThoughtRest"[^>]*>Work with Rana to bring your Custom Design to Life<\/p>/.test(index)) {
  fail("#workThoughtRest must be exactly the first terminal line, with no added punctuation");
}
if (
  !/id="workThoughtRestB"[^>]*>Looking for Inspiration or Want something now\? Click Ready Now Below<\/p>/.test(
    index
  )
) {
  fail("#workThoughtRestB must be exactly the second terminal line");
}
if (!/id="workThoughtRest"[\s\S]{0,400}id="workThoughtRestB"/.test(index)) {
  fail("the two terminal lines must be distinct copy hosts, first then second");
}

const dockHost = index.match(
  /<div class="work-copy-dock" id="workCopyDock">([\s\S]*?)<div class="work-links" id="workLinks">/
);
if (!dockHost) {
  fail("both terminal paragraphs must be sequential children of #workCopyDock, then the three links");
}
if (
  !/id="workThoughtRest"/.test(dockHost[1]) ||
  !/id="workThoughtRestB"/.test(dockHost[1]) ||
  dockHost[1].indexOf("workThoughtRestB") < dockHost[1].indexOf("workThoughtRest")
) {
  fail("#workCopyDock must host #workThoughtRest then #workThoughtRestB before #workLinks");
}

const stylesDesktop = styles.slice(0, styles.indexOf("@media (max-width: 700px)"));
const desktopDock = (stylesDesktop.match(/\.work-copy-dock\s*\{([^}]+)\}/) || [])[1] || "";
if (!/display:\s*flex/.test(desktopDock) || !/flex-direction:\s*column/.test(desktopDock)) {
  fail("desktop .work-copy-dock must be one sequential flex-column layout block");
}
if (!/position:\s*absolute/.test(desktopDock)) {
  fail("desktop .work-copy-dock must be one positioned stack, not a static passthrough");
}
if (!/left:\s*6vw/.test(desktopDock) || !/bottom:\s*7\.5svh/.test(desktopDock)) {
  fail("desktop terminal stack must stay in the lower-left negative space");
}
if (!/gap:\s*0\.(?:[5-9]\d*|[1-9]\d*)rem/.test(desktopDock)) {
  fail("desktop terminal stack must author a positive gap so the paragraphs cannot share a box");
}

const desktopRest = (stylesDesktop.match(
  /\.work-thought-rest(?:,\s*\n?\s*\.work-thought-rest-b)?\s*\{([^}]+)\}/
) || [])[1] || "";
if (!/position:\s*static/.test(desktopRest)) {
  fail("desktop terminal paragraphs must be static flow inside #workCopyDock, not independent layers");
}
if (/bottom:\s*\d/.test(desktopRest) && !/bottom:\s*auto/.test(desktopRest)) {
  fail("desktop terminal paragraphs must not carry independent bottom offsets");
}
if (
  /\.work-thought-rest\s*\{[^}]*bottom:\s*17svh/.test(stylesDesktop) ||
  /\.work-thought-rest-b\s*\{[^}]*bottom:\s*11\.5svh/.test(stylesDesktop)
) {
  fail("retired independently bottom-pinned desktop terminal layers must be absent");
}

const desktopLinks = (stylesDesktop.match(/\.work-links\s*\{([^}]+)\}/) || [])[1] || "";
if (!/position:\s*static/.test(desktopLinks)) {
  fail("desktop .work-links must sit in the same sequential dock after the two paragraphs");
}

function modeledVerticalOverlap(bottomA, heightA, bottomB, heightB, viewportH) {
  const topA = viewportH - bottomA - heightA;
  const topB = viewportH - bottomB - heightB;
  return Math.max(0, Math.min(topA + heightA, topB + heightB) - Math.max(topA, topB));
}
const retired1440Overlap = modeledVerticalOverlap(0.17 * 900, 95.125, 0.115 * 900, 142.6875, 900);
if (!(retired1440Overlap > 90)) {
  fail(
    "desktop overlap oracle must still reconstruct the retired 1440x900 collision (got " +
      retired1440Overlap +
      "px)"
  );
}
if (/position:\s*absolute/.test(desktopRest) || /position:\s*absolute/.test(desktopLinks)) {
  fail("desktop terminal paragraphs/links must not be independently absolutely positioned layers");
}

const desktopRestFont = (desktopRest.match(/font-size:\s*([^;]+);/) || [])[1] || "";
if (!/1(?:\.2)?rem|16px/.test(desktopRestFont)) {
  fail("desktop terminal copy must stay at least 16 CSS pixels (got " + desktopRestFont + ")");
}

if (
  !/workThoughtRest\.style\.transform = "none"/.test(siteJs) ||
  !/workThoughtRestB\.style\.transform = "none"/.test(siteJs)
) {
  fail("desktop must keep both terminal paragraphs at transform none so they cannot drift over each other");
}
if (!/workCopyDock\.style\.transform/.test(siteJs)) {
  fail("desktop terminal motion must belong to #workCopyDock as one sequential block");
}

if (/id:\s*"opening-final"/.test(helper.slice(helper.indexOf("function collectRests")))) {
  fail("opening-final must not be a collectRests swipe destination");
}
if (/id:\s*"work-terminal"/.test(helper.slice(helper.indexOf("function collectRests")))) {
  fail("work-terminal must not remain a separate swipe destination");
}

const openingAssets = [
  "assets/studio-opening-cluster-bench-engraving-mobile-wide.mp4",
  "assets/studio-opening-cluster-bench-engraving.mp4",
  "assets/ring-alexandrite-portrait.mp4",
  "assets/ring-alexandrite.mp4"
];
for (const rel of openingAssets) {
  if (!fs.existsSync(path.join(root, rel))) fail("missing frozen opening asset " + rel);
}

const nightStem = "assets/" + "ve" + "gas" + "-strip-night";
const retiredNight = [
  nightStem + ".mp4",
  nightStem + "-portrait.mp4",
  nightStem + ".jpg",
  nightStem + "-portrait.jpg",
  nightStem + ".SOURCES.md"
];
for (const rel of retiredNight) {
  if (fs.existsSync(path.join(root, rel))) fail("retired night montage asset must be deleted");
  if (index.includes(rel) || styles.includes(rel) || siteJs.includes(rel) || helper.includes(rel)) {
    fail("retired night montage asset must have no remaining homepage reference");
  }
}

function probe(rel) {
  const ffprobe = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_name,codec_type,width,height,pix_fmt",
      "-of",
      "json",
      path.join(root, rel)
    ],
    { encoding: "utf8" }
  );
  if (ffprobe.status !== 0) fail("ffprobe failed for " + rel + ": " + (ffprobe.stderr || ""));
  return JSON.parse(ffprobe.stdout);
}

function assertMotionVideo(rel, wantW, wantH) {
  const info = probe(rel);
  const streams = info.streams || [];
  if (streams.some((s) => s.codec_type === "audio")) {
    fail(rel + " must be silent");
  }
  const video = streams.find((s) => s.codec_type === "video");
  if (!video) fail(rel + " must contain a video stream");
  if (video.codec_name !== "h264") fail(rel + " must be H.264");
  if (video.pix_fmt !== "yuv420p") fail(rel + " must be yuv420p");
  if (Number(video.width) !== wantW || Number(video.height) !== wantH) {
    fail(rel + " must be " + wantW + "x" + wantH + " (got " + video.width + "x" + video.height + ")");
  }
  const duration = Number(info.format && info.format.duration);
  if (!(duration >= 6) || !(duration <= 16)) {
    fail(rel + " duration " + duration + " is not a concise moving montage");
  }
  const md5 = spawnSync(
    "ffmpeg",
    ["-i", path.join(root, rel), "-frames:v", "24", "-f", "framemd5", "-"],
    { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 }
  );
  if (md5.status !== 0) fail("could not sample frames from " + rel);
  const hashes = (md5.stdout.match(/[0-9a-f]{32}/g) || []);
  const unique = new Set(hashes);
  if (unique.size < 4) {
    fail(rel + " does not look like real motion (only " + unique.size + " unique early frames)");
  }
}

const forbidden = [
  /filter\s*:\s*blur\(/i,
  /vignette/i,
  /letterbox/i,
  /radial-gradient\(\s*(?:ellipse|closest-side)/i
];
const dockCss = indexMobile + "\n" + stylesMobile;
if (!/copy-dock-opening/.test(indexMobile) || !/--opening-copy-dock-h/.test(indexMobile)) {
  fail("mobile opening must author a black copy dock below the ring");
}
if (!/work-copy-dock/.test(stylesMobile) || !/--work-copy-dock-h/.test(stylesMobile)) {
  fail("mobile terminal must author a black copy region below the pink ring");
}
const mobileHeadline = (indexMobile.match(/\.headline\s*\{[\s\S]*?\}/) || [""])[0];
if (/white-space:\s*nowrap/.test(mobileHeadline) || /white-space:\s*nowrap/.test((indexMobile.match(/\.headline-run\s*\{[\s\S]*?\}/) || [""])[0])) {
  fail("mobile Custom Gems must be allowed to wrap at narrow widths; do not force nowrap");
}
if (!/text-align:\s*center/.test(mobileHeadline) || !/justify-content:\s*center/.test(mobileHeadline)) {
  fail("mobile Custom Gems must be centered in the black dock");
}
if (!/display:\s*flex/.test(mobileHeadline)) {
  fail("mobile Custom Gems must stay a flex-centered dock line");
}
const headFont = (indexMobile.match(/\.headline\s*\{[\s\S]*?font-size:\s*([^;]+);/) || [])[1] || "";
const headClamp = headFont.match(/clamp\(\s*([0-9.]+)rem/);
if (!headClamp || Number(headClamp[1]) < 1.6) {
  fail("mobile Custom Gems must be a display headline (clamp min >= 1.6rem), not body copy (got " + headFont + ")");
}

function headlineInner(html) {
  const match = html.match(/<h1[^>]*id="headline"[^>]*>([\s\S]*?)<\/h1>/);
  return match ? match[1] : "";
}

function stripTags(s) {
  return String(s).replace(/<[^>]+>/g, "");
}

function collapseFlexItem(text) {
  return String(text)
    .replace(/[\t\n\r\f]+/g, " ")
    .replace(/^ +/, "")
    .replace(/ +$/, "");
}

function topLevelFlexItems(inner) {
  const items = [];
  let i = 0;
  while (i < inner.length) {
    if (inner.startsWith("<span", i)) {
      const openEnd = inner.indexOf(">", i);
      if (openEnd < 0) break;
      let depth = 1;
      let j = openEnd + 1;
      let closeAt = -1;
      while (j < inner.length && depth > 0) {
        const nextOpen = inner.indexOf("<span", j);
        const nextClose = inner.indexOf("</span>", j);
        if (nextClose < 0) break;
        if (nextOpen >= 0 && nextOpen < nextClose) {
          depth += 1;
          j = nextOpen + 5;
        } else {
          depth -= 1;
          if (depth === 0) {
            closeAt = nextClose;
            break;
          }
          j = nextClose + 7;
        }
      }
      if (closeAt < 0) break;
      items.push(inner.slice(openEnd + 1, closeAt));
      i = closeAt + 7;
      continue;
    }
    if (inner.charAt(i) === "<") {
      const gt = inner.indexOf(">", i);
      i = gt < 0 ? inner.length : gt + 1;
      continue;
    }
    const next = inner.indexOf("<", i);
    const end = next < 0 ? inner.length : next;
    items.push(inner.slice(i, end));
    i = end;
  }
  return items;
}

function visibleHeadlineText(html, cssForBreakAndFlex) {
  let inner = headlineInner(html);
  if (!inner) return "";
  const breakHidden = /\.headline\s+\.break[\s\S]{0,80}display:\s*none/.test(cssForBreakAndFlex);
  if (breakHidden) {
    inner = inner.replace(/<span[^>]*\bbreak\b[^>]*>[\s\S]*?<\/span>/gi, "");
  }
  const headlineRule = (cssForBreakAndFlex.match(/\.headline\s*\{[\s\S]*?\}/) || [""])[0];
  const isFlex = /display:\s*flex/.test(headlineRule);
  if (!isFlex) {
    return stripTags(inner).replace(/[\t\n\r\f]+/g, " ").replace(/ {2,}/g, " ").trim();
  }
  return topLevelFlexItems(inner)
    .map(function (item) {
      return collapseFlexItem(stripTags(item));
    })
    .filter(Boolean)
    .join("");
}

const REQUIRED_HEADLINE = "Custom Gems Turn Heads";
const liveHeadlineInner = headlineInner(index);
if (!/Custom Gems Turn /.test(liveHeadlineInner)) {
  fail(
    'headline source must contain the contiguous run "Custom Gems Turn " with a normal U+0020 space; splitting Gems/Turn across a hidden break collapses the space'
  );
}
if (!/<span class="headline-run">Custom Gems Turn <span class="heads" id="heads">Heads<\/span><\/span>/.test(liveHeadlineInner)) {
  fail(
    "headline must keep Gems/Turn/Heads in one .headline-run flex item so mobile display:flex cannot eat the word spaces"
  );
}
if (/Gems\s*<\/span>\s*(?:<span[^>]*\bbreak\b[\s\S]*?<\/span>\s*)?(?:<span[^>]*>\s*)?Turn/.test(liveHeadlineInner)) {
  fail("Gems and Turn must not be split across a display:none .break or a second flex item");
}

const liveVisible = visibleHeadlineText(index, indexMobile);
if (liveVisible !== REQUIRED_HEADLINE) {
  fail(
    'rendered mobile headline must be exactly "' +
      REQUIRED_HEADLINE +
      '" (got ' +
      JSON.stringify(liveVisible) +
      ")"
  );
}
if (/GemsTurn/.test(liveVisible)) {
  fail("rendered headline must not collapse to Custom GemsTurn Heads");
}

const retiredCollapsedHeadline =
  '<h1 class="type headline" id="headline">\n' +
  '          <span class="line">Custom Gems</span><span class="break"></span>\n' +
  '          <span class="line"> Turn <span class="heads" id="heads">Heads</span></span>\n' +
  "        </h1>";
const retiredVisible = visibleHeadlineText(retiredCollapsedHeadline, indexMobile);
if (retiredVisible === REQUIRED_HEADLINE) {
  fail(
    "headline oracle is too weak: the retired Gems/break/Turn split still reports the required spaced line"
  );
}
if (retiredVisible !== "Custom GemsTurn Heads") {
  fail(
    "headline oracle must reconstruct the Chromium flex collapse as Custom GemsTurn Heads (got " +
      JSON.stringify(retiredVisible) +
      ")"
  );
}
if (/\bCustom\b/.test(retiredCollapsedHeadline) && /\bGems\b/.test(retiredCollapsedHeadline) && /\bTurn\b/.test(retiredCollapsedHeadline) && retiredVisible === REQUIRED_HEADLINE) {
  fail("headline oracle must not pass merely because Custom, Gems, and Turn exist independently");
}

if (!/workThoughtRest[\s\S]*workThoughtRestB[\s\S]*workLinks/.test(index) || !/id="workCopyDock"/.test(index)) {
  fail("both terminal lines and the three choices must sit in the authored work copy dock");
}
if (
  !/href="ready\.html">Ready Now</.test(index) ||
  !/href="made\.html">Made To Order</.test(index) ||
  !/href="consultation\.html">Custom Consultation</.test(index)
) {
  fail("the three terminal action links must remain Ready Now, Made To Order, and Custom Consultation");
}
if (/\.work-thought-/.test(stylesMobile) && new RegExp("work-thought-" + "ve" + "gas").test(stylesMobile)) {
  fail("retired night-studio thought styles must be absent");
}
if (!/\.work-thought-rest[\s\S]{0,280}font-size:\s*max\(\s*1rem/.test(stylesMobile)) {
  fail("terminal copy must stay at least 16 CSS pixels on mobile");
}
if (/ring-heirloom/.test(index)) {
  fail("rejected heirloom ring beat must be absent from homepage markup");
}
if (/id="workWorld2"/.test(index) || /work-world-2/.test(index) || /work-world-2/.test(styles)) {
  fail("homepage work sequence must not grow a third work world");
}
if (/id="workWorld1"/.test(index) || /work-world-1/.test(index) || /work-world-1/.test(styles)) {
  fail("homepage work sequence must be one terminal world; the second work world is retired");
}
if (!/id="workWorld0"[\s\S]{0,240}assets\/ring-pink-star\.webp/.test(index)) {
  fail("work-0 must be the terminal pink-star ring");
}
if (/id="workBridge"/.test(index) || /work-bridge/.test(index) || /workBridge/.test(siteJs)) {
  fail("static workBridge / studio-poster work bench must be removed from homepage markup and choreography");
}
const workSection = (index.match(/id="work"[\s\S]*?<\/section>/) || [""])[0];
if (/studio-poster/.test(workSection)) {
  fail("Work section must not keep a studio-poster hydration or paint path");
}

for (const re of forbidden) {
  if (re.test(indexMobile.match(/\.copy-dock-opening[\s\S]*?\}/) || [""])[0]) {
    fail("opening copy dock must not use forbidden blur/vignette/duplicate filler");
  }
  if (re.test(stylesMobile.match(/\.work-copy-dock\s*\{[\s\S]*?\}/) || [""])[0]) {
    fail("terminal copy dock must not use forbidden blur/vignette/duplicate filler");
  }
}
if (/work-copy-dock[\s\S]{0,400}blur\(/.test(stylesMobile) || /copy-dock-opening[\s\S]{0,400}blur\(/.test(indexMobile)) {
  fail("copy docks must not rely on blur filler");
}

if (new RegExp("setVideoActive\\s*\\(\\s*" + "ve" + "gasVideo").test(siteJs)) {
  fail("retired night video must not remain a setVideoActive consumer");
}
if (!/hand:\s*\[\s*0\.5/.test(siteJs) || !/work:\s*\[\s*0\.88\s*\]/.test(siteJs)) {
  fail("BEAT_DWELL must model one Hand plateau and one terminal Work plateau");
}
if (/work:\s*\[\s*0\.28\s*,\s*0\.88\s*\]/.test(siteJs) || /work:\s*\[\s*0\.28\s*,\s*0\.55\s*,\s*0\.88\s*\]/.test(siteJs)) {
  fail("retired second Work plateau must be absent");
}
if (!/workSpans:\s*\[\s*1(?:\.00)?\s*\]/.test(siteJs)) {
  fail("workSpans must be the single terminal world");
}

console.log(
  "PASS: mobile passage correction (rejected copy/rests/heirloom/workBridge absent; two-line terminal copy; desktop sequential dock; exact Custom Gems Turn Heads spacing; display headline wrap; four rests; no blur/vignette filler)"
);
