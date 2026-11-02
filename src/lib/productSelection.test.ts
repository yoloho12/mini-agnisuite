import test from "node:test";
import assert from "node:assert/strict";

const {
  normalizeSelectedIds,
  isAllVisibleSelected,
  toggleSelectedId,
  setVisibleSelection,
} = await import(new URL("./productSelection.ts", import.meta.url).href);

test("normalizeSelectedIds removes IDs that no longer exist", () => {
  const selected = new Set(["a", "b", "c"]);
  const visible = ["a", "d"];

  assert.deepEqual([...normalizeSelectedIds(selected, visible)], ["a"]);
});

test("setting visible selection preserves selections from other pages", () => {
  const selected = new Set(["off-page", "a"]);

  assert.deepEqual([...setVisibleSelection(selected, ["a", "b"], true)], ["off-page", "a", "b"]);
  assert.deepEqual([...setVisibleSelection(selected, ["a", "b"], false)], ["off-page"]);
});

test("toggleSelectedId flips a selection without mutating the previous set", () => {
  const original = new Set(["a"]);
  const toggled = toggleSelectedId(original, "b");

  assert.deepEqual([...original], ["a"]);
  assert.deepEqual([...toggled], ["a", "b"]);

  const untoggled = toggleSelectedId(toggled, "a");
  assert.deepEqual([...untoggled], ["b"]);
});

test("isAllVisibleSelected returns true only when every visible row is selected", () => {
  const selected = new Set(["a", "b"]);

  assert.equal(isAllVisibleSelected(selected, ["a", "b"]), true);
  assert.equal(isAllVisibleSelected(selected, ["a", "b", "c"]), false);
  assert.equal(isAllVisibleSelected(new Set(), ["a", "b"]), false);
});
