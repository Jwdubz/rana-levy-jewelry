#!/usr/bin/env node
/**
 * Source assertion: derived hand work-cycle media metadata + frame-order tripwire.
 *
 * Proves both Lap→Engraving→Signets→Ornate cycle assets exist with contract shapes:
 * - desktop: 134 frames, ~4.466667s, 2160x1080, 30 fps, H.264/yuv420p, no audio
 * - portrait: 134 frames, ~4.466667s, 720x1560, 30 fps, H.264/yuv420p, no audio
 * and that decoded boundary frames match the intended source partition order closely
 * enough to reject wrong shot order or swapped inserts after H.264 re-encode.
 * The mobile derivative letterboxes a 1200x1080 source window into 720x1560:
 *   frames 0–33 (Lap): x=360; 34–67 (Engraving): x=0;
 *   68–100 (Signets): x=0; 101–133 (Ornate): x=360.
 *
 * Intended order (source frames, inclusive ranges):
 *   [171..204] + [137..170] + [306..338] + [339..371]  → 134 frames
 *
 * Does not claim visual consumer verification of motion or composition.
 *
 * Usage: node tools/assert-hand-work-cycle-media.mjs
 *
 * Residue: hand-work-cycle-media tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator retiming or re-encoding the hand bench cycle
 * Activation: execute — node tools/assert-hand-work-cycle-media.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when the hand work-cycle asset contract is retired or superseded
 *
 * Companion maintained assets:
 *   assets/studio-hand-work-cycle-portrait.mp4
 *   assets/studio-poster-portrait.jpg
 * Future consumer: mobile homepage Hand via selectResponsiveMedia()
 * Activation: auto-load — index.html data-mobile-src / data-mobile-poster
 * Behavioral check: execute — node tools/assert-hand-work-cycle-media.mjs
 * Retirement: when this mobile hand-cycle derivative is retired
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "8a8832c26eb55fec664c6cd884ce8eccd23c82cd";

// Inclusive source ranges → derived order.
const LAP_START = 171;
const LAP_END = 204;
const ENGRAVING_START = 137;
const ENGRAVING_END = 170;
const SIGNETS_START = 306;
const SIGNETS_END = 338;
const ORNATE_START = 339;
const ORNATE_END = 371;

const LAP_LEN = LAP_END - LAP_START + 1; // 34
const ENGRAVING_LEN = ENGRAVING_END - ENGRAVING_START + 1; // 34
const SIGNETS_LEN = SIGNETS_END - SIGNETS_START + 1; // 33
const ORNATE_LEN = ORNATE_END - ORNATE_START + 1; // 33

const TOTAL_FRAMES = LAP_LEN + ENGRAVING_LEN + SIGNETS_LEN + ORNATE_LEN; // 134
const EXPECTED_DURATION = TOTAL_FRAMES / 30; // 4.4666…

// Derived frame indices at partition boundaries (0-based).
const NEW_LAP_START = 0;
const NEW_LAP_END = LAP_LEN - 1; // 33
const NEW_ENGRAVING_START = LAP_LEN; // 34
const NEW_ENGRAVING_END = LAP_LEN + ENGRAVING_LEN - 1; // 67
const NEW_SIGNETS_START = LAP_LEN + ENGRAVING_LEN; // 68
const NEW_SIGNETS_END = NEW_SIGNETS_START + SIGNETS_LEN - 1; // 100
const NEW_ORNATE_START = NEW_SIGNETS_END + 1; // 101
const NEW_ORNATE_END = TOTAL_FRAMES - 1; // 133

const desktopContract = {
  rel: "assets/studio-hand-work-cycle.mp4",
  sourceRel: "assets/studio-banner.mp4",
  width: 2160,
  height: 1080,
  label: "desktop",
};

const portraitContract = {
  rel: "assets/studio-hand-work-cycle-portrait.mp4",
  sourceRel: "assets/studio-hand-work-cycle.mp4",
  width: 720,
  height: 1560,
  label: "portrait",
};

const PORTRAIT_OUT_W = 720;
const PORTRAIT_OUT_H = 1560;
const PORTRAIT_BAND_H = 648;
const PORTRAIT_BAND_Y = 456;
const PORTRAIT_SOURCE_W = 1200;
const PORTRAIT_SOURCE_H = 1080;
const DESK_W = 2160;
const DESK_H = 1080;
const MATCH_W = 80;
const MATCH_H = 72;

function portraitWindowX(n) {
  if (n <= NEW_LAP_END || n >= NEW_ORNATE_START) return 360;
  return 0;
}

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
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

function extractRawFrame(videoPath, frameIndex, outPath, width, height, codedCrop = null) {
  // Downscale for stable, fast comparison across re-encodes.
  const targetW = Math.min(160, width);
  const targetH = Math.round((height / width) * targetW);
  // force even dims for raw rgb24 convenience
  const w = targetW % 2 === 0 ? targetW : targetW - 1;
  const h = targetH % 2 === 0 ? targetH : targetH - 1;

  const vfParts = [`select=eq(n\\,${frameIndex})`];
  const args = ["-y"];
  if (codedCrop) {
    args.push("-apply_cropping", "0");
    vfParts.push(
      `crop=${codedCrop.w}:${codedCrop.h}:${codedCrop.x}:${codedCrop.y}`,
      "setsar=1"
    );
  }
  vfParts.push(`scale=${width}:${height}`, "setsar=1", `scale=${w}:${h}`);
  args.push(
    "-i",
    videoPath,
    "-vf",
    vfParts.join(","),
    "-vframes",
    "1",
    "-update",
    "1",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    outPath
  );

  const r = spawnSync(ffmpeg, args, { encoding: "utf8" });
  if (r.status !== 0 || !fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
    process.stderr.write(r.stderr || "");
    fail(`failed to extract frame ${frameIndex} from ${videoPath}`);
  }
  return { w, h };
}

function meanAbsDiff(aPath, bPath) {
  const A = fs.readFileSync(aPath);
  const B = fs.readFileSync(bPath);
  if (A.length !== B.length) {
    fail(`raw frame size mismatch ${aPath} (${A.length}) vs ${bPath} (${B.length})`);
  }
  let sum = 0;
  for (let i = 0; i < A.length; i++) sum += Math.abs(A[i] - B[i]);
  return sum / A.length;
}

function assertMetadata(contract) {
  const assetPath = path.join(root, contract.rel);
  if (!fs.existsSync(assetPath)) {
    fail(`missing ${contract.rel}`);
  }

  const info = probeJson(assetPath);
  const streams = Array.isArray(info.streams) ? info.streams : [];
  const video = streams.filter((s) => s.codec_type === "video");
  const audio = streams.filter((s) => s.codec_type === "audio");

  if (video.length !== 1) {
    fail(`${contract.rel}: expected exactly one video stream, found ${video.length}`);
  }
  if (audio.length !== 0) {
    fail(`${contract.rel}: expected no audio streams, found ${audio.length}`);
  }

  const v = video[0];
  const framesRaw = v.nb_read_frames || v.nb_frames;
  const frames = Number(framesRaw);
  const duration = Number(info.format && info.format.duration);
  const rate = String(v.r_frame_rate || "");

  if (v.codec_name !== "h264") {
    fail(`${contract.rel}: codec_name must be h264, got ${v.codec_name}`);
  }
  if (v.pix_fmt !== "yuv420p") {
    fail(`${contract.rel}: pix_fmt must be yuv420p, got ${v.pix_fmt}`);
  }
  if (Number(v.width) !== contract.width) {
    fail(`${contract.rel}: width must be ${contract.width}, got ${v.width}`);
  }
  if (Number(v.height) !== contract.height) {
    fail(`${contract.rel}: height must be ${contract.height}, got ${v.height}`);
  }
  if (rate !== "30/1") {
    fail(`${contract.rel}: r_frame_rate must be 30/1, got ${rate}`);
  }
  if (!Number.isFinite(frames) || frames !== TOTAL_FRAMES) {
    fail(
      `${contract.rel}: frame count must be exactly ${TOTAL_FRAMES}, got ${framesRaw}`
    );
  }
  if (!Number.isFinite(duration)) {
    fail(
      `${contract.rel}: duration must be numeric, got ${info.format && info.format.duration}`
    );
  }
  // 134/30 = 4.4666…; allow tiny container rounding only.
  if (Math.abs(duration - EXPECTED_DURATION) > 0.0005) {
    fail(
      `${contract.rel}: duration must be ~${EXPECTED_DURATION.toFixed(6)}s (${TOTAL_FRAMES}/30), got ${duration}`
    );
  }

  console.log(
    `PASS: hand work-cycle ${contract.label} media (${contract.rel}; ${TOTAL_FRAMES} frames; ~${EXPECTED_DURATION.toFixed(6)}s; ${contract.width}x${contract.height}; 30fps; h264/yuv420p; no audio)`
  );
}

function assertOrder(contract) {
  const assetPath = path.join(root, contract.rel);
  const sourcePath = path.join(root, contract.sourceRel);
  if (!fs.existsSync(sourcePath)) fail(`missing source ${contract.sourceRel}`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rana-hand-order-"));
  try {
    const pairs = [
      {
        label: "new0≈srcLap171",
        newFrame: NEW_LAP_START,
        srcFrame: LAP_START,
        maxMad: 8,
        mustMatch: true,
      },
      {
        label: "new33≈srcLap204",
        newFrame: NEW_LAP_END,
        srcFrame: LAP_END,
        maxMad: 8,
        mustMatch: true,
      },
      {
        label: "new34≈srcEngraving137",
        newFrame: NEW_ENGRAVING_START,
        srcFrame: ENGRAVING_START,
        maxMad: 8,
        mustMatch: true,
      },
      {
        label: "new67≈srcEngraving170",
        newFrame: NEW_ENGRAVING_END,
        srcFrame: ENGRAVING_END,
        maxMad: 8,
        mustMatch: true,
      },
      {
        label: "new68≈srcSignets306",
        newFrame: NEW_SIGNETS_START,
        srcFrame: SIGNETS_START,
        maxMad: 8,
        mustMatch: true,
      },
      {
        label: "new100≈srcSignets338",
        newFrame: NEW_SIGNETS_END,
        srcFrame: SIGNETS_END,
        maxMad: 8,
        mustMatch: true,
      },
      {
        label: "new101≈srcOrnate339",
        newFrame: NEW_ORNATE_START,
        srcFrame: ORNATE_START,
        maxMad: 8,
        mustMatch: true,
      },
      {
        label: "new133≈srcOrnate371",
        newFrame: NEW_ORNATE_END,
        srcFrame: ORNATE_END,
        maxMad: 8,
        mustMatch: true,
      },
      // Reject swapped / truncated prior 68-frame Lap→Engraving-only cycle ends.
      {
        label: "new68≠srcEngraving137",
        newFrame: NEW_SIGNETS_START,
        srcFrame: ENGRAVING_START,
        minMad: 20,
        mustMatch: false,
      },
      {
        label: "new0≠srcSignets306",
        newFrame: 0,
        srcFrame: SIGNETS_START,
        minMad: 20,
        mustMatch: false,
      },
      {
        label: "new133≠srcLap204",
        newFrame: NEW_ORNATE_END,
        srcFrame: LAP_END,
        minMad: 20,
        mustMatch: false,
      },
    ];

    for (const pair of pairs) {
      const newPath = path.join(tmp, `new-${pair.newFrame}.rgb`);
      const srcPath = path.join(tmp, `src-${pair.srcFrame}.rgb`);
      extractRawFrame(
        assetPath,
        pair.newFrame,
        newPath,
        contract.width,
        contract.height,
        null
      );
      extractRawFrame(
        sourcePath,
        pair.srcFrame,
        srcPath,
        contract.width,
        contract.height,
        contract.sourceCodedCrop || null
      );
      const mad = meanAbsDiff(newPath, srcPath);
      if (pair.mustMatch) {
        if (!(mad <= pair.maxMad)) {
          fail(
            `${contract.rel} order ${pair.label}: MAD ${mad.toFixed(3)} exceeds max ${pair.maxMad}`
          );
        }
        console.log(
          `PASS: ${contract.label} order ${pair.label} (MAD ${mad.toFixed(3)} ≤ ${pair.maxMad})`
        );
      } else {
        if (!(mad >= pair.minMad)) {
          fail(
            `${contract.rel} order ${pair.label}: MAD ${mad.toFixed(3)} below min ${pair.minMad} (too similar)`
          );
        }
        console.log(
          `PASS: ${contract.label} order ${pair.label} (MAD ${mad.toFixed(3)} ≥ ${pair.minMad})`
        );
      }
    }
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
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

function assertDesktopBytesFrozen() {
  const rel = desktopContract.rel;
  const base = execFileSync("git", ["rev-parse", BASE + ":" + rel], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const now = execFileSync("git", ["hash-object", path.join(root, rel)], {
    encoding: "utf8",
  }).trim();
  if (now !== base) {
    fail(`${rel} desktop bytes changed vs base ${BASE} (${base} -> ${now})`);
  }
  console.log(`PASS: desktop hand-cycle bytes unchanged (${rel} ${base})`);
}

function assertPortraitWindows() {
  const assetPath = path.join(root, portraitContract.rel);
  const deskPath = path.join(root, portraitContract.sourceRel);
  if (!fs.existsSync(deskPath)) fail(`missing source ${portraitContract.sourceRel}`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rana-hand-wide-"));
  try {
    const samples = [
      { n: NEW_LAP_START, label: "lap-start" },
      { n: NEW_LAP_END, label: "lap-end" },
      { n: NEW_ENGRAVING_START, label: "engraving-start" },
      { n: NEW_ENGRAVING_END, label: "engraving-end" },
      { n: NEW_SIGNETS_START, label: "signets-start" },
      { n: NEW_SIGNETS_END, label: "signets-end" },
      { n: NEW_ORNATE_START, label: "ornate-start" },
      { n: NEW_ORNATE_END, label: "ornate-end" },
    ];
    for (const sample of samples) {
      const nativeRaw = path.join(tmp, `native_${sample.n}.raw`);
      extractRgb(assetPath, sample.n, nativeRaw, 4, PORTRAIT_OUT_H);
      const band = detectContentBand(fs.readFileSync(nativeRaw), 4, PORTRAIT_OUT_H);
      if (Math.abs(band.h - PORTRAIT_BAND_H) > 8) {
        fail(
          `${portraitContract.rel} ${sample.label} content band ${band.h}px is not the 720x${PORTRAIT_BAND_H} letterbox (y0=${band.y0})`
        );
      }
      if (Math.abs(band.y0 - PORTRAIT_BAND_Y) > 8) {
        fail(
          `${portraitContract.rel} ${sample.label} content band y0=${band.y0} is not centered at ${PORTRAIT_BAND_Y}`
        );
      }
      const inferredSourceW = DESK_H * (PORTRAIT_OUT_W / band.h);
      if (Math.abs(inferredSourceW - PORTRAIT_SOURCE_W) > 16) {
        fail(
          `${portraitContract.rel} ${sample.label} inferred source width ${inferredSourceW.toFixed(1)}px is not ${PORTRAIT_SOURCE_W}`
        );
      }
      const expectX = portraitWindowX(sample.n);
      const mobileRaw = path.join(tmp, `mob_${sample.n}.raw`);
      const deskRaw = path.join(tmp, `desk_${sample.n}.raw`);
      extractRgb(
        assetPath,
        sample.n,
        mobileRaw,
        MATCH_W,
        MATCH_H,
        `crop=${PORTRAIT_OUT_W}:${PORTRAIT_BAND_H}:0:${PORTRAIT_BAND_Y}`
      );
      extractRgb(
        deskPath,
        sample.n,
        deskRaw,
        MATCH_W,
        MATCH_H,
        `crop=${PORTRAIT_SOURCE_W}:${PORTRAIT_SOURCE_H}:${expectX}:0`
      );
      const mad = meanAbsDiffBuf(fs.readFileSync(mobileRaw), fs.readFileSync(deskRaw));
      if (mad > 10) {
        fail(
          `${portraitContract.rel} ${sample.label} frame ${sample.n} does not match desktop 1200x1080 x=${expectX} (mad ${mad.toFixed(3)} > 10)`
        );
      }
      console.log(
        `  portrait ${sample.label} frame ${sample.n}: mad=${mad.toFixed(3)} band=${band.h}px y0=${band.y0} x=${expectX}`
      );
    }

    const distinctPairs = [
      [NEW_LAP_END, NEW_ENGRAVING_START, "Lap→Engraving"],
      [NEW_ENGRAVING_END, NEW_SIGNETS_START, "Engraving→Signets"],
      [NEW_SIGNETS_END, NEW_ORNATE_START, "Signets→Ornate"],
    ];
    for (const [a, b, label] of distinctPairs) {
      const aRaw = path.join(tmp, `native_${a}.raw`);
      const bRaw = path.join(tmp, `native_${b}.raw`);
      const mad = meanAbsDiffBuf(fs.readFileSync(aRaw), fs.readFileSync(bRaw));
      if (mad < 12) {
        fail(`boundary ${label} looks like the same picture (mad ${mad.toFixed(3)} < 12)`);
      }
      console.log(`  boundary ${label}: mad=${mad.toFixed(3)}`);
    }

    const posterRel = "assets/studio-poster-portrait.jpg";
    if (!fs.existsSync(path.join(root, posterRel))) fail(`missing ${posterRel}`);
    const posterRaw = path.join(tmp, "poster.raw");
    const film0Raw = path.join(tmp, "film0.raw");
    runFfmpeg([
      "-y",
      "-i",
      path.join(root, posterRel),
      "-vf",
      "scale=72:156:flags=fast_bilinear,setsar=1",
      "-vframes",
      "1",
      "-update",
      "1",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      posterRaw,
    ]);
    extractRgb(assetPath, 0, film0Raw, 72, 156);
    const posterMad = meanAbsDiffBuf(fs.readFileSync(film0Raw), fs.readFileSync(posterRaw));
    if (posterMad > 14) {
      fail(`studio-poster-portrait does not match film frame 0 (mad ${posterMad.toFixed(3)} > 14)`);
    }
    console.log(`PASS: hand poster≈film0 mad=${posterMad.toFixed(3)}`);
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
  console.log(
    "PASS: portrait hand-cycle is 720x1560 letterboxed 1200x1080 (Lap/Ornate x=360; Engraving/Signets x=0) with Lap→Engraving→Signets→Ornate order"
  );
}

function assertPlaybackWindowCoversAsset() {
  const siteJs = fs
    .readFileSync(path.join(root, "site.js"), "utf8")
    .replace(/\r\n?/g, "\n");
  const m = siteJs.match(
    /const\s+BENCH_WINDOWS\s*=\s*\{[\s\S]*?hand\s*:\s*(\[[^\]]+\])/
  );
  if (!m) fail("BENCH_WINDOWS.hand declaration missing from site.js");
  const normalized = m[1].replace(/\s+/g, "");
  if (normalized !== "[0,4.466667]") {
    fail(
      `BENCH_WINDOWS.hand must be exactly [0, 4.466667] to cover full ${TOTAL_FRAMES}-frame cycle, got ${m[1]}`
    );
  }
  console.log(
    "PASS: Hand playback window covers complete new asset duration ([0, 4.466667])"
  );
}

function assertResponsiveWiringIntact() {
  const index = fs
    .readFileSync(path.join(root, "index.html"), "utf8")
    .replace(/\r\n?/g, "\n");
  const handVideoBlock = index.match(/id="handVideo"[\s\S]*?<\/video>/);
  if (!handVideoBlock) fail("handVideo element must be present");
  const markup = handVideoBlock[0];
  if (!/data-src="assets\/studio-hand-work-cycle\.mp4"/.test(markup)) {
    fail('handVideo must use data-src="assets/studio-hand-work-cycle.mp4"');
  }
  if (!/data-desktop-src="assets\/studio-hand-work-cycle\.mp4"/.test(markup)) {
    fail('handVideo must declare data-desktop-src="assets/studio-hand-work-cycle.mp4"');
  }
  if (
    !/data-mobile-src="assets\/studio-hand-work-cycle-portrait\.mp4"/.test(markup)
  ) {
    fail(
      'handVideo must declare data-mobile-src="assets/studio-hand-work-cycle-portrait.mp4"'
    );
  }
  if ((index.match(/id="handVideo"/g) || []).length !== 1) {
    fail("exactly one handVideo decoder element must exist");
  }
  console.log(
    "PASS: responsive handVideo source wiring and one-decoder contract intact"
  );
}

assertDesktopBytesFrozen();
assertMetadata(desktopContract);
assertOrder(desktopContract);
assertMetadata(portraitContract);
assertPortraitWindows();
assertPlaybackWindowCoversAsset();
assertResponsiveWiringIntact();

console.log(
  "PASS: hand work-cycle media (134 frames both derivatives; desktop 2160x1080 bytes frozen; portrait 720x1560 letterboxed 1200px windows; boundary order Lap→Engraving→Signets→Ornate; playback window + wiring intact; source proof only — not visual consumer verification)"
);
