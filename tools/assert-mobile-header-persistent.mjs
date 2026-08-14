#!/usr/bin/env node
/**
 * Fail-before / pass-after: the approved mobile opening-rest header must
 * remain for the entire homepage passage. Exact parent 562fda7 lerps the
 * mark to the upper-left, fades #sitePrimaryNav, and reveals Index.
 * The candidate must keep the centered official mark and four full
 * destinations at every progress, hide compact Index, and leave desktop
 * unchanged.
 *
 * Usage: node tools/assert-mobile-header-persistent.mjs
 *
 * Residue: mobile-header-persistent tripwire
 * Disposition: focused test or tripwire
 * Future consumer: any operator editing homepage mobile header / mark / Index chrome
 * Activation: execute — node tools/assert-mobile-header-persistent.mjs
 * Behavioral check: PASS when stdout includes "PASS:" and exit 0
 * Retirement: when the persistent opening-rest mobile header contract is retired or superseded
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PARENT = "562fda7d49d6876ec147a1d48c795af19aed565a";
const WIDTHS = [320, 375, 430];
const PROGRESS = [0, 0.03, 0.1, 0.16, 0.34, 0.55, 0.86, 1];
const DESKTOP_WIDTH = 1280;
const MARK_END = 0.34;

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
    maxBuffer: 8 * 1024 * 1024
  }).replace(/\r\n?/g, "\n");
}

function extractFn(src, name) {
  const re = new RegExp("function\\s+" + name + "\\s*\\(");
  const match = re.exec(src);
  if (!match) return "";
  const brace = src.indexOf("{", match.index);
  if (brace < 0) return "";
  let depth = 0;
  for (let j = brace; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") {
      depth--;
      if (depth === 0) return src.slice(match.index, j + 1);
    }
  }
  return "";
}

function extractBalancedFrom(src, startIdx) {
  const brace = src.indexOf("{", startIdx);
  if (brace < 0) return "";
  let depth = 0;
  for (let j = brace; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") {
      depth--;
      if (depth === 0) return src.slice(startIdx, j + 1);
    }
  }
  return "";
}

function extractMobileSlice(src) {
  const q = "@media (max-width: 700px)";
  const idx = src.indexOf(q);
  if (idx < 0) return "";
  return extractBalancedFrom(src, idx);
}

function extractRule(src, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped + "\\s*\\{", "g");
  while (true) {
    const match = re.exec(src);
    if (!match) return "";
    let i = match.index;
    while (i > 0 && /\s/.test(src[i - 1])) i--;
    if (i > 0 && src[i - 1] === ",") continue;
    return extractBalancedFrom(src, match.index);
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function smoothstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function windowProgress(p, start, end) {
  if (end <= start) return p >= end ? 1 : 0;
  return smoothstep((p - start) / (end - start));
}

function approvedMark(width) {
  const widthPx = Math.min(0.46 * width, 176);
  return {
    widthPx,
    top: 1.6,
    leftPx: (width - widthPx) / 2
  };
}

function parentCollapsedMark(width) {
  const widthPx = Math.min(0.28 * width, 120);
  return {
    widthPx,
    top: 3.4,
    leftPx: 0.05 * width
  };
}

function parsePx(value) {
  return Number(String(value).replace(/px$/, ""));
}

function parseSvh(value) {
  return Number(String(value).replace(/svh$/, ""));
}

function makeStyle() {
  const store = Object.create(null);
  return {
    setProperty(name, value) {
      store[name] = String(value);
    },
    removeProperty(name) {
      delete store[name];
    },
    getPropertyValue(name) {
      return store[name] || "";
    },
    get width() {
      return store.width || "";
    },
    set width(v) {
      store.width = v;
    },
    get top() {
      return store.top || "";
    },
    set top(v) {
      store.top = v;
    },
    get left() {
      return store.left || "";
    },
    set left(v) {
      store.left = v;
    },
    get transform() {
      return store.transform || "";
    },
    set transform(v) {
      store.transform = v;
    },
    get opacity() {
      return store.opacity || "";
    },
    set opacity(v) {
      store.opacity = v;
    },
    get visibility() {
      return store.visibility || "";
    },
    set visibility(v) {
      store.visibility = v;
    },
    get pointerEvents() {
      return store.pointerEvents || "";
    },
    set pointerEvents(v) {
      store.pointerEvents = v;
    }
  };
}

function makeEl() {
  const classes = new Set();
  const attrs = Object.create(null);
  return {
    style: makeStyle(),
    hidden: false,
    classList: {
      add(name) {
        classes.add(name);
      },
      remove(name) {
        classes.delete(name);
      },
      toggle(name, force) {
        if (force === true) classes.add(name);
        else if (force === false) classes.delete(name);
        else if (classes.has(name)) classes.delete(name);
        else classes.add(name);
        return classes.has(name);
      },
      contains(name) {
        return classes.has(name);
      }
    },
    setAttribute(name, value) {
      attrs[name] = String(value);
    },
    removeAttribute(name) {
      delete attrs[name];
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
    _attrs: attrs,
    _classes: classes
  };
}

function compileApplyMark(fnSrc) {
  return new Function(
    "markEl",
    "state",
    "MOTION",
    "windowProgress",
    "lerp",
    "window",
    fnSrc + "\nreturn applyMark;"
  );
}

function compileApplyHeaderChrome(fnSrc) {
  return new Function(
    "siteHeader",
    "sitePrimaryNav",
    "siteChromeCompact",
    "siteIndexToggle",
    "markEl",
    "state",
    "MOTION",
    "windowProgress",
    "setIndexOpen",
    fnSrc + "\nreturn applyHeaderChrome;"
  );
}

function compileApplyPersistentMark(fnSrc) {
  return new Function(
    "persistentMark",
    "state",
    "window",
    "opening",
    "openingMark",
    "setPersistentMarkInteractive",
    fnSrc + "\nreturn applyPersistentMark;"
  );
}

function runApplyMark(fnSrc, opts) {
  const markEl = makeEl();
  const applyMark = compileApplyMark(fnSrc)(
    markEl,
    { isMobile: !!opts.mobile },
    { markStart: 0.06, markEnd: MARK_END },
    windowProgress,
    lerp,
    { innerWidth: opts.width }
  );
  applyMark(opts.progress);
  return {
    widthPx: parsePx(markEl.style.width),
    top: parseSvh(markEl.style.top),
    leftPx: parsePx(markEl.style.left),
    transform: markEl.style.transform
  };
}

function runApplyPersistentMark(fnSrc, opts) {
  const persistentMark = makeEl();
  const openingMark = makeEl();
  openingMark.style.opacity = "0.94";
  let interactive = null;
  const applyPersistentMark = compileApplyPersistentMark(fnSrc)(
    persistentMark,
    { isMobile: !!opts.mobile },
    {
      innerWidth: opts.width,
      innerHeight: opts.height || 812
    },
    {
      getBoundingClientRect() {
        return { bottom: opts.openingBottom == null ? 900 : opts.openingBottom };
      }
    },
    openingMark,
    function setPersistentMarkInteractive(active) {
      interactive = !!active;
    }
  );
  applyPersistentMark(opts.progress);
  return {
    widthPx: parsePx(persistentMark.style.width),
    top: parseSvh(persistentMark.style.top),
    leftPx: parsePx(persistentMark.style.left),
    opacity: Number(persistentMark.style.opacity),
    interactive,
    openingOpacity: openingMark.style.opacity
  };
}

function runApplyHeaderChrome(fnSrc, opts) {
  const siteHeader = makeEl();
  const sitePrimaryNav = makeEl();
  const siteChromeCompact = makeEl();
  const siteIndexToggle = makeEl();
  siteIndexToggle.setAttribute("tabindex", "-1");
  const markEl = makeEl();
  const closed = [];
  const state = {
    isMobile: !!opts.mobile,
    headerYield: 0.99,
    indexOpen: opts.indexOpen === true
  };
  const applyHeaderChrome = compileApplyHeaderChrome(fnSrc)(
    siteHeader,
    sitePrimaryNav,
    siteChromeCompact,
    siteIndexToggle,
    markEl,
    state,
    { markStart: 0.06, markEnd: MARK_END },
    windowProgress,
    function setIndexOpen(open) {
      state.indexOpen = !!open;
      closed.push(!!open);
    }
  );
  applyHeaderChrome(opts.progress);
  return {
    headerYield: state.headerYield,
    passageActive: siteHeader.classList.contains("is-passage-active"),
    headerYieldVar: siteHeader.style.getPropertyValue("--header-yield"),
    navOpacity: sitePrimaryNav.style.opacity,
    navVisibility: sitePrimaryNav.style.visibility,
    navPointer: sitePrimaryNav.style.pointerEvents,
    compactOpacity: siteChromeCompact.style.opacity,
    compactVisibility: siteChromeCompact.style.visibility,
    compactPointer: siteChromeCompact.style.pointerEvents,
    indexTabindex: siteIndexToggle.getAttribute("tabindex"),
    indexOpen: state.indexOpen,
    indexCalls: closed
  };
}

function almostEqual(a, b, eps) {
  return Math.abs(a - b) <= (eps == null ? 1e-9 : eps);
}

function sameBox(got, want, label) {
  if (!almostEqual(got.widthPx, want.widthPx)) {
    fail(label + " width " + got.widthPx + " !== " + want.widthPx);
  }
  if (!almostEqual(got.top, want.top)) {
    fail(label + " top " + got.top + " !== " + want.top);
  }
  if (!almostEqual(got.leftPx, want.leftPx)) {
    fail(label + " left " + got.leftPx + " !== " + want.leftPx);
  }
}

function extractMobileBranch(fnSrc) {
  const idx = fnSrc.indexOf("if (mobile)");
  if (idx < 0) return "";
  return extractBalancedFrom(fnSrc, idx);
}

function extractDesktopElse(fnSrc) {
  const mobileIdx = fnSrc.indexOf("if (mobile)");
  if (mobileIdx < 0) return "";
  const elseIdx = fnSrc.indexOf("} else {", mobileIdx);
  if (elseIdx < 0) return "";
  return extractBalancedFrom(fnSrc, elseIdx + 2);
}

function extractDesktopHeaderPath(fnSrc) {
  const idx = fnSrc.indexOf("if (!mobile)");
  if (idx < 0) return "";
  return extractBalancedFrom(fnSrc, idx);
}

const parentSha = execFileSync("git", ["rev-parse", "--verify", PARENT], {
  cwd: root,
  encoding: "utf8"
}).trim();
if (parentSha !== PARENT) fail("exact parent " + PARENT + " must be present in this worktree");

const candidateIndex = read("index.html");
const candidateSite = read("site.js");
const candidateStyles = read("styles.css");
const parentIndex = gitShow(PARENT, "index.html");
const parentSite = gitShow(PARENT, "site.js");
const parentStyles = gitShow(PARENT, "styles.css");

const parentApplyMark = extractFn(parentIndex, "applyMark");
const candidateApplyMark = extractFn(candidateIndex, "applyMark");
const parentApplyChrome = extractFn(parentIndex, "applyHeaderChrome");
const candidateApplyChrome = extractFn(candidateIndex, "applyHeaderChrome");
const parentApplyPersistent = extractFn(parentSite, "applyPersistentMark");
const candidateApplyPersistent = extractFn(candidateSite, "applyPersistentMark");

if (!parentApplyMark || !candidateApplyMark) fail("could not extract applyMark");
if (!parentApplyChrome || !candidateApplyChrome) fail("could not extract applyHeaderChrome");
if (!parentApplyPersistent || !candidateApplyPersistent) {
  fail("could not extract applyPersistentMark");
}

// Parent must still be the collapsing implementation.
if (!/0\.28\s*\*\s*vw/.test(extractMobileBranch(parentApplyMark))) {
  fail("exact parent applyMark must lerp mobile mark to min(28vw, 120px)");
}
if (!/lerp\(\s*1\.6\s*,\s*3\.4/.test(extractMobileBranch(parentApplyMark))) {
  fail("exact parent applyMark must lerp mobile mark top 1.6 → 3.4");
}
if (!/0\.05\s*\*\s*vw/.test(extractMobileBranch(parentApplyMark))) {
  fail("exact parent applyMark must lerp mobile mark toward left 5vw");
}
if (!/1\s*-\s*yieldT/.test(parentApplyChrome) || !/yieldT\s*>\s*0\.55/.test(parentApplyChrome)) {
  fail("exact parent applyHeaderChrome must fade primary nav and reveal compact after yieldT > 0.55");
}
if (!/0\.28\s*\*\s*vw/.test(extractMobileBranch(parentApplyPersistent))) {
  fail("exact parent applyPersistentMark must park the mobile clone at min(28vw, 120px)");
}
if (!/top\s*=\s*3\.4/.test(extractMobileBranch(parentApplyPersistent))) {
  fail("exact parent applyPersistentMark must use top 3.4svh on mobile");
}

const parentStylesMobile = extractMobileSlice(parentStyles);
const parentPersistentCss = extractRule(parentStylesMobile, ".persistent-mark");
if (!/min\(\s*28vw\s*,\s*7\.5rem\s*\)/.test(parentPersistentCss)) {
  fail("exact parent mobile .persistent-mark must default to min(28vw, 7.5rem)");
}
if (!/left:\s*5vw/.test(parentPersistentCss)) {
  fail("exact parent mobile .persistent-mark must default to left: 5vw");
}

// Candidate must not keep the collapse formulas on mobile.
if (/0\.28\s*\*\s*vw|7\.5rem|left:\s*5vw|top\s*=\s*3\.4/.test(extractMobileBranch(candidateApplyMark))) {
  fail("candidate applyMark must not keep compact mobile mark geometry");
}
if (/0\.28\s*\*\s*vw|top\s*=\s*3\.4|0\.05\s*\*\s*vw/.test(extractMobileBranch(candidateApplyPersistent))) {
  fail("candidate applyPersistentMark must not keep compact mobile mark geometry");
}
if (/yieldT|restOpacity|compactOn/.test(candidateApplyChrome)) {
  fail("candidate applyHeaderChrome must not keep the mobile yield/compact clock");
}
if (!/opacity\s*=\s*"1"/.test(candidateApplyChrome) || !/visibility\s*=\s*"visible"/.test(candidateApplyChrome)) {
  fail("candidate applyHeaderChrome must force #sitePrimaryNav visible at opacity 1");
}
if (!/pointerEvents\s*=\s*"auto"/.test(candidateApplyChrome)) {
  fail("candidate applyHeaderChrome must keep #sitePrimaryNav pointer-active");
}
if (!/tabindex["']\s*,\s*["']-1["']/.test(candidateApplyChrome)) {
  fail("candidate applyHeaderChrome must keep the Index toggle out of tab order");
}
if (!/state\.indexOpen\)\s*setIndexOpen\(\s*false\s*\)/.test(candidateApplyChrome)) {
  fail("candidate applyHeaderChrome must close an already-open Index panel");
}

const candidateStylesMobile = extractMobileSlice(candidateStyles);
const candidatePersistentCss = extractRule(candidateStylesMobile, ".persistent-mark");
if (!/min\(\s*46vw\s*,\s*11rem\s*\)/.test(candidatePersistentCss)) {
  fail("candidate mobile .persistent-mark must use approved width min(46vw, 11rem)");
}
if (!/1\.6svh/.test(candidatePersistentCss)) {
  fail("candidate mobile .persistent-mark must stay in the opening top band (1.6svh)");
}
if (!/50%\s*-\s*min\(\s*46vw\s*,\s*11rem\s*\)\s*\/\s*2/.test(candidatePersistentCss)) {
  fail("candidate mobile .persistent-mark must stay horizontally centered");
}

const candidateNavCss = extractRule(candidateStylesMobile, ".site-primary-nav");
const candidateNavLinkCss = extractRule(candidateStylesMobile, ".site-primary-nav a");
if (!/flex-wrap:\s*nowrap/.test(candidateNavCss)) {
  fail("mobile #sitePrimaryNav must keep one nowrap row");
}
if (!/space-between/.test(candidateNavCss)) {
  fail("mobile #sitePrimaryNav must keep space-between distribution");
}
if (!/min-height:\s*44px/.test(candidateNavLinkCss) || !/min-width:\s*44px/.test(candidateNavLinkCss)) {
  fail("mobile primary links must keep 44px touch targets");
}
if (!/white-space:\s*nowrap/.test(candidateNavLinkCss)) {
  fail("mobile primary links must stay nowrap");
}

const forbidden = [
  "backdrop-filter",
  "filter: blur",
  "filter:blur",
  "-webkit-backdrop-filter",
  "letterbox",
  "vignette"
];
const headerSurfaces = [
  candidateNavCss,
  candidateNavLinkCss,
  candidatePersistentCss,
  extractRule(candidateStylesMobile, ".site-chrome-compact"),
  extractMobileBranch(candidateApplyMark),
  extractMobileBranch(candidateApplyPersistent),
  candidateApplyChrome
].join("\n");
for (const token of forbidden) {
  if (headerSurfaces.toLowerCase().includes(token)) {
    fail("header correction must not add visual treatment " + token);
  }
}

// Desktop implementations must stay byte-identical in the desktop branches.
if (extractDesktopElse(parentApplyMark) !== extractDesktopElse(candidateApplyMark)) {
  fail("desktop applyMark path must remain unchanged");
}
if (extractDesktopElse(parentApplyPersistent) !== extractDesktopElse(candidateApplyPersistent)) {
  fail("desktop applyPersistentMark path must remain unchanged");
}
if (extractDesktopHeaderPath(parentApplyChrome) !== extractDesktopHeaderPath(candidateApplyChrome)) {
  fail("desktop applyHeaderChrome path must remain unchanged");
}

const reported = [];

// Fail-before: parent collapses after the opening rest.
WIDTHS.forEach((width) => {
  const wantOpen = approvedMark(width);
  const wantCompact = parentCollapsedMark(width);
  const parentOpen = runApplyMark(parentApplyMark, { mobile: true, width, progress: 0 });
  sameBox(parentOpen, wantOpen, "parent applyMark progress=0 @" + width);
  const parentDone = runApplyMark(parentApplyMark, { mobile: true, width, progress: 1 });
  sameBox(parentDone, wantCompact, "parent applyMark progress=1 @" + width);
  if (almostEqual(parentDone.widthPx, wantOpen.widthPx) && almostEqual(parentDone.leftPx, wantOpen.leftPx)) {
    fail("exact parent applyMark must change mobile geometry by progress=1 @" + width);
  }
  const parentPersist = runApplyPersistentMark(parentApplyPersistent, {
    mobile: true,
    width,
    progress: 1
  });
  sameBox(parentPersist, wantCompact, "parent applyPersistentMark progress=1 @" + width);

  const parentChromeOpen = runApplyHeaderChrome(parentApplyChrome, {
    mobile: true,
    width,
    progress: 0
  });
  if (parentChromeOpen.navOpacity !== "1") {
    fail("parent opening-rest nav should still be opacity 1");
  }
  const parentChromeDone = runApplyHeaderChrome(parentApplyChrome, {
    mobile: true,
    width,
    progress: 1,
    indexOpen: true
  });
  if (parentChromeDone.navOpacity !== "0") {
    fail("exact parent must fade #sitePrimaryNav to 0 by progress=1 (got " + parentChromeDone.navOpacity + ")");
  }
  if (parentChromeDone.navVisibility !== "hidden" || parentChromeDone.navPointer !== "none") {
    fail("exact parent must hide and disable #sitePrimaryNav after yield");
  }
  if (parentChromeDone.compactVisibility !== "visible" || parentChromeDone.compactPointer !== "auto") {
    fail("exact parent must reveal #siteChromeCompact / Index after yieldT > 0.55");
  }
  if (parentChromeDone.indexTabindex !== null) {
    fail("exact parent must admit the Index toggle to tab order after yield");
  }
});

// Pass-after: candidate geometry is invariant and shared.
WIDTHS.forEach((width) => {
  const want = approvedMark(width);
  const navPad = 0.35 * 16 * 2;
  if (4 * 44 + navPad > width) {
    fail("four 44px targets plus existing side padding overflow " + width);
  }
  const markBottom = 1.6 + want.widthPx * 0.34;
  const navTop = 1.6 + want.widthPx * 0.34 + 0.45 * 16;
  if (!(navTop > markBottom)) {
    fail("mark and nav overlap at width " + width);
  }

  PROGRESS.forEach((progress) => {
    const opening = runApplyMark(candidateApplyMark, { mobile: true, width, progress });
    sameBox(opening, want, "candidate applyMark p=" + progress + " @" + width);
    const persist = runApplyPersistentMark(candidateApplyPersistent, {
      mobile: true,
      width,
      progress,
      openingBottom: 900
    });
    sameBox(persist, want, "candidate applyPersistentMark p=" + progress + " @" + width);
    if (progress < MARK_END) {
      if (persist.opacity !== 0 || persist.interactive !== false || persist.openingOpacity !== "0.94") {
        fail("before markEnd the persistent plate must stay hidden and the opening plate visible");
      }
      const early = runApplyPersistentMark(candidateApplyPersistent, {
        mobile: true,
        width,
        progress,
        openingBottom: 10
      });
      sameBox(early, want, "candidate early-swap applyPersistentMark p=" + progress + " @" + width);
      if (early.opacity !== 0.94 || early.interactive !== true || early.openingOpacity !== "0") {
        fail("mobile must not stack both plates when the persistent mark shows before markEnd");
      }
    } else {
      if (persist.opacity !== 0.94 || persist.interactive !== true || persist.openingOpacity !== "0") {
        fail("at/after markEnd the persistent plate must replace the opening plate with no dual paint");
      }
    }

    const chrome = runApplyHeaderChrome(candidateApplyChrome, {
      mobile: true,
      width,
      progress,
      indexOpen: true
    });
    if (chrome.headerYield !== 0 || chrome.passageActive) {
      fail("candidate must not enter passage-yield chrome at p=" + progress);
    }
    if (chrome.navOpacity !== "1" || chrome.navVisibility !== "visible" || chrome.navPointer !== "auto") {
      fail("candidate must force #sitePrimaryNav visible/interactive at p=" + progress);
    }
    if (
      chrome.compactOpacity !== "0" ||
      chrome.compactVisibility !== "hidden" ||
      chrome.compactPointer !== "none"
    ) {
      fail("candidate must keep #siteChromeCompact hidden/inert at p=" + progress);
    }
    if (chrome.indexTabindex !== "-1") {
      fail("candidate Index toggle must stay out of tab order at p=" + progress);
    }
    if (chrome.indexOpen !== false || chrome.indexCalls[0] !== false) {
      fail("candidate must close an already-open Index panel when rendering resumes");
    }
  });

  reported.push({
    width,
    mark: want,
    navTopCss: "1.6svh + min(46vw,11rem)*0.34 + 0.45rem"
  });
});

// Desktop executable path: parent and candidate emit the same numbers.
[0, 0.2, MARK_END, 1].forEach((progress) => {
  const parentMark = runApplyMark(parentApplyMark, {
    mobile: false,
    width: DESKTOP_WIDTH,
    progress
  });
  const candidateMark = runApplyMark(candidateApplyMark, {
    mobile: false,
    width: DESKTOP_WIDTH,
    progress
  });
  sameBox(candidateMark, parentMark, "desktop applyMark p=" + progress);
  const parentPersist = runApplyPersistentMark(parentApplyPersistent, {
    mobile: false,
    width: DESKTOP_WIDTH,
    progress
  });
  const candidatePersist = runApplyPersistentMark(candidateApplyPersistent, {
    mobile: false,
    width: DESKTOP_WIDTH,
    progress
  });
  sameBox(candidatePersist, parentPersist, "desktop applyPersistentMark p=" + progress);
  if (candidatePersist.opacity !== parentPersist.opacity) {
    fail("desktop persistent opacity must remain unchanged at p=" + progress);
  }
  if (candidatePersist.openingOpacity !== parentPersist.openingOpacity) {
    fail("desktop opening-plate swap must remain unchanged at p=" + progress);
  }
  const parentEarly = runApplyPersistentMark(parentApplyPersistent, {
    mobile: false,
    width: DESKTOP_WIDTH,
    progress,
    openingBottom: 10
  });
  const candidateEarly = runApplyPersistentMark(candidateApplyPersistent, {
    mobile: false,
    width: DESKTOP_WIDTH,
    progress,
    openingBottom: 10
  });
  if (candidateEarly.openingOpacity !== parentEarly.openingOpacity) {
    fail("desktop must still hide the opening plate only at markEnd, even if the section has left");
  }
  const parentChrome = runApplyHeaderChrome(parentApplyChrome, {
    mobile: false,
    width: DESKTOP_WIDTH,
    progress,
    indexOpen: true
  });
  const candidateChrome = runApplyHeaderChrome(candidateApplyChrome, {
    mobile: false,
    width: DESKTOP_WIDTH,
    progress,
    indexOpen: true
  });
  if (JSON.stringify(parentChrome) !== JSON.stringify(candidateChrome)) {
    fail("desktop applyHeaderChrome result must remain unchanged at p=" + progress);
  }
});

// Route links and four labels remain the homepage destinations.
if (
  !/id="sitePrimaryNav"[\s\S]*Ready Now[\s\S]*Made To Order[\s\S]*Consultation[\s\S]*FAQ/.test(
    candidateIndex
  )
) {
  fail("homepage must keep the four full destination labels");
}

console.log(
  "PASS: mobile header stays the approved opening-rest (parent 562fda7 collapses mark/nav to Index; candidate keeps centered min(46vw,176px) mark + four links; opening/persistent geometry invariant; compact Index hidden/inert; desktop unchanged)"
);
console.log(JSON.stringify(reported));
