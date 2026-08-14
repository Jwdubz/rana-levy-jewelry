#!/usr/bin/env node
/**
 * Focused tripwire for the 2026-08-14 mobile passage correction.
 *
 * Residue: mobile passage correction tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator editing homepage beats, Vegas montage, or mobile copy docks
 * Activation: execute — node tools/assert-mobile-passage-corrections.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when the six-beat jewelry passage or its copy/media contract is retired
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

if (!index.includes("Designing Jewelry for nearly a Decade.")) {
  fail('exact sentence "Designing Jewelry for nearly a Decade." must be present');
}
if (!/id="workThoughtVegas"/.test(index) || !/id="workThoughtVegas"[\s\S]{0,200}Designing Jewelry for nearly a Decade\./.test(index)) {
  fail("decade line must live on the Vegas work beat (#workThoughtVegas)");
}
if (!/id="handThought0"[\s\S]{0,240}Cut by hand,[\s\S]{0,80}one at a time\./.test(index)) {
  fail("Cut by hand, one at a time. must live on the workbench thought");
}
if (!index.includes("See what's ready now or work with Rana to bring your Custom Design to Life.")) {
  fail("exact terminal sentence must remain");
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

const vegasLand = "assets/vegas-strip-night.mp4";
const vegasPort = "assets/vegas-strip-night-portrait.mp4";
if (!fs.existsSync(path.join(root, vegasLand)) || !fs.existsSync(path.join(root, vegasPort))) {
  fail("Vegas landscape and portrait assets must exist");
}
if (!index.includes(vegasLand) || !index.includes(vegasPort)) {
  fail("Vegas assets must be locally referenced from index.html");
}
if (!fs.existsSync(path.join(root, "assets/vegas-strip-night.SOURCES.md"))) {
  fail("provenance note assets/vegas-strip-night.SOURCES.md must exist");
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

assertMotionVideo(vegasLand, 1920, 1080);
assertMotionVideo(vegasPort, 720, 1560);

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
if (!/white-space:\s*nowrap/.test(indexMobile) || !/\.headline \.line\s*\{\s*display:\s*inline/.test(indexMobile)) {
  fail("mobile Custom Gems must be one nowrap line");
}
const mobileHeadline = (indexMobile.match(/\.headline\s*\{[\s\S]*?\}/) || [""])[0];
if (!/text-align:\s*center/.test(mobileHeadline) || !/justify-content:\s*center/.test(mobileHeadline)) {
  fail("mobile Custom Gems must be centered in the black dock");
}
const headFont = (indexMobile.match(/\.headline\s*\{[\s\S]*?font-size:\s*([^;]+);/) || [])[1] || "";
if (!/1rem|16px/.test(headFont)) {
  fail("mobile Custom Gems font must not drop below 16px (got " + headFont + ")");
}
if (!/workThoughtRest[\s\S]*workLinks/.test(index) || !/id="workCopyDock"/.test(index)) {
  fail("terminal sentence and three choices must sit in the authored work copy dock");
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

if (!/setVideoActive\s*\(\s*vegasVideo/.test(siteJs)) {
  fail("Vegas video ownership must go through setVideoActive");
}
if (!/hand:\s*\[\s*0\.5/.test(siteJs) || !/work:\s*\[\s*0\.28\s*,\s*0\.55\s*,\s*0\.88\s*\]/.test(siteJs)) {
  fail("BEAT_DWELL must model one Hand plateau and three Work plateaus");
}

console.log(
  "PASS: mobile passage correction (rejected copy/rests absent; decade + cut-by-hand on the right beats; Vegas motion assets silent H.264/yuv420p; one-line Custom Gems dock; below-ring terminal dock; no blur/vignette filler)"
);
