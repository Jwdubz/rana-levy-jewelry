#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const source = fs.readFileSync(
  fileURLToPath(new URL("../motion-control.js", import.meta.url)), "utf8"
);

function target() {
  const listeners = new Map();
  return {
    addEventListener(type, fn) {
      const list = listeners.get(type) || [];
      list.push(fn);
      listeners.set(type, list);
    },
    dispatchEvent(event) {
      for (const fn of listeners.get(event.type) || []) fn(event);
    }
  };
}

function page({ stored, quiet = false, storageBlocked = false } = {}) {
  const window = target();
  const document = target();
  const classes = new Set();
  const entries = new Map(stored == null ? [] : [["rana-motion-paused", stored]]);
  let control;
  let replacement;
  const video = { tagName: "VIDEO", currentTime: 4.2, paused: false, pause() { this.paused = true; } };
  document.documentElement = {
    classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); } }
  };
  document.readyState = "complete";
  document.body = {
    firstChild: {},
    insertBefore(node) { control = node; }
  };
  document.getElementById = () => control;
  document.querySelector = () => ({});
  document.querySelectorAll = () => [video];
  document.createElement = () => ({
    ...target(),
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; }
  });
  const location = {
    search: quiet ? "?motion=quiet&keep=1" : "",
    href: quiet ? "https://rana.example/?motion=quiet&keep=1#work" : "https://rana.example/",
    replace(href) { replacement = href; }
  };
  const localStorage = {
    getItem(key) { if (storageBlocked) throw Error("blocked"); return entries.get(key) || null; },
    setItem(key, value) { if (storageBlocked) throw Error("blocked"); entries.set(key, value); }
  };
  class CustomEvent {
    constructor(type, init) { this.type = type; this.detail = init.detail; }
  }
  vm.runInNewContext(source, { window, document, localStorage, location, URL, URLSearchParams, CustomEvent });
  return {
    window, document, video, entries, classes,
    get control() { return control; },
    get replacement() { return replacement; }
  };
}

const fresh = page();
assert.equal(fresh.window.RANA_MOTION.isPaused(), false, "fresh visits keep motion on");
assert.equal(fresh.control.textContent, "Pause");
assert.equal(fresh.control.attributes["aria-label"], "Pause motion");
assert.equal(fresh.control.type, "button");
fresh.control.dispatchEvent({ type: "click" });
assert.equal(fresh.video.paused, true);
assert.equal(fresh.video.currentTime, 4.2, "pause must not seek");
assert.equal(fresh.control.textContent, "Resume");
assert.equal(fresh.control.attributes["aria-label"], "Resume motion");
assert.equal(fresh.entries.get("rana-motion-paused"), "true");
assert.equal(page({ stored: fresh.entries.get("rana-motion-paused") }).window.RANA_MOTION.isPaused(), true);

fresh.video.paused = false;
fresh.document.dispatchEvent({ type: "play", target: fresh.video });
assert.equal(fresh.video.paused, true, "queued play must honor pause");
fresh.control.dispatchEvent({ type: "click" });
assert.equal(fresh.window.RANA_MOTION.isPaused(), false);
assert.equal(fresh.video.paused, true, "resume must defer play to the active media owner");
assert.equal(fresh.entries.get("rana-motion-paused"), "false");
fresh.entries.set("rana-motion-paused", "true");
fresh.window.dispatchEvent({ type: "storage", key: "rana-motion-paused" });
assert.equal(fresh.window.RANA_MOTION.isPaused(), true);
fresh.entries.set("rana-motion-paused", "false");
fresh.window.dispatchEvent({ type: "pageshow" });
assert.equal(fresh.window.RANA_MOTION.isPaused(), false, "history restores the current choice");

const restricted = page({ storageBlocked: true });
restricted.control.dispatchEvent({ type: "click" });
assert.equal(restricted.window.RANA_MOTION.isPaused(), true, "storage failure must not break pause");
restricted.window.dispatchEvent({ type: "pageshow" });
assert.equal(restricted.window.RANA_MOTION.isPaused(), true, "unavailable storage must not clear an in-memory pause on history restore");

const quiet = page({ quiet: true });
assert.equal(quiet.control.textContent, "Resume");
quiet.control.dispatchEvent({ type: "click" });
assert.equal(quiet.replacement, "https://rana.example/?keep=1#work", "resume removes only explicit quiet mode");
console.log("PASS: persistent motion control (default on; pause without seeking; reload, navigation and queued-play guards; explicit quiet resume; storage failure)");
