#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = "assets/studio-opening-cluster-bench-engraving-mobile-wide.mp4";
const output =
  "assets/studio-opening-cluster-bench-engraving-mobile-wide-spectral.mp4";
const poster =
  "assets/studio-opening-cluster-bench-engraving-mobile-wide-spectral.jpg";

for (const rel of [source]) {
  if (!fs.existsSync(path.join(root, rel))) {
    throw new Error(`Missing source asset: ${rel}`);
  }
}
for (const rel of [output, poster]) {
  if (fs.existsSync(path.join(root, rel))) {
    throw new Error(`Refusing to overwrite existing derivative: ${rel}`);
  }
}

const wash = 0.67;
const dark = [2, 0, 5];
const stops = [
  [215, 185, 255],
  [169, 140, 255],
  [255, 156, 201],
  [244, 221, 176],
];

// CSS 105deg across the complete 720 × 1560 field: rightward and slightly down.
const dx = 0.9659258262890683;
const dy = 0.25881904510252085;
const t =
  `clip(0.5+((X+0.5-360)*${dx}+(Y+0.5-780)*${dy})` +
  `/(720*${dx}+1560*${dy}),0,1)`;
const ramp = (start, length) => `clip(((${t})-${start})/${length},0,1)`;

function channel(index) {
  const [a, b, c, d] = stops.map((rgb) => rgb[index]);
  const value =
    `(${a}+(${b - a})*${ramp(0, 0.28)}` +
    `+(${c - b})*${ramp(0.28, 0.3)}` +
    `+(${d - c})*${ramp(0.58, 0.42)})`;
  return `round((1-${wash})*${value}+${wash}*${dark[index]})`;
}

const graph = [
  "nullsrc=s=720x1560:r=30,trim=end_frame=1,format=gbrp," +
    `geq=r='${channel(0)}':g='${channel(1)}':b='${channel(2)}',` +
    "scale=out_color_matrix=bt601:out_range=tv:flags=accurate_rnd," +
    "format=yuv420p,loop=loop=-1:size=1:start=0," +
    "setpts=N/(30*TB),split=2[gradientTop][gradientBottom]",
  "[gradientTop]crop=w=720:h=456:x=0:y=0[top]",
  "[0:v:0]trim=end_frame=517,setpts=PTS-STARTPTS," +
    "crop=w=720:h=648:x=0:y=456,setsar=1[picture]",
  "[gradientBottom]crop=w=720:h=456:x=0:y=1104[bottom]",
  "[top][picture][bottom]vstack=inputs=3:shortest=1," +
    "setsar=1,format=yuv420p," +
    "setparams=range=unknown:color_primaries=unknown:" +
    "color_trc=unknown:colorspace=unknown[out]",
].join(";");

function run(args, label) {
  const result = spawnSync("ffmpeg", args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

run(
  [
    "-hide_banner",
    "-n",
    "-i",
    source,
    "-filter_complex",
    graph,
    "-map",
    "[out]",
    "-frames:v",
    "517",
    "-r",
    "30",
    "-fps_mode",
    "cfr",
    "-c:v",
    "libx264",
    "-profile:v",
    "main",
    "-preset",
    "slow",
    "-crf",
    "16",
    "-pix_fmt",
    "yuv420p",
    "-an",
    "-sn",
    "-dn",
    "-video_track_timescale",
    "15360",
    "-movflags",
    "+faststart",
    output,
  ],
  "Spectral video generation"
);

run(
  [
    "-hide_banner",
    "-n",
    "-i",
    output,
    "-map",
    "0:v:0",
    "-frames:v",
    "1",
    "-c:v",
    "mjpeg",
    "-q:v",
    "2",
    "-pix_fmt",
    "yuvj420p",
    "-update",
    "1",
    poster,
  ],
  "Spectral poster generation"
);

console.log(`Created ${output}`);
console.log(`Created ${poster}`);
