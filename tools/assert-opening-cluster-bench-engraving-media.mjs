#!/usr/bin/env node
/**
 * Source assertion: opening Cluster→product→Bench→Engraving media metadata + order tripwire.
 *
 * Proves both opening films exist with their contract shapes:
 * - desktop: 517 frames, ~17.233s, 2160x1080, 30 fps, H.264/yuv420p, no audio
 * - portrait: 517 frames, ~17.233s, 498x1080, 30 fps, H.264/yuv420p, no audio
 * and that decoded boundary frames match the intended source partition order closely
 * enough to reject bench-first, early-process, banner-start, and older accidental starts.
 * Portrait source frames are normalized through the H.264 coded-frame display
 * crop (498x1080 at x=830,y=4 inside 2160x1088) before comparison.
 *
 * Intended order (source frames, once each):
 *   [405..516] + [36..170] + [205..404] + [171..204] + [0..35]
 * so new frame 0 ≈ source cluster 405, product runs next, bench is penultimate,
 * engraving is final, then loop returns to the cluster.
 *
 * Does not claim visual consumer verification of motion or composition.
 *
 * Usage: node tools/assert-opening-cluster-bench-engraving-media.mjs
 *
 * Residue: opening-cluster-bench-engraving-media tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator retiming or re-encoding the opening recut
 * Activation: execute — node tools/assert-opening-cluster-bench-engraving-media.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when the cluster-bench-engraving opening asset contract is retired
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Natural shot boundaries verified against studio-banner scene cuts + owner still.
const CLUSTER_START = 405;
const CLUSTER_END = 516; // inclusive
const PRODUCT1_START = 36;
const PRODUCT1_END = 170; // inclusive
const PRODUCT2_START = 205;
const PRODUCT2_END = 404; // inclusive
const BENCH_START = 171;
const BENCH_END = 204; // inclusive
const ENGRAVING_START = 0;
const ENGRAVING_END = 35; // inclusive

const CLUSTER_LEN = CLUSTER_END - CLUSTER_START + 1; // 112
const PRODUCT1_LEN = PRODUCT1_END - PRODUCT1_START + 1; // 135
const PRODUCT2_LEN = PRODUCT2_END - PRODUCT2_START + 1; // 200
const BENCH_LEN = BENCH_END - BENCH_START + 1; // 34
const ENGRAVING_LEN = ENGRAVING_END - ENGRAVING_START + 1; // 36

const TOTAL_FRAMES =
  CLUSTER_LEN + PRODUCT1_LEN + PRODUCT2_LEN + BENCH_LEN + ENGRAVING_LEN; // 517
const EXPECTED_DURATION = TOTAL_FRAMES / 30;

// New-film frame indices at partition boundaries (0-based).
const NEW_CLUSTER_START = 0;
const NEW_CLUSTER_END = CLUSTER_LEN - 1; // 111
const NEW_PRODUCT1_START = CLUSTER_LEN; // 112
const NEW_PRODUCT1_END = CLUSTER_LEN + PRODUCT1_LEN - 1; // 246
const NEW_PRODUCT2_START = CLUSTER_LEN + PRODUCT1_LEN; // 247
const NEW_PRODUCT2_END = CLUSTER_LEN + PRODUCT1_LEN + PRODUCT2_LEN - 1; // 446
const NEW_BENCH_START = CLUSTER_LEN + PRODUCT1_LEN + PRODUCT2_LEN; // 447
const NEW_BENCH_END = NEW_BENCH_START + BENCH_LEN - 1; // 480
const NEW_ENGRAVING_START = NEW_BENCH_END + 1; // 481
const NEW_ENGRAVING_END = TOTAL_FRAMES - 1; // 516

const contracts = [
  {
    rel: "assets/studio-opening-cluster-bench-engraving.mp4",
    sourceRel: "assets/studio-banner.mp4",
    width: 2160,
    height: 1080,
    label: "desktop",
  },
  {
    rel: "assets/studio-opening-cluster-bench-engraving-portrait.mp4",
    sourceRel: "assets/studio-banner-portrait.mp4",
    width: 498,
    height: 1080,
    label: "portrait",
    // studio-banner-portrait stores a 498x1080 display window inside a 2160x1088
    // coded frame (H.264 frame_crop left=830 right=832 top=4 bottom=4). Naive
    // decode/scale compares unequal geometry across ffmpeg crop modes.
    sourceCodedCrop: { w: 498, h: 1080, x: 830, y: 4 },
  },
];

const posters = [
  "assets/studio-opening-cluster-bench-engraving.jpg",
  "assets/studio-opening-cluster-bench-engraving-portrait.jpg",
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

  // Normalize to the contract display geometry before comparison. Some sources
  // (notably studio-banner-portrait) carry a wider coded frame with an H.264
  // display crop; decoding without an explicit crop/scale/setsar path makes
  // order MAD depend on ffmpeg crop-application mode rather than content.
  const vfParts = [`select=eq(n\\,${frameIndex})`];
  const args = ["-y"];
  if (codedCrop) {
    args.push("-apply_cropping", "0");
    vfParts.push(
      `crop=${codedCrop.w}:${codedCrop.h}:${codedCrop.x}:${codedCrop.y}`,
      "setsar=1"
    );
  }
  // Candidates are already display-sized; force exact contract size + SAR so a
  // macroblock-padded coded frame still compares at the same geometry.
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
  if (!fs.existsSync(assetPath)) fail(`missing ${contract.rel}`);

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
  // 517/30 ≈ 17.2333…; allow tiny container rounding only.
  if (Math.abs(duration - EXPECTED_DURATION) > 0.02) {
    fail(
      `${contract.rel}: duration must be ~${EXPECTED_DURATION.toFixed(6)}s (${TOTAL_FRAMES}/30), got ${duration}`
    );
  }

  console.log(
    `PASS: opening cluster-bench-engraving ${contract.label} metadata (${contract.rel}; ${TOTAL_FRAMES} frames; ~${EXPECTED_DURATION.toFixed(6)}s; ${contract.width}x${contract.height}; 30fps; h264/yuv420p; no audio)`
  );
}

function assertOrder(contract) {
  const assetPath = path.join(root, contract.rel);
  const sourcePath = path.join(root, contract.sourceRel);
  if (!fs.existsSync(sourcePath)) fail(`missing source ${contract.sourceRel}`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rana-open-order-"));
  try {
    const pairs = [
      // Partition starts/ends prove entire order cluster → product → product → bench → engraving
      {
        label: "new0≈srcCluster405",
        newFrame: NEW_CLUSTER_START,
        srcFrame: CLUSTER_START,
        maxMad: 8,
        mustMatch: true,
      },
      {
        label: "newClusterEnd≈srcCluster516",
        newFrame: NEW_CLUSTER_END,
        srcFrame: CLUSTER_END,
        maxMad: 8,
        mustMatch: true,
      },
      {
        label: "newProduct1Start≈src36",
        newFrame: NEW_PRODUCT1_START,
        srcFrame: PRODUCT1_START,
        maxMad: 8,
        mustMatch: true,
      },
      {
        label: "newProduct1End≈src170",
        newFrame: NEW_PRODUCT1_END,
        srcFrame: PRODUCT1_END,
        maxMad: 8,
        mustMatch: true,
      },
      {
        label: "newProduct2Start≈src205",
        newFrame: NEW_PRODUCT2_START,
        srcFrame: PRODUCT2_START,
        maxMad: 8,
        mustMatch: true,
      },
      {
        label: "newProduct2End≈src404",
        newFrame: NEW_PRODUCT2_END,
        srcFrame: PRODUCT2_END,
        maxMad: 8,
        mustMatch: true,
      },
      {
        label: "newBenchStart≈src171",
        newFrame: NEW_BENCH_START,
        srcFrame: BENCH_START,
        maxMad: 8,
        mustMatch: true,
      },
      {
        label: "newBenchEnd≈src204",
        newFrame: NEW_BENCH_END,
        srcFrame: BENCH_END,
        maxMad: 8,
        mustMatch: true,
      },
      {
        label: "newEngravingStart≈src0",
        newFrame: NEW_ENGRAVING_START,
        srcFrame: ENGRAVING_START,
        maxMad: 8,
        mustMatch: true,
      },
      {
        label: "newEngravingEnd≈src35",
        newFrame: NEW_ENGRAVING_END,
        srcFrame: ENGRAVING_END,
        maxMad: 8,
        mustMatch: true,
      },
      // Loop return: last frame is engraving end; first is cluster (implicit via new0 match).
      // Reject bench-first, early process, engraving/banner starts, older accidental starts.
      {
        label: "new0≠srcBench171",
        newFrame: 0,
        srcFrame: BENCH_START,
        minMad: 20,
        mustMatch: false,
      },
      {
        label: "new0≠srcEngraving0",
        newFrame: 0,
        srcFrame: ENGRAVING_START,
        minMad: 20,
        mustMatch: false,
      },
      {
        label: "new0≠srcProduct36",
        newFrame: 0,
        srcFrame: PRODUCT1_START,
        minMad: 20,
        mustMatch: false,
      },
      // Immediately after cluster must be product (36), not bench/process.
      {
        label: "new112≠srcBench171",
        newFrame: NEW_PRODUCT1_START,
        srcFrame: BENCH_START,
        minMad: 20,
        mustMatch: false,
      },
      {
        label: "new112≠srcEngraving0",
        newFrame: NEW_PRODUCT1_START,
        srcFrame: ENGRAVING_START,
        minMad: 20,
        mustMatch: false,
      },
    ];

    for (const p of pairs) {
      const newRaw = path.join(tmp, `new_${p.newFrame}_${p.label}.raw`);
      const srcRaw = path.join(tmp, `src_${p.srcFrame}_${p.label}.raw`);
      // Candidate is authored at contract display size; source may need an
      // explicit coded-frame crop (portrait banner) before the same scale path.
      extractRawFrame(assetPath, p.newFrame, newRaw, contract.width, contract.height, null);
      extractRawFrame(
        sourcePath,
        p.srcFrame,
        srcRaw,
        contract.width,
        contract.height,
        contract.sourceCodedCrop || null
      );
      const mad = meanAbsDiff(newRaw, srcRaw);
      if (p.mustMatch) {
        if (mad > p.maxMad) {
          fail(
            `${contract.rel} order ${p.label}: mean abs diff ${mad.toFixed(3)} exceeds ${p.maxMad} (frame alignment / wrong recut)`
          );
        }
      } else if (mad < p.minMad) {
        fail(
          `${contract.rel} order ${p.label}: mean abs diff ${mad.toFixed(3)} below ${p.minMad} (looks like superseded rotation)`
        );
      }
      console.log(
        `  order ${contract.label} ${p.label}: mad=${mad.toFixed(3)} (${p.mustMatch ? "match" : "reject-old"})`
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log(
    `PASS: opening cluster-bench-engraving ${contract.label} order (Cluster ${CLUSTER_START}-${CLUSTER_END} then product ${PRODUCT1_START}-${PRODUCT1_END}+${PRODUCT2_START}-${PRODUCT2_END} then Bench ${BENCH_START}-${BENCH_END} then Engraving ${ENGRAVING_START}-${ENGRAVING_END}; rejects bench-first/early-process/banner starts)`
  );
}

if (TOTAL_FRAMES !== 517) {
  fail(`internal frame arithmetic must total 517, got ${TOTAL_FRAMES}`);
}

for (const rel of posters) {
  if (!fs.existsSync(path.join(root, rel))) fail(`missing poster ${rel}`);
}

for (const contract of contracts) {
  assertMetadata(contract);
  assertOrder(contract);
}

console.log(
  "PASS: opening cluster-bench-engraving media (517 frames both derivatives; full duration; boundary order Cluster→product→Bench→Engraving; posters present; source proof only — not visual consumer verification)"
);
