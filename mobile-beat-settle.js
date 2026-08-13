/* RANA LEVY mobile beat settle.
 *
 * One continuous single-finger vertical gesture that begins at authored
 * rest N may finish only at N-1, N, or N+1. Native touch momentum does
 * not own passage distance. The first-axis latch may hold native scroll
 * during contact; completed net motion owns the lift. While attached,
 * html and body keep touch-action: pan-x pinch-zoom. Body keeps a
 * standing overflow-y:hidden vertical lock so the document is not a
 * native vertical scroller (when root overflow-y stays visible, the
 * viewport takes body's overflow-y). Root overflow is left exactly as
 * authored so sticky scenes keep the viewport containing block; root
 * overflow-y hidden|clip unpins them. Only controller scrollTo may
 * move the passage. Detach restores the exact prior inline
 * touch-action and overflow values. A second contact interrupts
 * ownership but keeps the origin.
 * Destinations are the Opening terminal hold, BEAT_DWELL Hand/Work
 * plateaus, and the Work terminal — inverted from the existing remap
 * mathematics, then snapped to reachable whole CSS pixels. Adjacent
 * gesture landings aim at the composed plateau center so the damped
 * visual clock stays inside the hold, not on a black leading edge.
 * Quiet and reduced-motion stay native. Desktop stays unbound. Not
 * CSS scroll-snap.
 *
 * Residue: mobile beat settle
 * Disposition: maintained asset
 * Future consumer: homepage mobile visitor after a finger gesture; any operator editing passage beats
 * Activation: auto-load — index.html script after site.js
 * Behavioral check: node tools/assert-mobile-beat-settle.mjs && node tools/assert-mobile-composed-rest-landings.mjs
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
  var SWIPE_THRESHOLD_PX = 10;
  var TOUCH_ACTION_POLICY = "pan-x pinch-zoom";
  var VERTICAL_OVERFLOW_LOCK = "hidden";

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function lastReachableScrollY(maxY) {
    if (!(maxY > 0)) return 0;
    return Math.floor(maxY);
  }

  // Continuous authored [start, end] → reachable whole CSS pixels.
  // A plateau that contains an integer becomes first..last integer inside it.
  // A zero/narrow span with no integer becomes one nearest reachable point.
  function operationalRest(rest) {
    if (!rest) return rest;
    var first = Math.ceil(rest.start);
    var last = Math.floor(rest.end);
    if (first <= last) {
      return { id: rest.id, start: first, end: last };
    }
    var nearest = Math.round((rest.start + rest.end) / 2);
    return { id: rest.id, start: nearest, end: nearest };
  }

  function operationalRests(rests, maxY) {
    if (!rests || !rests.length) return rests || [];
    var reachableMax = maxY == null ? null : lastReachableScrollY(maxY);
    var out = [];
    var i;
    var rest;
    for (i = 0; i < rests.length; i++) {
      rest = operationalRest(rests[i]);
      if (reachableMax != null) {
        rest.start = clamp(rest.start, 0, reachableMax);
        rest.end = clamp(rest.end, 0, reachableMax);
        if (rest.end < rest.start) rest.start = rest.end;
        if (rest.id === "work-terminal") {
          rest.start = reachableMax;
          rest.end = reachableMax;
        }
      }
      out.push(rest);
    }
    return out;
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

  function restAimY(rest) {
    if (!rest) return null;
    if (rest.start === rest.end) return rest.start;
    return Math.round((rest.start + rest.end) / 2);
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
  // when the viewport is already inside an exact operational rest.
  function chooseBeatDestination(scrollY, direction, rests, options) {
    if (!rests || !rests.length) return null;
    rests = operationalRests(rests);
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

  function restIndexForY(y, rests) {
    if (!rests || !rests.length) return 0;
    rests = operationalRests(rests);
    var prev = -1;
    var next = -1;
    var i;
    var rest;
    for (i = 0; i < rests.length; i++) {
      rest = rests[i];
      if (y >= rest.start && y <= rest.end) return i;
      if (rest.end < y) prev = i;
      if (rest.start > y && next < 0) next = i;
    }
    if (prev < 0) return next < 0 ? 0 : next;
    if (next < 0) return prev;
    return y - rests[prev].end <= rests[next].start - y ? prev : next;
  }

  function classifyTouchIntent(dx, dy, thresholdPx) {
    var threshold = thresholdPx == null ? SWIPE_THRESHOLD_PX : thresholdPx;
    var adx = Math.abs(dx);
    var ady = Math.abs(dy);
    if (adx < threshold && ady < threshold) return null;
    if (ady >= adx && ady >= threshold) return "vertical";
    return "horizontal";
  }

  // True when an element's inline overflow cannot feed native vertical
  // document momentum. Empty / visible / auto / scroll remain available.
  function nativeVerticalOverflowLocked(style) {
    if (!style) return false;
    var y = style.overflowY;
    if (y === "hidden" || y === "clip") return true;
    var all = style.overflow;
    if (!y && all) {
      var parts = String(all).trim().split(/\s+/);
      var axisY = parts.length > 1 ? parts[1] : parts[0];
      if (axisY === "hidden" || axisY === "clip") return true;
    }
    return false;
  }

  function completedVerticalIntent(dx, dy, thresholdPx) {
    return classifyTouchIntent(dx, dy, thresholdPx) === "vertical";
  }

  // Pure adjacent-destination: finger deltaY > 0 is swipe down / reverse.
  // Never more than one rest away, regardless of swipe length.
  // Land on the composed plateau center, not the leading/trailing edge.
  function chooseAdjacentDestination(originIndex, swipeDeltaY, rests, options) {
    if (!rests || !rests.length) return { index: 0, y: null };
    rests = operationalRests(rests);
    var last = rests.length - 1;
    var origin = originIndex;
    if (origin == null || origin !== origin) origin = 0;
    origin = clamp(Math.round(origin), 0, last);
    var threshold =
      options && options.thresholdPx != null
        ? options.thresholdPx
        : SWIPE_THRESHOLD_PX;
    var dest = origin;
    if (Math.abs(swipeDeltaY) >= threshold) {
      if (swipeDeltaY < 0) dest = Math.min(last, origin + 1);
      else dest = Math.max(0, origin - 1);
    }
    if (dest === origin) return { index: dest, y: null };
    return {
      index: dest,
      y: restAimY(rests[dest])
    };
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
    SWIPE_THRESHOLD_PX: SWIPE_THRESHOLD_PX,
    deriveOpeningFinalPhysical: deriveOpeningFinalPhysical,
    plateauPhysicalRange: plateauPhysicalRange,
    lastReachableScrollY: lastReachableScrollY,
    operationalRest: operationalRest,
    operationalRests: operationalRests,
    restIndexForY: restIndexForY,
    classifyTouchIntent: classifyTouchIntent,
    completedVerticalIntent: completedVerticalIntent,
    chooseBeatDestination: chooseBeatDestination,
    chooseAdjacentDestination: chooseAdjacentDestination,
    mergeRests: mergeRests,
    restAimY: restAimY,
    aimAtRest: aimAtRest,
    TOUCH_ACTION_POLICY: TOUCH_ACTION_POLICY,
    VERTICAL_OVERFLOW_LOCK: VERTICAL_OVERFLOW_LOCK,
    nativeVerticalOverflowLocked: nativeVerticalOverflowLocked,
    isNativeVerticalDocumentScrollLocked: isNativeVerticalDocumentScrollLocked,
    rootOverflowPreservesStickyContainingBlock: rootOverflowPreservesStickyContainingBlock
  };

  var authoredSvhPxCache = 0;
  var opening = null;
  var hand = null;
  var work = null;
  var bound = false;
  var armed = false;
  var suppress = false;
  var fingerDown = false;
  var settling = false;
  var settleGen = 0;
  var raf = 0;
  var idleTimer = 0;
  var direction = 0;
  var lastY = 0;
  var ignoreScrollUntil = 0;
  var settleTargetY = 0;
  var gesture = null;
  var mediaQuery = null;
  var reduceQuery = null;
  var priorRootTouchAction = "";
  var priorBodyTouchAction = "";
  var priorRootOverflow = "";
  var priorRootOverflowX = "";
  var priorRootOverflowY = "";
  var priorBodyOverflow = "";
  var priorBodyOverflowX = "";
  var priorBodyOverflowY = "";
  var documentLockOwned = false;

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

  function shouldCaptureTouch() {
    return live() && !quietModeActive() && !prefersReducedMotion();
  }

  function isNativeVerticalDocumentScrollLocked() {
    if (!documentLockOwned) return false;
    var body = typeof document !== "undefined" ? document.body : null;
    return nativeVerticalOverflowLocked(body && body.style);
  }

  // Root overflow-y hidden|clip makes html the sticky scrollport and
  // leaves composed scenes at their static position.
  function rootOverflowPreservesStickyContainingBlock(style) {
    return !nativeVerticalOverflowLocked(style);
  }

  function snapshotInlineOverflow(style) {
    if (!style) {
      return { overflow: "", overflowX: "", overflowY: "" };
    }
    return {
      overflow: style.overflow,
      overflowX: style.overflowX,
      overflowY: style.overflowY
    };
  }

  function restoreInlineOverflow(style, prior) {
    if (!style || !prior) return;
    style.overflow = prior.overflow;
    style.overflowX = prior.overflowX;
    style.overflowY = prior.overflowY;
  }

  function applyDocumentTouchAction() {
    if (documentLockOwned) return;
    var root = typeof document !== "undefined" ? document.documentElement : null;
    var body = typeof document !== "undefined" ? document.body : null;
    var rootOverflow = snapshotInlineOverflow(root && root.style);
    var bodyOverflow = snapshotInlineOverflow(body && body.style);
    priorRootTouchAction = root && root.style ? root.style.touchAction : "";
    priorBodyTouchAction = body && body.style ? body.style.touchAction : "";
    priorRootOverflow = rootOverflow.overflow;
    priorRootOverflowX = rootOverflow.overflowX;
    priorRootOverflowY = rootOverflow.overflowY;
    priorBodyOverflow = bodyOverflow.overflow;
    priorBodyOverflowX = bodyOverflow.overflowX;
    priorBodyOverflowY = bodyOverflow.overflowY;
    if (root && root.style) {
      root.style.touchAction = TOUCH_ACTION_POLICY;
    }
    if (body && body.style) {
      body.style.touchAction = TOUCH_ACTION_POLICY;
      body.style.overflowY = VERTICAL_OVERFLOW_LOCK;
    }
    documentLockOwned = true;
  }

  function restoreDocumentTouchAction() {
    if (!documentLockOwned) return;
    var root = typeof document !== "undefined" ? document.documentElement : null;
    var body = typeof document !== "undefined" ? document.body : null;
    if (root && root.style) {
      root.style.touchAction = priorRootTouchAction;
      restoreInlineOverflow(root.style, {
        overflow: priorRootOverflow,
        overflowX: priorRootOverflowX,
        overflowY: priorRootOverflowY
      });
    }
    if (body && body.style) {
      body.style.touchAction = priorBodyTouchAction;
      restoreInlineOverflow(body.style, {
        overflow: priorBodyOverflow,
        overflowX: priorBodyOverflowX,
        overflowY: priorBodyOverflowY
      });
    }
    priorRootTouchAction = "";
    priorBodyTouchAction = "";
    priorRootOverflow = "";
    priorRootOverflowX = "";
    priorRootOverflowY = "";
    priorBodyOverflow = "";
    priorBodyOverflowX = "";
    priorBodyOverflowY = "";
    documentLockOwned = false;
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
    return operationalRests(mergeRests(rests, NEAR_PX), maxY);
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

  function stopNativeMomentum(y) {
    // Standing overflow-y lock already makes native momentum unavailable.
    // Do not pulse-restore overflow; that re-opens the Samsung scroller.
    window.scrollTo(0, y);
  }

  function holdGestureOrigin() {
    if (!gesture) return;
    if (Math.abs(currentScrollY() - gesture.originY) > 0) {
      window.scrollTo(0, gesture.originY);
    }
  }

  function cancelGesture() {
    if (gesture && gesture.locked) {
      stopNativeMomentum(gesture.originY);
    }
    gesture = null;
  }

  function matchingTouch(list, id) {
    if (!list) return null;
    var i;
    var touch;
    for (i = 0; i < list.length; i++) {
      touch = list[i];
      if (touch && touch.identifier === id) return touch;
    }
    return null;
  }

  function notePrimaryTouch(event, useChanged) {
    if (!gesture || !event) return;
    var touch = matchingTouch(event.touches, gesture.identifier);
    if (!touch && useChanged) {
      touch = matchingTouch(event.changedTouches, gesture.identifier);
    }
    if (touch) {
      gesture.lastX = touch.clientX;
      gesture.lastY = touch.clientY;
    }
  }

  function interruptGesture() {
    if (!gesture) return;
    gesture.interrupted = true;
    gesture.locked = false;
  }

  function finishSettle() {
    settling = false;
    raf = 0;
    direction = 0;
    ignoreScrollUntil = (performance.now ? performance.now() : Date.now()) + 80;
    stopNativeMomentum(settleTargetY);
  }

  function startSettle(targetY) {
    cancelSettle();
    var from = currentScrollY();
    var dist = Math.abs(targetY - from);
    settleTargetY = targetY;
    if (!(dist > 0)) {
      stopNativeMomentum(targetY);
      return;
    }
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
    target = clamp(target, 0, lastReachableScrollY(maxScrollY()));
    if (!(Math.abs(target - y) > 0)) return;
    startSettle(target);
  }

  function onScroll() {
    if (!live() || settling) return;
    if (gesture && gesture.locked) {
      holdGestureOrigin();
      return;
    }
    var now = performance.now ? performance.now() : Date.now();
    if (now < ignoreScrollUntil) return;
    var y = currentScrollY();
    if (y > lastY + 0.5) direction = 1;
    else if (y < lastY - 0.5) direction = -1;
    lastY = y;
    if (armed && !fingerDown && !suppress) scheduleIdle();
  }

  function onTouchStart(event) {
    if (!live()) return;
    cancelSettle();
    clearIdle();
    armed = false;
    fingerDown = true;
    if (gesture) {
      if (event && event.touches && event.touches.length > 1) {
        interruptGesture();
        return;
      }
      cancelGesture();
    }
    if (!shouldCaptureTouch()) return;
    if (!event || !event.touches || event.touches.length !== 1) return;
    var touch = event.touches[0];
    var y = currentScrollY();
    var rests = collectRests();
    if (!rests.length) return;
    gesture = {
      identifier: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
      originY: y,
      originIndex: restIndexForY(y, rests),
      axis: null,
      locked: false,
      interrupted: false
    };
  }

  function onTouchMove(event) {
    if (!live()) return;
    cancelSettle();
    fingerDown = true;
    clearIdle();
    if (!shouldCaptureTouch() || !gesture) return;
    if (!event || !event.touches || !event.touches.length) return;
    if (event.touches.length !== 1) {
      interruptGesture();
    }
    notePrimaryTouch(event, false);
    if (gesture.interrupted) return;
    var dx = gesture.lastX - gesture.startX;
    var dy = gesture.lastY - gesture.startY;
    if (gesture.axis !== "vertical" && gesture.axis !== "horizontal") {
      gesture.axis = classifyTouchIntent(dx, dy);
      if (gesture.axis === "vertical") {
        gesture.locked = true;
        stopNativeMomentum(gesture.originY);
      }
    }
    if (gesture.axis === "vertical") {
      if (event.cancelable) event.preventDefault();
      holdGestureOrigin();
    }
  }

  function onTouchEnd(event) {
    if (!live()) return;
    if (event && event.touches && event.touches.length > 0) {
      fingerDown = true;
      interruptGesture();
      notePrimaryTouch(event, true);
      cancelSettle();
      clearIdle();
      return;
    }
    fingerDown = false;
    if (!gesture) return;
    notePrimaryTouch(event, true);
    var dx = gesture.lastX - gesture.startX;
    var dy = gesture.lastY - gesture.startY;
    var originIndex = gesture.originIndex;
    var originY = gesture.originY;
    gesture = null;
    if (!shouldCaptureTouch() || !completedVerticalIntent(dx, dy)) return;
    if (event && event.cancelable) event.preventDefault();
    stopNativeMomentum(originY);
    var dest = chooseAdjacentDestination(originIndex, dy, collectRests());
    if (!dest || dest.y == null) return;
    dest.y = clamp(dest.y, 0, lastReachableScrollY(maxScrollY()));
    if (!(Math.abs(dest.y - originY) > 0)) return;
    startSettle(dest.y);
  }

  function onTouchCancel() {
    if (!live()) return;
    fingerDown = false;
    cancelSettle();
    clearIdle();
    cancelGesture();
  }

  function onPointerDown() {
    if (!live()) return;
    cancelSettle();
    clearIdle();
    fingerDown = true;
  }

  function onPointerMove(event) {
    if (!live()) return;
    if (gesture) return;
    if (!fingerDown && !(event && event.buttons > 0)) return;
    cancelSettle();
    clearIdle();
  }

  function onPointerUp() {
    if (!live()) return;
    if (gesture) return;
    fingerDown = false;
  }

  function onWheel() {
    if (!live()) return;
    cancelSettle();
    cancelGesture();
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
    cancelGesture();
  }

  function onPageHide() {
    cancelSettle();
    clearIdle();
    cancelGesture();
    armed = false;
    fingerDown = false;
  }

  function onVisibility() {
    if (document.hidden) onPageHide();
  }

  function onHashOrNav() {
    cancelSettle();
    clearIdle();
    cancelGesture();
    armed = false;
    suppress = true;
    fingerDown = false;
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
    if (!isMobileViewport() || quietModeActive() || prefersReducedMotion()) return;
    opening = document.getElementById("opening");
    hand = document.getElementById("hand");
    work = document.getElementById("work");
    if (!opening || !hand || !work) return;
    bound = true;
    armed = false;
    suppress = false;
    fingerDown = false;
    settling = false;
    gesture = null;
    direction = 0;
    lastY = currentScrollY();
    authoredSvhPxCache = 0;
    applyDocumentTouchAction();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: false });
    window.addEventListener("touchcancel", onTouchCancel, { passive: true });
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
    cancelGesture();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("touchcancel", onTouchCancel);
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
    restoreDocumentTouchAction();
    bound = false;
    armed = false;
    suppress = false;
    fingerDown = false;
    opening = null;
    hand = null;
    work = null;
  }

  function onBreakpointChange() {
    if (isMobileViewport() && !quietModeActive() && !prefersReducedMotion()) attach();
    else detach();
  }

  function listenMedia(query, fn) {
    if (!query) return;
    if (query.addEventListener) query.addEventListener("change", fn);
    else if (query.addListener) query.addListener(fn);
  }

  function boot() {
    if (typeof window === "undefined" || !window.document) return;
    if (!document.getElementById("opening")) return;
    try {
      mediaQuery = window.matchMedia("(max-width: " + MOBILE_MAX_WIDTH + "px)");
    } catch (e) {
      return;
    }
    try {
      reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    } catch (e) {
      reduceQuery = null;
    }
    listenMedia(mediaQuery, onBreakpointChange);
    listenMedia(reduceQuery, onBreakpointChange);
    onBreakpointChange();
  }

  api.boot = boot;
  api.collectRests = collectRests;
  api.cancelSettle = cancelSettle;
  api.startSettle = startSettle;
  api.attach = attach;
  api.detach = detach;
  api.onBreakpointChange = onBreakpointChange;

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
