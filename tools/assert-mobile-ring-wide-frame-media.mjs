#!/usr/bin/env node
/**
 * Source assertion: widened mobile alexandrite ring derivative.
 *
 * The retired 332x720 portrait was a tight center cut of the 720x720
 * desktop film. The candidate must keep the exact 419-frame order,
 * 13.966667s duration, loop wiring, and desktop bytes, while placing
 * the 720x720 source into the same 720x648 beat-1 plate used by the
 * opening/hand mobile films, letterboxed in a 720x1560 canvas.
 *
 * Usage: node tools/assert-mobile-ring-wide-frame-media.mjs
 *
 * Residue: mobile-ring-wide-frame tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator recropping or rewiring the mobile ring
 * Activation: execute — node tools/assert-mobile-ring-wide-frame-media.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when the widened mobile ring contract is retired
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "8a8832c26eb55fec664c6cd884ce8eccd23c82cd";

const MOBILE_VIDEO = "assets/ring-alexandrite-portrait.mp4";
const MOBILE_POSTER = "assets/ring-poster-portrait.jpg";
const DESKTOP_VIDEO = "assets/ring-alexandrite.mp4";
const DESKTOP_POSTER = "assets/ring-poster.jpg";

const TOTAL_FRAMES = 419;
const EXPECTED_DURATION = TOTAL_FRAMES / 30;
const OUT_W = 720;
const OUT_H = 1560;
const SOURCE_W = 720;
const SOURCE_H = 720;
const BAND_H = 648;
const BAND_Y = 456;
const DESK_CROP_Y = 36;
const OLD_CROP_W = 332;
const MATCH = 80;

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n?/g, "\n");
}

function findTool(name) {
  const direct = spawnSync(name, ["-version"], { encoding: "utf8" });
  if (direct.status === 0) return name;
  const home = process.env.HOME || "";
  const fallback = path.join(home, ".local", "bin", name);
  if (home && fs.existsSync(fallback)) return fallback;
  fail(`${name} not available on PATH or ~/.local/bin/${name}`);
}

const ffprobe = findTool("ffprobe");
const ffmpeg = findTool("ffmpeg");

function probeJson(assetPath) {
  const probe = spawnSync(
    ffprobe,
    [
      "-v",
      "error",
      "-count_frames",
      "-show_entries",
      "stream=index,codec_type,codec_name,width,height,pix_fmt,r_frame_rate,nb_frames,nb_read_frames",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      assetPath,
    ],
    { encoding: "utf8" }
  );
  if (probe.status !== 0) {
    process.stderr.write(probe.stdout || "");
    process.stderr.write(probe.stderr || "");
    fail(`ffprobe failed on ${assetPath}`);
  }
  try {
    return JSON.parse(probe.stdout || "{}");
  } catch {
    fail(`ffprobe JSON parse failed for ${assetPath}`);
  }
}

function moovBeforeMdat(rel) {
  const buf = fs.readFileSync(path.join(root, rel));
  let pos = 0;
  let moov = -1;
  let mdat = -1;
  while (pos + 8 <= buf.length) {
    let size = buf.readUInt32BE(pos);
    const typ = buf.slice(pos + 4, pos + 8).toString("ascii");
    if (size === 1) {
      if (pos + 16 > buf.length) break;
      size = Number(buf.readBigUInt64BE(pos + 8));
    }
    if (size < 8) break;
    if (typ === "moov" && moov < 0) moov = pos;
    if (typ === "mdat" && mdat < 0) mdat = pos;
    pos += size;
  }
  return { moov, mdat };
}

function runFfmpeg(args) {
  const r = spawnSync(ffmpeg, args, { encoding: "utf8" });
  if (r.status !== 0) {
    process.stderr.write(r.stderr || "");
    fail(`ffmpeg failed: ${args.slice(0, 8).join(" ")}`);
  }
}

function extractRgb(videoPath, frameIndex, outPath, width, height, vfExtra = "") {
  const parts = [`select=eq(n\\,${frameIndex})`];
  if (vfExtra) parts.push(vfExtra);
  parts.push(`scale=${width}:${height}:flags=bilinear`, "setsar=1");
  runFfmpeg([
    "-y",
    "-i",
    videoPath,
    "-vf",
    parts.join(","),
    "-vframes",
    "1",
    "-update",
    "1",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    outPath,
  ]);
}

function extractRgbStill(imagePath, outPath, width, height) {
  runFfmpeg([
    "-y",
    "-i",
    imagePath,
    "-vf",
    `scale=${width}:${height}:flags=fast_bilinear,setsar=1`,
    "-vframes",
    "1",
    "-update",
    "1",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    outPath,
  ]);
}

function meanAbsDiffBuf(a, b) {
  if (a.length !== b.length) {
    fail(`raw buffer size mismatch ${a.length} vs ${b.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

function detectContentBand(rgb, width, height) {
  const rows = [];
  for (let y = 0; y < height; y++) {
    let sum = 0;
    let sumSq = 0;
    const rowOff = y * width * 3;
    for (let x = 0; x < width; x++) {
      const i = rowOff + x * 3;
      const luma = 0.299 * rgb[i] + 0.587 * rgb[i + 1] + 0.114 * rgb[i + 2];
      sum += luma;
      sumSq += luma * luma;
    }
    const mean = sum / width;
    const variance = sumSq / width - mean * mean;
    const std = Math.sqrt(Math.max(0, variance));
    rows.push({ content: !(mean < 14 && std < 10) });
  }
  let y0 = 0;
  while (y0 < height && !rows[y0].content) y0++;
  let y1 = height;
  while (y1 > y0 && !rows[y1 - 1].content) y1--;
  return { y0, h: y1 - y0 };
}

function gitHash(commit, rel) {
  return execFileSync("git", ["rev-parse", commit + ":" + rel], {
    cwd: root,
    encoding: "utf8",
  }).trim();
}

for (const rel of [MOBILE_VIDEO, MOBILE_POSTER, DESKTOP_VIDEO, DESKTOP_POSTER]) {
  if (!fs.existsSync(path.join(root, rel))) fail(`missing ${rel}`);
}

const deskVideoNow = execFileSync("git", ["hash-object", path.join(root, DESKTOP_VIDEO)], {
  encoding: "utf8",
}).trim();
const deskPosterNow = execFileSync("git", ["hash-object", path.join(root, DESKTOP_POSTER)], {
  encoding: "utf8",
}).trim();
const deskVideoBase = gitHash(BASE, DESKTOP_VIDEO);
const deskPosterBase = gitHash(BASE, DESKTOP_POSTER);
if (deskVideoNow !== deskVideoBase) {
  fail(`${DESKTOP_VIDEO} bytes changed vs base ${BASE} (${deskVideoBase} -> ${deskVideoNow})`);
}
if (deskPosterNow !== deskPosterBase) {
  fail(`${DESKTOP_POSTER} bytes changed vs base ${BASE} (${deskPosterBase} -> ${deskPosterNow})`);
}
console.log(
  `PASS: desktop ring source bytes unchanged (${DESKTOP_VIDEO} ${deskVideoBase}; ${DESKTOP_POSTER} ${deskPosterBase})`
);

const info = probeJson(path.join(root, MOBILE_VIDEO));
const streams = Array.isArray(info.streams) ? info.streams : [];
const video = streams.filter((s) => s.codec_type === "video");
const audio = streams.filter((s) => s.codec_type === "audio");
if (video.length !== 1) fail(`${MOBILE_VIDEO}: expected one video stream, found ${video.length}`);
if (audio.length !== 0) fail(`${MOBILE_VIDEO}: expected no audio streams, found ${audio.length}`);
const v = video[0];
const frames = Number(v.nb_read_frames || v.nb_frames);
const duration = Number(info.format && info.format.duration);
if (v.codec_name !== "h264") fail(`${MOBILE_VIDEO}: codec_name must be h264, got ${v.codec_name}`);
if (v.pix_fmt !== "yuv420p") fail(`${MOBILE_VIDEO}: pix_fmt must be yuv420p, got ${v.pix_fmt}`);
if (String(v.r_frame_rate) !== "30/1") {
  fail(`${MOBILE_VIDEO}: r_frame_rate must be 30/1, got ${v.r_frame_rate}`);
}
if (!Number.isFinite(frames) || frames !== TOTAL_FRAMES) {
  fail(`${MOBILE_VIDEO}: frame count must be exactly ${TOTAL_FRAMES}, got ${v.nb_read_frames || v.nb_frames}`);
}
if (!Number.isFinite(duration) || Math.abs(duration - EXPECTED_DURATION) > 0.02) {
  fail(
    `${MOBILE_VIDEO}: duration must be ~${EXPECTED_DURATION.toFixed(6)}s (${TOTAL_FRAMES}/30), got ${duration}`
  );
}
if (Number(v.width) !== OUT_W || Number(v.height) !== OUT_H) {
  fail(`${MOBILE_VIDEO}: canvas must be exactly ${OUT_W}x${OUT_H}, got ${v.width}x${v.height}`);
}
if (Number(v.width) === OLD_CROP_W) {
  fail(`${MOBILE_VIDEO}: still the retired ${OLD_CROP_W}px tight crop`);
}
const atoms = moovBeforeMdat(MOBILE_VIDEO);
if (atoms.moov < 0 || atoms.mdat < 0 || atoms.moov > atoms.mdat) {
  fail(`${MOBILE_VIDEO}: moov must precede mdat for faststart (moov=${atoms.moov} mdat=${atoms.mdat})`);
}
console.log(
  `PASS: ${MOBILE_VIDEO} media (${frames} frames; ${duration.toFixed(6)}s; ${OUT_W}x${OUT_H}; 30fps; h264/yuv420p; no audio; faststart)`
);

const index = read("index.html");
const opening = index.slice(index.indexOf('id="opening"'), index.indexOf('id="hand"'));
if (/id="ringVideo"/.test(opening)) {
  fail("opening must not keep the retired ringVideo decoder");
}
const ringBlock = index.match(/id="handBridgeVideo"[\s\S]*?<\/video>/);
if (!ringBlock) fail("handBridgeVideo element must be present as the ring-film consumer");
const markup = ringBlock[0];
if (!markup.includes(`data-mobile-src="${MOBILE_VIDEO}"`)) {
  fail(`handBridgeVideo data-mobile-src must remain ${MOBILE_VIDEO}`);
}
if (!markup.includes(`data-mobile-poster="${MOBILE_POSTER}"`)) {
  fail(`handBridgeVideo data-mobile-poster must remain ${MOBILE_POSTER}`);
}
if (!markup.includes(`data-desktop-src="${DESKTOP_VIDEO}"`)) {
  fail(`handBridgeVideo desktop film must remain ${DESKTOP_VIDEO}`);
}
if (!/\bloop\b/.test(markup)) {
  fail("handBridgeVideo must keep loop behavior");
}
console.log("PASS: handBridgeVideo ring mobile filename/wiring and loop attribute remain intact");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rana-ring-wide-"));
try {
  const samples = [0, 209, 418];
  for (const n of samples) {
    const nativeRaw = path.join(tmp, `native_${n}.raw`);
    extractRgb(path.join(root, MOBILE_VIDEO), n, nativeRaw, 4, OUT_H);
    const band = detectContentBand(fs.readFileSync(nativeRaw), 4, OUT_H);
    if (Math.abs(band.h - BAND_H) > 8) {
      fail(
        `${MOBILE_VIDEO} frame ${n} content band ${band.h}px is not the beat-1 ${BAND_H}px plate (y0=${band.y0})`
      );
    }
    if (Math.abs(band.y0 - BAND_Y) > 8) {
      fail(
        `${MOBILE_VIDEO} frame ${n} content band y0=${band.y0} is not centered at ${BAND_Y}`
      );
    }
    const mobileRaw = path.join(tmp, `mob_${n}.raw`);
    const deskRaw = path.join(tmp, `desk_${n}.raw`);
    extractRgb(
      path.join(root, MOBILE_VIDEO),
      n,
      mobileRaw,
      MATCH,
      MATCH,
      `crop=${OUT_W}:${BAND_H}:0:${BAND_Y}`
    );
    extractRgb(
      path.join(root, DESKTOP_VIDEO),
      n,
      deskRaw,
      MATCH,
      MATCH,
      `crop=${SOURCE_W}:${BAND_H}:0:${DESK_CROP_Y}`
    );
    const mad = meanAbsDiffBuf(fs.readFileSync(mobileRaw), fs.readFileSync(deskRaw));
    if (mad > 10) {
      fail(
        `${MOBILE_VIDEO} frame ${n} does not match the beat-1 crop of the ${SOURCE_W}x${SOURCE_H} desktop frame (mad ${mad.toFixed(3)} > 10)`
      );
    }
    console.log(
      `  frame ${n}: mad=${mad.toFixed(3)} band=${band.h}px y0=${band.y0} (beat-1 ${OUT_W}x${BAND_H})`
    );
  }

  const posterRaw = path.join(tmp, "poster.raw");
  const film0Raw = path.join(tmp, "film0.raw");
  extractRgbStill(path.join(root, MOBILE_POSTER), posterRaw, 72, 156);
  extractRgb(path.join(root, MOBILE_VIDEO), 0, film0Raw, 72, 156);
  const posterMad = meanAbsDiffBuf(fs.readFileSync(film0Raw), fs.readFileSync(posterRaw));
  if (posterMad > 14) {
    fail(`ring poster does not match film frame 0 (mad ${posterMad.toFixed(3)} > 14)`);
  }
  console.log(`PASS: ring poster≈film0 mad=${posterMad.toFixed(3)}`);
} finally {
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // tmp cleanup is best-effort
  }
}

console.log(
  "PASS: mobile ring wide-frame media (419-frame 720x1560 letterbox on the beat-1 720x648 plate; poster matches frame 0; desktop bytes exact; handBridgeVideo wiring/loop intact; no opening ringVideo; source proof only — not visual consumer verification)"
);
