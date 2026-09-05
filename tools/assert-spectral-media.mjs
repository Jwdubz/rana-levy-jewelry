#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceVideo =
  "assets/studio-opening-cluster-bench-engraving-mobile-wide.mp4";
const sourcePoster =
  "assets/studio-opening-cluster-bench-engraving-mobile-wide.jpg";
const draftVideo =
  "assets/studio-opening-cluster-bench-engraving-mobile-wide-spectral.mp4";
const draftPoster =
  "assets/studio-opening-cluster-bench-engraving-mobile-wide-spectral.jpg";
const htmlFiles = [
  "index.html",
  "consultation.html",
  "faq.html",
  "gallery.html",
  "journal.html",
  "made.html",
  "privacy.html",
  "ready.html",
  "services.html",
  "terms.html",
];

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n?/g, "\n");
}

for (const rel of htmlFiles) {
  const draft = read(rel);
  const linkCount = (draft.match(/href="spectral-background\.css"/g) || []).length;
  if (linkCount !== 1) fail(`${rel} must load spectral-background.css exactly once`);
}

const index = read("index.html");
if (!/<h1 class="type headline" id="headline">/.test(index)) {
  fail("approved type headline class/id changed");
}
if (!/font-size:\s*clamp\(4\.1rem,\s*6\.8vw,\s*7\.2rem\)/.test(index)) {
  fail("approved desktop headline size changed");
}
if (!/font-size:\s*clamp\(1\.45rem,\s*7\.4vw,\s*2\.25rem\)/.test(index)) {
  fail("approved mobile headline size changed");
}
if (/Some stones turn colors|worldGem|gemCanvas|setupLine/.test(index)) {
  fail("retired gemstone/setup opening returned");
}
for (const rel of [draftVideo, draftPoster]) {
  if (!index.includes(rel)) fail(`index.html does not wire ${rel}`);
}

const css = read("spectral-background.css");
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
if (
  !/--spectral-palette:\s*linear-gradient\(\s*105deg,\s*#d7b9ff 0%,\s*#a98cff 28%,\s*#ff9cc9 58%,\s*#f4ddb0 100%\s*\)/.test(
    cssNoComments
  )
) {
  fail("spectral palette no longer matches the approved Heads gradient");
}
if ((cssNoComments.match(/rgba\(2,\s*0,\s*5,\s*0\.67\)/g) || []).length !== 2) {
  fail("spectral ground must use one uniform 67% ink wash");
}
if (/--ink\s*:/.test(cssNoComments)) fail("draft must not redefine --ink");
if (
  /\b(?:font(?:-[a-z-]+)?|color|text-shadow|letter-spacing|line-height|object-fit|object-position|transform|filter|opacity|mask(?:-[a-z-]+)?|clip-path)\s*:/.test(
    cssNoComments
  )
) {
  fail("draft stylesheet contains a forbidden typography/media/compositing property");
}

