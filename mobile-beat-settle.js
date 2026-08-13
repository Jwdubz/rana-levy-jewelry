/* RANA LEVY mobile beat settle.
 *
 * After a mobile finger gesture ends, one fully composed authored rest owns
 * the viewport. Destinations are the Opening terminal hold, BEAT_DWELL
 * Hand/Work plateaus, and the Work terminal — inverted from the existing
 * remap mathematics. Desktop stays unbound. Not CSS scroll-snap.
 *
 * Residue: mobile beat settle
 * Disposition: maintained asset
 * Future consumer: homepage mobile visitor after a finger gesture; any operator editing passage beats
 * Activation: auto-load — index.html script after site.js
 * Behavioral check: node tools/assert-mobile-beat-settle.mjs
 * Retirement: when mobile per-beat settle is retired or superseded
 */
(function () {
  "use strict";

  var MOBILE_MAX_WIDTH = 700;
  var IDLE_MS = 200;
  var SETTLE_MIN_MS = 280;
  var SETTLE_MAX_MS = 620;
  var NEAR_PX = 12;
  var SNAP_BACK_PX = 36;
  var DIRECTION_BOUND = 2.35;
  var OPENING_HOLD_KEEP = 0.88;

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function deriveOpeningFinalPhysical(span) {
    if (!span) return null;
    var end = span.choreographyEnd;
    if (!(end > 0) && span.choreographySvh > 0 && span.terminalHoldSvh >= 0) {
      end = span.choreographySvh / (span.choreographySvh + span.terminalHoldSvh);
    }
    if (!(end > 0) || !(end <= 1)) return null;
    return {
      startP: end,
      endP: end + (1 - end) * OPENING_HOLD_KEEP
    };
  }

  // Inverse of site.js remapBeatProgress plateaus: physical progress range
  // that holds anchors[index] for holdSvh of authored 100svh.
  function plateauPhysicalRange(totalTravel, holdSvh, svhPx, anchors, index) {
    if (!anchors || index < 0 || index >= anchors.length) return null;
    var travel = Math.max(1, totalTravel);
    var plateauPx = (holdSvh / 100) * svhPx;
    var choreographyTravel = Math.max(1, travel - anchors.length * plateauPx);
    var px = 0;
    var prev = 0;
    var i;
    for (i = 0; i < anchors.length; i++) {
      px += (anchors[i] - prev) * choreographyTravel;
      if (i === index) {
        return {
          startP: clamp(px / travel, 0, 1),
          endP: clamp((px + plateauPx) / travel, 0, 1)
        };
      }
      px += plateauPx;
      prev = anchors[i];
    }
    return null;
  }

  function aimAtRest(y, rest) {
    if (!rest) return null;
    if (y < rest.start) return rest.start;
    if (y > rest.end) return rest.end;
    return y;
  }

  function nearestRest(y, prev, next) {
    if (!prev) return next || null;
    if (!next) return prev;
    return y - prev.end <= next.start - y ? prev : next;
  }

  function pickAlongDirection(y, toward, away, snapBack, bound) {
    if (!toward) return away || null;
    if (!away) return toward;
    var distToward;
    var distAway;
    if (toward.start >= y) {
      distToward = toward.start - y;
      distAway = y - away.end;
    } else {
      distToward = y - toward.end;
      distAway = away.start - y;
    }
    if (distAway >= 0 && distAway <= snapBack) return away;
    if (distToward > distAway * bound && distAway < distToward) return away;
    return toward;
  }

  // Direction + bounded nearest adjacent rest. Returns a scrollY or null
  // when the viewport is already inside an exact authored rest.
  function chooseBeatDestination(scrollY, direction, rests, options) {
    if (!rests || !rests.length) return null;
    var snapBack =
      options && options.snapBackPx != null ? options.snapBackPx : SNAP_BACK_PX;
    var bound =
      options && options.directionBound != null
        ? options.directionBound
        : DIRECTION_BOUND;
    var y = scrollY;
    var prev = null;
    var next = null;
    var i;
    var rest;
    for (i = 0; i < rests.length; i++) {
      rest = rests[i];
      if (y >= rest.start && y <= rest.end) return null;
      if (rest.end < y) prev = rest;
      if (rest.start > y && !next) next = rest;
    }

    var chosen;
    if (direction > 0) {
      chosen = pickAlongDirection(y, next, prev, snapBack, bound);
    } else if (direction < 0) {
      chosen = pickAlongDirection(y, prev, next, snapBack, bound);
    } else {
      chosen = nearestRest(y, prev, next);
    }
    if (!chosen) return null;
    return aimAtRest(y, chosen);
  }

  function mergeRests(rests, nearPx) {
    if (!rests.length) return rests;
    var near = nearPx == null ? NEAR_PX : nearPx;
    var out = [
      {
        id: rests[0].id,
        start: rests[0].start,
        end: rests[0].end
      }
    ];
    var i;
    for (i = 1; i < rests.length; i++) {
      var prev = out[out.length - 1];
      var cur = rests[i];
      if (cur.start <= prev.end + near) {
        prev.end = Math.max(prev.end, cur.end);
      } else {
        out.push({ id: cur.id, start: cur.start, end: cur.end });
      }
    }
    return out;
  }

  var api = {
    MOBILE_MAX_WIDTH: MOBILE_MAX_WIDTH,
    IDLE_MS: IDLE_MS,
    NEAR_PX: NEAR_PX,
    SNAP_BACK_PX: SNAP_BACK_PX,
    DIRECTION_BOUND: DIRECTION_BOUND,
    deriveOpeningFinalPhysical: deriveOpeningFinalPhysical,
    plateauPhysicalRange: plateauPhysicalRange,
    chooseBeatDestination: chooseBeatDestination,
    mergeRests: mergeRests,
    aimAtRest: aimAtRest
  };

  var authoredSvhPxCache = 0;
  var opening = null;
  var hand = null;
  var work = null;
  var bound = false;
  var armed = false;
  var suppress = false;
  var fingerDown = false;
  var sawContact = false;
  var settling = false;
  var settleGen = 0;
  var raf = 0;
  var idleTimer = 0;
  var direction = 0;
  var lastY = 0;
  var ignoreScrollUntil = 0;
  var mediaQuery = null;

  function isMobileViewport() {
    try {
      return window.matchMedia("(max-width: " + MOBILE_MAX_WIDTH + "px)").matches;
    } catch (e) {
      return false;
    }
  }

  function quietModeActive() {
    try {
      if (new URLSearchParams(location.search).get("motion") === "quiet") {
        return true;
      }
    } catch (e) {}
    if (typeof window.__ranaQuietModeActive === "function") {
      try {
        if (window.__ranaQuietModeActive()) return true;
      } catch (e) {}
    }
    var root = document.documentElement;
    return !!(root && root.classList && root.classList.contains("is-quiet"));
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return false;
    }
  }

  function live() {
    return bound && isMobileViewport() && !!(opening && hand && work);
  }

  function authoredSvhPx() {
    if (authoredSvhPxCache > 0) return authoredSvhPxCache;
    var probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText =
      "position:absolute;left:0;top:0;width:0;height:100svh;visibility:hidden;pointer-events:none;";
    document.documentElement.appendChild(probe);
    var px = probe.getBoundingClientRect().height;
    probe.remove();
    authoredSvhPxCache = px > 0 ? px : window.innerHeight;
    return authoredSvhPxCache;
  }

  function sectionTravel(el) {
    return Math.max(1, el.offsetHeight - window.innerHeight);
  }

  function currentScrollY() {
    return window.scrollY || window.pageYOffset || 0;
  }

  function maxScrollY() {
    var el = document.documentElement;
    var body = document.body;
    var height = Math.max(
      (el && el.scrollHeight) || 0,
      (body && body.scrollHeight) || 0
    );
    return Math.max(0, height - window.innerHeight);
  }

  function scrollYForSectionProgress(el, physicalProgress) {
    var total = sectionTravel(el);
    var rect = el.getBoundingClientRect();
    var documentTop = rect.top + currentScrollY();
    return documentTop + clamp(physicalProgress, 0, 1) * total;
  }

  function collectRests() {
    var beat = window.BEAT_DWELL;
    var span = window.OPENING_SPAN;
    if (!beat || !span || !opening || !hand || !work) return [];
    var svh = authoredSvhPx();
    var hold = beat.holdSvh;
    var rests = [];
    var open0 = scrollYForSectionProgress(opening, 0);
    rests.push({ id: "opening-start", start: open0, end: open0 });

    var openingFinal = deriveOpeningFinalPhysical(span);
    if (openingFinal) {
      rests.push({
        id: "opening-final",
        start: scrollYForSectionProgress(opening, openingFinal.startP),
        end: scrollYForSectionProgress(opening, openingFinal.endP)
      });
    }

    var handTravel = sectionTravel(hand);
    var i;
    var range;
    for (i = 0; i < beat.hand.length; i++) {
      range = plateauPhysicalRange(handTravel, hold, svh, beat.hand, i);
      if (!range) continue;
      rests.push({
        id: "hand-" + i,
        start: scrollYForSectionProgress(hand, range.startP),
        end: scrollYForSectionProgress(hand, range.endP)
      });
    }

    var workTravel = sectionTravel(work);
    for (i = 0; i < beat.work.length; i++) {
      range = plateauPhysicalRange(workTravel, hold, svh, beat.work, i);
      if (!range) continue;
      rests.push({
        id: "work-" + i,
        start: scrollYForSectionProgress(work, range.startP),
        end: scrollYForSectionProgress(work, range.endP)
      });
    }

    var term = scrollYForSectionProgress(work, 1);
    rests.push({ id: "work-terminal", start: term, end: term });

    var maxY = maxScrollY();
    for (i = 0; i < rests.length; i++) {
      rests[i].start = clamp(rests[i].start, 0, maxY);
      rests[i].end = clamp(rests[i].end, 0, maxY);
      if (rests[i].end < rests[i].start) {
        var swap = rests[i].start;
        rests[i].start = rests[i].end;
        rests[i].end = swap;
      }
    }
    rests.sort(function (a, b) {
      return a.start - b.start;
    });
    return mergeRests(rests, NEAR_PX);
  }

  function clearIdle() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = 0;
    }
  }

  function cancelSettle() {
    settleGen += 1;
    settling = false;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function scheduleIdle() {
    clearIdle();
    if (!live() || !armed || suppress || fingerDown || settling) return;
    idleTimer = setTimeout(maybeSettle, IDLE_MS);
  }

  function finishSettle() {
    settling = false;
    raf = 0;
    direction = 0;
    ignoreScrollUntil = (performance.now ? performance.now() : Date.now()) + 80;
  }

  function startSettle(targetY) {
    cancelSettle();
    var from = currentScrollY();
    var dist = Math.abs(targetY - from);
    if (!(dist > 0)) return;
    if (dist <= NEAR_PX) {
      window.scrollTo(0, targetY);
      finishSettle();
      return;
    }
    var duration = clamp(SETTLE_MIN_MS + dist * 0.28, SETTLE_MIN_MS, SETTLE_MAX_MS);
    var gen = settleGen;
    settling = true;
    var t0 = performance.now ? performance.now() : Date.now();

    function step(now) {
      if (gen !== settleGen) return;
      var t = clamp((now - t0) / duration, 0, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      window.scrollTo(0, from + (targetY - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(step);
        return;
      }
      window.scrollTo(0, targetY);
      finishSettle();
    }

    raf = requestAnimationFrame(step);
  }

  function maybeSettle() {
    idleTimer = 0;
    if (!live() || !armed || suppress || fingerDown || settling) return;
    if (quietModeActive() || prefersReducedMotion()) return;
    var y = currentScrollY();
    var target = chooseBeatDestination(y, direction, collectRests());
    if (target == null) return;
    target = clamp(target, 0, maxScrollY());
    if (!(Math.abs(target - y) > 0)) return;
    startSettle(target);
  }

  function onScroll() {
    if (!live() || settling) return;
    var now = performance.now ? performance.now() : Date.now();
    if (now < ignoreScrollUntil) return;
    var y = currentScrollY();
    if (y > lastY + 0.5) direction = 1;
    else if (y < lastY - 0.5) direction = -1;
    lastY = y;
    if (sawContact && !suppress) armed = true;
    if (armed && !fingerDown && !suppress) scheduleIdle();
  }

  function onPointerDown() {
    if (!live()) return;
    cancelSettle();
    fingerDown = true;
    sawContact = true;
    clearIdle();
  }

  function onTouchMove() {
    if (!live()) return;
    cancelSettle();
    fingerDown = true;
    armed = true;
    suppress = false;
    clearIdle();
  }

  function onPointerMove(event) {
    if (!live()) return;
    if (!fingerDown && !(event && event.buttons > 0)) return;
    onTouchMove();
  }

  function onPointerUp() {
    if (!live()) return;
    fingerDown = false;
    if (armed && !suppress) scheduleIdle();
  }

  function onWheel() {
    if (!live()) return;
    cancelSettle();
    armed = true;
    suppress = false;
    fingerDown = false;
    scheduleIdle();
  }

  var SCROLL_KEYS = {
    ArrowUp: 1,
    ArrowDown: 1,
    ArrowLeft: 1,
    ArrowRight: 1,
    PageUp: 1,
    PageDown: 1,
    Home: 1,
    End: 1,
    " ": 1,
    Spacebar: 1
  };

  function onKeyDown(event) {
    if (!live() || !event) return;
    if (!SCROLL_KEYS[event.key]) return;
    cancelSettle();
    armed = true;
    suppress = false;
    scheduleIdle();
  }

  function onResize() {
    authoredSvhPxCache = 0;
    cancelSettle();
    clearIdle();
  }

  function onPageHide() {
    cancelSettle();
    clearIdle();
    armed = false;
    fingerDown = false;
    sawContact = false;
  }

  function onVisibility() {
    if (document.hidden) onPageHide();
  }

  function onHashOrNav() {
    cancelSettle();
    clearIdle();
    armed = false;
    suppress = true;
    fingerDown = false;
    sawContact = false;
  }

  function onActivate(event) {
    if (!live() || !event) return;
    var node = event.target;
    while (node && node !== document) {
      var tag = node.tagName;
      if (tag === "A" || tag === "BUTTON") {
        onHashOrNav();
        return;
      }
      node = node.parentNode;
    }
  }

  function attach() {
    if (bound) return;
    opening = document.getElementById("opening");
    hand = document.getElementById("hand");
    work = document.getElementById("work");
    if (!opening || !hand || !work) return;
    bound = true;
    armed = false;
    suppress = false;
    fingerDown = false;
    sawContact = false;
    settling = false;
    direction = 0;
    lastY = currentScrollY();
    authoredSvhPxCache = 0;
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onPointerDown, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onPointerUp, { passive: true });
    window.addEventListener("touchcancel", onPointerUp, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("hashchange", onHashOrNav);
    window.addEventListener("popstate", onHashOrNav);
    document.addEventListener("click", onActivate, true);
  }

  function detach() {
    if (!bound) return;
    cancelSettle();
    clearIdle();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onPointerDown);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onPointerUp);
    window.removeEventListener("touchcancel", onPointerUp);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("pagehide", onPageHide);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("hashchange", onHashOrNav);
    window.removeEventListener("popstate", onHashOrNav);
    document.removeEventListener("click", onActivate, true);
    bound = false;
    armed = false;
    suppress = false;
    fingerDown = false;
    sawContact = false;
    opening = null;
    hand = null;
    work = null;
  }

  function onBreakpointChange() {
    if (isMobileViewport() && !quietModeActive()) attach();
    else detach();
  }

  function boot() {
    if (typeof window === "undefined" || !window.document) return;
    if (!document.getElementById("opening")) return;
    try {
      mediaQuery = window.matchMedia("(max-width: " + MOBILE_MAX_WIDTH + "px)");
    } catch (e) {
      return;
    }
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", onBreakpointChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(onBreakpointChange);
    }
    onBreakpointChange();
  }

  api.boot = boot;
  api.collectRests = collectRests;
  api.cancelSettle = cancelSettle;

  if (typeof window !== "undefined") {
    window.__ranaMobileBeatSettle = api;
    if (window.document) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
      } else {
        boot();
      }
    }
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
