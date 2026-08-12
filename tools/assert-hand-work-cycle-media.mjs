#!/usr/bin/env node
/**
 * Source assertion: derived hand work-cycle media metadata + frame-order tripwire.
 *
 * Proves both Lap→Engraving→Signets→Ornate cycle assets exist with contract shapes:
 * - desktop: 134 frames, ~4.466667s, 2160x1080, 30 fps, H.264/yuv420p, no audio
 * - portrait: 134 frames, ~4.466667s, 498x1080, 30 fps, H.264/yuv420p, no audio
 * and that decoded boundary frames match the intended source partition order closely
 * enough to reject wrong shot order or swapped inserts after H.264 re-encode.
 * Portrait source frames are normalized through the H.264 coded-frame display
 * crop (498x1080 at x=830,y=4 inside 2160x1088) before comparison.
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
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

const contracts = [
  {
    rel: "assets/studio-hand-work-cycle.mp4",
    sourceRel: "assets/studio-banner.mp4",
    width: 2160,
    height: 1080,
    label: "desktop",
  },
  {
    rel: "assets/studio-hand-work-cycle-portrait.mp4",
    sourceRel: "assets/studio-banner-portrait.mp4",
    width: 498,
    height: 1080,
    label: "portrait",
    // studio-banner-portrait stores a 498x1080 display window inside a 2160x1088
    // coded frame (H.264 frame_crop left=830 right=832 top=4 bottom=4).
    sourceCodedCrop: { w: 498, h: 1080, x: 830, y: 4 },
  },
];

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

for (const contract of contracts) {
  assertMetadata(contract);
  assertOrder(contract);
}
assertPlaybackWindowCoversAsset();
assertResponsiveWiringIntact();

console.log(
  "PASS: hand work-cycle media (134 frames both derivatives; full duration; boundary order Lap→Engraving→Signets→Ornate; playback window + wiring intact; source proof only — not visual consumer verification)"
);
