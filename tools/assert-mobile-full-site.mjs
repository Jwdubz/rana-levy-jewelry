#!/usr/bin/env node
/**
 * Source assertion: complete mobile site from the approved full-screen oracle.
 *
 * Extends (does not weaken) the opening oracle contract with home Hand/Work
 * passage, two-column catalog, sharp product/held frames, shell two-band nav,
 * route-specific grounds, consultation sketch, quiet/desktop preservation.
 *
 * Usage: node tools/assert-mobile-full-site.mjs
 *
 * Residue: mobile-full-site-from-oracle tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator editing mobile shell/catalog/home passage
 * Activation: execute — node tools/assert-mobile-full-site.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when the mobile full-site contract is retired or superseded
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n?/g, "\n");
}

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function extractBlock(src, selector, afterIndex = 0) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped + "\\s*\\{", "g");
  re.lastIndex = afterIndex;
  while (true) {
    const match = re.exec(src);
    if (!match) return null;
    let i = match.index;
    while (i > 0 && /\s/.test(src[i - 1])) i--;
    if (i > 0 && src[i - 1] === ",") continue;
    const brace = match.index + match[0].length - 1;
    let depth = 0;
    for (let j = brace; j < src.length; j++) {
      const ch = src[j];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return src.slice(brace + 1, j);
      }
    }
    return null;
  }
}

function extractMobileSlice(src) {
  const q = "@media (max-width: 700px)";
  const idx = src.indexOf(q);
  if (idx < 0) return null;
  // Collect all mobile media blocks into one synthetic slice for token probes.
  let out = "";
  let from = 0;
  while (true) {
    const i = src.indexOf(q, from);
    if (i < 0) break;
    const slice = src.slice(i);
    // Find end of this media query by brace depth from first {
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
  return out || null;
}

function assertIncludes(hay, needle, label) {
  if (!hay || !hay.includes(needle)) fail(`${label}: missing ${JSON.stringify(needle)}`);
}

function assertNotIncludes(hay, needle, label) {
  if (hay && hay.includes(needle)) fail(`${label}: forbidden ${JSON.stringify(needle)}`);
}

// --- Opening oracle must still pass ---
const opening = spawnSync(
  process.execPath,
  [path.join(root, "tools/assert-mobile-opening-zero-effects.mjs")],
  { encoding: "utf8" }
);
if (opening.status !== 0) {
  process.stderr.write(opening.stdout || "");
  process.stderr.write(opening.stderr || "");
  fail("opening oracle assertion failed — full-site must not weaken it");
}

const styles = read("styles.css");
const shellCss = read("shell.css");
const siteJs = read("site.js");
const shellJs = read("shell.js");
const index = read("index.html");

const stylesMobile = extractMobileSlice(styles);
const shellMobile = extractMobileSlice(shellCss);
if (!stylesMobile) fail("styles.css missing mobile max-width: 700px query");
if (!shellMobile) fail("shell.css missing mobile max-width: 700px query");

const stylesMobileIdx = styles.indexOf("@media (max-width: 700px)");
const shellMobileIdx = shellCss.indexOf("@media (max-width: 700px)");

// --- Desktop catalog remains three columns ---
const trayDesktop = extractBlock(shellCss, ".tray", 0);
if (!trayDesktop) fail("missing desktop .tray");
if (!/grid-template-columns\s*:\s*repeat\(\s*3\s*,/.test(trayDesktop)) {
  fail("desktop .tray must remain three columns (repeat(3, …))");
}
// Desktop piece mask may remain; ensure base still declares it.
if (!/--piece-mask\s*:\s*radial-gradient/.test(shellCss)) {
  fail("desktop --piece-mask radial dissolve must remain for desktop composition");
}

// --- Mobile catalog is two columns, including grammar for 320 ---
const trayMobile = extractBlock(shellCss, ".tray", shellMobileIdx);
if (!trayMobile) fail("missing mobile .tray override");
if (!/grid-template-columns\s*:\s*repeat\(\s*2\s*,/.test(trayMobile)) {
  fail("mobile .tray must be two columns (repeat(2, …))");
}
if (/grid-template-columns\s*:\s*1fr\s*;/.test(trayMobile)) {
  fail("mobile .tray must not collapse to one column");
}
assertIncludes(trayMobile, "align-items: start", "mobile .tray row-axis lock");

// --- Mobile product frames: sharp square edges, no radial mask/wash/overscan ---
const pieceFrameMobile = extractBlock(shellCss, ".piece__frame", shellMobileIdx);
if (!pieceFrameMobile) fail("missing mobile .piece__frame");
assertIncludes(pieceFrameMobile, "inset: 0", "mobile .piece__frame full media box");
if (!/mask-image\s*:\s*none/i.test(pieceFrameMobile)) {
  fail("mobile .piece__frame must set mask-image: none");
}
if (/inset\s*:\s*-\d/.test(pieceFrameMobile)) {
  fail("mobile .piece__frame must not use negative overscan inset");
}

const pieceAfterMobile = extractBlock(shellCss, ".piece__frame::after", shellMobileIdx);
if (pieceAfterMobile) {
  if (!/display\s*:\s*none|content\s*:\s*none/i.test(pieceAfterMobile)) {
    fail("mobile .piece__frame::after radial wash must be disabled");
  }
  if (/radial-gradient/i.test(pieceAfterMobile) && !/none/i.test(pieceAfterMobile)) {
    fail("mobile .piece__frame::after must not paint radial wash");
  }
}

const pieceImageMobile = extractBlock(shellCss, ".piece__image", shellMobileIdx);
if (!pieceImageMobile) fail("missing mobile .piece__image");
if (!/transform\s*:\s*none/i.test(pieceImageMobile)) {
  fail("mobile .piece__image must not scale/overscan (transform: none)");
}

// --- Held view: sharp square, no radial mask/wash ---
const heldFrameMobile = extractBlock(shellCss, ".shell-held__frame", shellMobileIdx);
if (!heldFrameMobile) fail("missing mobile .shell-held__frame");
assertIncludes(heldFrameMobile, "inset: 0", "mobile held frame");
if (!/mask-image\s*:\s*none/i.test(heldFrameMobile)) {
  fail("mobile .shell-held__frame must set mask-image: none");
}

const heldMobile = extractBlock(shellCss, ".shell-held", shellMobileIdx);
if (!heldMobile) fail("missing mobile .shell-held");
if (/radial-gradient/i.test(heldMobile)) {
  fail("mobile .shell-held must not use radial-gradient surround wash");
}

const heldMediaMobile = extractBlock(shellCss, ".shell-held__media", shellMobileIdx);
if (!heldMediaMobile) fail("missing mobile .shell-held__media");
if (!/aspect-ratio\s*:\s*1\s*\/\s*1/i.test(heldMediaMobile)) {
  fail("mobile held media must remain a square (aspect-ratio: 1 / 1)");
}

// --- Shell two-band nav: nowrap primary destinations ---
const navMobile = extractBlock(shellCss, ".shell-primary-nav", shellMobileIdx);
if (!navMobile) fail("missing mobile .shell-primary-nav");
assertIncludes(navMobile, "flex-wrap: nowrap", "mobile primary nav nowrap");
assertIncludes(navMobile, "space-between", "mobile primary nav distribution");
if (/flex-wrap\s*:\s*wrap/i.test(navMobile)) {
  fail("mobile .shell-primary-nav must not wrap destinations");
}

const navLinkMobile = extractBlock(shellCss, ".shell-primary-nav a", shellMobileIdx);
if (!navLinkMobile) fail("missing mobile .shell-primary-nav a");
assertIncludes(navLinkMobile, "min-height: 44px", "mobile nav 44px targets");
assertIncludes(navLinkMobile, "white-space: nowrap", "mobile nav labels nowrap");

// --- Mobile shell chrome must not stay a transparent fixed overlay ---
// Observed defect: fixed transparent .shell-chrome + scrolling body copy collision
// at 320×568 on long non-home routes (consultation.html especially).
const chromeBase = extractBlock(shellCss, ".shell-chrome", 0);
if (!chromeBase) fail("missing base .shell-chrome");
if (!/position\s*:\s*fixed/i.test(chromeBase)) {
  fail("desktop/base .shell-chrome must remain position: fixed");
}
const chromeMobile = extractBlock(shellCss, ".shell-chrome", shellMobileIdx);
if (!chromeMobile) fail("missing mobile .shell-chrome override");
if (/position\s*:\s*fixed/i.test(chromeMobile)) {
  fail(
    "mobile .shell-chrome must not remain position:fixed (transparent fixed overlay collides with body copy while scrolling)"
  );
}
if (!/position\s*:\s*(relative|static|sticky)/i.test(chromeMobile)) {
  fail(
    "mobile .shell-chrome must join document flow (relative/static/sticky) so chrome scrolls with the opening composition"
  );
}
// Forbidden cosmetic hides of the collision (binding visual rule).
for (const forbidden of [
  "backdrop-filter",
  "filter: blur",
  "filter:blur",
  "-webkit-backdrop-filter",
]) {
  if (chromeMobile.toLowerCase().includes(forbidden.toLowerCase())) {
    fail(`mobile .shell-chrome must not use ${forbidden} to hide overlap`);
  }
}
// No opaque utility-bar paint on the chrome as a substitute for scroll-away.
if (/background(?:-color)?\s*:\s*(?!transparent|none|inherit|initial|unset)[^;]+/i.test(chromeMobile)) {
  const bg = chromeMobile.match(/background(?:-color)?\s*:\s*([^;]+)/i);
  const val = (bg && bg[1] ? bg[1] : "").trim().toLowerCase();
  if (val && !/^(transparent|none|inherit|initial|unset)$/.test(val) && !/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/.test(val)) {
    fail(
      "mobile .shell-chrome must not gain an opaque utility-bar background; chrome should scroll away instead"
    );
  }
}
// Mobile top pad is only the calm breath after in-flow chrome — not fixed-overlay clearance.
const rootMobile = extractBlock(shellCss, ":root", shellMobileIdx);
if (!rootMobile) fail("missing mobile :root tokens");
if (!/--shell-pad-top\s*:\s*1\.1rem/i.test(rootMobile)) {
  fail(
    "mobile --shell-pad-top must be the in-flow breath (1.1rem), not fixed-chrome clearance that double-spaces or enables overlay collision"
  );
}
// Guard the old fixed-clearance formula from returning under another name.
if (
  /--shell-pad-top\s*:\s*calc\s*\(\s*3\.2svh[\s\S]*2\.75rem/i.test(rootMobile) ||
  /--shell-pad-top\s*:\s*calc\s*\([\s\S]*mark-w[\s\S]*2\.75rem/i.test(rootMobile)
) {
  fail("mobile --shell-pad-top must not reintroduce fixed two-band chrome clearance calc");
}

// --- Filter instrument: search full row + two columns ---
const instrumentMobile = extractBlock(shellCss, ".tray-instrument__row", shellMobileIdx);
if (!instrumentMobile) fail("missing mobile .tray-instrument__row");
if (!/grid-template-columns\s*:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)|grid-template-columns\s*:\s*1fr\s+1fr/.test(
  instrumentMobile
)) {
  fail("mobile filter instrument must use two usable columns");
}
const searchMobile = extractBlock(shellCss, ".tray-field--search", shellMobileIdx);
if (!searchMobile || !/grid-column\s*:\s*1\s*\/\s*-1/.test(searchMobile)) {
  fail("mobile search field must span full instrument row");
}
const labelMobile = extractBlock(shellCss, ".tray-field label", shellMobileIdx);
const selectCaps = extractBlock(shellCss, ".tray-field select", shellMobileIdx);
const optionCaps = extractBlock(shellCss, ".tray-field select option", shellMobileIdx);
if (!labelMobile || !/text-transform\s*:\s*capitalize/.test(labelMobile)) {
  fail("mobile filter labels must use text-transform: capitalize");
}
if (!selectCaps || !/text-transform\s*:\s*capitalize/.test(selectCaps)) {
  fail("mobile filter selects must use text-transform: capitalize");
}
if (!optionCaps || !/text-transform\s*:\s*capitalize/.test(optionCaps)) {
  fail("mobile filter options must use text-transform: capitalize");
}

// --- Catalog native select: dark option panel (Windows/Chromium) ---
// Cream option text over a white OS popup is nearly invisible.
// Shared .tray-field select on ready.html + made.html; do not restyle the closed control.
{
  const catalogSelect = extractBlock(shellCss, ".tray-field select", 0);
  if (!catalogSelect) fail("missing shared .tray-field select");
  if (!/color-scheme\s*:\s*dark\s*;/i.test(catalogSelect)) {
    fail("shared .tray-field select must declare color-scheme: dark for the native option panel");
  }
  const catalogOption = extractBlock(shellCss, ".tray-field select option", 0);
  if (!catalogOption) fail("missing shared .tray-field select option");
  if (!/background(?:-color)?\s*:\s*var\(--ink\)/i.test(catalogOption)) {
    fail("catalog select option rows must have an explicit dark fill (var(--ink))");
  }
  if (!/color\s*:\s*var\(--cream\)/i.test(catalogOption)) {
    fail("catalog select option rows must use explicit light text (var(--cream))");
  }
  if (/background(?:-color)?\s*:\s*transparent/i.test(catalogOption)) {
    fail("catalog select option rows must not use a transparent surface");
  }
}

// --- Blurred wallpaper filler removed on mobile for ink routes ---
assertIncludes(shellMobile, "display: none", "mobile ground image hide for ink routes");
if (!/\.page-services\s+\.shell-ground__image[\s\S]{0,400}filter\s*:\s*none/i.test(shellMobile)) {
  fail("mobile services ground must be sharp (filter: none), not blurred wallpaper");
}
if (
  !/\.page-consultation[\s\S]{0,600}\.shell-ground--sketch\s+\.shell-ground__image[\s\S]{0,500}filter\s*:\s*none/i.test(
    shellMobile
  )
) {
  fail("mobile consultation sketch must stay sharp (filter: none)");
}
// Consultation mobile scrim must not reintroduce radial vignette stack.
const consultBlocks = shellMobile.match(
  /\.page-consultation[\s\S]*?shell-ground__scrim\s*\{[\s\S]*?\}/g
) || [];
for (const block of consultBlocks) {
  if (/radial-gradient/i.test(block)) {
    fail("mobile consultation scrim must not use radial-gradient vignette treatment");
  }
}

// --- Consultation mobile contrast: opening sketch → native ink ground ---
// Fixed pale paper under the full scrolled article made contact links ~1.2:1.
// Mechanism: document-absolute ground with var(--ink); sharp sketch owns 100svh only.
// Forbidden: re-fixed pale paper, blur/mask/vignette, or card/panel contrast shells.
{
  const consultGroundBlocks = shellMobile.match(
    /\.page-consultation(?:\.shell-body)?\s+\.shell-ground\s*\{[\s\S]*?\}/g
  ) || [];
  if (!consultGroundBlocks.length) {
    fail("mobile consultation .shell-ground block missing");
  }
  const groundJoined = consultGroundBlocks.join("\n");
  if (!/position\s*:\s*absolute/i.test(groundJoined)) {
    fail(
      "mobile consultation ground must be position:absolute so the opening sketch yields to ink on scroll"
    );
  }
  if (/position\s*:\s*fixed/i.test(groundJoined)) {
    fail("mobile consultation ground must not remain position:fixed under the scrolled passage");
  }
  if (!/background\s*:\s*var\(--ink\)/i.test(groundJoined)) {
    fail("mobile consultation ground must use var(--ink) under the scrolled article");
  }
  if (/background\s*:\s*#f4f1ea/i.test(groundJoined)) {
    fail("mobile consultation ground must not paint pale paper (#f4f1ea) under the full passage");
  }

  if (
    !/\.page-consultation[\s\S]{0,800}\.shell-ground--sketch\s+\.shell-ground__image[\s\S]{0,500}height\s*:\s*100svh/i.test(
      shellMobile
    )
  ) {
    fail("mobile consultation sketch image must own the opening viewport only (height: 100svh)");
  }

  // Scrim must yield toward native ink at the opening bottom (contact zone on tall phones).
  const consultScrimBlocks = shellMobile.match(
    /\.page-consultation[\s\S]*?shell-ground__scrim\s*\{[\s\S]*?\}/g
  ) || [];
  if (!consultScrimBlocks.length) {
    fail("mobile consultation scrim block missing");
  }
  const scrimJoined = consultScrimBlocks.join("\n");
  if (!/height\s*:\s*100svh/i.test(scrimJoined)) {
    fail("mobile consultation scrim must be scoped to the opening viewport (height: 100svh)");
  }
  if (!/rgba\(\s*2\s*,\s*0\s*,\s*5\s*,\s*0\.(9|9\d|96|94|95|97|98|99)\s*\)/i.test(scrimJoined)) {
    fail("mobile consultation scrim must yield to near-opaque ink at the opening bottom");
  }
  // Transparent mid-stack was the contrast hole — require a mid-passage darkness floor.
  if (/transparent\s+48%/i.test(scrimJoined) && /transparent\s+82%/i.test(scrimJoined)) {
    fail("mobile consultation scrim must not recreate the fully-transparent mid-viewport stack");
  }
  // Residual local-halo: opaque cream alone left ~4.17:1 over 430 pale pencil.
  // Proven vertical mid-stops (0.55/0.62/0.80) clear ≥4.5:1; lock the floor.
  if (!/rgba\(\s*10\s*,\s*2\s*,\s*14\s*,\s*0\.55\s*\)\s*34%/i.test(scrimJoined)) {
    fail("mobile consultation vertical scrim 34% stop must keep mid-stack darkness floor 0.55");
  }
  if (!/rgba\(\s*10\s*,\s*2\s*,\s*14\s*,\s*0\.62\s*\)\s*56%/i.test(scrimJoined)) {
    fail("mobile consultation vertical scrim 56% stop must keep mid-stack darkness floor 0.62");
  }
  if (!/rgba\(\s*10\s*,\s*2\s*,\s*14\s*,\s*0\.8(?:0)?\s*\)\s*78%/i.test(scrimJoined)) {
    fail("mobile consultation vertical scrim 78% stop must keep mid-stack darkness floor 0.80");
  }
  if (
    /\.page-consultation[\s\S]{0,800}\.shell-ground--sketch\s+\.shell-ground__image[\s\S]{0,500}filter\s*:\s*[^;]*blur/i.test(
      shellMobile
    )
  ) {
    fail("mobile consultation sketch must not use blur (Frame-Filler / atmosphere)");
  }
  if (
    /\.page-consultation[\s\S]{0,800}\.shell-ground--sketch\s+\.shell-ground__image[\s\S]{0,500}mask-image\s*:/i.test(
      shellMobile
    )
  ) {
    fail("mobile consultation sketch must not use mask-image");
  }

  // No floating card / opaque panel substitute on the consult passage.
  const consultPassageBlocks = shellMobile.match(
    /\.page-consultation[\s\S]*?consult-passage(?:\s+[^{]+)?\s*\{[\s\S]*?\}/g
  ) || [];
  for (const block of consultPassageBlocks) {
    if (/backdrop-filter/i.test(block)) {
      fail("mobile consultation passage must not use backdrop-filter card treatment");
    }
    if (/background\s*:\s*(?:#(?:0{3,6}|020005)|rgba\(\s*2\s*,\s*0\s*,\s*5\s*,\s*0\.(?:[5-9]|\d{2,}))/i.test(block)) {
      fail("mobile consultation passage must not solve contrast with an opaque utility panel");
    }
  }

  // Residual opening-copy contrast: ordinary paragraphs must use opaque cream
  // over the sharp sketch (not inherited translucent --cream-soft / 0.78 alpha).
  const consultParaBlocks = shellMobile.match(
    /\.page-consultation[\s\S]*?consult-passage\s+p\s*\{[\s\S]*?\}/g
  ) || [];
  const consultParaJoined = consultParaBlocks.join("\n");
  if (!/color\s*:\s*var\(--cream\)/i.test(consultParaJoined)) {
    fail(
      "mobile consultation ordinary paragraphs must use opaque cream (var(--cream)), not translucent cream-soft"
    );
  }
  if (/color\s*:\s*var\(--cream-soft\)/i.test(consultParaJoined)) {
    fail(
      "mobile consultation ordinary paragraphs must not reintroduce translucent --cream-soft over the opening sketch"
    );
  }
}

// --- Mid-band shell chrome (701–1100px): document-bound, never fixed/sticky ---
// Observed shared residual: transparent fixed .shell-chrome overlaps later copy
// on every long shell route at 844×390 and at 1024×600 (above the retired
// max-height: 500px gate). Proven causal fix is unscoped absolute across the
// complete 701–1100 band — opening composition stays, header scrolls away.
{
  // Retired narrow forms must be gone (one source of truth for the band).
  if (
    /@media\s*\(\s*min-width\s*:\s*701px\s*\)\s*and\s*\(\s*max-width\s*:\s*1100px\s*\)\s*and\s*\(\s*max-height\s*:\s*500px\s*\)/i.test(
      shellCss
    )
  ) {
    fail(
      "mid-band chrome must not retain retired max-height: 500px gate; band is width-only 701–1100px"
    );
  }
  if (/\.page-consultation\s+\.shell-chrome/i.test(shellCss)) {
    fail(
      "mid-band chrome must not retain Consultation-scoped .page-consultation .shell-chrome; unscoped .shell-chrome is required"
    );
  }

  const midBandRe =
    /@media\s*\(\s*min-width\s*:\s*701px\s*\)\s*and\s*\(\s*max-width\s*:\s*1100px\s*\)\s*\{/g;
  const m = midBandRe.exec(shellCss);
  if (!m) {
    fail(
      "mid-band shell chrome media missing: @media (min-width: 701px) and (max-width: 1100px)"
    );
  }
  // Ensure this match is not a longer compound that reintroduces height/other gates.
  const mediaHead = shellCss.slice(m.index, shellCss.indexOf("{", m.index));
  if (/max-height/i.test(mediaHead)) {
    fail("mid-band shell chrome media must not include max-height (width-only 701–1100px)");
  }
  const brace = shellCss.indexOf("{", m.index);
  let depth = 0;
  let end = -1;
  for (let j = brace; j < shellCss.length; j++) {
    if (shellCss[j] === "{") depth++;
    else if (shellCss[j] === "}") {
      depth--;
      if (depth === 0) {
        end = j;
        break;
      }
    }
  }
  if (end < 0) fail("mid-band shell chrome media block unclosed");
  const band = shellCss.slice(brace + 1, end);
  const chromeBlock = extractBlock(band, ".shell-chrome", 0);
  if (!chromeBlock) {
    fail(
      "mid-band must target unscoped .shell-chrome (all shell routes in 701–1100px)"
    );
  }
  // Reject Consultation-scoped form if it somehow appears inside the band.
  if (extractBlock(band, ".page-consultation .shell-chrome", 0)) {
    fail(
      "mid-band must not target .page-consultation .shell-chrome; use unscoped .shell-chrome only"
    );
  }
  if (!/position\s*:\s*absolute/i.test(chromeBlock)) {
    fail(
      "mid-band .shell-chrome must be position:absolute (document-bound; scrolls away with copy)"
    );
  }
  if (/position\s*:\s*fixed/i.test(chromeBlock)) {
    fail(
      "mid-band .shell-chrome must never be position:fixed (viewport-bound reading collision)"
    );
  }
  if (/position\s*:\s*sticky/i.test(chromeBlock)) {
    fail(
      "mid-band .shell-chrome must never be position:sticky (must leave the viewport on scroll)"
    );
  }
  // Exactly one complete mid-band law for this chrome correction.
  midBandRe.lastIndex = end + 1;
  if (midBandRe.exec(shellCss)) {
    fail(
      "mid-band shell chrome media must appear exactly once (one source of truth for 701–1100px)"
    );
  }
}

// --- Gallery mobile: no piece-mask islands ---
const galFrameMobile = extractBlock(shellCss, ".gallery-item__frame", shellMobileIdx);
if (!galFrameMobile) fail("missing mobile .gallery-item__frame");
if (!/mask-image\s*:\s*none/i.test(galFrameMobile)) {
  fail("mobile gallery frames must set mask-image: none");
}
const galStreamMobile = extractBlock(shellCss, ".gallery-stream", shellMobileIdx);
if (!galStreamMobile || !/repeat\(\s*2\s*,/.test(galStreamMobile)) {
  fail("mobile gallery stream should be a two-column aligned field");
}

// --- Home Work: no mobile echo blur / radial jewelry island / rest wash ---
assertNotIncludes(stylesMobile, "blur(28px)", "mobile work echo blur");
if (/work-world-0::before[\s\S]{0,120}filter\s*:\s*[^;]*blur/i.test(stylesMobile)) {
  fail("mobile work-world::before must not apply blur atmosphere");
}
if (!/work-world-0::before[\s\S]{0,180}(content\s*:\s*none|display\s*:\s*none)/i.test(stylesMobile)) {
  fail("mobile work-world echo underlays must be disabled");
}
if (!/#workStack0\s*>\s*img[\s\S]{0,400}object-fit\s*:\s*cover/i.test(stylesMobile)) {
  fail("mobile work jewelry carriers must use object-fit: cover");
}
if (!/#workWorld0::after[\s\S]{0,300}100dvh\s*\*\s*456\s*\/\s*1560/.test(stylesMobile)) {
  fail("mobile work must keep the beat-1 header hold in black");
}
if (!/#workStack0\s*>\s*img[\s\S]{0,400}inset\s*:\s*0/.test(stylesMobile)) {
  fail("mobile work jewelry must stay full-bleed");
}
if (/#workStack0\s*>\s*img[\s\S]{0,500}mask-image\s*:\s*radial-gradient/i.test(stylesMobile)) {
  fail("mobile work jewelry must not use radial-gradient media masks");
}
if (!/work-rest-wash[\s\S]{0,120}display\s*:\s*none/i.test(stylesMobile)) {
  fail("mobile .work-rest-wash radial resting wash must be disabled");
}

// Mobile bridges retired: direct Opening→Hand→Work authority (no duplicate paint).
if (!/\.hand-bridge[\s\S]{0,400}visibility:\s*hidden\s*!important/i.test(stylesMobile)) {
  fail("mobile full-site must retire .hand-bridge paint (visibility:hidden !important)");
}
if (/id="workBridge"/.test(index) || /work-bridge/.test(styles) || /workBridge/.test(siteJs)) {
  fail("full-site must remove workBridge rather than hide a static workbench poster");
}
// Desktop opening→hand bridge paths must remain in site.js.
if (!/function\s+applyBridgeOut\s*\(/.test(siteJs)) {
  fail("desktop applyBridgeOut must remain for angled bridge Turns");
}
if (!/function\s+armHandBridgePlayback\s*\(/.test(siteJs)) {
  fail("desktop armHandBridgePlayback must remain");
}
if (!/id="handBridgeVideo"/.test(index)) {
  fail("desktop opening→hand bridge markup (#handBridgeVideo) must remain present");
}

// --- site.js: Hand portrait world retired; direct bench passage + workbench Cut-by-hand ---
const handPassage = spawnSync(
  process.execPath,
  [path.join(root, "tools/assert-hand-direct-bench-passage.mjs")],
  { encoding: "utf8" }
);
if (handPassage.status !== 0) {
  process.stdout.write(handPassage.stdout || "");
  process.stderr.write(handPassage.stderr || "");
  fail("hand direct bench passage tripwire failed");
}

// --- Mobile single media authority (no stacked bridge videos) ---
const mediaAuthority = spawnSync(
  process.execPath,
  [path.join(root, "tools/assert-mobile-media-authority.mjs")],
  { encoding: "utf8" }
);
if (mediaAuthority.status !== 0) {
  process.stdout.write(mediaAuthority.stdout || "");
  process.stderr.write(mediaAuthority.stderr || "");
  fail("mobile media authority tripwire failed");
}

const handMotion = spawnSync(
  process.execPath,
  [path.join(root, "tools/assert-hand-motion-authority.mjs")],
  { encoding: "utf8" }
);
if (handMotion.status !== 0) {
  process.stdout.write(handMotion.stdout || "");
  process.stderr.write(handMotion.stderr || "");
  fail("hand motion authority tripwire failed");
}

const passageCorrection = spawnSync(
  process.execPath,
  [path.join(root, "tools/assert-mobile-passage-corrections.mjs")],
  { encoding: "utf8" }
);
if (passageCorrection.status !== 0) {
  process.stdout.write(passageCorrection.stdout || "");
  process.stderr.write(passageCorrection.stderr || "");
  fail("mobile passage correction tripwire failed");
}

const catalogSummary = spawnSync(
  process.execPath,
  [path.join(root, "tools/assert-catalog-count-summary.mjs")],
  { encoding: "utf8" }
);
if (catalogSummary.status !== 0) {
  process.stdout.write(catalogSummary.stdout || "");
  process.stderr.write(catalogSummary.stderr || "");
  fail("catalog count summary tripwire failed");
}

// Quiet mode helpers still present.
if (!/function\s+quietModeActive\s*\(/.test(siteJs) && !/function quietModeActive\s*\(/.test(siteJs)) {
  fail("site.js quietModeActive must remain");
}
if (!/is-quiet/.test(siteJs)) fail("site.js must still toggle is-quiet");

// --- Home hand beat: derived Lap→Engraving cycle + exact terminal copy ---
// handVideo uses the contiguous derived cycle; BENCH_WINDOWS.hand covers its full duration.
// Desktop fallback remains data-src; mobile/desktop explicit sources share one decoder.
const handVideoBlock = index.match(
  /id="handVideo"[\s\S]*?<\/video>/
);
if (!handVideoBlock) fail("handVideo element must be present");
const handVideoMarkup = handVideoBlock[0];
if (!/data-src="assets\/studio-hand-work-cycle\.mp4"/.test(handVideoMarkup)) {
  fail('handVideo must use data-src="assets/studio-hand-work-cycle.mp4"');
}
if (
  !/data-desktop-src="assets\/studio-hand-work-cycle\.mp4"/.test(handVideoMarkup)
) {
  fail(
    'handVideo must declare data-desktop-src="assets/studio-hand-work-cycle.mp4"'
  );
}
if (
  !/data-mobile-src="assets\/studio-hand-work-cycle-portrait\.mp4"/.test(
    handVideoMarkup
  )
) {
  fail(
    'handVideo must declare data-mobile-src="assets/studio-hand-work-cycle-portrait.mp4"'
  );
}
if (
  !/data-desktop-poster="assets\/studio-poster\.jpg"/.test(handVideoMarkup) ||
  !/data-mobile-poster="assets\/studio-poster-portrait\.jpg"/.test(handVideoMarkup)
) {
  fail("handVideo must declare desktop and mobile studio posters");
}
if (/data-src="assets\/studio-banner\.mp4"/.test(handVideoMarkup)) {
  fail("handVideo must not still point at the full studio-banner montage");
}
// Preceding poster img must share the same frame authority on phones.
const handBenchStack = index.match(
  /id="handBenchStack"[\s\S]*?<\/div>/
);
if (!handBenchStack) fail("handBenchStack must be present");
if (
  !/data-desktop-src="assets\/studio-poster\.jpg"/.test(handBenchStack[0]) ||
  !/data-mobile-src="assets\/studio-poster-portrait\.jpg"/.test(handBenchStack[0])
) {
  fail(
    "hand bench poster img must declare desktop/mobile studio poster sources"
  );
}
// Quiet hand beat: poster img is paint authority; source-less #handVideo must
// leave the quiet stacking path (opacity:0 alone left a black plane over the
// loaded poster). Normal mode must keep the decoder in-flow for is-live fade.
if (!/<img[\s\S]*?<video/.test(handBenchStack[0])) {
  fail("handBenchStack must keep poster img before handVideo for quiet paint authority");
}
const quietLayerVideoRule = styles.match(
  /\.is-quiet\s+\.layer\s+video\s*\{[^}]*\}/
);
if (!quietLayerVideoRule) {
  fail("styles.css must keep .is-quiet .layer video quiet paint rule");
}
if (!/display\s*:\s*none\s*!important/i.test(quietLayerVideoRule[0])) {
  fail(
    "quiet .layer video must use display:none !important so source-less hand decoder cannot occlude the poster"
  );
}
if (!/opacity\s*:\s*0\s*!important/i.test(quietLayerVideoRule[0])) {
  fail("quiet .layer video must keep opacity:0 !important");
}
// Normal path: is-live opacity crossfade must remain; no global display:none on layer video.
if (!/\.layer\s+video\.is-live\s*\{[^}]*opacity\s*:\s*1/i.test(styles)) {
  fail("normal .layer video.is-live opacity:1 crossfade must remain");
}
const stylesWithoutQuietLayerVideo = styles.replace(
  /\.is-quiet\s+\.layer\s+video\s*\{[^}]*\}/g,
  ""
);
if (/\.layer\s+video[^{]*\{[^}]*display\s*:\s*none/i.test(stylesWithoutQuietLayerVideo)) {
  fail("non-quiet .layer video must not use display:none (normal decoder path)");
}
// One live decoder: only a single handVideo element; responsive path only mutates data-src.
if ((index.match(/id="handVideo"/g) || []).length !== 1) {
  fail("exactly one handVideo decoder element must exist");
}
const handWindowDecl = siteJs.match(
  /const\s+BENCH_WINDOWS\s*=\s*\{[\s\S]*?hand\s*:\s*(\[[^\]]+\])/
);
if (!handWindowDecl || handWindowDecl[1].replace(/\s+/g, "") !== "[0,4.466667]") {
  fail("BENCH_WINDOWS.hand must be exactly [0, 4.466667] (full derived cycle)");
}
if (/const\s+BENCH_WINDOWS\s*=\s*\{[\s\S]*?hand\s*:\s*\[\s*5\.75\s*,\s*0\.95\s*\]/.test(siteJs)) {
  fail("retired BENCH_WINDOWS.hand [5.75, 0.95] must be absent from hand declaration");
}
if (/const\s+BENCH_WINDOWS\s*=\s*\{[\s\S]*?hand\s*:\s*\[\s*5\.0\s*,\s*1\.8\s*\]/.test(siteJs)) {
  fail("retired BENCH_WINDOWS.hand [5.0, 1.8] must be absent from hand declaration");
}
const workThoughtA = "Bring Your Vision To Life";
const workThoughtB = "Looking for Inspiration or Want something now?";
if (!index.includes(workThoughtA)) {
  fail("#workThoughtRest must use the exact first terminal headline");
}
if (index.includes("Bring Your Vision To Life With Rana")) {
  fail("#workThoughtRest must not keep the trailing With Rana");
}
if (!index.includes(workThoughtB)) {
  fail("#workThoughtReady must use the exact second terminal headline");
}
if (
  index.includes("Work with Rana to bring your Custom Design to Life") ||
  index.includes("Bring your Custom Design to Life with Rana") ||
  index.includes("Looking for Inspiration or Want something now? Click Ready Now Below") ||
  index.includes("See what's ready now or work with Rana to bring your Custom Design to Life.") ||
  index.includes("See what's ready now, or choose a design Rana can make for you.") ||
  index.includes("Designing Jewelry for nearly a Decade.")
) {
  fail("superseded homepage Work sentences must be absent");
}

// --- Hand bench video leave / reverse re-entry lifecycle ---
// Source invariants that protect reverse re-entry of the lap beat: leave must
// put the video in a coherent inactive state; re-entry must be able to arm,
// seek inside the lap window, play, and regain is-live without a hard-fail stick.
const setVideoActiveFn = siteJs.match(
  /function\s+setVideoActive\s*\(\s*video\s*,\s*active\s*,\s*armedFlag\s*\)\s*\{[\s\S]*?\n  \}/
);
if (!setVideoActiveFn) {
  fail("setVideoActive(video, active, armedFlag) must remain in site.js");
}
const setVideoActiveBody = setVideoActiveFn[0];
// Inactive leave path must invalidate arm generation, pause, and drop is-live.
if (!/invalidateDeferredArm\s*\(\s*video\s*\)/.test(setVideoActiveBody)) {
  fail("setVideoActive leave path must invalidateDeferredArm so re-entry can re-arm");
}
if (!/classList\.remove\(\s*["']is-live["']\s*\)/.test(setVideoActiveBody)) {
  fail("setVideoActive must remove is-live on leave / quiet (coherent inactive state)");
}
if (!/state\[armedFlag\]\s*=\s*false/.test(setVideoActiveBody)) {
  fail("setVideoActive must clear armedFlag on leave so reverse re-entry is a fresh arm");
}
// Retired leave shape: only invalidate when already arming/failed (skips successful live leave).
if (
  /if\s*\(\s*video\._deferArming\s*\|\|\s*video\._deferFailed\s*\)\s*\{\s*invalidateDeferredArm\s*\(\s*video\s*\)\s*;\s*\}/.test(
    setVideoActiveBody
  )
) {
  fail(
    "setVideoActive must not gate leave invalidation on only _deferArming||_deferFailed (successful live leave must tear down too)"
  );
}
// Activity arms hand video for the whole Hand occupancy — no mid-beat poster gate.
if (/setVideoActive\s*\(\s*handVideo\s*,\s*[^)]*handP\s*[<>]=?\s*/.test(siteJs)) {
  fail("handVideo must not use an artificial handP cutoff; that exposes the static poster mid-Hand");
}
if (
  !/setVideoActive\s*\(\s*handVideo\s*,\s*handActive\s*,\s*["']handVideoArmed["']\s*\)/.test(
    siteJs
  )
) {
  fail("hand activity must call setVideoActive(handVideo, handActive, 'handVideoArmed')");
}
// armDeferredPlayback remains the sole hydrate→seek→play path (no scroll-seeking).
if (!/function\s+armDeferredPlayback\s*\(\s*video\s*,\s*startAt\s*\)/.test(siteJs)) {
  fail("armDeferredPlayback must remain for deferred hydrate→seek→play");
}
if (!/function\s+playAndMarkLive\s*\(\s*video\s*,\s*generation\s*\)/.test(siteJs)) {
  fail("playAndMarkLive must remain generation-gated for is-live ownership");
}
// Stale generation must not tear down a newer arm's live state.
const playAndMarkLiveFn = siteJs.match(
  /function\s+playAndMarkLive\s*\(\s*video\s*,\s*generation\s*\)\s*\{[\s\S]*?\n  \}/
);
if (!playAndMarkLiveFn) {
  fail("playAndMarkLive body must be extractable");
}
if (
  /if\s*\(\s*mediaQuietActive\s*\(\s*\)\s*\|\|\s*video\._deferGen\s*!==\s*generation\s*\)\s*\{[\s\S]{0,120}classList\.remove\(\s*["']is-live["']\s*\)/.test(
    playAndMarkLiveFn[0]
  )
) {
  fail(
    "playAndMarkLive must not pause/remove is-live on stale generation (stale arms must be side-effect free)"
  );
}
// Paused reverse re-entry must re-apply the window seek (not short-circuit while paused).
if (
  !/!video\.paused\s*&&\s*!video\.seeking\s*&&\s*nearTarget\s*\(\s*\)/.test(siteJs)
) {
  fail("seekVideoTo must only short-circuit when already advancing near target (paused re-entry re-seeks)");
}
// seekVideoTo must not const-TDZ on timer when early near-target done() runs
// (that rejection set _deferFailed and stuck reverse re-entry on the poster).
const seekVideoToFn = siteJs.match(
  /function\s+seekVideoTo\s*\(\s*video\s*,\s*targetTime\s*\)\s*\{[\s\S]*?\n  \}/
);
if (!seekVideoToFn) {
  fail("seekVideoTo must remain extractable");
}
if (!/let\s+timer\s*=\s*null\s*;/.test(seekVideoToFn[0])) {
  fail("seekVideoTo must declare let timer = null before any done() path (no const-TDZ on early resolve)");
}
if (/const\s+timer\s*=\s*setTimeout/.test(seekVideoToFn[0])) {
  fail("seekVideoTo must not const-declare timer after done() can run (TDZ rejects arm → _deferFailed stick)");
}
// Quiet mode remains poster-only / source-sparing for deferred bench media.
if (!/mediaQuietActive\s*\(\s*\)/.test(setVideoActiveBody)) {
  fail("setVideoActive must still gate on mediaQuietActive for quiet poster-only mode");
}

// Shell current-route + Index still present.
if (!/function\s+markPrimaryNavCurrent\s*\(/.test(shellJs)) {
  fail("shell.js must mark primary nav current route");
}
if (!/function\s+setupIndex\s*\(/.test(shellJs)) {
  fail("shell.js Index setup must remain");
}
if (!/aria-current/.test(shellJs)) fail("shell.js must set aria-current");

// Opening uses owner-approved cluster→product→bench→engraving emotional recut
// (not banner, cluster-only rotation, or bench-first rotation).
assertIncludes(
  index,
  'data-desktop-src="assets/studio-opening-cluster-bench-engraving.mp4"',
  "desktop studio cluster-bench-engraving asset"
);
assertIncludes(
  index,
  'data-desktop-src="assets/ring-alexandrite.mp4"',
  "desktop ring asset"
);
assertIncludes(
  index,
  'data-mobile-src="assets/studio-opening-cluster-bench-engraving-mobile-wide.mp4"',
  "mobile studio wider-frame portrait"
);
assertIncludes(
  index,
  'data-mobile-src="assets/ring-alexandrite-portrait.mp4"',
  "mobile ring portrait"
);
assertIncludes(
  index,
  'data-desktop-src="assets/studio-opening-cluster-bench-engraving.jpg"',
  "desktop studio cluster-bench-engraving still"
);
assertIncludes(
  index,
  'data-mobile-src="assets/studio-opening-cluster-bench-engraving-mobile-wide.jpg"',
  "mobile studio wider-frame still"
);
// Opening must not retain superseded montage rotations as film authority.
const openingWorldSlice = index.slice(
  index.indexOf('id="worldStudio"'),
  index.indexOf('id="worldRing"')
);
if (/studio-banner(?:-portrait)?\.mp4/.test(openingWorldSlice)) {
  fail("opening world must not use pre-rotation studio-banner as film authority");
}
if (/studio-opening-cluster(?:-portrait)?\.(?:mp4|jpg)/.test(openingWorldSlice)) {
  fail("opening world must not retain prior cluster-only opening as film/still authority");
}
if (/studio-opening-bench-engraving(?:-portrait)?\.(?:mp4|jpg)/.test(openingWorldSlice)) {
  fail("opening world must not retain prior bench-first opening as film/still authority");
}
if (
  !/studio-opening-cluster-bench-engraving\.mp4/.test(openingWorldSlice) ||
  !/studio-opening-cluster-bench-engraving-mobile-wide\.mp4/.test(openingWorldSlice)
) {
  fail(
    "opening world must pin desktop cluster-bench-engraving film and the wider-frame mobile portrait"
  );
}

// Required routes exist.
const routes = [
  "index.html",
  "ready.html",
  "made.html",
  "consultation.html",
  "faq.html",
  "services.html",
  "gallery.html",
  "journal.html",
  "privacy.html",
  "terms.html",
];
for (const rel of routes) {
  if (!fs.existsSync(path.join(root, rel))) fail(`missing route ${rel}`);
}

// No framework / package.json introduced.
if (fs.existsSync(path.join(root, "package.json"))) {
  fail("must not add package.json / framework dependency surface");
}

console.log(
  "PASS: mobile full-site from oracle (opening preserved; direct bench Hand passage; 2-col catalog; sharp product/held/gallery frames; nowrap shell nav; mobile chrome scrolls with composition (no transparent-fixed overlap); consultation opening-sketch→ink ground (no fixed pale paper / Frame-Filler); no mobile work-echo/rest-wash; route grounds; desktop 3-col + assets intact)"
);
