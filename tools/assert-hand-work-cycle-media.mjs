#!/usr/bin/env node
/**
 * Source assertion: derived hand work-cycle media metadata.
 *
 * Proves both Lap→Engraving cycle assets exist with their contract shapes:
 * - desktop: 68 frames, ~2.266667s, 2160x1080, 30 fps, H.264/yuv420p, no audio
 * - portrait: 68 frames, ~2.266667s, 498x1080, 30 fps, H.264/yuv420p, no audio
 * Does not claim visual edit order or composition — that is an independent rendered check.
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
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const contracts = [
  {
    rel: "assets/studio-hand-work-cycle.mp4",
    width: 2160,
    height: 1080,
    label: "desktop",
  },
  {
    rel: "assets/studio-hand-work-cycle-portrait.mp4",
    width: 498,
    height: 1080,
    label: "portrait",
  },
];

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function findFfprobe() {
  const direct = spawnSync("ffprobe", ["-version"], { encoding: "utf8" });
  if (direct.status === 0) return "ffprobe";
  const home = process.env.HOME || "";
  const fallback = path.join(home, ".local", "bin", "ffprobe");
  if (home && fs.existsSync(fallback)) return fallback;
  fail("ffprobe not available on PATH or ~/.local/bin/ffprobe");
}

const ffprobe = findFfprobe();

function assertAsset(contract) {
  const assetPath = path.join(root, contract.rel);
  if (!fs.existsSync(assetPath)) {
    fail(`missing ${contract.rel}`);
  }

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
    fail(`ffprobe failed on ${contract.rel}`);
  }

  let info;
  try {
    info = JSON.parse(probe.stdout || "{}");
  } catch (e) {
    fail(`ffprobe JSON parse failed for ${contract.rel}`);
  }

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
  if (!Number.isFinite(frames) || frames !== 68) {
    fail(`${contract.rel}: frame count must be exactly 68, got ${framesRaw}`);
  }
  if (!Number.isFinite(duration)) {
    fail(
      `${contract.rel}: duration must be numeric, got ${info.format && info.format.duration}`
    );
  }
  // 68/30 = 2.2666…; allow tiny container rounding only.
  if (Math.abs(duration - 68 / 30) > 0.0005) {
    fail(`${contract.rel}: duration must be ~2.266667s (68/30), got ${duration}`);
  }

  console.log(
    `PASS: hand work-cycle ${contract.label} media (${contract.rel}; 68 frames; ~2.266667s; ${contract.width}x${contract.height}; 30fps; h264/yuv420p; no audio)`
  );
}

for (const contract of contracts) {
  assertAsset(contract);
}
