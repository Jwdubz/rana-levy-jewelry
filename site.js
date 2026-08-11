/* RANA LEVY full-site motion — single clock via opening rAF hook */
(function () {
  "use strict";

  const SITE_MOTION = {
    sectionTau: 0.34,
    junctionAngles: [41, 74, 33, 56],
    junctionAnglesMobile: [19, 34, 22, 31],
    junctionEdgeStart: -18,
    junctionEdgeEnd: 108,
    junctionEdgeStartMobile: -22,
    junctionEdgeEndMobile: 112,
    junctionFeather: 20,
    junctionFeatherFloor: 16,
    junctionLightPeak: 0.72,
    // Direct ring→bench carrier: former gem recession class re-homed on the bench.
    handBenchScaleStart: 1.28,
    handBenchScaleEnd: 1.02,
    handPortraitFeather: 34,
    // Surviving work worlds: art-deco, heirloom, pink-star terminal.
    workSpans: [1.00, 0.86, 0.94],
    workHoldFraction: 0.56,
    workScaleStart: 1.025,
    workScaleEnd: 1.0,
    restFloorLuma: 0.10,
    mobileMaxWidth: 700,
    mobileSpanScale: 0.82,
    /* Desktop portrait subject: face-centered radial reveal.
       Mobile uses edge-spanning angled handoff instead (no radial island). */
    portraitFocusDesktop: [78, 26],
    portraitFocusMobile: [86, 22]
  };

  const BENCH_WINDOWS = {
    hand: [5.0, 1.8]
  };

  // Post-opening completed-state dwell: one 60svh physical plateau at each
  // fully composed Hand / Work beat. Work is terminal.
  const BEAT_DWELL = {
    holdSvh: 60,
    // Fully composed word beats on the direct bench passage (fade durations preserved).
    hand: [0.28, 0.86],
    work: [0.28, 0.55, 0.88]
  };

  // Expose for inspection / verification.
  window.SITE_MOTION = SITE_MOTION;
  window.BENCH_WINDOWS = BENCH_WINDOWS;
  window.BEAT_DWELL = BEAT_DWELL;

  function urlQuietActive() {
    try {
      return new URLSearchParams(location.search).get("motion") === "quiet";
    } catch (e) {
      return false;
    }
  }

  // Quiet choreography is available only through the explicit URL mode.
  function quietModeActive() {
    if (urlQuietActive()) return true;
    if (typeof window.__ranaQuietModeActive === "function") {
      return !!window.__ranaQuietModeActive();
    }
    return false;
  }

  function syncQuietClasses() {
    const quiet = quietModeActive();
    document.documentElement.classList.toggle("is-quiet", quiet);
    if (document.body) document.body.classList.toggle("is-quiet", quiet);
    document.documentElement.classList.toggle("is-media-quiet", quiet);
  }

  syncQuietClasses();

  // Live media-quiet gate matches the explicit URL quiet mode.
  // Opening script owns the canonical helpers; fall back if this file is alone.
  function mediaQuietActive() {
    if (typeof window.__ranaMediaQuietActive === "function") {
      return !!window.__ranaMediaQuietActive();
    }
    return quietModeActive();
  }

  // Opening media still uses the direct streaming helper on window.
  // Deferred M2–M4 media never call it — they need seekable Blob URLs.
  function ensureVideoSource(video, preloadValue) {
    if (typeof window.__ranaEnsureVideoSource === "function") {
      return window.__ranaEnsureVideoSource(video, preloadValue);
    }
    if (!video) return false;
    const url = video.getAttribute("data-src");
    if (!url) {
      return !!(video.getAttribute("src") || video.currentSrc);
    }
    if (video.getAttribute("src") === url) return true;
    if (preloadValue) video.preload = preloadValue;
    video.setAttribute("src", url);
    try {
      video.load();
    } catch (e) {}
    return true;
  }

  // ——— Deferred seekable media registry (Blob URLs) ———
  // Non-range local servers report seekable [0,0] for direct <video src>, so
  // windowed Hand/Making seeks stick at 0. Same bytes via Blob URL are seekable.
  // One acquisition Promise per canonical data-src; Hand + Making share studio.
  const deferredBlobByUrl = Object.create(null);
  const deferredBlobPromiseByUrl = Object.create(null);
  const deferredFetchControllers = Object.create(null);
  let deferredBlobsRevoked = false;

  function abortDeferredFetches() {
    const keys = Object.keys(deferredFetchControllers);
    for (let i = 0; i < keys.length; i++) {
      const url = keys[i];
      const controller = deferredFetchControllers[url];
      delete deferredFetchControllers[url];
      if (controller) {
        try {
          controller.abort();
        } catch (e) {}
      }
    }
  }

  function revokeDeferredBlobs() {
    if (deferredBlobsRevoked) return;
    deferredBlobsRevoked = true;
    abortDeferredFetches();
    const keys = Object.keys(deferredBlobByUrl);
    for (let i = 0; i < keys.length; i++) {
      const url = keys[i];
      const blobUrl = deferredBlobByUrl[url];
      delete deferredBlobByUrl[url];
      delete deferredBlobPromiseByUrl[url];
      if (blobUrl) {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch (e) {}
      }
    }
  }

  function acquireDeferredBlobUrl(canonicalUrl) {
    if (!canonicalUrl || mediaQuietActive() || deferredBlobsRevoked) {
      return Promise.reject(new Error("deferred-media-unavailable"));
    }
    if (deferredBlobByUrl[canonicalUrl]) {
      return Promise.resolve(deferredBlobByUrl[canonicalUrl]);
    }
    if (deferredBlobPromiseByUrl[canonicalUrl]) {
      return deferredBlobPromiseByUrl[canonicalUrl];
    }

    let controller = null;
    try {
      controller = typeof AbortController === "function" ? new AbortController() : null;
    } catch (e) {
      controller = null;
    }
    if (controller) {
      deferredFetchControllers[canonicalUrl] = controller;
    }

    const promise = fetch(canonicalUrl, {
      credentials: "same-origin",
      signal: controller ? controller.signal : undefined
    })
      .then(function (response) {
        if (!response || !response.ok) {
          throw new Error("deferred-media-fetch-failed");
        }
        return response.blob();
      })
      .then(function (blob) {
        delete deferredFetchControllers[canonicalUrl];
        if (deferredBlobsRevoked) {
          throw new Error("deferred-media-revoked");
        }
        // Retain resolved bytes even if quiet flipped mid-flight; assignment
        // is still suppressed while quiet. Resume reuses this registry entry.
        const blobUrl = URL.createObjectURL(blob);
        deferredBlobByUrl[canonicalUrl] = blobUrl;
        return blobUrl;
      })
      .catch(function (err) {
        delete deferredFetchControllers[canonicalUrl];
        // Drop failed/aborted promise so a later normal-motion approach can retry.
        if (deferredBlobPromiseByUrl[canonicalUrl] === promise) {
          delete deferredBlobPromiseByUrl[canonicalUrl];
        }
        throw err;
      });

    deferredBlobPromiseByUrl[canonicalUrl] = promise;
    return promise;
  }

  function waitForVideoMetadata(video) {
    if (!video) return Promise.reject(new Error("no-video"));
    if (video.readyState >= 1 && isFinite(video.duration) && video.duration > 0) {
      return Promise.resolve();
    }
    return new Promise(function (resolve, reject) {
      let settled = false;
      const timer = setTimeout(function () {
        finish(function () {
          if (video.readyState >= 1) resolve();
          else reject(new Error("metadata-timeout"));
        });
      }, 8000);
      function finish(fn) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        video.removeEventListener("loadedmetadata", onMeta);
        video.removeEventListener("error", onErr);
        fn();
      }
      function onMeta() {
        finish(function () {
          resolve();
        });
      }
      function onErr() {
        finish(function () {
          reject(new Error("metadata-error"));
        });
      }
      video.addEventListener("loadedmetadata", onMeta);
      video.addEventListener("error", onErr);
    });
  }

  function seekVideoTo(video, targetTime) {
    if (!video) return Promise.resolve(false);
    const target = typeof targetTime === "number" && isFinite(targetTime) ? Math.max(0, targetTime) : 0;
    return new Promise(function (resolve) {
      let settled = false;
      function done(ok) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onErr);
        resolve(!!ok);
      }
      function nearTarget() {
        try {
          return Math.abs(video.currentTime - target) <= 0.2;
        } catch (e) {
          return false;
        }
      }
      // Already there and not mid-seek.
      if (!video.seeking && nearTarget() && video.readyState >= 1) {
        done(true);
        return;
      }
      const timer = setTimeout(function () {
        // Stuck seeking / non-seekable responses must not claim success.
        done(!video.seeking && nearTarget());
      }, 4000);
      function onSeeked() {
        done(nearTarget());
      }
      function onErr() {
        done(false);
      }
      video.addEventListener("seeked", onSeeked);
      video.addEventListener("error", onErr);
      try {
        video.currentTime = target;
      } catch (e) {
        done(false);
        return;
      }
      // Some engines apply the seek synchronously for Blob sources.
      if (!video.seeking && nearTarget()) {
        done(true);
      }
    });
  }

  function playAndMarkLive(video, generation) {
    if (!video) return Promise.resolve(false);
    if (mediaQuietActive() || video._deferGen !== generation) {
      try {
        video.pause();
      } catch (e) {}
      video.classList.remove("is-live");
      return Promise.resolve(false);
    }
    // Never mark live while still seeking or source-free.
    if (video.seeking || !(video.getAttribute("src") || video.currentSrc)) {
      video.classList.remove("is-live");
      return Promise.resolve(false);
    }
    let playResult;
    try {
      playResult = video.play();
    } catch (e) {
      video.classList.remove("is-live");
      return Promise.resolve(false);
    }
    if (playResult && typeof playResult.then === "function") {
      return playResult
        .then(function () {
          if (mediaQuietActive() || video._deferGen !== generation || video.seeking) {
            try {
              video.pause();
            } catch (e) {}
            video.classList.remove("is-live");
            return false;
          }
          video.classList.add("is-live");
          return true;
        })
        .catch(function () {
          video.classList.remove("is-live");
          return false;
        });
    }
    if (!video.paused && !video.seeking && !mediaQuietActive() && video._deferGen === generation) {
      video.classList.add("is-live");
      return Promise.resolve(true);
    }
    video.classList.remove("is-live");
    return Promise.resolve(false);
  }

  function invalidateDeferredArm(video) {
    if (!video) return;
    video._deferGen = (video._deferGen || 0) + 1;
    video._deferArming = false;
    // Quiet/reduce and beat leave may clear a hard fail so reduce→normal can retry.
    video._deferFailed = false;
  }

  function ensureDeferredVideoSource(video) {
    if (!video) return Promise.resolve(false);
    if (mediaQuietActive() || deferredBlobsRevoked) return Promise.resolve(false);
    const canonical = video.getAttribute("data-src");
    if (!canonical) {
      return Promise.resolve(!!(video.getAttribute("src") || video.currentSrc));
    }
    const existingBlob = deferredBlobByUrl[canonical];
    const currentSrc = video.getAttribute("src");
    if (existingBlob && currentSrc === existingBlob) {
      return Promise.resolve(true);
    }
    return acquireDeferredBlobUrl(canonical)
      .then(function (blobUrl) {
        if (mediaQuietActive() || deferredBlobsRevoked) return false;
        if (!blobUrl) return false;
        if (video.getAttribute("src") !== blobUrl) {
          video.preload = "auto";
          video.setAttribute("src", blobUrl);
          try {
            video.load();
          } catch (e) {}
        }
        return true;
      })
      .catch(function () {
        // Blob acquisition failed: leave poster up, never mark live.
        return false;
      });
  }

  function armDeferredPlayback(video, startAt) {
    if (!video || mediaQuietActive()) return;
    if (video._deferArming) return;
    // Hard failure (fetch/metadata/seek): stay poster-only; do not spin-refetch.
    // Quiet toggle clears this so reduce→normal can retry the cached registry.
    if (video._deferFailed) return;
    // Already genuinely live in a playable state — do not re-enter.
    if (
      !video.paused &&
      video.classList.contains("is-live") &&
      video.readyState >= 2 &&
      !video.seeking
    ) {
      return;
    }

    const generation = (video._deferGen || 0) + 1;
    video._deferGen = generation;
    video._deferArming = true;

    ensureDeferredVideoSource(video)
      .then(function (ok) {
        if (!ok || mediaQuietActive() || video._deferGen !== generation) {
          // Quiet/invalidate mid-flight is not a hard failure.
          if (!ok && !mediaQuietActive() && video._deferGen === generation) {
            video._deferFailed = true;
          }
          return false;
        }
        return waitForVideoMetadata(video).then(
          function () {
            return true;
          },
          function () {
            if (video._deferGen === generation && !mediaQuietActive()) {
              video._deferFailed = true;
            }
            return false;
          }
        );
      })
      .then(function (ready) {
        if (!ready || mediaQuietActive() || video._deferGen !== generation) {
          return false;
        }
        // Always seek to the intended window (including 0) so seekability is proven
        // before play; non-seekable paths fail closed without is-live.
        if (typeof startAt === "number" && isFinite(startAt)) {
          return seekVideoTo(video, startAt).then(function (seeked) {
            if (!seeked && video._deferGen === generation && !mediaQuietActive()) {
              video._deferFailed = true;
            }
            return seeked;
          });
        }
        return true;
      })
      .then(function (seekedOk) {
        if (!seekedOk || mediaQuietActive() || video._deferGen !== generation) {
          if (video._deferGen === generation) {
            video.classList.remove("is-live");
          }
          return false;
        }
        return playAndMarkLive(video, generation).then(function (played) {
          if (!played && video._deferGen === generation && !mediaQuietActive()) {
            // Autoplay block is not a hard media failure — allow later retry
            // when the same beat is still active (user gesture / browser policy).
            // Leave _deferFailed unset.
          }
          return played;
        });
      })
      .catch(function () {
        if (video._deferGen === generation) {
          video.classList.remove("is-live");
          if (!mediaQuietActive()) video._deferFailed = true;
        }
        return false;
      })
      .then(function () {
        if (video._deferGen === generation) {
          video._deferArming = false;
        }
      });
  }

  function benchKeyFor(video) {
    if (video === handVideo) return "hand";
    return null;
  }

  // Revoke only on a real page exit. bfcache (event.persisted) must keep Blob
  // URLs so a restored page can re-arm deferred motion without a blank registry.
  // No unload listener: it can disqualify bfcache in some browsers.
  window.addEventListener("pagehide", function (event) {
    if (event && event.persisted) return;
    revokeDeferredBlobs();
  });

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(t) {
    const x = clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
  }

  function windowProgress(p, start, end) {
    if (end <= start) return p >= end ? 1 : 0;
    return smoothstep((p - start) / (end - start));
  }

  function sectionProgress(el) {
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const total = Math.max(1, el.offsetHeight - window.innerHeight);
    return clamp(-rect.top / total, 0, 1);
  }

  function sectionProximity(el) {
    if (!el) return { progress: 0, near: false, visible: false };
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const total = Math.max(1, el.offsetHeight - vh);
    const progress = clamp(-rect.top / total, 0, 1);
    const visible = rect.bottom > -vh * 0.15 && rect.top < vh * 1.15;
    const near = rect.bottom > -vh * 0.5 && rect.top < vh * 1.5;
    return { progress: progress, near: near, visible: visible, rect: rect };
  }

  // Shared with the inline opening renderer (window.openingTimeline / OPENING_SPAN).
  // Maps raw physical opening progress → choreography timeline so mark swap and
  // MOTION cues stay locked to the same absolute scroll distances; the terminal
  // hold plateaus at 1. Falls back to identity only if the opening script failed.
  function remapOpeningProgress(physicalProgress) {
    if (typeof window.openingTimeline === "function") {
      return window.openingTimeline(physicalProgress);
    }
    const span = window.OPENING_SPAN;
    if (span && span.choreographySvh > 0 && span.terminalHoldSvh >= 0) {
      const end =
        span.choreographyEnd ||
        span.choreographySvh / (span.choreographySvh + span.terminalHoldSvh);
      return clamp(physicalProgress / end, 0, 1);
    }
    return clamp(physicalProgress, 0, 1);
  }

  // Generic physical-progress → choreography-progress remapper for M2–M4.
  // Total travel comes from the live sticky range; each plateau is holdSvh of
  // the layout viewport. Ordinary segments keep the pre-existing choreography
  // rate; each plateau returns its exact anchor; the map is monotonic 0→1.
  // Smooth raw physical progress once upstream; never smooth the remapped clock.
  function remapBeatProgress(el, physicalProgress, anchors) {
    const p = clamp(physicalProgress, 0, 1);
    if (!el || !anchors || !anchors.length) return p;
    if (p <= 0) return 0;
    if (p >= 1) return 1;

    const totalTravel = Math.max(1, el.offsetHeight - window.innerHeight);
    const holdSvh = BEAT_DWELL.holdSvh;
    const plateauPx = (holdSvh / 100) * window.innerHeight;
    const choreographyTravel = Math.max(1, totalTravel - anchors.length * plateauPx);

    let remaining = p * totalTravel;
    let prev = 0;

    for (let i = 0; i < anchors.length; i++) {
      const anchor = anchors[i];
      const segChoreo = anchor - prev;
      const segPx = segChoreo * choreographyTravel;

      if (remaining <= segPx + 1e-9) {
        if (segPx <= 1e-9) return anchor;
        return prev + (remaining / segPx) * segChoreo;
      }
      remaining -= segPx;

      if (remaining <= plateauPx + 1e-9) {
        return anchor;
      }
      remaining -= plateauPx;
      prev = anchor;
    }

    const last = anchors[anchors.length - 1];
    const finalChoreo = 1 - last;
    const finalPx = finalChoreo * choreographyTravel;
    if (finalPx <= 1e-9) return 1;
    return clamp(last + (remaining / finalPx) * finalChoreo, 0, 1);
  }

  function setWillChange(el, value) {
    if (!el) return;
    if (value) {
      el.style.willChange = value;
    } else {
      el.style.willChange = "auto";
    }
  }

  function clearMask(el) {
    if (!el) return;
    el.style.maskImage = "none";
    el.style.webkitMaskImage = "none";
    el.style.maskSize = "";
    el.style.webkitMaskSize = "";
    el.style.maskRepeat = "";
    el.style.webkitMaskRepeat = "";
  }

  function applyAngledMask(el, t, angle, edgeStart, edgeEnd, feather) {
    if (!el) return;
    const tt = clamp(t, 0, 1);
    if (tt <= 0) {
      // Fully hidden behind mask (incoming not yet revealed).
      const mask =
        "linear-gradient(" +
        angle +
        "deg, transparent 0%, transparent 100%)";
      el.style.maskImage = mask;
      el.style.webkitMaskImage = mask;
      el.style.maskSize = "100% 100%";
      el.style.webkitMaskSize = "100% 100%";
      el.style.maskRepeat = "no-repeat";
      el.style.webkitMaskRepeat = "no-repeat";
      return;
    }
    if (tt >= 1) {
      clearMask(el);
      return;
    }
    const edge = lerp(edgeStart, edgeEnd, tt);
    const f = Math.max(SITE_MOTION.junctionFeatherFloor, feather || SITE_MOTION.junctionFeather);
    const half = f * 0.5;
    const mask =
      "linear-gradient(" +
      angle +
      "deg, #000 0%, #000 " +
      (edge - half) +
      "%, rgba(0,0,0,.82) " +
      (edge - half * 0.4) +
      "%, rgba(0,0,0,.28) " +
      (edge + half * 0.4) +
      "%, transparent " +
      (edge + half) +
      "%)";
    el.style.maskImage = mask;
    el.style.webkitMaskImage = mask;
    el.style.maskSize = "100% 100%";
    el.style.webkitMaskSize = "100% 100%";
    el.style.maskRepeat = "no-repeat";
    el.style.webkitMaskRepeat = "no-repeat";
  }

  function applyJunctionLight(el, t, angle) {
    if (!el) return;
    const tt = clamp(t, 0, 1);
    if (tt <= 0 || tt >= 1) {
      el.style.opacity = "0";
      return;
    }
    const bgPos = lerp(112, -12, tt);
    const lightOpacity = Math.sin(Math.PI * tt) * SITE_MOTION.junctionLightPeak;
    el.style.backgroundImage =
      "linear-gradient(" +
      angle +
      "deg, transparent 42%, rgba(255,244,232,.06) 46%, rgba(215,185,255,.34) 49%, rgba(255,156,201,.22) 51.5%, rgba(244,221,176,.13) 54%, transparent 59%)";
    el.style.backgroundSize = "260% 100%";
    el.style.backgroundPosition = bgPos + "% 50%";
    el.style.opacity = String(lightOpacity);
  }

  // Outgoing bridge: fully visible at t=0, fully gone at t=1.
  // Transparent advances along the same angled edge used for incoming reveals,
  // so both worlds stay full-bleed under one feathered traveling edge.
  function applyBridgeOut(el, t, angle, edgeStart, edgeEnd, feather) {
    if (!el) return;
    const tt = clamp(t, 0, 1);
    if (tt <= 0) {
      clearMask(el);
      el.style.opacity = "1";
      el.style.visibility = "visible";
      return;
    }
    if (tt >= 1) {
      clearMask(el);
      el.style.opacity = "0";
      el.style.visibility = "hidden";
      return;
    }
    el.style.opacity = "1";
    el.style.visibility = "visible";
    const edge = lerp(edgeStart, edgeEnd, tt);
    const f = Math.max(SITE_MOTION.junctionFeatherFloor, feather || SITE_MOTION.junctionFeather);
    const half = f * 0.5;
    const mask =
      "linear-gradient(" +
      angle +
      "deg, transparent 0%, transparent " +
      (edge - half) +
      "%, rgba(0,0,0,.28) " +
      (edge - half * 0.4) +
      "%, rgba(0,0,0,.82) " +
      (edge + half * 0.4) +
      "%, #000 " +
      (edge + half) +
      "%, #000 100%)";
    el.style.maskImage = mask;
    el.style.webkitMaskImage = mask;
    el.style.maskSize = "100% 100%";
    el.style.webkitMaskSize = "100% 100%";
    el.style.maskRepeat = "no-repeat";
    el.style.webkitMaskRepeat = "no-repeat";
  }

  function setRetired(el, retired) {
    if (!el) return;
    if (retired) {
      el.classList.add("is-retired");
    } else {
      el.classList.remove("is-retired");
    }
  }

  function thoughtOpacity(progress, inStart, inEnd, outStart, outEnd) {
    const enter = windowProgress(progress, inStart, inEnd);
    if (outStart == null) {
      return enter;
    }
    const leave = windowProgress(progress, outStart, outEnd);
    if (leave > 0) return Math.max(0, 1 - leave);
    return enter;
  }

  // ——— DOM ———

  const opening = document.getElementById("opening");
  const hand = document.getElementById("hand");
  const work = document.getElementById("work");
  const persistentMark = document.getElementById("persistentMark");
  const openingMark = document.getElementById("mark");

  const handBenchLayer = document.getElementById("handBench");
  const handBenchStack = document.getElementById("handBenchStack");
  const handPortrait = document.getElementById("handPortrait");
  const handPortraitFrame = document.getElementById("handPortraitFrame");
  const handVideo = document.getElementById("handVideo");
  const handBridge = document.getElementById("handBridge");
  const handBridgeVideo = document.getElementById("handBridgeVideo");
  const handJunction = document.getElementById("handJunction");
  const handThoughts = [
    document.getElementById("handThought0"),
    document.getElementById("handThought1")
  ];

  const workWorlds = [
    document.getElementById("workWorld0"),
    document.getElementById("workWorld1"),
    document.getElementById("workWorld2")
  ];
  const workStacks = [
    document.getElementById("workStack0"),
    document.getElementById("workStack1"),
    document.getElementById("workStack2")
  ];
  const workBridge = document.getElementById("workBridge");
  const workJunction = document.getElementById("workJunction");
  const workRestWash = document.getElementById("workRestWash");
  const workThoughtOpen = document.getElementById("workThoughtOpen");
  const workThoughtRest = document.getElementById("workThoughtRest");
  const workLinks = document.getElementById("workLinks");
  const workLinkAnchors = workLinks
    ? Array.prototype.slice.call(workLinks.querySelectorAll("a.choice-link"))
    : [];
  const ringVideo = document.getElementById("ringVideo");

  const state = {
    isMobile: window.matchMedia("(max-width: 700px)").matches,
    openingTarget: 0,
    openingVisual: 0,
    handTarget: 0,
    handVisual: 0,
    workTarget: 0,
    workVisual: 0,
    handVideoArmed: false,
    bridgePhaseSynced: false
  };

  // Normalize work spans once.
  const workSpanTotal = SITE_MOTION.workSpans.reduce(function (a, b) {
    return a + b;
  }, 0);
  const workNorm = SITE_MOTION.workSpans.map(function (s) {
    return s / workSpanTotal;
  });
  const workStarts = [];
  {
    let acc = 0;
    for (let i = 0; i < workNorm.length; i++) {
      workStarts.push(acc);
      acc += workNorm[i];
    }
  }

  function edgeParams() {
    if (state.isMobile) {
      return {
        edgeStart: SITE_MOTION.junctionEdgeStartMobile,
        edgeEnd: SITE_MOTION.junctionEdgeEndMobile,
        angles: SITE_MOTION.junctionAnglesMobile
      };
    }
    return {
      edgeStart: SITE_MOTION.junctionEdgeStart,
      edgeEnd: SITE_MOTION.junctionEdgeEnd,
      angles: SITE_MOTION.junctionAngles
    };
  }

  // ——— Bench video window loops (natural time only; never scroll-seek) ———

  function bindBenchWindow(video, window, key) {
    if (!video) return;
    const win = BENCH_WINDOWS[key];
    if (!win) return;
    const start = win[0];
    const duration = win[1];
    const end = start + duration;

    // Always attach loop listeners so a mid-session reduce→normal toggle can resume.
    // Sources stay deferred on data-src until setVideoActive hydrates Blob URLs.
    if (mediaQuietActive()) {
      video.removeAttribute("autoplay");
      video.autoplay = false;
      try {
        video.pause();
      } catch (e) {}
      video.classList.remove("is-live");
    }

    function ensureInWindow() {
      try {
        if (!isFinite(video.duration)) return;
        // Do not fight an in-flight arm seek; only maintain the natural loop.
        if (video._deferArming || video.seeking) return;
        if (video.currentTime < start || video.currentTime >= end - 0.04) {
          video.currentTime = start;
        }
      } catch (e) {}
    }

    video.loop = false;
    video.muted = true;
    video.playsInline = true;

    video.addEventListener("timeupdate", function () {
      if (mediaQuietActive()) return;
      if (video._deferArming) return;
      try {
        if (video.currentTime >= end - 0.03) {
          video.currentTime = start;
          const p = video.play();
          if (p && typeof p.catch === "function") p.catch(function () {});
        }
      } catch (e) {}
    });

    video.addEventListener("ended", function () {
      if (mediaQuietActive()) return;
      if (video._deferArming) return;
      try {
        video.currentTime = start;
        const p = video.play();
        if (p && typeof p.catch === "function") p.catch(function () {});
      } catch (e) {}
    });

    // is-live is owned by the deferred arm pipeline (seeked → play → then live).
    // playing only reaffirms after a real, non-seeking playback state.
    video.addEventListener("playing", function () {
      if (mediaQuietActive()) {
        try {
          video.pause();
        } catch (e) {}
        video.classList.remove("is-live");
        return;
      }
      if (video.seeking || video._deferArming) return;
      if (!(video.getAttribute("src") || video.currentSrc)) return;
      // Require the windowed start to have actually landed before claiming live.
      if (video.currentTime + 0.25 < start) return;
      video.classList.add("is-live");
      ensureInWindow();
    });
  }

  function setVideoActive(video, active, armedFlag) {
    if (!video) return;
    if (mediaQuietActive()) {
      invalidateDeferredArm(video);
      abortDeferredFetches();
      if (!video.paused) {
        try {
          video.pause();
        } catch (e) {}
      }
      video.classList.remove("is-live");
      return;
    }
    if (active) {
      if (!state[armedFlag]) {
        state[armedFlag] = true;
      }
      const key = benchKeyFor(video);
      const startAt = key && BENCH_WINDOWS[key] ? BENCH_WINDOWS[key][0] : 0;

      // Already live and advancing inside the window — keep it, no re-arm.
      if (
        !video.paused &&
        video.classList.contains("is-live") &&
        video.readyState >= 2 &&
        !video.seeking
      ) {
        try {
          if (key && BENCH_WINDOWS[key]) {
            const start = BENCH_WINDOWS[key][0];
            const end = start + BENCH_WINDOWS[key][1];
            if (video.currentTime < start || video.currentTime >= end) {
              video.currentTime = start;
            }
          }
        } catch (e) {}
        return;
      }

      // Hydrate via shared Blob registry, seek to window, then play → is-live.
      armDeferredPlayback(video, startAt);
    } else {
      // Leaving the beat: cancel in-flight arm. Keep any resolved Blob in the
      // shared registry; clear hard-fail so a later approach may retry once.
      if (video._deferArming || video._deferFailed) {
        invalidateDeferredArm(video);
      }
      if (!video.paused) {
        try {
          video.pause();
        } catch (e) {}
      }
    }
  }

  // ——— Persistent mark ———

  function loadPersistentMark() {
    if (!persistentMark) return;
    // Post-opening mark only: harder luminance key so the lavender plate dies.
    // Opening mark processing in index.html is intentionally left untouched.
    function keyLogoToCanvas(source) {
      const canvas = document.createElement("canvas");
      const w = source.naturalWidth || source.width || source.videoWidth;
      const h = source.naturalHeight || source.height || source.videoHeight;
      if (!w || !h) return null;
      canvas.width = w;
      canvas.height = h;
      canvas.setAttribute("aria-hidden", "true");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(source, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      const count = w * h;
      // Hard-key the near-white lavender plate; keep only dark glyph mass as cream
      // alpha. No rectangle, badge, global ground, or source-pixel dilation here —
      // contrast halo is CSS drop-shadow on the keyed canvas after downscale.
      for (let i = 0, p = 0; p < count; i += 4, p++) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3] / 255;
        const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        // Plate is near-white lavender (~0.97). Kill light pixels; keep dark glyphs.
        // Strengthened darkness so cream glyphs hold over pale hair and bright metal.
        let outA = 0;
        if (lum < 0.48 && a > 0.02) {
          const darkness = Math.min(1, ((0.48 - lum) / 0.48) * 1.72);
          outA = Math.min(255, Math.round(255 * darkness * a * 1.18));
        }
        data[i] = 255;
        data[i + 1] = 250;
        data[i + 2] = 245;
        data[i + 3] = outA;
      }
      ctx.putImageData(imageData, 0, 0);
      return canvas;
    }

    function useImageFallback() {
      // Prefer the strict canvas key only. If keying fails, leave the
      // persistent clone empty rather than paint the rectangular plate.
      const img = new Image();
      img.decoding = "async";
      img.alt = "";
      img.onload = function () {
        try {
          const canvas = keyLogoToCanvas(img);
          if (canvas) {
            persistentMark.appendChild(canvas);
          }
        } catch (err) {}
      };
      img.src = "assets/rana-logo.png";
    }

    // Always rebuild with the stricter key (do not clone opening residual plate).
    // Brief wait only to avoid racing first paint; not a second animation clock.
    let tries = 0;
    function tryLoad() {
      tries += 1;
      if (openingMark) {
        const img = openingMark.querySelector("img");
        if (img && (img.naturalWidth || img.complete)) {
          try {
            const canvas = keyLogoToCanvas(img);
            if (canvas) {
              persistentMark.appendChild(canvas);
              return;
            }
          } catch (e) {}
        }
      }
      if (tries < 8) {
        setTimeout(tryLoad, 32);
      } else {
        useImageFallback();
      }
    }
    tryLoad();
  }

  function setPersistentMarkInteractive(active) {
    if (!persistentMark) return;
    if (active) {
      persistentMark.classList.add("is-visible");
      if (persistentMark.getAttribute("tabindex") === "-1") {
        persistentMark.removeAttribute("tabindex");
      }
      if (persistentMark.getAttribute("aria-hidden") === "true") {
        persistentMark.removeAttribute("aria-hidden");
      }
    } else {
      persistentMark.classList.remove("is-visible");
      persistentMark.setAttribute("tabindex", "-1");
      persistentMark.setAttribute("aria-hidden", "true");
      if (document.activeElement === persistentMark) {
        try {
          persistentMark.blur();
        } catch (e) {}
      }
    }
  }

  function applyPersistentMark(openingP) {
    if (!persistentMark) return;
    const mobile = state.isMobile;
    const vw = window.innerWidth;
    // openingP is remapped choreography progress (same timeline as the opening renderer).
    const choreoP = openingP;

    let widthPx;
    let top;
    let leftPx;

    if (mobile) {
      // Compact top-left identity after the rest header yields.
      widthPx = Math.min(0.28 * vw, 120);
      top = 3.4;
      leftPx = 0.05 * vw;
    } else {
      widthPx = Math.min(0.17 * vw, 240);
      top = 5.2;
      leftPx = 0.042 * vw;
    }

    persistentMark.style.width = widthPx + "px";
    persistentMark.style.top = top + "svh";
    persistentMark.style.left = leftPx + "px";

    // Swap after opening mark reaches terminal (MOTION.markEnd = 0.34 on choreography timeline).
    // Remain present through the terminal Work handoff — Work never yields to Making.
    const show =
      choreoP >= 0.34 ||
      (opening && opening.getBoundingClientRect().bottom <= window.innerHeight * 0.92);
    const opacity = show ? 0.94 : 0;
    const interactive = show;

    persistentMark.style.opacity = String(opacity);
    setPersistentMarkInteractive(interactive);

    if (show) {
      if (openingMark && choreoP >= 0.34) {
        openingMark.style.opacity = "0";
      }
    } else if (openingMark) {
      openingMark.style.opacity = "0.94";
    }
  }

  // ——— M2 Hand ———

  function renderHand(p) {
    if (!hand) return;
    const mobile = state.isMobile;
    const edges = edgeParams();
    const angleEnter = edges.angles[0];

    // Opening ring already full-bleed on the bridge; bench already full-bleed under it.
    // Angled feathered mask-out is the contract Turn — not a horizontal sticky release.
    const enterT = windowProgress(p, 0.0, 0.14);
    if (handBenchLayer) {
      handBenchLayer.style.opacity = "1";
      clearMask(handBenchLayer);
    }
    applyBridgeOut(
      handBridge,
      enterT,
      angleEnter,
      edges.edgeStart,
      edges.edgeEnd,
      SITE_MOTION.junctionFeather
    );
    if (enterT > 0 && enterT < 1) {
      applyJunctionLight(handJunction, enterT, angleEnter);
    } else {
      applyJunctionLight(handJunction, 0, angleEnter);
    }

    // Continuous recession inside the bench/studio world — scale the image, never the frame.
    // Media-layer overscan absorbs the start scale so no edges expose.
    if (handBenchStack) {
      const benchScale = lerp(
        SITE_MOTION.handBenchScaleStart,
        SITE_MOTION.handBenchScaleEnd,
        smoothstep(p)
      );
      handBenchStack.style.transform = "translate3d(0,0,0) scale(" + benchScale + ")";
    }

    // Portrait reveal ~0.36–0.63.
    // Desktop: radial expand from her face (approved composition).
    // Mobile: edge-spanning angled handoff between two full-viewport worlds
    // (bench → portrait). No radial island, oval spotlight, or mask-to-empty.
    const portT = windowProgress(p, 0.36, 0.63);
    if (mobile) {
      if (handPortraitFrame) {
        clearMask(handPortraitFrame);
        handPortraitFrame.style.transform =
          "scale(" + lerp(1.03, 1.0, portT) + ")";
      }
      if (handPortrait) {
        if (portT <= 0.001) {
          handPortrait.style.opacity = "0";
          clearMask(handPortrait);
        } else if (portT >= 0.999) {
          handPortrait.style.opacity = "1";
          clearMask(handPortrait);
        } else {
          handPortrait.style.opacity = "1";
          applyAngledMask(
            handPortrait,
            portT,
            angleEnter,
            edges.edgeStart,
            edges.edgeEnd,
            SITE_MOTION.junctionFeather
          );
        }
      }
    } else {
      const focus = SITE_MOTION.portraitFocusDesktop;
      if (handPortrait) {
        // Layer present once the reveal begins; recession is mask-driven.
        handPortrait.style.opacity = portT <= 0.001 ? "0" : "1";
        clearMask(handPortrait);
      }
      if (handPortraitFrame) {
        const feather = SITE_MOTION.handPortraitFeather;
        if (portT <= 0.001) {
          handPortraitFrame.style.webkitMaskImage =
            "radial-gradient(circle at " +
            focus[0] +
            "% " +
            focus[1] +
            "%, transparent 0%, transparent 100%)";
          handPortraitFrame.style.maskImage = handPortraitFrame.style.webkitMaskImage;
        } else if (portT >= 0.999) {
          // At rest: fully opaque portrait — no bench ghost through any edge.
          clearMask(handPortraitFrame);
        } else {
          // Expand soft solid core from her face; edge stays feathered mid-reveal.
          const solidBase = lerp(6, Math.max(34, 70 - feather * 0.45), portT);
          const midBase = Math.min(94, solidBase + feather * 0.55);
          const outerBase = Math.min(100, midBase + feather * 0.7);
          // Final portion of portT: smoothly close the soft outer alpha to solid.
          const resolve = smoothstep((portT - 0.72) / 0.28);
          const solid = lerp(solidBase, 100, resolve);
          const mid = lerp(midBase, 100, resolve);
          const outer = lerp(outerBase, 100, resolve);
          const midA = lerp(0.55, 1, resolve);
          const outerA = resolve;
          const mask =
            "radial-gradient(circle at " +
            focus[0] +
            "% " +
            focus[1] +
            "%, #000 0%, #000 " +
            solid +
            "%, rgba(0,0,0," +
            midA.toFixed(3) +
            ") " +
            mid +
            "%, rgba(0,0,0," +
            outerA.toFixed(3) +
            ") " +
            outer +
            "%)";
          handPortraitFrame.style.webkitMaskImage = mask;
          handPortraitFrame.style.maskImage = mask;
        }
        handPortraitFrame.style.transform =
          "scale(" + lerp(1.06, 1.0, portT) + ")";
      }
    }

    // Copy: one thought at a time; final stack holds at portrait rest.
    // 0: Rana works...  1: From her home... + Cutting stones / Designing Jewelry...
    // Re-anchored for the direct ring→bench passage: no long uncaused silent middle.
    // Authored fade durations preserved (0.12 / 0.12 and 0.12 / 0.08); 60svh plateaus
    // remain at BEAT_DWELL.hand fully-composed anchors.
    // End-fade keeps M2 type from coexisting with Work above 0.15 opacity.
    const endFade = 1 - windowProgress(p, 0.9, 0.98);
    const o0 = thoughtOpacity(p, 0.14, 0.26, 0.40, 0.52) * endFade;
    const o1 = thoughtOpacity(p, 0.70, 0.82, 0.90, 0.98);

    if (handThoughts[0]) {
      handThoughts[0].style.opacity = String(o0);
      handThoughts[0].style.transform =
        "translate3d(0," + lerp(4, 0, windowProgress(p, 0.14, 0.26)) + "svh,0)";
    }
    if (handThoughts[1]) {
      handThoughts[1].style.opacity = String(o1);
      handThoughts[1].style.transform =
        "translate3d(0," + lerp(3, 0, windowProgress(p, 0.70, 0.82)) + "svh,0)";
    }

    // Mobile object positions already in CSS; slight progress drift on desktop bench.
    if (!mobile && handBenchStack) {
      const img = handBenchStack.querySelector("img");
      const video = handBenchStack.querySelector("video");
      const x = lerp(42, 44, p).toFixed(1) + "% ";
      const y = lerp(48, 46, p).toFixed(1) + "%";
      if (img) img.style.objectPosition = x + y;
      if (video) video.style.objectPosition = x + y;
    }
  }

  // ——— M3 Work (terminal) ———

  function setLinkInteractive(container, anchors, interactive) {
    if (!container) return;
    if (interactive) {
      container.classList.add("is-interactive");
      container.removeAttribute("aria-hidden");
    } else {
      container.classList.remove("is-interactive");
      container.setAttribute("aria-hidden", "true");
    }
    // Invisible links must leave keyboard/assistive traversal entirely.
    for (let li = 0; li < anchors.length; li++) {
      const anchor = anchors[li];
      if (!anchor) continue;
      if (interactive) {
        if (anchor.getAttribute("tabindex") === "-1") {
          anchor.removeAttribute("tabindex");
        }
        if (anchor.getAttribute("aria-hidden") === "true") {
          anchor.removeAttribute("aria-hidden");
        }
      } else {
        anchor.setAttribute("tabindex", "-1");
        anchor.setAttribute("aria-hidden", "true");
        if (document.activeElement === anchor) {
          try {
            anchor.blur();
          } catch (e) {}
        }
      }
    }
  }

  function workLocal(p, index) {
    const start = workStarts[index];
    const len = workNorm[index];
    return clamp((p - start) / len, 0, 1);
  }

  function renderWork(p) {
    if (!work) return;
    const edges = edgeParams();
    const hold = SITE_MOTION.workHoldFraction;

    // Portrait already full-bleed on the bridge; first work still under it.
    const enterT = windowProgress(p, 0.0, 0.14);
    if (workWorlds[0]) {
      workWorlds[0].style.opacity = "1";
      clearMask(workWorlds[0]);
    }
    applyBridgeOut(
      workBridge,
      enterT,
      edges.angles[2],
      edges.edgeStart,
      edges.edgeEnd,
      SITE_MOTION.junctionFeather
    );

    // Opening thought after the entry Turn settles; rest + links late.
    const openOp = thoughtOpacity(p, 0.12, 0.2, 0.28, 0.36);
    const restOp = thoughtOpacity(p, 0.78, 0.88, null, null);

    if (workThoughtOpen) {
      workThoughtOpen.style.opacity = String(openOp);
      workThoughtOpen.style.transform =
        "translate3d(0," + lerp(3, 0, windowProgress(p, 0.12, 0.2)) + "svh,0)";
    }
    if (workThoughtRest) {
      workThoughtRest.style.opacity = String(restOp);
      workThoughtRest.style.transform =
        "translate3d(0," + lerp(3, 0, windowProgress(p, 0.78, 0.88)) + "svh,0)";
    }
    if (workLinks) {
      workLinks.style.opacity = String(restOp);
      setLinkInteractive(workLinks, workLinkAnchors, restOp > 0.15);
    }
    if (workRestWash) {
      // Fluid local darkening tracks the rest composition — no card/panel.
      workRestWash.style.opacity = String(restOp * 0.92);
    }

    let activeJunction = 0;
    let junctionT = 0;
    let junctionAngle = edges.angles[2];

    if (enterT > 0 && enterT < 1) {
      activeJunction = 0;
      junctionT = enterT;
      junctionAngle = edges.angles[2];
    }

    for (let i = 0; i < workWorlds.length; i++) {
      const world = workWorlds[i];
      const stack = workStacks[i];
      if (!world) continue;

      const local = workLocal(p, i);
      const start = workStarts[i];
      const len = workNorm[i];

      // Visibility: base world 0 always under; others masked in.
      let reveal = 1;
      if (i === 0) {
        reveal = 1;
        world.style.opacity = "1";
        // Keep clear during/after entry Turn (bridge is the outgoing world).
        if (enterT >= 1 || enterT <= 0) {
          clearMask(world);
        }
      } else {
        // Turn begins after hold of previous; span of this world opens with angled mask.
        const turnStart = workStarts[i];
        const turnEnd = turnStart + len * (1 - hold) * 0.85;
        reveal = windowProgress(p, turnStart, Math.min(turnEnd, turnStart + len * 0.42));
        // Also fully visible once past turn.
        if (p >= workStarts[i] + len * 0.35) reveal = 1;
        if (p < workStarts[i] - 0.001) reveal = 0;
        applyAngledMask(
          world,
          reveal,
          edges.angles[i % edges.angles.length],
          edges.edgeStart,
          edges.edgeEnd,
          SITE_MOTION.junctionFeather
        );
        world.style.opacity = reveal > 0 ? "1" : "0";
        if (reveal > 0 && reveal < 1) {
          activeJunction = i;
          junctionT = reveal;
          junctionAngle = edges.angles[i % edges.angles.length];
        }
      }

      // Uneven still scale: each world breathes slightly within its span.
      if (stack) {
        const scaleT = smoothstep(local);
        const scale = lerp(SITE_MOTION.workScaleStart, SITE_MOTION.workScaleEnd, scaleT);
        stack.style.transform = "translate3d(0,0,0) scale(" + scale + ")";
      }

      // Stack below .work-bridge (z-index 8) so the portrait Turn stays on top.
      world.style.zIndex = String(1 + i);
    }

    applyJunctionLight(
      workJunction,
      junctionT > 0 && junctionT < 1 ? junctionT : 0,
      junctionAngle
    );
  }

  // ——— Section retirement (kill sticky-release dead intervals) ———

  function updateSectionRetirement(openingP, handP, workP, handProx, workProx) {
    // A section retires the instant its sticky travel ends and the next world
    // is already pinned with a matching bridge — so ordinary vertical flow
    // between movements never paints into the viewport.
    // Work is terminal: it never retires.
    const handPinned = handProx && handProx.rect && handProx.rect.top <= 1;
    const workPinned = workProx && workProx.rect && workProx.rect.top <= 1;

    setRetired(opening, openingP >= 0.999 && handPinned);
    setRetired(hand, handP >= 0.999 && workPinned);
    setRetired(work, false);
  }

  // ——— Activity / will-change / video pause ———

  function updateActivity(handP, workP, handNear) {
    const handActive = handNear;
    const workActive = work && sectionProximity(work).near;

    setWillChange(handBenchStack, handActive ? "transform" : "");
    setWillChange(
      handPortraitFrame,
      handActive ? (state.isMobile ? "transform" : "transform, opacity") : ""
    );
    setWillChange(
      handPortrait,
      handActive
        ? state.isMobile
          ? "opacity, mask-image"
          : "opacity"
        : ""
    );
    setWillChange(handBridge, handActive && handP < 0.2 ? "opacity, mask-image" : "");
    for (let i = 0; i < workStacks.length; i++) {
      setWillChange(workStacks[i], workActive ? "transform" : "");
    }
    setWillChange(workBridge, workActive && workP < 0.2 ? "opacity, mask-image" : "");

    // Videos: active only near their movement; never seek from scroll.
    // Arm bench video as soon as Hand is active so hydration overlaps the Turn.
    setVideoActive(handVideo, handActive && handP > 0 && handP < 0.95, "handVideoArmed");

    // Bridge ring video: live only during the opening→hand Turn (natural loop, not scroll-seek).
    // Phase-align once to the opening ring without changing M1's own timing.
    // Deferred Blob path only — never the opening's direct stream helper.
    if (handBridgeVideo && !mediaQuietActive()) {
      if (handActive && handP < 0.18) {
        armHandBridgePlayback();
      } else {
        if (handBridgeVideo._deferArming || handBridgeVideo._deferFailed) {
          invalidateDeferredArm(handBridgeVideo);
        }
        if (!handBridgeVideo.paused) {
          try {
            handBridgeVideo.pause();
          } catch (e) {}
        }
        if (handP >= 0.18) {
          state.bridgePhaseSynced = false;
        }
      }
    } else if (handBridgeVideo && mediaQuietActive()) {
      invalidateDeferredArm(handBridgeVideo);
      abortDeferredFetches();
      if (!handBridgeVideo.paused) {
        try {
          handBridgeVideo.pause();
        } catch (e) {}
      }
      handBridgeVideo.classList.remove("is-live");
    }
  }

  function armHandBridgePlayback() {
    if (!handBridgeVideo || mediaQuietActive()) return;
    if (
      !handBridgeVideo.paused &&
      handBridgeVideo.classList.contains("is-live") &&
      handBridgeVideo.readyState >= 2 &&
      !handBridgeVideo.seeking
    ) {
      return;
    }
    if (handBridgeVideo._deferArming || handBridgeVideo._deferFailed) return;

    const generation = (handBridgeVideo._deferGen || 0) + 1;
    handBridgeVideo._deferGen = generation;
    handBridgeVideo._deferArming = true;

    ensureDeferredVideoSource(handBridgeVideo)
      .then(function (ok) {
        if (!ok || mediaQuietActive() || handBridgeVideo._deferGen !== generation) {
          if (!ok && !mediaQuietActive() && handBridgeVideo._deferGen === generation) {
            handBridgeVideo._deferFailed = true;
          }
          return false;
        }
        return waitForVideoMetadata(handBridgeVideo).then(
          function () {
            return true;
          },
          function () {
            if (handBridgeVideo._deferGen === generation && !mediaQuietActive()) {
              handBridgeVideo._deferFailed = true;
            }
            return false;
          }
        );
      })
      .then(function (ready) {
        if (!ready || mediaQuietActive() || handBridgeVideo._deferGen !== generation) {
          return false;
        }
        // Phase-align once to the opening ring after seekability is real.
        if (!state.bridgePhaseSynced && ringVideo && isFinite(ringVideo.currentTime)) {
          return seekVideoTo(handBridgeVideo, ringVideo.currentTime).then(function (seeked) {
            if (seeked) state.bridgePhaseSynced = true;
            else if (handBridgeVideo._deferGen === generation && !mediaQuietActive()) {
              handBridgeVideo._deferFailed = true;
            }
            return seeked;
          });
        }
        return true;
      })
      .then(function (ready) {
        if (!ready || mediaQuietActive() || handBridgeVideo._deferGen !== generation) {
          if (handBridgeVideo._deferGen === generation) {
            handBridgeVideo.classList.remove("is-live");
          }
          return false;
        }
        return playAndMarkLive(handBridgeVideo, generation);
      })
      .catch(function () {
        if (handBridgeVideo._deferGen === generation) {
          handBridgeVideo.classList.remove("is-live");
          if (!mediaQuietActive()) handBridgeVideo._deferFailed = true;
        }
        return false;
      })
      .then(function () {
        if (handBridgeVideo._deferGen === generation) {
          handBridgeVideo._deferArming = false;
        }
      });
  }

  // ——— Main site tick (called from single opening rAF) ———

  function siteTick(dt) {
    state.isMobile = window.matchMedia("(max-width: 700px)").matches;

    const openingProx = sectionProximity(opening);
    const handProx = sectionProximity(hand);
    const workProx = sectionProximity(work);

    // Targets and visuals stay RAW physical section progress.
    state.openingTarget = openingProx.progress;
    state.handTarget = handProx.progress;
    state.workTarget = workProx.progress;

    if (quietModeActive()) {
      state.openingVisual = state.openingTarget;
      state.handVisual = state.handTarget;
      state.workVisual = state.workTarget;
    } else {
      // Smooth raw physical progress once; remap happens after (never double-smooth).
      const k = 1 - Math.exp(-dt / SITE_MOTION.sectionTau);
      state.openingVisual += (state.openingTarget - state.openingVisual) * k;
      state.handVisual += (state.handTarget - state.handVisual) * k;
      state.workVisual += (state.workTarget - state.workVisual) * k;
    }

    // Remap once from smoothed (or direct quiet) physical progress → choreography.
    const handChoreo = remapBeatProgress(hand, state.handVisual, BEAT_DWELL.hand);
    const workChoreo = remapBeatProgress(work, state.workVisual, BEAT_DWELL.work);
    const handTargetChoreo = remapBeatProgress(hand, state.handTarget, BEAT_DWELL.hand);
    const workTargetChoreo = remapBeatProgress(work, state.workTarget, BEAT_DWELL.work);

    // Persistent mark follows the remapped choreography timeline (shared with M1).
    // openingVisual/openingTarget remain raw physical section progress.
    applyPersistentMark(remapOpeningProgress(state.openingVisual));

    // Retire completed stickies before paint so release cannot expose a split.
    // Retirement uses RAW physical completion so post-opening plateaus do not
    // retire a movement while its final beat is still the live rest composition.
    // Work is terminal and never retires.
    updateSectionRetirement(
      state.openingTarget,
      state.handTarget,
      state.workTarget,
      handProx,
      workProx
    );

    // Per-frame work limited to active movement and neighbor.
    // Keep rest-link renderers alive while a previously advanced visual is still
    // damping down on backward scroll, so opacity/focus retirement runs before
    // the far-away skip takes over.
    const openingNear = openingProx.near || openingProx.visible;
    const handNear = handProx.near || handProx.visible;
    const workNear = workProx.near || workProx.visible;
    // 0.85 / 0.78 are late-choreography thresholds — remap so they fire at the
    // same absolute scroll distances as before the plateaus were inserted.
    const renderHandNow =
      handNear || (openingNear && remapOpeningProgress(state.openingTarget) > 0.85);
    const renderWorkNow =
      workNear ||
      (handNear && handTargetChoreo > 0.85) ||
      state.workVisual > state.workTarget + 0.001 ||
      (quietModeActive() &&
        workLinks &&
        workLinks.classList.contains("is-interactive") &&
        workTargetChoreo < 0.78);

    if (renderHandNow) renderHand(handChoreo);
    if (renderWorkNow) renderWork(workChoreo);

    updateActivity(handChoreo, workChoreo, handProx.near);
  }

  // Initial resting composed states (no-JS-safe CSS is the floor; JS refines).
  function initialRender() {
    state.isMobile = window.matchMedia("(max-width: 700px)").matches;
    state.openingVisual = sectionProgress(opening);
    state.handVisual = sectionProgress(hand);
    state.workVisual = sectionProgress(work);
    state.openingTarget = state.openingVisual;
    state.handTarget = state.handVisual;
    state.workTarget = state.workVisual;
    applyPersistentMark(remapOpeningProgress(state.openingVisual));
    const handProx0 = sectionProximity(hand);
    const workProx0 = sectionProximity(work);
    updateSectionRetirement(
      state.openingTarget,
      state.handTarget,
      state.workTarget,
      handProx0,
      workProx0
    );
    const handChoreo0 = remapBeatProgress(hand, state.handVisual, BEAT_DWELL.hand);
    const workChoreo0 = remapBeatProgress(work, state.workVisual, BEAT_DWELL.work);
    renderHand(handChoreo0);
    renderWork(workChoreo0);
  }

  // Bind windowed natural loops (no scroll-seeking). Playback arms when near.
  // Sources stay on data-src until setVideoActive hydrates them for a live beat.
  bindBenchWindow(handVideo, null, "hand");

  // Deferred elements never receive src here. Explicit quiet: keep paused posters.
  // Normal motion: start paused; siteTick hydrates + plays only when near.
  [handVideo, handBridgeVideo].forEach(function (v) {
    if (!v) return;
    v.removeAttribute("autoplay");
    v.autoplay = false;
    try {
      v.pause();
    } catch (e) {}
    v.classList.remove("is-live");
  });

  loadPersistentMark();
  initialRender();

  // Register the single whole-site tick hook for the opening rAF loop.
  window.__ranaSiteTick = function (dt) {
    siteTick(typeof dt === "number" && isFinite(dt) ? dt : 0.016);
  };

  // If opening script is delayed, still keep composed states on resize.
  window.addEventListener(
    "resize",
    function () {
      state.isMobile = window.matchMedia("(max-width: 700px)").matches;
      if (quietModeActive()) {
        state.openingVisual = sectionProgress(opening);
        state.handVisual = sectionProgress(hand);
        state.workVisual = sectionProgress(work);
        applyPersistentMark(remapOpeningProgress(state.openingVisual));
        renderHand(remapBeatProgress(hand, state.handVisual, BEAT_DWELL.hand));
        renderWork(remapBeatProgress(work, state.workVisual, BEAT_DWELL.work));
      }
    },
    { passive: true }
  );
})();
