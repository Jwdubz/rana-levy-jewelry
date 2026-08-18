/**
 * RANA non-home shell — Index, Held, catalog instrument, gallery helpers.
 * Dependency-free. Safe on a plain static server.
 *
 * Residue: maintained asset — shared non-home system for the jewelry passage.
 * Future consumer: every non-home HTML page (ready/made/gallery/services/journal/
 *   consultation/terms/privacy) and pure-function verification of filter/sort/hash.
 * Activation: auto-load — <script src="shell.js"> after data/catalog.js where needed.
 * Behavioral check: node --check shell.js; pure filter/sort/hash/gallery tests; static
 *   server browse of ready.html#p=<id> for Held restore (browser lane).
 * Retirement: when the non-home shell is replaced by a different architecture.
 */
(function (global) {
  "use strict";

  var SHELL = global.RANA_SHELL || (global.RANA_SHELL = {});

  var INDEX_LINKS = [
    { href: "index.html", label: "Home" },
    { href: "ready.html", label: "Ready Now" },
    { href: "made.html", label: "Made To Order" },
    { href: "faq.html", label: "FAQ" },
    { href: "gallery.html", label: "Gallery" },
    { href: "services.html", label: "Services" },
    { href: "journal.html", label: "Journal" },
    { href: "consultation.html", label: "Consultation" },
    { href: "terms.html", label: "Terms" },
    { href: "privacy.html", label: "Privacy" },
  ];

  var EXTERNAL_LINKS = [
    {
      href: "https://www.instagram.com/thepacificlights/",
      label: "Instagram",
    },
    {
      href: "https://www.youtube.com/@thepacificlightsgems",
      label: "YouTube",
    },
    {
      href: "https://www.ranalevyjewelry.com/",
      label: "Live site",
    },
  ];

  var RHYTHM = ["a", "b", "c", "d"];

  /* ---------- Pure helpers (testable) ---------- */

  function urlQuietActive() {
    try {
      return new URLSearchParams(location.search).get("motion") === "quiet";
    } catch (e) {
      return false;
    }
  }

  // Quiet choreography is available only through the explicit URL mode.
  function isQuietMode() {
    return urlQuietActive();
  }

  function syncQuietClasses() {
    var quiet = isQuietMode();
    document.documentElement.classList.toggle("is-quiet", quiet);
    if (document.body) document.body.classList.toggle("is-quiet", quiet);
  }

  function formatUsd(cents, priceFrom) {
    if (typeof cents !== "number" || !isFinite(cents)) return "";
    var dollars = cents / 100;
    var formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: dollars % 1 === 0 ? 0 : 2,
    }).format(dollars);
    return priceFrom ? "From " + formatted : formatted;
  }

  function availabilityCue(record, mode) {
    if (!record) return "";
    if (mode === "made") {
      return record.available ? "Made to order" : "Sold";
    }
    if (mode === "gallery") {
      if (record.collection === "made") {
        return record.available ? "Made to order" : "Design archive";
      }
      return record.available ? "Ready to ship" : "Sold";
    }
    return record.available ? "Ready to ship" : "Sold";
  }

  function collectionLabel(record) {
    if (!record) return "";
    if (record.collection === "made") return "Made To Order";
    if (record.collection === "ready") {
      return record.available ? "Ready Now" : "Ready — sold";
    }
    return record.collection || "";
  }

  // The Zoom consultation is a service listing harvested into Made To Order.
  // Keep the data file intact; never treat it as jewelry in tray, search, or Held.
  function isConsultationService(record) {
    if (!record) return false;
    var href = String(record.href || "");
    return href.indexOf("/consultation-via-zoom-30-usd") !== -1;
  }

  function jewelryRecords(records) {
    var list = Array.isArray(records) ? records : [];
    return list.filter(function (record) {
      return !isConsultationService(record);
    });
  }

  function pieceLocalHref(record) {
    if (!record || !record.id) return "#";
    return buildHeldHash(record.id);
  }

  function normalizeQuery(q) {
    return String(q || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function recordSearchBlob(record) {
    var parts = [
      record.title || "",
      record.kind || "",
      (record.stones || []).join(" "),
      (record.tags || []).join(" "),
    ];
    return parts.join(" ").toLowerCase();
  }

  function filterRecords(records, state) {
    var list = Array.isArray(records) ? records.slice() : [];
    var q = normalizeQuery(state && state.query);
    var kind = state && state.kind ? String(state.kind) : "";
    var stone = state && state.stone ? String(state.stone) : "";
    var availability = state && state.availability ? String(state.availability) : "all";

    return list.filter(function (record) {
      if (kind && record.kind !== kind) return false;
      if (stone) {
        var stones = record.stones || [];
        var hit = false;
        for (var i = 0; i < stones.length; i += 1) {
          if (stones[i] === stone) {
            hit = true;
            break;
          }
        }
        if (!hit) return false;
      }
      if (availability === "available" && !record.available) return false;
      if (availability === "sold" && record.available) return false;
      if (q && recordSearchBlob(record).indexOf(q) === -1) return false;
      return true;
    });
  }

  function sortRecords(records, sortKey) {
    var list = Array.isArray(records) ? records.slice() : [];
    var key = sortKey || "source";
    if (key === "price-asc") {
      list.sort(function (a, b) {
        var pa = typeof a.priceCents === "number" ? a.priceCents : 0;
        var pb = typeof b.priceCents === "number" ? b.priceCents : 0;
        if (pa !== pb) return pa - pb;
        return (a.order || 0) - (b.order || 0);
      });
      return list;
    }
    if (key === "price-desc") {
      list.sort(function (a, b) {
        var pa = typeof a.priceCents === "number" ? a.priceCents : 0;
        var pb = typeof b.priceCents === "number" ? b.priceCents : 0;
        if (pa !== pb) return pb - pa;
        return (a.order || 0) - (b.order || 0);
      });
      return list;
    }
    list.sort(function (a, b) {
      return (a.order || 0) - (b.order || 0);
    });
    return list;
  }

  function deriveFacets(records) {
    var kinds = {};
    var stones = {};
    var list = Array.isArray(records) ? records : [];
    for (var i = 0; i < list.length; i += 1) {
      var r = list[i];
      if (r.kind) kinds[r.kind] = (kinds[r.kind] || 0) + 1;
      var ss = r.stones || [];
      for (var j = 0; j < ss.length; j += 1) {
        stones[ss[j]] = (stones[ss[j]] || 0) + 1;
      }
    }
    function keysSorted(map) {
      return Object.keys(map).sort(function (a, b) {
        return a.localeCompare(b);
      });
    }
    return {
      kinds: keysSorted(kinds),
      stones: keysSorted(stones),
    };
  }

  function encodePieceId(id) {
    return encodeURIComponent(String(id || ""));
  }

  function decodePieceId(encoded) {
    try {
      return decodeURIComponent(String(encoded || ""));
    } catch (e) {
      return String(encoded || "");
    }
  }

  function parseHeldHash(hash) {
    var raw = String(hash || "");
    if (raw.charAt(0) === "#") raw = raw.slice(1);
    if (!raw) return null;
    // Accept p=<id> form; ignore other hashes.
    var parts = raw.split("&");
    for (var i = 0; i < parts.length; i += 1) {
      var pair = parts[i].split("=");
      if (pair[0] === "p" && pair[1]) {
        return decodePieceId(pair.slice(1).join("="));
      }
    }
    return null;
  }

  function buildHeldHash(id) {
    return "#p=" + encodePieceId(id);
  }

  function findRecordIndex(records, id) {
    if (!id) return -1;
    for (var i = 0; i < records.length; i += 1) {
      if (records[i].id === id) return i;
    }
    return -1;
  }

  function buildGalleryRecords(catalog) {
    var ready = (catalog && catalog.ready) || [];
    var made = jewelryRecords((catalog && catalog.made) || []);
    var sold = ready.filter(function (r) {
      return !r.available && (r.hero || r.thumb);
    });
    var madePool = made.filter(function (r) {
      return r.hero || r.thumb;
    });

    var gallery = [];
    var soldTarget = 16;
    var madeTarget = 12;
    var soldStep = Math.max(1, Math.floor(sold.length / soldTarget) || 1);
    var madeStep = Math.max(1, Math.floor(madePool.length / madeTarget) || 1);

    for (var i = 0; i < sold.length && gallery.length < soldTarget; i += soldStep) {
      gallery.push(sold[i]);
    }
    // Backfill if stride skipped too many.
    for (var s = 0; s < sold.length && gallery.length < soldTarget; s += 1) {
      if (findRecordIndex(gallery, sold[s].id) === -1) gallery.push(sold[s]);
    }

    var madeStart = gallery.length;
    for (
      var m = 0;
      m < madePool.length && gallery.length - madeStart < madeTarget;
      m += madeStep
    ) {
      gallery.push(madePool[m]);
    }
    for (
      var m2 = 0;
      m2 < madePool.length && gallery.length - madeStart < madeTarget;
      m2 += 1
    ) {
      if (findRecordIndex(gallery, madePool[m2].id) === -1) {
        gallery.push(madePool[m2]);
      }
    }

    // Absolute floor: at least 24 when pool allows.
    var floor = 24;
    if (gallery.length < floor) {
      for (var x = 0; x < sold.length && gallery.length < floor; x += 1) {
        if (findRecordIndex(gallery, sold[x].id) === -1) gallery.push(sold[x]);
      }
      for (var y = 0; y < madePool.length && gallery.length < floor; y += 1) {
        if (findRecordIndex(gallery, madePool[y].id) === -1) {
          gallery.push(madePool[y]);
        }
      }
    }

    return gallery;
  }

  function countStatus(visible, total, mode) {
    var noun =
      mode === "made" ? "designs" : mode === "gallery" ? "works" : "pieces";
    if (visible === 0) return "No " + noun + " match.";
    if (visible === total) {
      return visible + " " + noun;
    }
    return "Showing " + visible + " of " + total + " " + noun;
  }

  /* ---------- DOM utilities ---------- */

  function keyLogoToCanvas(source) {
    var w = source.naturalWidth || source.width;
    var h = source.naturalHeight || source.height;
    if (!w || !h) return null;
    var canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.setAttribute("aria-hidden", "true");
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, w, h);
    var imageData = ctx.getImageData(0, 0, w, h);
    var data = imageData.data;
    var count = w * h;
    for (var i = 0, p = 0; p < count; i += 4, p += 1) {
      var r = data[i];
      var g = data[i + 1];
      var b = data[i + 2];
      var a = data[i + 3] / 255;
      var lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      var outA = 0;
      if (lum < 0.48 && a > 0.02) {
        var darkness = Math.min(1, ((0.48 - lum) / 0.48) * 1.72);
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

  function loadShellMark() {
    var mark = document.getElementById("shell-mark");
    if (!mark || mark.querySelector("canvas")) return;
    var img = new Image();
    img.decoding = "async";
    img.onload = function () {
      try {
        var canvas = keyLogoToCanvas(img);
        if (canvas) mark.appendChild(canvas);
      } catch (err) {}
    };
    img.onerror = function () {};
    img.src = "assets/rana-logo.png";
  }

  function pageFileName() {
    var path = location.pathname || "";
    var parts = path.split("/");
    var name = parts[parts.length - 1] || "index.html";
    if (!name || name === "") return "index.html";
    return name;
  }

  function withMotionQuery(href) {
    if (!href || typeof href !== "string") return href;
    // External, mail, tel, and hash-only links stay untouched.
    if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
    if (href.charAt(0) === "#") return href;
    try {
      if (!urlQuietActive()) return href;
      // Already carries a motion param — leave as authored.
      if (/(?:^|[?&])motion=/.test(href)) return href;
      var hashIndex = href.indexOf("#");
      var beforeHash = hashIndex === -1 ? href : href.slice(0, hashIndex);
      var hash = hashIndex === -1 ? "" : href.slice(hashIndex);
      var join = beforeHash.indexOf("?") === -1 ? "?" : "&";
      return beforeHash + join + "motion=quiet" + hash;
    } catch (e) {}
    return href;
  }

  function preserveQuietOnLocalLinks(root) {
    if (!urlQuietActive()) return;
    var scope = root || document;
    var links = scope.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i += 1) {
      var link = links[i];
      var href = link.getAttribute("href");
      if (!href) continue;
      var next = withMotionQuery(href);
      if (next !== href) link.setAttribute("href", next);
    }
  }

  /* ---------- Index overlay ---------- */

  function createIndexDialog() {
    var existing = document.getElementById("shell-index-dialog");
    if (existing) return existing;

    var dialog = document.createElement("dialog");
    dialog.id = "shell-index-dialog";
    dialog.className = "shell-index-dialog";
    dialog.setAttribute("aria-label", "Site index");

    var top = document.createElement("div");
    top.className = "shell-index-dialog__top";
    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "shell-index-dialog__close";
    closeBtn.textContent = "Close";
    closeBtn.setAttribute("data-index-close", "true");
    top.appendChild(closeBtn);

    var nav = document.createElement("nav");
    nav.className = "shell-index-dialog__nav";
    nav.setAttribute("aria-label", "Pages");
    var current = pageFileName();
    for (var i = 0; i < INDEX_LINKS.length; i += 1) {
      var item = INDEX_LINKS[i];
      var a = document.createElement("a");
      a.href = withMotionQuery(item.href);
      a.textContent = item.label;
      if (item.href === current) a.setAttribute("aria-current", "page");
      nav.appendChild(a);
    }

    var ext = document.createElement("div");
    ext.className = "shell-index-dialog__external";
    for (var j = 0; j < EXTERNAL_LINKS.length; j += 1) {
      var e = EXTERNAL_LINKS[j];
      var ea = document.createElement("a");
      ea.href = e.href;
      ea.textContent = e.label;
      ea.rel = "noopener";
      ext.appendChild(ea);
    }

    dialog.appendChild(top);
    dialog.appendChild(nav);
    dialog.appendChild(ext);
    document.body.appendChild(dialog);
    return dialog;
  }

  function setupIndex() {
    var openBtn = document.getElementById("shell-index-open");
    if (!openBtn) return null;

    var dialog = createIndexDialog();
    var lastFocus = null;

    function openIndex() {
      lastFocus = document.activeElement;
      document.body.classList.add("is-locked");
      openBtn.setAttribute("aria-expanded", "true");
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
      var closeBtn = dialog.querySelector("[data-index-close]");
      if (closeBtn) closeBtn.focus();
    }

    function closeIndex() {
      if (dialog.open || dialog.hasAttribute("open")) {
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
      }
      document.body.classList.remove("is-locked");
      openBtn.setAttribute("aria-expanded", "false");
      if (lastFocus && typeof lastFocus.focus === "function") {
        lastFocus.focus();
      } else {
        openBtn.focus();
      }
    }

    openBtn.addEventListener("click", function () {
      if (dialog.open) closeIndex();
      else openIndex();
    });

    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) closeIndex();
    });

    dialog.addEventListener("cancel", function (event) {
      event.preventDefault();
      closeIndex();
    });

    var closeBtn = dialog.querySelector("[data-index-close]");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeIndex);
    }

    // Local index links: optional view transition.
    dialog.addEventListener("click", function (event) {
      var link = event.target.closest("a");
      if (!link || !dialog.contains(link)) return;
      var href = link.getAttribute("href") || "";
      if (/^https?:/i.test(href) || href.indexOf("mailto:") === 0) return;
      // Let the browser navigate; view transition enhancement is optional.
      if (
        !isQuietMode() &&
        document.startViewTransition &&
        href.indexOf("#") !== 0
      ) {
        // Native navigation with @view-transition CSS when supported.
      }
    });

    return { open: openIndex, close: closeIndex, dialog: dialog };
  }

  /* ---------- Held surface ---------- */

  function createHeldDialog() {
    var existing = document.getElementById("shell-held");
    if (existing) return existing;

    var dialog = document.createElement("dialog");
    dialog.id = "shell-held";
    dialog.className = "shell-held";
    dialog.setAttribute("aria-labelledby", "shell-held-title");

    dialog.innerHTML =
      '<div class="shell-held__bar">' +
      '<button type="button" class="shell-held__close" data-held-close>Close</button>' +
      "</div>" +
      '<div class="shell-held__body">' +
      '<div class="shell-held__media">' +
      '<div class="shell-held__frame">' +
      '<img class="shell-held__image" id="shell-held-image" alt="" width="900" height="900">' +
      "</div></div>" +
      '<div class="shell-held__meta">' +
      '<h2 class="shell-held__title" id="shell-held-title"></h2>' +
      '<p class="shell-held__price" id="shell-held-price"></p>' +
      '<p class="shell-held__cue" id="shell-held-cue"></p>' +
      '<p class="shell-held__handoff" id="shell-held-handoff"></p>' +
      "</div></div>" +
      '<div class="shell-held__nav">' +
      '<button type="button" data-held-prev>Previous</button>' +
      '<button type="button" data-held-next>Next</button>' +
      "</div>";

    document.body.appendChild(dialog);
    return dialog;
  }

  function createHeldController(options) {
    var mode = (options && options.mode) || "ready";
    var getVisible = options && options.getVisibleRecords;
    var pageBase = (options && options.pageBase) || pageFileName();
    var dialog = createHeldDialog();
    var lastFocus = null;
    var currentId = null;
    // Explicit Held-session history: one modal layer, not a push per stone.
    // active         — dialog is open as the current history layer
    // layered/owned  — tray (or reloaded owned state) pushed this Held entry;
    //                  direct hash loads stay non-owned so Close never backs out
    // pendingConsume — explicit Close hid UI and called history.back(); popstate
    //                  owns final focus cleanup (avoid double restore)
    // suppressing    — ignore synthetic popstate while we mutate history
    var heldSession = {
      active: false,
      layered: false,
      pendingConsume: false,
      suppressing: false,
      imageToken: 0,
    };

    var els = {
      image: document.getElementById("shell-held-image"),
      title: document.getElementById("shell-held-title"),
      price: document.getElementById("shell-held-price"),
      cue: document.getElementById("shell-held-cue"),
      handoff: document.getElementById("shell-held-handoff"),
      prev: dialog.querySelector("[data-held-prev]"),
      next: dialog.querySelector("[data-held-next]"),
      close: dialog.querySelector("[data-held-close]"),
    };

    function visibleList() {
      return typeof getVisible === "function" ? getVisible() || [] : [];
    }

    function isDialogOpen() {
      return !!(dialog.open || dialog.hasAttribute("open"));
    }

    function heldUrl(id) {
      return pageBase + location.search + (id ? buildHeldHash(id) : "");
    }

    function withHistorySuppressed(fn) {
      heldSession.suppressing = true;
      try {
        fn();
      } catch (e) {}
      // popstate is sync for back/forward only; push/replace do not fire it.
      // Clear on next macrotask so any deferred hash listeners also skip.
      setTimeout(function () {
        heldSession.suppressing = false;
      }, 0);
    }

    function isOwnedHistoryState(state) {
      return !!(
        state &&
        typeof state === "object" &&
        (state.owned === true || state.layered === true)
      );
    }

    function writeHeldHistory(id, mode, owned) {
      // mode: "push" | "replace" | "none"
      // owned: explicit marker — never inferred from #p= alone
      if (mode === "none") return;
      var url = heldUrl(id);
      var isHeld = !!id;
      var isOwned = !!(isHeld && owned);
      var state = {
        ranaHeld: isHeld,
        heldId: id || null,
        page: pageBase,
        owned: isOwned,
        layered: isOwned,
      };
      withHistorySuppressed(function () {
        if (mode === "push") history.pushState(state, "", url);
        else history.replaceState(state, "", url);
      });
    }

    function revealHeldImage(record, token) {
      if (!els.image || !record) return;
      if (token !== heldSession.imageToken) return;
      if (currentId !== record.id) return;
      var src = record.hero || record.thumb || "";
      els.image.alt = record.imageAlt || record.title || "";
      els.image.title = record.title || "";
      if (!src) {
        els.image.removeAttribute("src");
        els.image.classList.remove("is-pending");
        els.image.classList.remove("is-ready");
        return;
      }
      // Gate the previous stone: hide until the intended image has decoded.
      els.image.classList.add("is-pending");
      els.image.classList.remove("is-ready");
      var probe = new Image();
      probe.decoding = "async";
      var finish = function (ok) {
        if (token !== heldSession.imageToken) return;
        if (currentId !== record.id) return;
        if (ok) {
          els.image.src = src;
          els.image.alt = record.imageAlt || record.title || "";
          els.image.title = record.title || "";
          els.image.classList.remove("is-pending");
          els.image.classList.add("is-ready");
        } else {
          // Keep composed frame/fallback; do not leave a stale prior stone.
          els.image.removeAttribute("src");
          els.image.classList.remove("is-pending");
          els.image.classList.remove("is-ready");
        }
      };
      probe.onload = function () {
        if (typeof probe.decode === "function") {
          probe
            .decode()
            .then(function () {
              finish(true);
            })
            .catch(function () {
              finish(true);
            });
        } else {
          finish(true);
        }
      };
      probe.onerror = function () {
        finish(false);
      };
      probe.src = src;
      // Cached image may already be complete before handlers attach.
      if (probe.complete && probe.naturalWidth > 0) {
        probe.onload = null;
        if (typeof probe.decode === "function") {
          probe
            .decode()
            .then(function () {
              finish(true);
            })
            .catch(function () {
              finish(true);
            });
        } else {
          finish(true);
        }
      }
    }

    function fill(record) {
      if (!record) return;
      currentId = record.id;
      heldSession.imageToken += 1;
      var token = heldSession.imageToken;

      els.title.textContent = record.title || "";
      els.price.textContent = formatUsd(record.priceCents, record.priceFrom);
      els.cue.textContent = availabilityCue(record, mode);
      els.handoff.innerHTML = "";

      // Explicit onward actions only. Catalog cards stay local; the live shop
      // is never the underlying product-card destination.
      var collection =
        record.collection ||
        (mode === "made" ? "made" : mode === "ready" ? "ready" : "");
      if (collection === "made" || mode === "made") {
        var consult = document.createElement("a");
        consult.href = "consultation.html";
        consult.textContent = "Ask about this design";
        els.handoff.appendChild(consult);
      }
      if (record.href) {
        var a = document.createElement("a");
        a.href = record.href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent =
          collection === "made" || mode === "made"
            ? "See this design on Rana's live shop"
            : "See it on Rana's live shop";
        els.handoff.appendChild(a);
      }

      var list = visibleList();
      var idx = findRecordIndex(list, record.id);
      els.prev.disabled = idx <= 0;
      els.next.disabled = idx < 0 || idx >= list.length - 1;

      revealHeldImage(record, token);
    }

    function showDialogSurface() {
      document.body.classList.add("is-locked");
      if (!isDialogOpen()) {
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      }
      if (els.close) els.close.focus();
    }

    function hideDialogSurface() {
      if (isDialogOpen()) {
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
      }
      document.body.classList.remove("is-locked");
      heldSession.imageToken += 1;
      if (els.image) {
        els.image.removeAttribute("src");
        els.image.alt = "";
        els.image.title = "";
        els.image.classList.remove("is-pending");
        els.image.classList.remove("is-ready");
      }
    }

    function open(record, opts) {
      if (!record) return;
      opts = opts || {};
      var wasOpen = heldSession.active && isDialogOpen();
      if (!wasOpen) {
        lastFocus = document.activeElement;
      }
      fill(record);
      showDialogSurface();
      heldSession.active = true;

      // History modes:
      // - history: "push"   open from tray → one owned Held layer
      // - history: "replace" prev/next: rewrite same entry, preserve owned marker
      // - history: "none"    popstate restore / pure UI
      // - history: "sync"    hash load: adopt owned only from history.state
      var historyMode = opts.history;
      if (!historyMode) {
        if (opts.push === false) historyMode = wasOpen ? "replace" : "sync";
        else historyMode = wasOpen ? "replace" : "push";
      }

      if (historyMode === "push") {
        writeHeldHistory(record.id, "push", true);
        heldSession.layered = true;
      } else if (historyMode === "replace") {
        // Prev/Next (and in-place fills) keep the existing owned/non-owned marker.
        writeHeldHistory(record.id, "replace", heldSession.layered);
      } else if (historyMode === "sync") {
        // Reload of an owned Held entry may carry owned/layered in history.state.
        // A cold direct load of ready.html#p=<id> has no underlying tray entry.
        var adopted = isOwnedHistoryState(history.state);
        writeHeldHistory(record.id, "replace", adopted);
        heldSession.layered = adopted;
      }
      // historyMode === "none": no history mutation (browser Back/Forward owns it).
    }

    function restoreLastFocus() {
      if (lastFocus && typeof lastFocus.focus === "function") {
        lastFocus.focus();
      }
      lastFocus = null;
    }

    function close(opts) {
      opts = opts || {};
      var reason = opts.reason || "explicit";
      // Owned explicit Close: consume the dedicated Held entry with history.back().
      // Non-owned (direct hash): replace URL to the tray base and stay on page.
      // popstate close: history already moved; final focus cleanup lands here.
      if (heldSession.active || isDialogOpen()) {
        hideDialogSurface();
      }
      heldSession.active = false;
      currentId = null;

      if (reason === "popstate") {
        heldSession.layered = false;
        heldSession.pendingConsume = false;
        restoreLastFocus();
        return;
      }

      if (reason === "explicit") {
        if (heldSession.layered) {
          // Hide immediately for responsiveness; do not replaceState (that would
          // duplicate the tray entry). popstate after back owns focus cleanup.
          heldSession.layered = false;
          heldSession.pendingConsume = true;
          try {
            history.back();
          } catch (e) {
            heldSession.pendingConsume = false;
            restoreLastFocus();
          }
          return;
        }
        // Direct/adopted non-owned hash: strip #p= in place; never leave the page.
        writeHeldHistory(null, "replace", false);
        heldSession.layered = false;
        heldSession.pendingConsume = false;
        restoreLastFocus();
      }
    }

    function openById(id, opts) {
      var list = visibleList();
      var idx = findRecordIndex(list, id);
      if (idx === -1) {
        // Fall back to full source if filtered out.
        var all =
          (options && options.getAllRecords && options.getAllRecords()) || list;
        idx = findRecordIndex(all, id);
        if (idx === -1) return false;
        open(all[idx], opts);
        return true;
      }
      open(list[idx], opts);
      return true;
    }

    function step(delta) {
      var list = visibleList();
      if (!list.length || !currentId) return;
      var idx = findRecordIndex(list, currentId);
      if (idx === -1) return;
      var next = idx + delta;
      if (next < 0 || next >= list.length) return;
      // Replace the single Held history entry; never push one entry per stone.
      open(list[next], { history: "replace" });
    }

    els.close.addEventListener("click", function () {
      close({ reason: "explicit" });
    });
    els.prev.addEventListener("click", function () {
      step(-1);
    });
    els.next.addEventListener("click", function () {
      step(1);
    });

    dialog.addEventListener("cancel", function (event) {
      event.preventDefault();
      close({ reason: "explicit" });
    });

    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) close({ reason: "explicit" });
    });

    document.addEventListener("keydown", function (event) {
      if (!isDialogOpen()) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      }
    });

    global.addEventListener("popstate", function () {
      if (heldSession.suppressing) return;
      var id = parseHeldHash(location.hash);
      var state = history.state || {};
      var stateId =
        state && typeof state === "object" && state.heldId
          ? state.heldId
          : null;
      var targetId = id || stateId;
      if (targetId) {
        // Back/Forward into a Held entry: open without adding history.
        // Adopt owned/layered only from the entry's explicit state marker.
        heldSession.pendingConsume = false;
        openById(targetId, { history: "none" });
        heldSession.layered = isOwnedHistoryState(state);
        heldSession.active = true;
      } else if (
        heldSession.active ||
        isDialogOpen() ||
        heldSession.pendingConsume
      ) {
        // Back from open Held, or settle after explicit owned Close consumed the layer.
        close({ reason: "popstate" });
      }
    });

    return {
      open: open,
      openById: openById,
      close: close,
      step: step,
      getCurrentId: function () {
        return currentId;
      },
      restoreFromHash: function () {
        var id = parseHeldHash(location.hash);
        if (id) return openById(id, { history: "sync" });
        return false;
      },
    };
  }

  /* ---------- Piece / gallery rendering ---------- */

  function createPieceElement(record, mode, onOpen) {
    var li = document.createElement("li");
    li.className = "piece" + (record.available ? "" : " is-sold");
    li.dataset.id = record.id;

    var localHref = pieceLocalHref(record);

    var media = document.createElement("a");
    media.className = "piece__media";
    // Page-local hash: ordinary, keyboard, and new-tab activation stay in draft.
    media.href = localHref;
    media.setAttribute(
      "aria-label",
      (record.available ? "Hold " : "Hold sold piece ") + record.title
    );

    var frame = document.createElement("div");
    frame.className = "piece__frame";

    var img = document.createElement("img");
    img.className = "piece__image";
    img.src = record.hero || record.thumb || "";
    img.alt = record.imageAlt || record.title || "";
    img.loading = "lazy";
    img.decoding = "async";

    frame.appendChild(img);
    media.appendChild(frame);

    var meta = document.createElement("div");
    meta.className = "piece__meta";

    var title = document.createElement("h2");
    title.className = "piece__title";
    var titleLink = document.createElement("a");
    titleLink.href = localHref;
    titleLink.textContent = record.title;
    title.appendChild(titleLink);

    var price = document.createElement("p");
    price.className = "piece__price";
    price.textContent = formatUsd(record.priceCents, record.priceFrom);

    var cue = document.createElement("p");
    cue.className = "piece__cue";
    cue.textContent = availabilityCue(record, mode);

    meta.appendChild(title);
    meta.appendChild(price);
    meta.appendChild(cue);

    function handleActivate(event) {
      // Modified / middle clicks keep the local #p=<id> destination.
      // Ordinary activation opens Held without a full navigation.
      if (
        event.defaultPrevented ||
        event.button === 1 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      event.preventDefault();
      if (typeof onOpen === "function") onOpen(record);
    }

    media.addEventListener("click", handleActivate);
    titleLink.addEventListener("click", handleActivate);

    li.appendChild(media);
    li.appendChild(meta);
    return li;
  }

  function createGalleryItem(record, index, onOpen) {
    var li = document.createElement("li");
    var rhythm = RHYTHM[index % RHYTHM.length];
    li.className = "gallery-item gallery-item--" + rhythm;
    li.dataset.id = record.id;

    var media = document.createElement("a");
    media.className = "gallery-item__media";
    media.href = pieceLocalHref(record);
    media.setAttribute("aria-label", "Hold " + record.title);

    var frame = document.createElement("div");
    frame.className = "gallery-item__frame";
    var img = document.createElement("img");
    img.className = "gallery-item__image";
    img.src = record.hero || record.thumb || "";
    img.alt = record.imageAlt || record.title || "";
    img.loading = index < 2 ? "eager" : "lazy";
    img.decoding = "async";
    if (index === 0) img.fetchPriority = "high";
    frame.appendChild(img);
    media.appendChild(frame);

    var meta = document.createElement("div");
    meta.className = "gallery-item__meta";
    var title = document.createElement("h2");
    title.className = "gallery-item__title";
    title.textContent = record.title;
    var coll = document.createElement("p");
    coll.className = "gallery-item__collection";
    coll.textContent = collectionLabel(record);
    meta.appendChild(title);
    meta.appendChild(coll);

    media.addEventListener("click", function (event) {
      if (
        event.defaultPrevented ||
        event.button === 1 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      event.preventDefault();
      if (typeof onOpen === "function") onOpen(record);
    });

    li.appendChild(media);
    li.appendChild(meta);
    return li;
  }

  function titleCaseFilterLabel(value) {
    return String(value || "").replace(/[A-Za-z][^\s-]*/g, function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    });
  }

  function fillSelect(select, values, allLabel) {
    if (!select) return;
    select.innerHTML = "";
    var all = document.createElement("option");
    all.value = "";
    all.textContent = titleCaseFilterLabel(allLabel || "All");
    select.appendChild(all);
    for (var i = 0; i < values.length; i += 1) {
      var opt = document.createElement("option");
      opt.value = values[i];
      opt.textContent = titleCaseFilterLabel(values[i]);
      select.appendChild(opt);
    }
  }

  function initCatalogPage(config) {
    var mode = config.mode || "ready";
    var collectionKey = config.collection || mode;
    var catalog = global.RANA_CATALOG;
    var tray = document.getElementById(config.trayId || "tray");
    var statusEl = document.getElementById(config.statusId || "tray-status");
    var countEl = document.getElementById(config.countId || "tray-count");
    var searchEl = document.getElementById(config.searchId || "tray-search");
    var kindEl = document.getElementById(config.kindId || "tray-kind");
    var stoneEl = document.getElementById(config.stoneId || "tray-stone");
    var sortEl = document.getElementById(config.sortId || "tray-sort");
    var availabilityEl = document.getElementById(
      config.availabilityId || "tray-availability"
    );

    var source = [];
    if (catalog && Array.isArray(catalog[collectionKey])) {
      // Jewelry only: durable source-filter so a future catalog refresh cannot
      // casually reinsert the Zoom consultation service among product fields.
      source = jewelryRecords(catalog[collectionKey]);
    }

    var state = {
      query: "",
      kind: "",
      stone: "",
      sort: "source",
      availability: "all",
    };
    var visible = source.slice();
    var held = null;

    function showStatus(message, isError) {
      if (!statusEl) return;
      statusEl.hidden = false;
      statusEl.textContent = message;
      if (isError) statusEl.setAttribute("role", "alert");
    }

    function updateCount() {
      if (!countEl) return;
      countEl.textContent = countStatus(visible.length, source.length, mode);
    }

    function render() {
      if (!tray) return;
      var filtered = filterRecords(source, state);
      visible = sortRecords(filtered, state.sort);
      tray.innerHTML = "";
      var fragment = document.createDocumentFragment();
      for (var i = 0; i < visible.length; i += 1) {
        fragment.appendChild(
          createPieceElement(visible[i], mode, function (record) {
            if (held) held.open(record, { history: "push" });
          })
        );
      }
      tray.appendChild(fragment);

      var firstImg = tray.querySelector(".piece:first-child .piece__image");
      if (firstImg) {
        firstImg.loading = "eager";
        firstImg.fetchPriority = "high";
      }

      updateCount();
      if (statusEl) {
        if (!source.length) {
          showStatus(
            mode === "made"
              ? "No designs are available to show."
              : "No pieces are available to show.",
            true
          );
        } else if (!visible.length) {
          // Single visitor-facing empty state (count line stays quiet at zero).
          showStatus(
            mode === "made"
              ? "No designs match right now."
              : "No pieces match right now.",
            false
          );
          if (countEl) countEl.textContent = "";
        } else {
          statusEl.hidden = true;
        }
      }
    }

    if (!catalog || !source.length) {
      showStatus(
        mode === "made"
          ? "Designs could not be shown just now."
          : "Pieces could not be shown just now.",
        true
      );
      return null;
    }

    var facets = deriveFacets(source);
    fillSelect(kindEl, facets.kinds, "All Kinds");
    fillSelect(stoneEl, facets.stones, "All Stones");

    function onStateChange() {
      state.query = searchEl ? searchEl.value : "";
      state.kind = kindEl ? kindEl.value : "";
      state.stone = stoneEl ? stoneEl.value : "";
      state.sort = sortEl ? sortEl.value : "source";
      state.availability = availabilityEl ? availabilityEl.value : "all";
      render();
      if (held && held.getCurrentId()) {
        // Keep held open on same id if still present; else leave as-is.
        held.restoreFromHash();
      }
    }

    if (searchEl) searchEl.addEventListener("input", onStateChange);
    if (kindEl) kindEl.addEventListener("change", onStateChange);
    if (stoneEl) stoneEl.addEventListener("change", onStateChange);
    if (sortEl) sortEl.addEventListener("change", onStateChange);
    if (availabilityEl) availabilityEl.addEventListener("change", onStateChange);

    held = createHeldController({
      mode: mode,
      pageBase: pageFileName(),
      getVisibleRecords: function () {
        return visible;
      },
      getAllRecords: function () {
        return source;
      },
    });

    render();
    held.restoreFromHash();

    return {
      getVisible: function () {
        return visible.slice();
      },
      getSource: function () {
        return source.slice();
      },
      getState: function () {
        return Object.assign({}, state);
      },
      held: held,
      render: render,
    };
  }

  function initGalleryPage() {
    var catalog = global.RANA_CATALOG;
    var stream = document.getElementById("gallery-stream");
    var statusEl = document.getElementById("gallery-status");
    if (!stream) return null;
    if (!catalog) {
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "The gallery could not be shown just now.";
      }
      return null;
    }

    var records = buildGalleryRecords(catalog);
    var held = createHeldController({
      mode: "gallery",
      pageBase: pageFileName(),
      getVisibleRecords: function () {
        return records;
      },
      getAllRecords: function () {
        return records;
      },
    });

    stream.innerHTML = "";
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < records.length; i += 1) {
      fragment.appendChild(
        createGalleryItem(records[i], i, function (record) {
          held.open(record, { history: "push" });
        })
      );
    }
    stream.appendChild(fragment);
    if (statusEl) statusEl.hidden = true;
    held.restoreFromHash();

    return { records: records, held: held };
  }

  function enhanceLocalLinks() {
    // Stamp ?motion=quiet onto every same-origin local page link once.
    preserveQuietOnLocalLinks(document);
    document.addEventListener("click", function (event) {
      var link = event.target.closest("a");
      if (!link) return;
      var href = link.getAttribute("href") || "";
      if (!href || href.charAt(0) === "#") return;
      if (/^(https?:|mailto:|tel:)/i.test(href)) return;
      // Keep quiet sticky even if a later-injected local link missed the stamp.
      var quietHref = withMotionQuery(href);
      if (quietHref !== href) {
        link.setAttribute("href", quietHref);
      }
      if (link.target === "_blank") return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (isQuietMode()) return;
      if (!document.startViewTransition) return;
      // Prefer CSS @view-transition navigation when browser supports it;
      // no JS override required. This hook is a no-op placeholder for
      // browsers that need explicit startViewTransition on SPA-style moves.
    });
  }

  function markPrimaryNavCurrent() {
    var nav = document.querySelector(".shell-primary-nav");
    if (!nav) return;
    var current = pageFileName();
    var links = nav.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i += 1) {
      var href = links[i].getAttribute("href") || "";
      var file = href.split("?")[0].split("#")[0].split("/").pop() || href;
      if (file === current) {
        links[i].setAttribute("aria-current", "page");
      } else {
        links[i].removeAttribute("aria-current");
      }
    }
  }

  function initShell(options) {
    options = options || {};
    syncQuietClasses();
    loadShellMark();
    setupIndex();
    markPrimaryNavCurrent();
    enhanceLocalLinks();

    var page = options.page || document.body.getAttribute("data-page") || "";
    var result = { page: page };

    if (page === "ready" || page === "made") {
      result.catalog = initCatalogPage({
        mode: page,
        collection: page,
      });
    } else if (page === "gallery") {
      result.gallery = initGalleryPage();
    }

    return result;
  }

  // Public pure surface for verification.
  SHELL.formatUsd = formatUsd;
  SHELL.filterRecords = filterRecords;
  SHELL.sortRecords = sortRecords;
  SHELL.deriveFacets = deriveFacets;
  SHELL.parseHeldHash = parseHeldHash;
  SHELL.buildHeldHash = buildHeldHash;
  SHELL.encodePieceId = encodePieceId;
  SHELL.decodePieceId = decodePieceId;
  SHELL.findRecordIndex = findRecordIndex;
  SHELL.buildGalleryRecords = buildGalleryRecords;
  SHELL.isConsultationService = isConsultationService;
  SHELL.jewelryRecords = jewelryRecords;
  SHELL.pieceLocalHref = pieceLocalHref;
  SHELL.availabilityCue = availabilityCue;
  SHELL.countStatus = countStatus;
  SHELL.isQuietMode = isQuietMode;
  SHELL.withMotionQuery = withMotionQuery;
  SHELL.preserveQuietOnLocalLinks = preserveQuietOnLocalLinks;
  SHELL.init = initShell;
  SHELL.INDEX_LINKS = INDEX_LINKS;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      if (document.body && document.body.hasAttribute("data-page")) {
        initShell();
      }
    });
  } else if (document.body && document.body.hasAttribute("data-page")) {
    initShell();
  }
})(typeof window !== "undefined" ? window : globalThis);