const sourceVideoHash = execFileSync("git", ["hash-object", sourceVideo], {
  cwd: root,
  encoding: "utf8",
}).trim();
const sourcePosterHash = execFileSync("git", ["hash-object", sourcePoster], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (sourceVideoHash !== "009889b69f7a2b2c4e424159dc35e6e2e7c10255") {
  fail("approved source mobile opening video changed");
}
if (sourcePosterHash !== "ed0f8a1929223a7a77aaefbbdcf04e6e1d25fe2f") {
  fail("approved source mobile opening poster changed");
}

function probe(rel, countFrames = false) {
  const args = ["-v", "error"];
  if (countFrames) args.push("-count_frames");
  args.push(
    "-show_entries",
    "stream=codec_type,codec_name,profile,width,height,pix_fmt,r_frame_rate,avg_frame_rate,nb_frames,nb_read_frames,color_range,color_space,color_transfer,color_primaries",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    rel
  );
  const result = spawnSync("ffprobe", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) fail(`ffprobe failed for ${rel}: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

const info = probe(draftVideo, true);
const videos = (info.streams || []).filter((stream) => stream.codec_type === "video");
const audios = (info.streams || []).filter((stream) => stream.codec_type === "audio");
if (videos.length !== 1 || audios.length !== 0) {
  fail("spectral derivative must contain one video stream and no audio");
}
const video = videos[0];
if (
  video.codec_name !== "h264" ||
  video.profile !== "Main" ||
  video.pix_fmt !== "yuv420p" ||
  video.width !== 720 ||
  video.height !== 1560 ||
  video.r_frame_rate !== "30/1" ||
  video.avg_frame_rate !== "30/1" ||
  Number(video.nb_read_frames || video.nb_frames) !== 517
) {
  fail(`unexpected spectral video metadata: ${JSON.stringify(video)}`);
}
if (Math.abs(Number(info.format.duration) - 17.233333) > 0.02) {
  fail(`unexpected spectral video duration: ${info.format.duration}`);
}
for (const key of ["color_space", "color_transfer", "color_primaries"]) {
  if (video[key] && video[key] !== "unknown") {
    fail(`spectral derivative must not retag the source; ${key}=${video[key]}`);
  }
}

function moovBeforeMdat(rel) {
  const buffer = fs.readFileSync(path.join(root, rel));
  let offset = 0;
  let moov = -1;
  let mdat = -1;
  while (offset + 8 <= buffer.length) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    if (size === 1) size = Number(buffer.readBigUInt64BE(offset + 8));
    if (size < 8) break;
    if (type === "moov" && moov < 0) moov = offset;
    if (type === "mdat" && mdat < 0) mdat = offset;
    offset += size;
  }
  return moov >= 0 && mdat >= 0 && moov < mdat;
}
if (!moovBeforeMdat(draftVideo)) fail("spectral derivative is not faststart");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "rana-spectral-check-"));
const frameBytes = 720 * 1560 * 3;
function extract(rel, frame, label) {
  const output = path.join(temp, `${label}-${frame}.rgb`);
  const result = spawnSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      rel,
      "-vf",
      `select=eq(n\\,${frame})`,
      "-frames:v",
      "1",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      output,
    ],
    { cwd: root, encoding: "utf8" }
  );
  if (result.status !== 0) fail(`frame extraction failed: ${result.stderr}`);
  const bytes = fs.readFileSync(output);
  if (bytes.length !== frameBytes) fail(`short RGB frame for ${rel} at ${frame}`);
  return bytes;
}

function centerMad(a, b) {
  let sum = 0;
  let count = 0;
  for (let y = 456; y < 1104; y += 1) {
    let offset = y * 720 * 3;
    for (let x = 0; x < 720 * 3; x += 1) {
      sum += Math.abs(a[offset + x] - b[offset + x]);
      count += 1;
    }
  }
  return sum / count;
}

const samples = [0, 112, 247, 447, 481, 516];
let draftFirst;
for (const frame of samples) {
  const source = extract(sourceVideo, frame, "source");
  const draft = extract(draftVideo, frame, "draft");
  if (frame === 0) draftFirst = draft;
  const mad = centerMad(source, draft);
  if (mad > 3) fail(`center picture MAD ${mad.toFixed(3)} at frame ${frame}`);
}

const dx = 0.9659258262890683;
const dy = 0.25881904510252085;
const stops = [
  [0, [215, 185, 255]],
  [0.28, [169, 140, 255]],
  [0.58, [255, 156, 201]],
  [1, [244, 221, 176]],
];
const groundWash = 0.67;
const groundInk = [2, 0, 5];

function luminance(rgb) {
  const linear = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

for (const [, foreground] of stops) {
  const background = foreground.map((value, channel) =>
    Math.round((1 - groundWash) * value + groundWash * groundInk[channel])
  );
  const contrast =
    (Math.max(luminance(foreground), luminance(background)) + 0.05) /
    (Math.min(luminance(foreground), luminance(background)) + 0.05);
  if (contrast < 4.5) {
    fail(
      `spectral text/ground stop contrast ${contrast.toFixed(2)} is below 4.5:1`
    );
  }
}

function expectedRgb(x, y) {
  const t = Math.max(
    0,
    Math.min(
      1,
      0.5 + ((x + 0.5 - 360) * dx + (y + 0.5 - 780) * dy) / (720 * dx + 1560 * dy)
    )
  );
  let left = stops[0];
  let right = stops.at(-1);
  for (let i = 1; i < stops.length; i += 1) {
    if (t <= stops[i][0]) {
      left = stops[i - 1];
      right = stops[i];
      break;
    }
  }
  const p = (t - left[0]) / (right[0] - left[0] || 1);
  return left[1].map((value, channel) =>
    Math.round(
      (1 - groundWash) * (value + (right[1][channel] - value) * p) +
        groundWash * groundInk[channel]
    )
  );
}

function patchMean(frame, cx, cy, radius = 8) {
  const sum = [0, 0, 0];
  let count = 0;
  for (let y = cy - radius; y < cy + radius; y += 1) {
    for (let x = cx - radius; x < cx + radius; x += 1) {
      const offset = (y * 720 + x) * 3;
      sum[0] += frame[offset];
      sum[1] += frame[offset + 1];
      sum[2] += frame[offset + 2];
      count += 1;
    }
  }
  return sum.map((value) => value / count);
}

for (const [x, y] of [
  [72, 72],
  [360, 228],
  [648, 384],
  [72, 1176],
  [360, 1332],
  [648, 1488],
]) {
  const observed = patchMean(draftFirst, x, y);
  const expected = expectedRgb(x, y);
  const distance = Math.hypot(...observed.map((value, i) => value - expected[i]));
  if (distance > 8) {
    fail(
      `gradient patch (${x},${y}) differs by ${distance.toFixed(2)}: ` +
        `${observed.map((v) => v.toFixed(1)).join(",")} vs ${expected.join(",")}`
    );
  }
}

const draftLast = extract(draftVideo, 516, "draft-last");
let bandDelta = 0;
let bandCount = 0;
for (let y = 0; y < 1560; y += 1) {
  if (y >= 456 && y < 1104) continue;
  const start = y * 720 * 3;
  for (let x = 0; x < 720 * 3; x += 1) {
    bandDelta += Math.abs(draftFirst[start + x] - draftLast[start + x]);
    bandCount += 1;
  }
}
if (bandDelta / bandCount > 1) fail("spectral bands are not temporally stable");

const posterFrame = extract(draftPoster, 0, "poster");
if (centerMad(draftFirst, posterFrame) > 4) {
  fail("spectral poster no longer matches video frame zero in the picture band");
}

fs.rmSync(temp, { recursive: true, force: true });
console.log(
  "PASS: spectral media (exact Heads palette; uniform ink wash; approved typography/opening preserved; mobile derivative metadata, center edit, gradient bands, poster, and faststart verified)"
);
