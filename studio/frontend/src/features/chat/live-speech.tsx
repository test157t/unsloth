import { useAui, useAuiState } from "@assistant-ui/react";
import { useEffect, useRef } from "react";
import { create } from "zustand";
import { useVoiceSettingsStore } from "@/features/settings/stores/voice-settings-store";
import { useExternalProvidersStore } from "./stores/external-providers-store";
import { StudioSpeechSynthesisAdapter } from "./adapters/studio-speech-synthesis-adapter";
import { StreamingSpeechQueue } from "./streaming-speech";

export const useLiveSpeechStore = create<{ messageId: string | null; stop: () => void }>(() => ({ messageId: null, stop: () => {} }));

export function LiveSpeech({ enabled }: { enabled: boolean }) {
  const aui = useAui();
  const messages = useAuiState(({ thread }) => thread.messages);
  const running = useAuiState(({ thread }) => thread.isRunning);
  const threadId = useAuiState(({ threads }) => threads.mainThreadId);
  const ttsEnabled = useVoiceSettingsStore((s) => s.ttsEnabled);
  const liveEnabled = useVoiceSettingsStore((s) => s.ttsLiveEnabled);
  const engine = useVoiceSettingsStore((s) => s.ttsEngine);
  const providerId = useVoiceSettingsStore((s) => s.ttsProviderId);
  const isVoiceForge = useExternalProvidersStore((s) => s.connectionsEnabled && s.providers.some((p) => p.id === providerId && p.providerType === "voiceforge"));
  const session = useRef<{ queue: StreamingSpeechQueue; id: string; prefix: string; lastText: string } | null>(null);
  const wasRunning = useRef(false);
  const allowed = enabled && ttsEnabled && liveEnabled && engine === "custom" && isVoiceForge;

  useEffect(() => {
    return () => { session.current?.queue.cancel(); session.current = null; wasRunning.current = false; };
  }, [threadId, allowed, providerId]);

  useEffect(() => {
    if (!allowed) return;
    const previousRunning = wasRunning.current;
    if (running && !previousRunning) {
      session.current?.queue.cancel();
      session.current = null;
    }
    wasRunning.current = running;
    const message = messages.at(-1);
    if (message?.role === "user") {
      session.current?.queue.cancel();
      session.current = null;
      return;
    }
    if (!message || message.role !== "assistant") return;
    if (!session.current && (!running || message.status?.type !== "running") && !(previousRunning && !running)) return;
    // Only visible assistant text enters speech, never reasoning or tool-result parts.
    const text = message.content.filter((part) => part.type === "text").map((part) => part.text).join("\n")
      .replace(/```[\s\S]*?(?:```|$)/g, "");
    if (!session.current) {
      const thread = aui.thread();
      // The runtime throws when stopSpeaking is called without active speech.
      if (thread.getState().speech) thread.stopSpeaking();
      const queue = new StreamingSpeechQueue(new StudioSpeechSynthesisAdapter(), () => {
        if (session.current?.queue === queue) useLiveSpeechStore.setState({ messageId: null });
      });
      session.current = { queue, id: message.id, prefix: "", lastText: "" };
      useLiveSpeechStore.setState({ messageId: message.id, stop: () => queue.cancel() });
    }
    const active = session.current;
    if (active.queue.stopped) return;
    // Several assistant messages can form one tool-using run. Preserve their speech order.
    if (active.id !== message.id) {
      active.prefix += active.lastText + "\n\n";
      active.id = message.id;
      useLiveSpeechStore.setState({ messageId: message.id });
    }
    active.lastText = text;
    const interrupted = message.status?.type === "incomplete" && !["tool-calls", "length"].includes(message.status.reason);
    if (interrupted) active.queue.cancel();
    else active.queue.update(active.prefix + text, !running);
  }, [allowed, aui, messages, running]);
  return null;
}
