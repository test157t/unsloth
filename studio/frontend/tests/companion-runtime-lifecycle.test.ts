import assert from "node:assert/strict";
import test from "node:test";
import { createRuntimeQueue } from "../src/features/companion/runtime-queue.ts";
import { selectedAvatarProfile, studioAvatarProfiles } from "../src/features/companion/selected-avatar.ts";

test("pending avatar load finishes before teardown and replacement", async () => {
  const enqueue = createRuntimeQueue();
  const calls: string[] = [];
  let release!: () => void;
  const loading = new Promise<void>((resolve) => { release = resolve; });
  const oldLoad = enqueue(async () => { calls.push("old-start"); await loading; calls.push("old-finish"); });
  const teardown = enqueue(() => { calls.push("unload-old"); });
  const replacement = enqueue(() => { calls.push("new-load"); });
  await Promise.resolve();
  assert.deepEqual(calls, ["old-start"]);
  release();
  await Promise.all([oldLoad, teardown, replacement]);
  assert.deepEqual(calls, ["old-start", "old-finish", "unload-old", "new-load"]);
});

test("failed load does not block the next selection", async () => {
  const enqueue = createRuntimeQueue();
  await assert.rejects(enqueue(() => { throw new Error("bad model"); }), /bad model/);
  assert.equal(await enqueue(() => "Mia.vrm"), "Mia.vrm");
});

test("settings and preview resolve selected or missing profile identically", () => {
  const profiles = [{ id: "first" }, { id: "selected" }];
  assert.equal(selectedAvatarProfile({ vrmSelectedAgentId: "selected" }, profiles)?.id, "selected");
  assert.equal(selectedAvatarProfile({ vrmSelectedAgentId: "deleted" }, profiles)?.id, "first");
  assert.equal(selectedAvatarProfile({}, studioAvatarProfiles)?.id, "studio");
});
