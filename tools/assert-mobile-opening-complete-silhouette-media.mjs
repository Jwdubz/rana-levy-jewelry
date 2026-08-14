#!/usr/bin/env node
/**
 * Fail-before / pass-after: mobile opening source edit with complete
 * ring/gem compositions. Exact parent 143e43a wires the prior tight
 * portrait crop. The candidate must keep desktop bytes/attrs exact,
 * author a new uniquely named 498x1080 mobile film, preserve the
 * approved cluster first frame, and not solve aspect with CSS fillers.
 *
 * Usage: node tools/assert-mobile-opening-complete-silhouette-media.mjs
 *
 * Residue: mobile-opening-complete-silhouette tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator retiming or re-encoding the mobile opening
 * Activation: execute — node tools/assert-mobile-opening-complete-silhouette-media.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when the complete-silhouette mobile opening contract is retired
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PARENT = "143e43a5c5ac9ca29162fefebefc9ff192538106";

const NEW_VIDEO = "assets/studio-opening-cluster-complete-silhouette-portrait.mp4";
const NEW_POSTER = "assets/studio-opening-cluster-complete-silhouette-portrait.jpg";
const OLD_VIDEO = "assets/studio-opening-cluster-bench-engraving-portrait.mp4";
const OLD_POSTER = "assets/studio-opening-cluster-bench-engraving-portrait.jpg";
const DESKTOP_VIDEO = "assets/studio-opening-cluster-bench-engraving.mp4";
const DESKTOP_POSTER = "assets/studio-opening-cluster-bench-engraving.jpg";
const RING_MOBILE = "assets/ring-alexandrite-portrait.mp4";

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n?/g, "\n");
}

function gitHash(commit, rel) {
  return execFileSync("git", ["rev-parse", commit + ":" + rel], {
    cwd: root,
    encoding: "utf8",
  }).trim();
}

function gitShow(commit, rel) {
  return execFileSync("git", ["show", commit + ":" + rel], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  }).replace(/\r\n?/g, "\n");
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

function extractRawFrame(videoPath, frameIndex, outPath, width, height) {
  const targetW = Math.min(160, width);
  const targetH = Math.round((height / width) * targetW);
  const w = targetW % 2 === 0 ? targetW : targetW - 1;
  const h = targetH % 2 === 0 ? targetH : targetH - 1;
  const r = spawnSync(
    ffmpeg,
    [
      "-y",
      "-i",
      videoPath,
      "-vf",
      `select=eq(n\\,${frameIndex}),scale=${w}:${h}`,
      "-vframes",
      "1",
      "-update",
      "1",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      outPath,
    ],
    { encoding: "utf8" }
  );
  if (r.status !== 0 || !fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
    process.stderr.write(r.stderr || "");
    fail(`failed to extract frame ${frameIndex} from ${videoPath}`);
  }
  return { w, h };
}

function extractRawStill(imagePath, outPath, w, h) {
  const r = spawnSync(
    ffmpeg,
    [
      "-y",
      "-i",
      imagePath,
      "-vf",
      `scale=${w}:${h}`,
      "-vframes",
      "1",
      "-update",
      "1",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      outPath,
    ],
    { encoding: "utf8" }
  );
  if (r.status !== 0 || !fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
    process.stderr.write(r.stderr || "");
    fail(`failed to extract still ${imagePath}`);
  }
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

const index = read("index.html");
const styles = read("styles.css");
const parentIndex = gitShow(PARENT, "index.html");

// Parent must still be the tight-crop wiring so this test fails there.
if (parentIndex.includes(NEW_VIDEO) || parentIndex.includes(NEW_POSTER)) {
  fail(`parent ${PARENT} already wires ${NEW_VIDEO}; fail-before contract is broken`);
}
if (
  !parentIndex.includes(`data-mobile-src="${OLD_VIDEO}"`) ||
  !parentIndex.includes(`data-mobile-poster="${OLD_POSTER}"`)
) {
  fail(`parent ${PARENT} lost the prior tight portrait wiring used as fail-before`);
}

// New uniquely named assets must exist; old portrait must remain (not overwritten).
for (const rel of [NEW_VIDEO, NEW_POSTER, OLD_VIDEO, OLD_POSTER, DESKTOP_VIDEO, DESKTOP_POSTER, RING_MOBILE]) {
  if (!fs.existsSync(path.join(root, rel))) fail(`missing ${rel}`);
}
if (NEW_VIDEO === OLD_VIDEO || NEW_POSTER === OLD_POSTER) {
  fail("new mobile opening assets must be uniquely named, not overwrite the prior portrait");
}

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
if (!studioMarkup.includes(`data-desktop-src="${DESKTOP_VIDEO}"`)) {
  fail(`studioVideo desktop film must remain ${DESKTOP_VIDEO}`);
}
if (!studioMarkup.includes(`data-src="${DESKTOP_VIDEO}"`)) {
  fail(`studioVideo data-src must remain the desktop film ${DESKTOP_VIDEO}`);
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

// Desktop bytes must match the exact parent blob.
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

// Media contract: H.264 / yuv420p / 30fps CFR / 498x1080 / muted / 16–24s / faststart.
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
if (Number(v.width) !== 498) fail(`${NEW_VIDEO}: width must be 498, got ${v.width}`);
if (Number(v.height) !== 1080) fail(`${NEW_VIDEO}: height must be 1080, got ${v.height}`);
if (String(v.r_frame_rate) !== "30/1") {
  fail(`${NEW_VIDEO}: r_frame_rate must be 30/1, got ${v.r_frame_rate}`);
}
if (!Number.isFinite(frames) || frames < 480 || frames > 720) {
  fail(`${NEW_VIDEO}: expected ~16–24s at 30fps (480–720 frames), got ${frames}`);
}
if (!Number.isFinite(duration) || duration < 16 || duration > 24) {
  fail(`${NEW_VIDEO}: duration must be 16–24s, got ${duration}`);
}
if (Math.abs(duration - frames / 30) > 0.05) {
  fail(`${NEW_VIDEO}: duration ${duration} is not CFR 30fps for ${frames} frames`);
}
const atoms = moovBeforeMdat(NEW_VIDEO);
if (atoms.moov < 0 || atoms.mdat < 0 || atoms.moov > atoms.mdat) {
  fail(`${NEW_VIDEO}: moov must precede mdat for faststart (moov=${atoms.moov} mdat=${atoms.mdat})`);
}
console.log(
  `PASS: ${NEW_VIDEO} media (${frames} frames; ${duration.toFixed(6)}s; 498x1080; 30fps; h264/yuv420p; no audio; faststart)`
);

// Opening frame identity: new film/poster match the approved cluster (old portrait frame 0).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rana-complete-sil-"));
try {
  const new0 = path.join(tmp, "new0.raw");
  const old0 = path.join(tmp, "old0.raw");
  const posterRaw = path.join(tmp, "poster.raw");
  const geom = extractRawFrame(path.join(root, NEW_VIDEO), 0, new0, 498, 1080);
  extractRawFrame(path.join(root, OLD_VIDEO), 0, old0, 498, 1080);
  extractRawStill(path.join(root, NEW_POSTER), posterRaw, geom.w, geom.h);
  const filmMad = meanAbsDiff(new0, old0);
  const posterMad = meanAbsDiff(new0, posterRaw);
  if (filmMad > 8) {
    fail(
      `new opening frame 0 diverges from approved cluster (mad ${filmMad.toFixed(3)} > 8 vs ${OLD_VIDEO} frame 0)`
    );
  }
  if (posterMad > 12) {
    fail(
      `new poster does not match new film frame 0 (mad ${posterMad.toFixed(3)} > 12)`
    );
  }
  console.log(
    `PASS: opening frame identity (film0≈old-cluster mad=${filmMad.toFixed(3)}; poster≈film0 mad=${posterMad.toFixed(3)})`
  );
} finally {
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // tmp cleanup is best-effort; assertion results already stand
  }
}

// Forbidden CSS / frame-filler family must not appear as a crop substitute.
const indexMobile = extractMobileSlice(index);
const stylesMobile = extractMobileSlice(styles);
const mobileCss = (indexMobile + "\n" + stylesMobile).replace(/\/\*[\s\S]*?\*\//g, "");
const parentMobileCss = (
  extractMobileSlice(gitShow(PARENT, "index.html")) +
  "\n" +
  extractMobileSlice(gitShow(PARENT, "styles.css"))
).replace(/\/\*[\s\S]*?\*\//g, "");
const forbidden = [
  { re: /object-fit\s*:\s*contain/i, label: "object-fit: contain" },
  { re: /backdrop-filter/i, label: "backdrop-filter" },
  { re: /media-echo|atmosphere-layer|media-atmosphere/i, label: "atmosphere/echo filler" },
  { re: /mask-image\s*:\s*[^;]*(radial-gradient|linear-gradient|ellipse)/i, label: "gradient/ellipse media mask" },
  { re: /closest-side|ellipse 96% 94%|ellipse 50% 50% at 50% 50%/i, label: "vignette ellipse grammar" },
  { re: /filter\s*:\s*[^;]*blur\(/i, label: "blur filter" },
];
for (const item of forbidden) {
  if (item.re.test(mobileCss) && !item.re.test(parentMobileCss)) {
    fail(`mobile CSS introduced forbidden frame-filler: ${item.label}`);
  }
  if (item.re.test(mobileCss) && item.re.test(parentMobileCss)) {
    // Pre-existing parent grammar is not this correction's introduction.
    continue;
  }
}
if (/\.world-studio\s+\.media-stack[\s\S]{0,400}object-fit\s*:\s*contain/i.test(mobileCss)) {
  fail("studio media stack must not switch to contain on mobile");
}
console.log("PASS: no contain/letterbox/vignette/blur/atmosphere frame-filler on mobile");

console.log(
  "PASS: mobile opening complete-silhouette media (unique 498x1080 film+poster; desktop bytes/attrs invariant; cluster first frame; no CSS filler; source proof only — not visual consumer verification)"
);
