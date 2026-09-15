import assert from "node:assert/strict";
import test from "node:test";
import type { SpeechSynthesisAdapter } from "@assistant-ui/react";
import { StreamingSpeechQueue, takeSpeechChunk } from "../src/features/chat/streaming-speech.ts";

function harness() {
  const spoken: string[] = [];
  const utterances: (SpeechSynthesisAdapter.Utterance & { finish: () => void })[] = [];
  let ended = 0;
  const queue = new StreamingSpeechQueue({ speak(text) {
    spoken.push(text);
    const listeners = new Set<() => void>();
    const utterance: SpeechSynthesisAdapter.Utterance & { finish: () => void } = {
      status: { type: "running" },
      subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); },
      cancel() { utterance.status = { type: "ended", reason: "cancelled" }; listeners.forEach((cb) => cb()); },
      finish() { utterance.status = { type: "ended", reason: "finished" }; listeners.forEach((cb) => cb()); },
    };
    utterances.push(utterance);
    return utterance;
  } }, () => ended++);
  return { queue, spoken, utterances, ended: () => ended };
}

test("speech starts before completion, queues in order, and never repeats cumulative text", () => {
  const h = harness();
  h.queue.update("Hello");
  assert.equal(h.spoken.length, 0);
  h.queue.update("Hello. More");
  assert.deepEqual(h.spoken, ["Hello. "]);
  h.queue.update("Hello. More text. Tail");
  h.queue.update("Hello. More text. Tail");
  h.queue.update("Hello. More text. Tail", true);
  assert.equal(h.spoken.length, 1);
  h.utterances[0].finish();
  assert.equal(h.spoken[1], "More text. ");
  h.utterances[1].finish();
  assert.equal(h.spoken[2], "Tail");
  h.utterances[2].finish();
  assert.equal(h.ended(), 1);
});

test("cancellation stops playback and suppresses future streaming updates", () => {
  const h = harness();
  h.queue.update("First sentence. Second sentence. ");
  h.queue.cancel();
  h.queue.update("First sentence. Second sentence. Third.", true);
  h.utterances[0].finish();
  assert.equal(h.spoken.length, 1);
  assert.equal(h.ended(), 1);
});

test("rewritten text cancels speech instead of replaying a different branch", () => {
  const h = harness();
  h.queue.update("One sentence. ");
  h.queue.update("Replaced sentence. ");
  assert.equal(h.queue.stopped, true);
  assert.equal(h.spoken.length, 1);
});

test("long sentences are bounded without splitting surrogate pairs; short tails wait", () => {
  assert.equal(takeSpeechChunk("unfinished", false), null);
  const text = "a".repeat(239) + "🙂".repeat(10);
  const [first, rest] = takeSpeechChunk(text, false)!;
  assert.equal(first + rest, text);
  assert.equal(first.length, 239);
  assert.deepEqual(takeSpeechChunk("Done", true), ["Done", ""]);
});

test("prepares one phrase during playback, plays in order, and cancels buffered synthesis", () => {
  const generated: string[] = [];
  const playing: string[] = [];
  const cancelled: string[] = [];
  const finishers: (() => void)[] = [];
  const prepare = (text: string) => {
    generated.push(text);
    const listeners = new Set<() => void>();
    const utterance: SpeechSynthesisAdapter.Utterance = {
      status: { type: "starting" },
      subscribe(cb) { listeners.add(cb); return () => { listeners.delete(cb); }; },
      cancel() { cancelled.push(text); utterance.status = { type: "ended", reason: "cancelled" }; listeners.forEach(cb => cb()); },
    };
    finishers.push(() => { utterance.status = { type: "ended", reason: "finished" }; listeners.forEach(cb => cb()); });
    return { utterance, cancel: () => utterance.cancel(), start: () => {
      playing.push(text);
      utterance.status = { type: "running" };
      listeners.forEach(cb => cb());
    } };
  };
  const queue = new StreamingSpeechQueue({ prepare, speak(text) {
    const item = prepare(text); item.start(); return item.utterance;
  } }, () => {});
  queue.update("First. Second. Third. Fourth. ", true);
  assert.deepEqual(generated, ["First. ", "Second. "]);
  assert.deepEqual(playing, ["First. "]);
  finishers[0]();
  assert.deepEqual(playing, ["First. ", "Second. "]);
  assert.deepEqual(generated, ["First. ", "Second. ", "Third. "]);
  queue.cancel();
  assert.deepEqual(cancelled, ["Third. ", "Second. "]);
  assert.equal(playing.length, 2);
  assert.equal(generated.length, 3);
});
