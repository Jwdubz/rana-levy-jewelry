#!/usr/bin/env node
/**
 * Source assertion: draft-only mobile blush-band opening derivative.
 *
 * The approved 720x1560 mobile-wide film keeps black letterbox bands
 * baked into the pixels. This draft must keep that source intact and
 * add uniquely named MP4/JPG derivatives that preserve the exact
 * 517-frame / 30fps / 17.233333s center edit while replacing only
 * those measured black bands with porcelain-blush paper. Jewelry
 * content is not cropped or zoomed.
 *
 * Usage: node tools/assert-mobile-opening-blush-bands-media.mjs
 *
 * Residue: mobile-opening-blush-bands tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator recoding the mobile opening surround
 * Activation: execute — node tools/assert-mobile-opening-blush-bands-media.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when the blush-band mobile opening contract is retired
 *
 * Companion draft assets:
 *   assets/studio-opening-cluster-bench-engraving-mobile-wide-blush.mp4
 *   assets/studio-opening-cluster-bench-engraving-mobile-wide-blush.jpg
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SOURCE_VIDEO = "assets/studio-opening-cluster-bench-engraving-mobile-wide.mp4";
const SOURCE_POSTER = "assets/studio-opening-cluster-bench-engraving-mobile-wide.jpg";
const BLUSH_VIDEO = "assets/studio-opening-cluster-bench-engraving-mobile-wide-blush.mp4";
const BLUSH_POSTER = "assets/studio-opening-cluster-bench-engraving-mobile-wide-blush.jpg";

const TOTAL_FRAMES = 517;
const EXPECTED_DURATION = TOTAL_FRAMES / 30;
const OUT_W = 720;
const OUT_H = 1560;
const SAMPLE_FRAMES = [0, 112, 247, 447, 481, 516];
const PICTURE_MAD_MAX = 8;
const BAND_LUMA_MIN = 170;
const BAND_STD_MAX = 22;
const BLACK_LUMA_MAX = 18;
const PAPER = { r: 244, g: 227, b: 232 };
const PAPER_YUV = { r: 226, g: 211, b: 216 };
const PAPER_DIST_MAX = 42;

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

function extractRgb(videoPath, frameIndex, outPath) {
  runFfmpeg([
    "-y",
    "-i",
    videoPath,
    "-vf",
    `select=eq(n\\,${frameIndex}),scale=${OUT_W}:${OUT_H}:flags=neighbor,setsar=1`,
    "-vframes",
    "1",
    "-update",
    "1",
    "-s",
    `${OUT_W}x${OUT_H}`,
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

function extractRgbStill(imagePath, outPath) {
  runFfmpeg([
    "-y",
    "-i",
    imagePath,
    "-vf",
    `scale=${OUT_W}:${OUT_H}:flags=neighbor,setsar=1`,
    "-vframes",
    "1",
    "-update",
    "1",
    "-s",
    `${OUT_W}x${OUT_H}`,
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    outPath,
  ]);
}

function detectBlackBand(rgb, width, height) {
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
    rows.push({ mean, std, black: mean < BLACK_LUMA_MAX && std < 10 });
  }
  let y0 = 0;
  while (y0 < height && rows[y0].black) y0++;
  let y1 = height;
  while (y1 > y0 && rows[y1 - 1].black) y1--;
  const bandH = y1 - y0;
  if (bandH < Math.max(8, Math.round(height * 0.18))) {
    fail(`could not detect a letterboxed picture band (interior ${bandH}px of ${height}px)`);
  }
  return { y0, y1, h: bandH, top: y0, bottom: height - y1 };
}

function regionStats(rgb, width, y0, y1) {
  let r = 0;
  let g = 0;
  let b = 0;
  let luma = 0;
  let lumaSq = 0;
  let n = 0;
  let minLuma = 255;
  for (let y = y0; y < y1; y++) {
    const rowOff = y * width * 3;
    for (let x = 0; x < width; x++) {
      const i = rowOff + x * 3;
      r += rgb[i];
      g += rgb[i + 1];
      b += rgb[i + 2];
      const yL = 0.299 * rgb[i] + 0.587 * rgb[i + 1] + 0.114 * rgb[i + 2];
      luma += yL;
      lumaSq += yL * yL;
      if (yL < minLuma) minLuma = yL;
      n++;
    }
  }
  const meanLuma = luma / n;
  return {
    r: r / n,
    g: g / n,
    b: b / n,
    luma: meanLuma,
    std: Math.sqrt(Math.max(0, lumaSq / n - meanLuma * meanLuma)),
    minLuma,
    n,
  };
}

function regionMad(a, b, width, y0, y1) {
  let sum = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    const rowOff = y * width * 3;
    for (let i = 0; i < width * 3; i++) {
      sum += Math.abs(a[rowOff + i] - b[rowOff + i]);
      n++;
    }
  }
  return sum / n;
}

function paperDistance(stats) {
  const a = Math.hypot(stats.r - PAPER.r, stats.g - PAPER.g, stats.b - PAPER.b);
  const c = Math.hypot(stats.r - PAPER_YUV.r, stats.g - PAPER_YUV.g, stats.b - PAPER_YUV.b);
  return Math.min(a, c);
}

function assertBlushBand(label, stats) {
  if (stats.luma < BAND_LUMA_MIN || stats.minLuma < 80) {
    fail(`${label} still looks black (luma ${stats.luma.toFixed(1)}, min ${stats.minLuma.toFixed(1)})`);
  }
  if (stats.std > BAND_STD_MAX) {
    fail(`${label} is not a flat blush paper field (std ${stats.std.toFixed(2)} > ${BAND_STD_MAX})`);
  }
  const dist = paperDistance(stats);
  if (dist > PAPER_DIST_MAX) {
    fail(
      `${label} mean rgb(${stats.r.toFixed(1)},${stats.g.toFixed(1)},${stats.b.toFixed(1)}) is not porcelain blush (dist ${dist.toFixed(1)})`
    );
  }
}

function assertMetadata(rel) {
  const info = probeJson(path.join(root, rel));
  const streams = Array.isArray(info.streams) ? info.streams : [];
  const video = streams.filter((s) => s.codec_type === "video");
  const audio = streams.filter((s) => s.codec_type === "audio");
  if (video.length !== 1) fail(`${rel}: expected one video stream, found ${video.length}`);
  if (audio.length !== 0) fail(`${rel}: expected no audio streams, found ${audio.length}`);
  const v = video[0];
  const frames = Number(v.nb_read_frames || v.nb_frames);
  const duration = Number(info.format && info.format.duration);
  if (v.codec_name !== "h264") fail(`${rel}: codec_name must be h264, got ${v.codec_name}`);
  if (v.pix_fmt !== "yuv420p") fail(`${rel}: pix_fmt must be yuv420p, got ${v.pix_fmt}`);
  if (String(v.r_frame_rate) !== "30/1") {
    fail(`${rel}: r_frame_rate must be 30/1, got ${v.r_frame_rate}`);
  }
  if (!Number.isFinite(frames) || frames !== TOTAL_FRAMES) {
    fail(`${rel}: frame count must be exactly ${TOTAL_FRAMES}, got ${v.nb_read_frames || v.nb_frames}`);
  }
  if (!Number.isFinite(duration) || Math.abs(duration - EXPECTED_DURATION) > 0.02) {
    fail(`${rel}: duration must be ~${EXPECTED_DURATION.toFixed(6)}s, got ${duration}`);
  }
  if (Number(v.width) !== OUT_W || Number(v.height) !== OUT_H) {
    fail(`${rel}: canvas must be exactly ${OUT_W}x${OUT_H}, got ${v.width}x${v.height}`);
  }
  const atoms = moovBeforeMdat(rel);
  if (atoms.moov < 0 || atoms.mdat < 0 || atoms.moov > atoms.mdat) {
    fail(`${rel}: moov must precede mdat for faststart (moov=${atoms.moov} mdat=${atoms.mdat})`);
  }
  console.log(
    `PASS: ${rel} metadata (${frames} frames; ${duration.toFixed(6)}s; ${OUT_W}x${OUT_H}; 30fps; h264/yuv420p; no audio; faststart)`
  );
}

for (const rel of [SOURCE_VIDEO, SOURCE_POSTER, BLUSH_VIDEO, BLUSH_POSTER]) {
  if (!fs.existsSync(path.join(root, rel))) fail(`missing ${rel}`);
}
if (BLUSH_VIDEO === SOURCE_VIDEO || BLUSH_POSTER === SOURCE_POSTER) {
  fail("blush derivatives must be uniquely named, not overwrite the black-band source");
}

const sourceVideoNow = execFileSync("git", ["hash-object", path.join(root, SOURCE_VIDEO)], {
  encoding: "utf8",
}).trim();
const sourcePosterNow = execFileSync("git", ["hash-object", path.join(root, SOURCE_POSTER)], {
  encoding: "utf8",
}).trim();
const sourceVideoHead = execFileSync("git", ["rev-parse", "HEAD:" + SOURCE_VIDEO], {
  cwd: root,
  encoding: "utf8",
}).trim();
const sourcePosterHead = execFileSync("git", ["rev-parse", "HEAD:" + SOURCE_POSTER], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (sourceVideoNow !== sourceVideoHead) {
  fail(`${SOURCE_VIDEO} bytes changed vs HEAD; the black-band source must stay frozen`);
}
if (sourcePosterNow !== sourcePosterHead) {
  fail(`${SOURCE_POSTER} bytes changed vs HEAD; the black-band poster must stay frozen`);
}

const index = read("index.html");
const studioMarkup = (index.match(/id="studioVideo"[\s\S]*?<\/video>/) || [""])[0];
if (!studioMarkup.includes(`data-mobile-src="${BLUSH_VIDEO}"`)) {
  fail(`studioVideo data-mobile-src must be ${BLUSH_VIDEO}`);
}
if (!studioMarkup.includes(`data-mobile-poster="${BLUSH_POSTER}"`)) {
  fail(`studioVideo data-mobile-poster must be ${BLUSH_POSTER}`);
}
if (studioMarkup.includes(`data-mobile-src="${SOURCE_VIDEO}"`)) {
  fail("studioVideo must not keep the black-band mobile film as the live mobile source");
}
const studioStack = (index.match(/id="studioStack"[\s\S]*?<\/div>\s*<\/div>/) || [""])[0];
if (!studioStack.includes(`data-mobile-src="${BLUSH_POSTER}"`)) {
  fail(`studio fallback image data-mobile-src must be ${BLUSH_POSTER}`);
}

assertMetadata(SOURCE_VIDEO);
assertMetadata(BLUSH_VIDEO);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rana-blush-bands-"));
try {
  const source0 = path.join(tmp, "source0.raw");
  extractRgb(path.join(root, SOURCE_VIDEO), 0, source0);
  const sourceRgb = fs.readFileSync(source0);
  if (sourceRgb.length !== OUT_W * OUT_H * 3) {
    fail(`source frame 0 raw size ${sourceRgb.length} is not ${OUT_W}x${OUT_H} rgb24`);
  }
  const band = detectBlackBand(sourceRgb, OUT_W, OUT_H);
  if (band.y0 !== 456 || band.y1 !== 1104 || band.h !== 648) {
    fail(
      `measured source picture band must be rows 456..1103 (got y0=${band.y0} y1=${band.y1} h=${band.h})`
    );
  }
  const sourceTop = regionStats(sourceRgb, OUT_W, 0, band.y0);
  const sourceBottom = regionStats(sourceRgb, OUT_W, band.y1, OUT_H);
  if (sourceTop.luma >= BLACK_LUMA_MAX || sourceBottom.luma >= BLACK_LUMA_MAX) {
    fail("source mobile-wide bands must remain baked black so the blush derivative has a real job");
  }
  console.log(
    `PASS: source ${SOURCE_VIDEO} picture band is ${band.y0}..${band.y1 - 1} (${band.h}px) with black ${band.top}/${band.bottom} letterbox`
  );

  const posterSrc = path.join(tmp, "source-poster.raw");
  extractRgbStill(path.join(root, SOURCE_POSTER), posterSrc);
  const posterSrcRgb = fs.readFileSync(posterSrc);
  const posterBand = detectBlackBand(posterSrcRgb, OUT_W, OUT_H);
  if (posterBand.y0 !== band.y0 || posterBand.y1 !== band.y1) {
    fail(
      `source poster picture band ${posterBand.y0}..${posterBand.y1 - 1} must match the film (${band.y0}..${band.y1 - 1})`
    );
  }

  const blushPosterRaw = path.join(tmp, "blush-poster.raw");
  extractRgbStill(path.join(root, BLUSH_POSTER), blushPosterRaw);
  const blushPoster = fs.readFileSync(blushPosterRaw);
  if (blushPoster.length !== OUT_W * OUT_H * 3) {
    fail(`${BLUSH_POSTER} is not ${OUT_W}x${OUT_H} rgb24`);
  }

  for (const n of SAMPLE_FRAMES) {
    const srcRaw = path.join(tmp, `src_${n}.raw`);
    const blushRaw = path.join(tmp, `blush_${n}.raw`);
    extractRgb(path.join(root, SOURCE_VIDEO), n, srcRaw);
    extractRgb(path.join(root, BLUSH_VIDEO), n, blushRaw);
    const src = fs.readFileSync(srcRaw);
    const blush = fs.readFileSync(blushRaw);
    if (src.length !== blush.length) {
      fail(`frame ${n} raw size mismatch source ${src.length} vs blush ${blush.length}`);
    }
    const srcBand = detectBlackBand(src, OUT_W, OUT_H);
    if (srcBand.y0 !== band.y0 || srcBand.y1 !== band.y1) {
      fail(`source frame ${n} picture band drifted to ${srcBand.y0}..${srcBand.y1 - 1}`);
    }
    const pictureMad = regionMad(src, blush, OUT_W, band.y0, band.y1);
    if (pictureMad > PICTURE_MAD_MAX) {
      fail(
        `${BLUSH_VIDEO} frame ${n} picture band does not preserve jewelry pixels (mad ${pictureMad.toFixed(3)} > ${PICTURE_MAD_MAX})`
      );
    }
    const top = regionStats(blush, OUT_W, 8, band.y0 - 8);
    const bottom = regionStats(blush, OUT_W, band.y1 + 8, OUT_H - 8);
    assertBlushBand(`${BLUSH_VIDEO} frame ${n} top band`, top);
    assertBlushBand(`${BLUSH_VIDEO} frame ${n} bottom band`, bottom);
    const blushBlack = detectBlackBand(blush, OUT_W, OUT_H);
    if (blushBlack.top > 2 || blushBlack.bottom > 2) {
      fail(
        `${BLUSH_VIDEO} frame ${n} still has black letterbox (top ${blushBlack.top} bottom ${blushBlack.bottom})`
      );
    }
    console.log(
      `  frame ${n}: picture mad=${pictureMad.toFixed(3)}; top rgb(${top.r.toFixed(1)},${top.g.toFixed(1)},${top.b.toFixed(1)}); bottom rgb(${bottom.r.toFixed(1)},${bottom.g.toFixed(1)},${bottom.b.toFixed(1)})`
    );
  }

  const blush0 = fs.readFileSync(path.join(tmp, "blush_0.raw"));
  const posterPictureMad = regionMad(blush0, blushPoster, OUT_W, band.y0, band.y1);
  if (posterPictureMad > 14) {
    fail(`${BLUSH_POSTER} picture band does not match blush film frame 0 (mad ${posterPictureMad.toFixed(3)} > 14)`);
  }
  assertBlushBand(`${BLUSH_POSTER} top band`, regionStats(blushPoster, OUT_W, 8, band.y0 - 8));
  assertBlushBand(`${BLUSH_POSTER} bottom band`, regionStats(blushPoster, OUT_W, band.y1 + 8, OUT_H - 8));
  const posterBlack = detectBlackBand(blushPoster, OUT_W, OUT_H);
  if (posterBlack.top > 2 || posterBlack.bottom > 2) {
    fail(`${BLUSH_POSTER} still has black letterbox`);
  }
  console.log(`PASS: ${BLUSH_POSTER} picture≈film0 mad=${posterPictureMad.toFixed(3)}; bands are blush paper`);
} finally {
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // tmp cleanup is best-effort; assertion results already stand
  }
}

console.log(
  "PASS: mobile opening blush-band media (draft-only 517-frame 720x1560 H.264 derivative; measured 456/648/456 bands; jewelry picture parity; no baked black letterbox; source mobile-wide frozen; live markup wired to blush files)"
);
