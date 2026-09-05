/* Native, persistent control for Rana's automatically playing media. */
(function () {
  "use strict";

  var storageKey = "rana-motion-paused";
  var button;
  var quiet = new URLSearchParams(location.search).get("motion") === "quiet";

  function readChoice() {
    try {
      return localStorage.getItem(storageKey) === "true";
    } catch (error) {
      return null;
    }
  }

  var paused = quiet || readChoice() === true;

  function syncControl() {
    document.documentElement.classList.toggle("is-motion-paused", paused);
    if (button) {
      button.textContent = paused ? "Resume" : "Pause";
      button.setAttribute("aria-label", paused ? "Resume motion" : "Pause motion");
      button.title = paused ? "Resume motion" : "Pause motion";
    }
  }

  function stopMedia() {
    document.querySelectorAll("video").forEach(function (video) {
      video.pause();
    });
  }

  function setPaused(next, persist) {
    next = !!next;
    if (persist !== false) {
      try {
        localStorage.setItem(storageKey, String(next));
      } catch (error) {
        // The control still works for this page when storage is unavailable.
      }
    }
    var changed = next !== paused;
    paused = next;
    syncControl();
    if (paused) stopMedia();
    if (changed) {
      window.dispatchEvent(new CustomEvent("rana:motionchange", {
        detail: { paused: paused }
      }));
    }
  }

  window.RANA_MOTION = {
    isPaused: function () { return paused; },
    setPaused: setPaused
  };
  syncControl();

  // A queued native play event must not override the visitor's pause choice.
  document.addEventListener("play", function (event) {
    if (paused && event.target && event.target.tagName === "VIDEO") {
      event.target.pause();
    }
  }, true);

  function mount() {
    if (!document.body || document.getElementById("motionControl")) return;
    button = document.createElement("button");
    button.type = "button";
    button.id = "motionControl";
    button.className = "motion-control";
    button.addEventListener("click", function () {
      if (quiet) {
        // The explicit poster-only URL mode is initialized at page load.
        // Resume removes that mode and lets the ordinary owners start again.
        setPaused(false);
        var url = new URL(location.href);
        url.searchParams.delete("motion");
        location.replace(url.href);
        return;
      }
      setPaused(!paused);
    });
    var header = document.querySelector("header");
    document.body.insertBefore(button, header || document.body.firstChild);
    syncControl();
    if (paused) stopMedia();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }

  window.addEventListener("pageshow", function () {
    var choice = readChoice();
    if (choice !== null) setPaused(quiet || choice, false);
  });
  window.addEventListener("storage", function (event) {
    if (event.key === storageKey || event.key === null) {
      var choice = readChoice();
      if (choice !== null) setPaused(quiet || choice, false);
    }
  });
})();
