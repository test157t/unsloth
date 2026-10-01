// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { SpeechSynthesisAdapter } from "@assistant-ui/react";
import { StreamingSpeechQueue } from "../src/features/chat/streaming-speech.ts";
import * as voiceforge from "../src/features/chat/voiceforge.ts";
import * as speechAnalyser from "../src/features/chat/speech-analyser.ts";
import * as speechPlaybackOwner from "../src/features/chat/speech-playback-owner.ts";
import { loadWithStubs } from "./helpers/module-stubs.ts";

type PreparedSpeech = {
  utterance: SpeechSynthesisAdapter.Utterance;
  start: () => void;
  cancel: () => void;
};
type Adapter = SpeechSynthesisAdapter & {
  prepare: (text: string) => PreparedSpeech;
};

// Drain promise continuations without timeouts, real audio, a browser or a service.
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

function harness(t: TestContext) {
  speechPlaybackOwner.stopSpeechPlayback();
  t.after(() => speechPlaybackOwner.stopSpeechPlayback());
  const requests: {
    text: string;
    signal: AbortSignal;
    respond: () => void;
    fail: () => void;
  }[] = [];
  const audio: FakeAudio[] = [];
  const revoked: string[] = [];
  const errors: string[] = [];
  let nextUrl = 0;

  class FakeAudio extends EventTarget {
    playbackRate = 1;
    volume = 1;
    paused = true;
    sourceRemoved = false;
    plays = 0;
    readonly url: string;
    constructor(url: string) {
      super();
      this.url = url;
      audio.push(this);
    }
    async play() { this.paused = false; this.plays++; }
    pause() { this.paused = true; }
    removeAttribute(name: string) {
      assert.equal(name, "src");
      this.sourceRemoved = true;
    }
    finish() { this.paused = true; this.dispatchEvent(new Event("ended")); }
  }

  const previousAudio = Object.getOwnPropertyDescriptor(globalThis, "Audio");
  Object.defineProperty(globalThis, "Audio", { configurable: true, value: FakeAudio });
  t.after(() => {
    if (previousAudio) Object.defineProperty(globalThis, "Audio", previousAudio);
    else Reflect.deleteProperty(globalThis, "Audio");
  });
  t.mock.method(URL, "createObjectURL", () => `blob:test-${++nextUrl}`);
  t.mock.method(URL, "revokeObjectURL", (url: string) => revoked.push(url));
  t.mock.method(globalThis, "fetch", () => { throw new Error("Real network is forbidden in this test"); });

  const settings = {
    ttsEngine: "custom",
    ttsProviderId: "voiceforge-test",
    ttsProviderModel: "kokoro",
    ttsProviderVoice: "bf_emma",
    ttsVoiceForgeRvc: "",
    ttsRate: 1.25,
    ttsVolume: 0.4,
  };
  const provider = {
    id: settings.ttsProviderId,
    providerType: "voiceforge",
    baseUrl: "https://voiceforge.invalid/v1",
    hasApiKey: true,
  };
  const module = loadWithStubs<{ StudioSpeechSynthesisAdapter: new (options?: { externallyOwned?: boolean }) => Adapter }>(
    new URL("../src/features/chat/adapters/studio-speech-synthesis-adapter.ts", import.meta.url),
    {
      "../voiceforge": voiceforge,
      "../speech-playback-owner": speechPlaybackOwner,
      "../speech-analyser": speechAnalyser,
      "@/features/auth": {
        authFetch: (path: string, init: { body: string; signal: AbortSignal }) => {
          assert.equal(path, "/api/inference/audio/speech");
          return new Promise<Response>((resolve, reject) => {
            requests.push({
              text: JSON.parse(init.body).input,
              signal: init.signal,
              // Deliberately ignore abort: late completions must be harmless even if
              // a transport or worker finishes after cancellation.
              respond: () => resolve(new Response(new Uint8Array([1, 2, 3]), {
                headers: { "content-type": "audio/wav" },
              })),
              fail: () => reject(new Error("Synthesis failed")),
            });
          });
        },
      },
      "@/features/settings/stores/voice-settings-store": {
        useVoiceSettingsStore: { getState: () => settings },
      },
      "../stores/external-providers-store": {
        useExternalProvidersStore: { getState: () => ({ connectionsEnabled: true, providers: [provider] }) },
      },
      "../api/providers-api": { encryptProviderApiKey: () => { throw new Error("Unexpected key encryption"); } },
      "../external-providers": { getExternalProviderApiKey: () => "" },
      "../search-images/search-images": { stripSearchImageTokens: (text: string) => text },
      "@/lib/toast": { toast: { error: (message: string) => errors.push(message) } },
    },
  );
  return { adapter: new module.StudioSpeechSynthesisAdapter(), queueAdapter: new module.StudioSpeechSynthesisAdapter({ externallyOwned: true }), requests, audio, revoked, errors };
}

test("manual read-aloud displaces a live queue and its in-flight prefetch", async (t) => {
  const h = harness(t);
  let release = () => {};
  const queue = new StreamingSpeechQueue(h.queueAdapter, () => release());
  release = speechPlaybackOwner.claimSpeechPlayback(() => queue.cancel());
  queue.update("Live first. Live second. Live third. ", true);
  h.requests[0].respond();
  await settle();
  assert.equal(h.requests.length, 2);
  const manual = h.adapter.speak("Manual sentence.");
  assert.equal(queue.stopped, true);
  assert.ok(h.requests[0].signal.aborted && h.requests[1].signal.aborted);
  h.requests[1].respond();
  h.requests[2].respond();
  await settle();
  assert.equal(h.audio.length, 2);
  assert.equal(h.audio[0].paused, true);
  assert.equal(h.audio[1].paused, false);
  speechPlaybackOwner.stopSpeechPlayback();
  assert.equal(manual.status.type, "ended");
  assert.equal(h.audio[1].paused, true);
});

