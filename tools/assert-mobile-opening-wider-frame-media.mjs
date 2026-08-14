#!/usr/bin/env node
/**
 * Fail-before / pass-after: mobile opening framing-only correction.
 * Exact parent c50760d wired a rejected complete-silhouette edit that
 * replaced approved product passages with different native-portrait clips.
 * The candidate must keep the exact approved 517-frame desktop recut
 * (content, order, timing) and reframe only — a uniquely named mobile
 * derivative whose frames expose materially more horizontal source
 * coverage than the prior 498x1080 tight crop, with honest black
 * negative space allowed and no blur / echo / vignette / substitution.
 *
 * Usage: node tools/assert-mobile-opening-wider-frame-media.mjs
 *
 * Residue: mobile-opening-wider-frame tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator recropping or rewiring the mobile opening
 * Activation: execute — node tools/assert-mobile-opening-wider-frame-media.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when the wider-frame mobile opening contract is retired
 *
 * Companion maintained asset:
 *   assets/studio-opening-cluster-bench-engraving-mobile-wide.mp4
 *   assets/studio-opening-cluster-bench-engraving-mobile-wide.jpg
 * Future consumer: mobile homepage opening via selectResponsiveMedia()
 * Activation: auto-load — index.html data-mobile-src / data-mobile-poster
 * Behavioral check: execute — node tools/assert-mobile-opening-wider-frame-media.mjs
 * Retirement: when this mobile opening derivative is retired
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PARENT = "c50760d14ec37dbf7c4260908a39b8363dcc26ac";

const NEW_VIDEO = "assets/studio-opening-cluster-bench-engraving-mobile-wide.mp4";
const NEW_POSTER = "assets/studio-opening-cluster-bench-engraving-mobile-wide.jpg";
const OLD_VIDEO = "assets/studio-opening-cluster-bench-engraving-portrait.mp4";
const OLD_POSTER = "assets/studio-opening-cluster-bench-engraving-portrait.jpg";
const DESKTOP_VIDEO = "assets/studio-opening-cluster-bench-engraving.mp4";
const DESKTOP_POSTER = "assets/studio-opening-cluster-bench-engraving.jpg";
const REJECTED_VIDEO = "assets/studio-opening-cluster-complete-silhouette-portrait.mp4";
const REJECTED_POSTER = "assets/studio-opening-cluster-complete-silhouette-portrait.jpg";
const RING_MOBILE = "assets/ring-alexandrite-portrait.mp4";
const ALT_CLIPS = [
  "assets/ring-alexandrite-portrait.mp4",
  "assets/ring-alexandrite.mp4",
  "assets/studio-opening-cluster.mp4",
  "assets/studio-opening-cluster-portrait.mp4",
  "assets/studio-opening-bench-engraving.mp4",
  "assets/studio-opening-bench-engraving-portrait.mp4",
  "assets/studio-banner.mp4",
  "assets/studio-banner-portrait.mp4",
];

const TOTAL_FRAMES = 517;
const EXPECTED_DURATION = TOTAL_FRAMES / 30;
const OLD_CROP_W = 498;
const MIN_SOURCE_W = 900;
const DESK_W = 2160;
const DESK_H = 1080;
const DETECT_W = 72;
const DETECT_H = 156;
const MATCH_H = 120;

const NEW_CLUSTER_START = 0;
const NEW_CLUSTER_END = 111;
const NEW_PRODUCT1_START = 112;
const NEW_PRODUCT1_END = 246;
const NEW_PRODUCT2_START = 247;
const NEW_PRODUCT2_END = 446;
const NEW_BENCH_START = 447;
const NEW_BENCH_END = 480;
const NEW_ENGRAVING_START = 481;
const NEW_ENGRAVING_END = 516;

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n?/g, "\n");
}

function gitShow(commit, rel) {
  return execFileSync("git", ["show", commit + ":" + rel], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  }).replace(/\r\n?/g, "\n");
}

function gitHash(commit, rel) {
  return execFileSync("git", ["rev-parse", commit + ":" + rel], {
    cwd: root,
    encoding: "utf8",
  }).trim();
}

function findTool(name) {
  const direct = spawnSync(name, ["-version"], { encoding: "utf8" });
  if (direct.status === 0) return name;
  const home = process.env.HOME || "";
  const fallback = path.join(home, ".local", "bin", name);
  if (home && fs.existsSync(fallback)) return fallback;
  fail(`${name} not available on PATH or ~/.local/bin/${name}`);
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
      "format=duration,size",
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
  return r;
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
  if (!fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
    fail(`failed to extract frame ${frameIndex} from ${videoPath}`);
  }
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
    rows.push({ mean, std, content: !(mean < 14 && std < 10) });
  }
  let y0 = 0;
  while (y0 < height && !rows[y0].content) y0++;
  let y1 = height;
  while (y1 > y0 && !rows[y1 - 1].content) y1--;
  const bandH = y1 - y0;
  if (bandH < Math.max(8, Math.round(height * 0.18))) {
    fail(
      `could not detect a letterboxed content band (interior ${bandH}px of ${height}px)`
    );
  }
  return { y0, h: bandH, y1 };
}

function even(n) {
  const v = Math.max(2, Math.round(n));
  return v % 2 === 0 ? v : v - 1;
}

function bestWindowMatch(content, contentW, contentH, desk, deskW, deskH) {
  if (contentH !== deskH) {
    fail(`content/desk probe height mismatch ${contentH} vs ${deskH}`);
  }
  if (contentW > deskW) {
    fail(`content probe wider than desktop (${contentW} > ${deskW})`);
  }
  let bestMad = Infinity;
  let bestX = 0;
  for (let x = 0; x <= deskW - contentW; x++) {
    let sum = 0;
    const n = contentW * contentH * 3;
    for (let y = 0; y < contentH; y++) {
      const cRow = y * contentW * 3;
      const dRow = (y * deskW + x) * 3;
      for (let i = 0; i < contentW * 3; i++) {
        sum += Math.abs(content[cRow + i] - desk[dRow + i]);
      }
    }
    const mad = sum / n;
    if (mad < bestMad) {
      bestMad = mad;
      bestX = x;
    }
  }
  return {
    mad: bestMad,
    x: bestX,
    sourceW: (contentW / deskW) * DESK_W,
    sourceX: (bestX / deskW) * DESK_W,
  };
}

const index = read("index.html");
const styles = read("styles.css");
const parentIndex = gitShow(PARENT, "index.html");

if (parentIndex.includes(NEW_VIDEO) || parentIndex.includes(NEW_POSTER)) {
  fail(`parent ${PARENT} already wires ${NEW_VIDEO}; fail-before contract is broken`);
}
if (
  !parentIndex.includes(`data-mobile-src="${REJECTED_VIDEO}"`) &&
  !parentIndex.includes(`data-mobile-src="${OLD_VIDEO}"`)
) {
  fail(
    `parent ${PARENT} lost both the rejected silhouette wiring and the prior tight portrait`
  );
}

for (const rel of [NEW_VIDEO, NEW_POSTER, OLD_VIDEO, OLD_POSTER, DESKTOP_VIDEO, DESKTOP_POSTER]) {
  if (!fs.existsSync(path.join(root, rel))) fail(`missing ${rel}`);
}
if (NEW_VIDEO === OLD_VIDEO || NEW_POSTER === OLD_POSTER) {
  fail("new mobile opening assets must be uniquely named, not overwrite the prior portrait");
}
if (fs.existsSync(path.join(root, REJECTED_VIDEO)) || fs.existsSync(path.join(root, REJECTED_POSTER))) {
  fail(
    `rejected complete-silhouette assets must not remain in the delivered set (${REJECTED_VIDEO} / ${REJECTED_POSTER})`
  );
}

const openingWorld = index.slice(index.indexOf('id="worldStudio"'), index.indexOf('id="worldRing"'));
if (!openingWorld) fail("could not isolate opening studio world");

const studioVideoBlock = index.match(/id="studioVideo"[\s\S]*?<\/video>/);
if (!studioVideoBlock) fail("studioVideo element must be present");
const studioMarkup = studioVideoBlock[0];
if (!studioMarkup.includes(`data-mobile-src="${NEW_VIDEO}"`)) {
  fail(`studioVideo data-mobile-src must be ${NEW_VIDEO}`);
}
if (!studioMarkup.includes(`data-mobile-poster="${NEW_POSTER}"`)) {
  fail(`studioVideo data-mobile-poster must be ${NEW_POSTER}`);
}
if (studioMarkup.includes(OLD_VIDEO) || studioMarkup.includes(`data-mobile-poster="${OLD_POSTER}"`)) {
  fail("studioVideo must not keep the prior tight portrait as mobile film/poster");
}
if (studioMarkup.includes("complete-silhouette")) {
  fail("studioVideo must not reference the rejected complete-silhouette assets");
}
if (!studioMarkup.includes(`data-desktop-src="${DESKTOP_VIDEO}"`)) {
  fail(`studioVideo desktop film must remain ${DESKTOP_VIDEO}`);
}
if (!studioMarkup.includes(`data-src="${DESKTOP_VIDEO}"`)) {
  fail(`studioVideo default data-src must remain the desktop film ${DESKTOP_VIDEO}`);
}
if (!studioMarkup.includes(`data-desktop-poster="${DESKTOP_POSTER}"`)) {
  fail(`studioVideo desktop poster must remain ${DESKTOP_POSTER}`);
}
if (!/poster="assets\/studio-opening-cluster-bench-engraving\.jpg"/.test(studioMarkup)) {
  fail("studioVideo default poster must remain the desktop cluster-bench-engraving still");
}

const studioStackBlock = index.match(
  /id="studioStack"[\s\S]*?<\/div>\s*<\/div>\s*<div class="world world-ring"/
);
if (!studioStackBlock) fail("could not extract worldStudio media stack");
if (!studioStackBlock[0].includes(`data-mobile-src="${NEW_POSTER}"`)) {
  fail(`studio fallback image data-mobile-src must be ${NEW_POSTER}`);
}
if (!studioStackBlock[0].includes(`data-desktop-src="${DESKTOP_POSTER}"`)) {
  fail("studio fallback image desktop still must remain unchanged");
}
if (!/src="assets\/studio-opening-cluster-bench-engraving\.jpg"/.test(studioStackBlock[0])) {
  fail("studio fallback default src must remain the desktop still");
}

const ringBlock = index.match(/id="ringVideo"[\s\S]*?<\/video>/);
if (!ringBlock || !ringBlock[0].includes(`data-mobile-src="${RING_MOBILE}"`)) {
  fail("ringVideo must remain the alexandrite portrait on mobile");
}
if (!/data-desktop-src="assets\/ring-alexandrite\.mp4"/.test(index)) {
  fail("desktop ringVideo source must remain ring-alexandrite.mp4");
}

const forbiddenOpening = [
  "complete-silhouette",
  "studio-banner.mp4",
  "studio-banner-portrait.mp4",
  "studio-opening-cluster.mp4",
  "studio-opening-cluster.jpg",
  "studio-opening-cluster-portrait.mp4",
  "studio-opening-cluster-portrait.jpg",
  "studio-opening-bench-engraving.mp4",
  "studio-opening-bench-engraving.jpg",
  "studio-opening-bench-engraving-portrait.mp4",
  "studio-opening-bench-engraving-portrait.jpg",
  "ring-alexandrite.mp4",
  "ring-alexandrite-portrait.mp4",
];
for (const token of forbiddenOpening) {
  if (openingWorld.includes(token)) {
    fail(`opening world must not reference alternate clip ${token}`);
  }
}

const desktopVideoHead = gitHash(PARENT, DESKTOP_VIDEO);
const desktopPosterHead = gitHash(PARENT, DESKTOP_POSTER);
const desktopVideoNow = execFileSync("git", ["hash-object", path.join(root, DESKTOP_VIDEO)], {
  encoding: "utf8",
}).trim();
const desktopPosterNow = execFileSync("git", ["hash-object", path.join(root, DESKTOP_POSTER)], {
  encoding: "utf8",
}).trim();
if (desktopVideoNow !== desktopVideoHead) {
  fail(
    `${DESKTOP_VIDEO} bytes changed vs parent ${PARENT} (${desktopVideoHead} -> ${desktopVideoNow})`
  );
}
if (desktopPosterNow !== desktopPosterHead) {
  fail(
    `${DESKTOP_POSTER} bytes changed vs parent ${PARENT} (${desktopPosterHead} -> ${desktopPosterNow})`
  );
}
console.log(
  `PASS: desktop opening source bytes unchanged (${DESKTOP_VIDEO} ${desktopVideoHead}; ${DESKTOP_POSTER} ${desktopPosterHead})`
);

const info = probeJson(path.join(root, NEW_VIDEO));
const streams = Array.isArray(info.streams) ? info.streams : [];
const video = streams.filter((s) => s.codec_type === "video");
const audio = streams.filter((s) => s.codec_type === "audio");
if (video.length !== 1) fail(`${NEW_VIDEO}: expected one video stream, found ${video.length}`);
if (audio.length !== 0) fail(`${NEW_VIDEO}: expected no audio streams, found ${audio.length}`);
const v = video[0];
const frames = Number(v.nb_read_frames || v.nb_frames);
const duration = Number(info.format && info.format.duration);
if (v.codec_name !== "h264") fail(`${NEW_VIDEO}: codec_name must be h264, got ${v.codec_name}`);
if (v.pix_fmt !== "yuv420p") fail(`${NEW_VIDEO}: pix_fmt must be yuv420p, got ${v.pix_fmt}`);
if (String(v.r_frame_rate) !== "30/1") {
  fail(`${NEW_VIDEO}: r_frame_rate must be 30/1, got ${v.r_frame_rate}`);
}
if (!Number.isFinite(frames) || frames !== TOTAL_FRAMES) {
  fail(`${NEW_VIDEO}: frame count must be exactly ${TOTAL_FRAMES}, got ${v.nb_read_frames || v.nb_frames}`);
}
if (!Number.isFinite(duration) || Math.abs(duration - EXPECTED_DURATION) > 0.02) {
  fail(
    `${NEW_VIDEO}: duration must be ~${EXPECTED_DURATION.toFixed(6)}s (${TOTAL_FRAMES}/30), got ${duration}`
  );
}
if (Math.abs(duration - frames / 30) > 0.05) {
  fail(`${NEW_VIDEO}: duration ${duration} is not CFR 30fps for ${frames} frames`);
}
const outW = Number(v.width);
const outH = Number(v.height);
if (!Number.isFinite(outW) || !Number.isFinite(outH) || outW < 2 || outH < 2) {
  fail(`${NEW_VIDEO}: invalid geometry ${v.width}x${v.height}`);
}
if (outW >= outH) {
  fail(`${NEW_VIDEO}: mobile derivative must be portrait (got ${outW}x${outH})`);
}
const atoms = moovBeforeMdat(NEW_VIDEO);
if (atoms.moov < 0 || atoms.mdat < 0 || atoms.moov > atoms.mdat) {
  fail(`${NEW_VIDEO}: moov must precede mdat for faststart (moov=${atoms.moov} mdat=${atoms.mdat})`);
}
console.log(
  `PASS: ${NEW_VIDEO} media (${frames} frames; ${duration.toFixed(6)}s; ${outW}x${outH}; 30fps; h264/yuv420p; no audio; faststart)`
);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rana-wider-frame-"));
try {
  const deskMatchW = even((DESK_W / DESK_H) * MATCH_H);
  const sampleFrames = [
    { n: NEW_CLUSTER_START, label: "cluster-start" },
    { n: NEW_CLUSTER_END, label: "cluster-end" },
    { n: NEW_PRODUCT1_START, label: "product1-start" },
    { n: NEW_PRODUCT1_END, label: "product1-end" },
    { n: NEW_PRODUCT2_START, label: "product2-start" },
    { n: NEW_PRODUCT2_END, label: "product2-end" },
    { n: NEW_BENCH_START, label: "bench-start" },
    { n: NEW_BENCH_END, label: "bench-end" },
    { n: NEW_ENGRAVING_START, label: "engraving-start" },
    { n: NEW_ENGRAVING_END, label: "engraving-end" },
  ];

  const coverage = [];
  for (const sample of sampleFrames) {
    const detectRaw = path.join(tmp, `detect_${sample.n}.raw`);
    const nativeDetectRaw = path.join(tmp, `native_${sample.n}.raw`);
    extractRgb(path.join(root, NEW_VIDEO), sample.n, detectRaw, DETECT_W, DETECT_H);
    extractRgb(path.join(root, NEW_VIDEO), sample.n, nativeDetectRaw, 4, outH);
    const band = detectContentBand(fs.readFileSync(nativeDetectRaw), 4, outH);
    const cropYEven = band.y0 % 2 === 0 ? band.y0 : band.y0 + 1;
    const cropHEven = even(Math.min(outH - cropYEven, band.h));
    // Full-height source crop letterboxed into the portrait width:
    // sourceW = sourceHeight * (encodedWidth / contentHeight).
    const inferredSourceW = DESK_H * (outW / cropHEven);
    const contentMatchW = even(Math.min(deskMatchW, (inferredSourceW / DESK_W) * deskMatchW));
    const contentRaw = path.join(tmp, `new_${sample.n}.raw`);
    const deskRaw = path.join(tmp, `desk_${sample.n}.raw`);
    extractRgb(
      path.join(root, NEW_VIDEO),
      sample.n,
      contentRaw,
      contentMatchW,
      MATCH_H,
      `crop=${outW}:${cropHEven}:0:${cropYEven}`
    );
    extractRgb(path.join(root, DESKTOP_VIDEO), sample.n, deskRaw, deskMatchW, MATCH_H);
    const match = bestWindowMatch(
      fs.readFileSync(contentRaw),
      contentMatchW,
      MATCH_H,
      fs.readFileSync(deskRaw),
      deskMatchW,
      MATCH_H
    );

    if (match.mad > 12) {
      fail(
        `${NEW_VIDEO} ${sample.label} frame ${sample.n} does not match ${DESKTOP_VIDEO} frame ${sample.n} (mad ${match.mad.toFixed(3)} > 12)`
      );
    }
    if (match.sourceW < MIN_SOURCE_W) {
      fail(
        `${NEW_VIDEO} ${sample.label} frame ${sample.n} source width ${match.sourceW.toFixed(1)}px is not materially wider than the old ${OLD_CROP_W}px crop (need >= ${MIN_SOURCE_W})`
      );
    }
    coverage.push({
      label: sample.label,
      n: sample.n,
      mad: match.mad,
      sourceW: match.sourceW,
      sourceX: match.sourceX,
    });
    console.log(
      `  frame ${sample.n} ${sample.label}: mad=${match.mad.toFixed(3)} sourceW=${match.sourceW.toFixed(1)} sourceX=${match.sourceX.toFixed(1)}`
    );
  }

  const minW = Math.min(...coverage.map((c) => c.sourceW));
  const maxW = Math.max(...coverage.map((c) => c.sourceW));
  if (minW < MIN_SOURCE_W) {
    fail(`narrowest sampled source coverage ${minW.toFixed(1)}px < ${MIN_SOURCE_W}`);
  }
  console.log(
    `PASS: frames derive from the approved 517-frame desktop recut with wider coverage (min sourceW=${minW.toFixed(1)} max=${maxW.toFixed(1)}; old crop=${OLD_CROP_W})`
  );

  // Shot-boundary distinctness: adjacent partitions are different pictures.
  const distinctPairs = [
    [NEW_CLUSTER_END, NEW_PRODUCT1_START, "cluster→product1"],
    [NEW_PRODUCT1_END, NEW_PRODUCT2_START, "product1→product2"],
    [NEW_PRODUCT2_END, NEW_BENCH_START, "product2→bench"],
    [NEW_BENCH_END, NEW_ENGRAVING_START, "bench→engraving"],
  ];
  for (const [a, b, label] of distinctPairs) {
    const aRaw = path.join(tmp, `detect_${a}.raw`);
    const bRaw = path.join(tmp, `detect_${b}.raw`);
    const mad = meanAbsDiffBuf(fs.readFileSync(aRaw), fs.readFileSync(bRaw));
    if (mad < 12) {
      fail(`boundary ${label} looks like the same picture (mad ${mad.toFixed(3)} < 12)`);
    }
    console.log(`  boundary ${label}: mad=${mad.toFixed(3)}`);
  }
  console.log(
    "PASS: Cluster → product → product → Bench → Engraving boundaries remain distinct in the mobile derivative"
  );

  // Poster is the new film's first frame, not a different still.
  const posterRaw = path.join(tmp, "poster.raw");
  const film0Raw = path.join(tmp, "film0_full.raw");
  extractRgbStill(path.join(root, NEW_POSTER), posterRaw, DETECT_W, DETECT_H);
  extractRgb(path.join(root, NEW_VIDEO), 0, film0Raw, DETECT_W, DETECT_H);
  const posterMad = meanAbsDiffBuf(fs.readFileSync(film0Raw), fs.readFileSync(posterRaw));
  if (posterMad > 14) {
    fail(`new poster does not match new film frame 0 (mad ${posterMad.toFixed(3)} > 14)`);
  }
  console.log(`PASS: poster≈film0 mad=${posterMad.toFixed(3)}`);

  // Alternate opening clips must not be the source of sampled product frames.
  const altFrame = NEW_PRODUCT1_START;
  const newAltRaw = path.join(tmp, `detect_${altFrame}.raw`);
  const newAlt = fs.readFileSync(newAltRaw);
  for (const rel of ALT_CLIPS) {
    const altPath = path.join(root, rel);
    if (!fs.existsSync(altPath)) continue;
    const altRaw = path.join(tmp, `alt_${path.basename(rel)}.raw`);
    extractRgb(altPath, 0, altRaw, DETECT_W, DETECT_H);
    const mad = meanAbsDiffBuf(newAlt, fs.readFileSync(altRaw));
    if (mad < 18) {
      fail(
        `${NEW_VIDEO} frame ${altFrame} matches alternate clip ${rel} frame 0 (mad ${mad.toFixed(3)} < 18)`
      );
    }
  }
  console.log("PASS: product passage does not match alternate opening clips");
} finally {
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // tmp cleanup is best-effort; assertion results already stand
  }
}

const indexMobile = extractMobileSlice(index);
const stylesMobile = extractMobileSlice(styles);
const mobileCss = (indexMobile + "\n" + stylesMobile).replace(/\/\*[\s\S]*?\*\//g, "");
const forbiddenCss = [
  { re: /backdrop-filter/i, label: "backdrop-filter" },
  { re: /media-echo|atmosphere-layer|media-atmosphere/i, label: "atmosphere/echo filler" },
  { re: /mask-image\s*:\s*[^;]*(radial-gradient|linear-gradient|ellipse)/i, label: "gradient/ellipse media mask" },
  { re: /closest-side|ellipse 96% 94%|ellipse 50% 50% at 50% 50%/i, label: "vignette ellipse grammar" },
  { re: /filter\s*:\s*[^;]*blur\(/i, label: "blur filter" },
];
for (const item of forbiddenCss) {
  if (item.re.test(mobileCss)) {
    fail(`mobile CSS has forbidden frame-filler: ${item.label}`);
  }
}
if (/\.world-studio\s+\.media-stack[\s\S]{0,500}object-fit\s*:\s*contain/i.test(mobileCss)) {
  fail("studio media stack must not switch to contain as a crop substitute");
}
if (/box-shadow\s*:\s*[^;]*0\s+0\s+\d+px/i.test(mobileCss) && /halo/i.test(mobileCss)) {
  fail("mobile CSS must not introduce halo language");
}
console.log("PASS: no blur/duplicate-background/vignette/halo/echo/atmosphere/synthetic-fill grammar");

function spawnAssert(rel) {
  const r = spawnSync(process.execPath, [path.join(root, rel)], { encoding: "utf8" });
  if (r.status !== 0) {
    process.stderr.write(r.stdout || "");
    process.stderr.write(r.stderr || "");
    fail(`${rel} must remain intact`);
  }
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  if (!out.includes("PASS:")) fail(`${rel} did not report PASS`);
}

spawnAssert("tools/assert-mobile-header-persistent.mjs");
spawnAssert("tools/assert-mobile-beat-settle.mjs");
console.log("PASS: persistent header and mobile rest-lock source contracts remain intact");

if (index.includes("complete-silhouette") || styles.includes("complete-silhouette")) {
  fail("complete-silhouette must not remain referenced in index.html or styles.css");
}

console.log(
  "PASS: mobile opening wider-frame media (unique 517-frame derivative of the approved recut; materially wider than 498x1080; mobile-only wiring; desktop bytes exact; no alternate clips or frame-fillers; source proof only — not visual consumer verification)"
);
