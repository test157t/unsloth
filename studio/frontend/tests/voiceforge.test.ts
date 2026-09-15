import assert from "node:assert/strict";
import test from "node:test";
import { splitVoiceForgeSpeech, voiceForgeSettings, voiceForgeRvcOptions } from "../src/features/chat/voiceforge.ts";
import { registerBundlerResolver } from "./helpers/kit.ts";

registerBundlerResolver();

test("RVC selection distinguishes server settings, off, and an explicit model", () => {
  assert.deepEqual(voiceForgeRvcOptions(""), {});
  assert.deepEqual(voiceForgeRvcOptions("__off__"), { voiceforge_rvc_model: "" });
  assert.deepEqual(voiceForgeRvcOptions("Alice"), { voiceforge_rvc_model: "Alice" });
  assert.equal(voiceForgeSettings("another-server").ttsVoiceForgeRvc, "");
});

test("VoiceForge connection tests allow an empty key without making hosted providers keyless", async () => {
  const { providerAllowsKeylessConnection } = await import("../src/features/chat/external-providers.ts");
  assert.equal(providerAllowsKeylessConnection("voiceforge"), true);
  assert.equal(providerAllowsKeylessConnection("llama_cpp"), true);
  assert.equal(providerAllowsKeylessConnection("xai"), false);
});

test("VoiceForge retains its provider identity in saved connections", async () => {
  const { toExternalBackendProviderType } = await import("../src/features/chat/external-providers.ts");
  assert.equal(toExternalBackendProviderType("voiceforge"), "voiceforge");
});

test("one connection configures both speech and recognition", () => {
  const settings = voiceForgeSettings("voiceforge-local");
  assert.equal(settings.sttProviderId, settings.ttsProviderId);
  assert.equal(settings.dictationEngine, "custom");
  assert.equal(settings.ttsEngine, "custom");
  assert.equal(settings.ttsProviderVoice, "auto");
  assert.equal(settings.sttProviderModel, "whisper-large-v3-turbo");
  assert.throws(() => voiceForgeSettings(""));
});

test("long speech respects VoiceForge segment limits without losing Unicode or text", () => {
  for (const text of ["Hello. ".repeat(900), "🙂".repeat(3001), "x".repeat(3000), "small", ""]) {
    const segments = splitVoiceForgeSpeech(text);
    assert.equal(segments.join(""), text);
    assert.ok(segments.every((segment) => Array.from(segment).length <= 1200));
  }
});

test("segmentation prefers sentence boundaries and rejects invalid limits", () => {
  assert.equal(splitVoiceForgeSpeech("One sentence. Another sentence.", 20)[0], "One sentence. ");
  assert.throws(() => splitVoiceForgeSpeech("text", 0));
});