test("a preview owner stops manual speech and late completion cannot release it", async (t) => {
  const h = harness(t);
  const manual = h.adapter.speak("Old manual speech.");
  let previewCancelled = 0;
  speechPlaybackOwner.claimSpeechPlayback(() => previewCancelled++);
  assert.equal(manual.status.type, "ended");
  h.requests[0].respond();
  await settle();
  assert.equal(h.audio.length, 0);
  speechPlaybackOwner.stopSpeechPlayback();
  assert.equal(previewCancelled, 1);
  speechPlaybackOwner.stopSpeechPlayback();
  assert.equal(previewCancelled, 1);
});

test("prepared speech holds audio until start and releases it when cancelled", async (t) => {
  const h = harness(t);
  const prepared = h.adapter.prepare("Prepared sentence.");
  h.requests[0].respond();
  await settle();
  assert.equal(h.audio.length, 0);
  assert.equal(prepared.utterance.status.type, "starting");
  prepared.start();
  await settle();
  assert.equal(h.audio.length, 1);
  assert.equal(h.audio[0].plays, 1);
  assert.equal(h.audio[0].playbackRate, 1.25);
  assert.equal(h.audio[0].volume, 0.4);
  assert.equal(prepared.utterance.status.type, "running");
  prepared.cancel();
  await settle();
  assert.equal(h.requests[0].signal.aborted, true);
  assert.equal(h.audio[0].paused, true);
  assert.equal(h.audio[0].sourceRemoved, true);
  assert.deepEqual(h.revoked, ["blob:test-1"]);
  assert.deepEqual(h.errors, []);
});

test("cancel before a late synthesis response prevents playback and notifies only once", async (t) => {
  const h = harness(t);
  const utterance = h.adapter.speak("Cancelled sentence.");
  let notifications = 0;
  utterance.subscribe(() => notifications++);
  utterance.cancel();
  utterance.cancel();
  h.requests[0].respond();
  await settle();
  assert.equal(h.requests[0].signal.aborted, true);
  assert.equal(h.audio.length, 0);
  assert.equal(notifications, 1);
  assert.equal(utterance.status.type, "ended");
  assert.deepEqual(h.revoked, ["blob:test-1"]);
  assert.deepEqual(h.errors, []);
});

test("cancel a prepared result before start disposes its URL and cannot be restarted", async (t) => {
  const h = harness(t);
  const prepared = h.adapter.prepare("Never play this.");
  h.requests[0].respond();
  await settle();
  prepared.cancel();
  prepared.start();
  await settle();
  assert.equal(h.audio.length, 0);
  assert.deepEqual(h.revoked, ["blob:test-1"]);
  assert.deepEqual(h.errors, []);
});

test("cancel active read-aloud prevents remaining VoiceForge segments even after a late ended event", async (t) => {
  const h = harness(t);
  const utterance = h.adapter.speak("word ".repeat(500));
  assert.ok(h.requests[0].text.length <= 1200);
  h.requests[0].respond();
  await settle();
  utterance.cancel();
  h.audio[0].finish();
  await settle();
  assert.equal(h.requests.length, 1);
  assert.equal(h.audio[0].paused, true);
  assert.deepEqual(h.revoked, ["blob:test-1"]);
  assert.deepEqual(h.errors, []);
});

test("live queue cancellation aborts current and prefetched real adapter requests", async (t) => {
  const h = harness(t);
  let ended = 0;
  const queue = new StreamingSpeechQueue(h.adapter, () => ended++);
  queue.update("First. Second. Third. ", true);
  h.requests[0].respond();
  await settle();
  assert.deepEqual(h.requests.map((request) => request.text), ["First. ", "Second. "]);
  queue.cancel();
  h.requests[1].respond();
  h.audio[0].finish();
  await settle();
  assert.ok(h.requests.every((request) => request.signal.aborted));
  assert.equal(h.requests.length, 2);
  assert.equal(h.audio.length, 1);
  assert.equal(ended, 1);
  assert.deepEqual(h.revoked, ["blob:test-1", "blob:test-2"]);
  assert.deepEqual(h.errors, []);
});

test("live queue plays prepared speech in order and releases each audio URL", async (t) => {
  const h = harness(t);
  let ended = 0;
  const queue = new StreamingSpeechQueue(h.adapter, () => ended++);
  queue.update("First. Second. ", true);
  h.requests[0].respond();
  await settle();
  h.requests[1].respond();
  await settle();
  assert.equal(h.audio.length, 1);
  h.audio[0].finish();
  await settle();
  assert.equal(h.audio.length, 2);
  assert.equal(h.audio[0].sourceRemoved, true);
  assert.equal(h.audio[1].plays, 1);
  h.audio[1].finish();
  await settle();
  assert.equal(ended, 1);
  assert.deepEqual(h.revoked, ["blob:test-1", "blob:test-2"]);
  assert.deepEqual(h.errors, []);
});

test("synthesis failure ends the live queue without starting later phrases", async (t) => {
  const h = harness(t);
  let ended = 0;
  const queue = new StreamingSpeechQueue(h.adapter, () => ended++);
  queue.update("First. Second. ", true);
  h.requests[0].fail();
  await settle();
  assert.equal(queue.stopped, true);
  assert.equal(ended, 1);
  assert.equal(h.requests.length, 1);
  assert.equal(h.audio.length, 0);
  assert.deepEqual(h.errors, ["Synthesis failed"]);
});
