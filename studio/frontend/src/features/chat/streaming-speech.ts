import type { SpeechSynthesisAdapter } from "@assistant-ui/react";

type PreparedSpeech = { utterance: SpeechSynthesisAdapter.Utterance; start: () => void; cancel: () => void };
type SpeechAdapter = SpeechSynthesisAdapter & { prepare?: (text: string) => PreparedSpeech };

/** Speak sentence-sized chunks; bound latency for long sentences and flush the final tail. */
export function takeSpeechChunk(text: string, final: boolean): [string, string] | null {
  const sentence = /[.!?。！？](?:["'”’)]*)(?:\s+|$)|\n\s*\n/u.exec(text);
  if (sentence && (final || sentence.index + sentence[0].length < text.length || /\s$/.test(sentence[0]))) {
    const end = sentence.index + sentence[0].length;
    return [text.slice(0, end), text.slice(end)];
  }
  if (text.length >= 240) {
    const boundary = text.lastIndexOf(" ", 240);
    let end = boundary > 80 ? boundary + 1 : 240;
    if (/^[\uD800-\uDBFF]$/.test(text[end - 1])) end--;
    return [text.slice(0, end), text.slice(end)];
  }
  return final && text.trim() ? [text, ""] : null;
}

export class StreamingSpeechQueue {
  private source = "";
  private pending = "";
  private queue: string[] = [];
  private utterance: SpeechSynthesisAdapter.Utterance | null = null;
  private unsubscribe: (() => void) | null = null;
  private cancelled = false;
  private finished = false;
  private prepared: PreparedSpeech | null = null;
  private adapter: SpeechAdapter;
  private onEnd: () => void;
  constructor(adapter: SpeechAdapter, onEnd: () => void) {
    this.adapter = adapter;
    this.onEnd = onEnd;
  }
  get stopped() { return this.cancelled; }

  update(text: string, final = false) {
    if (this.cancelled || this.finished) return;
    // Branch edits and replacements cannot safely replay already spoken content.
    if (!text.startsWith(this.source)) { this.cancel(); return; }
    this.pending += text.slice(this.source.length);
    this.source = text;
    let part: [string, string] | null;
    while ((part = takeSpeechChunk(this.pending, final))) {
      if (part[0].trim()) this.queue.push(part[0]);
      this.pending = part[1];
    }
    this.finished = final;
    this.pump();
  }

  private pump() {
    if (this.cancelled) return;
    if (this.utterance) { this.prefetch(); return; }
    const prepared = this.prepared;
    this.prepared = null;
    const text = prepared ? null : this.queue.shift();
    if (!prepared && !text) { if (this.finished) this.onEnd(); return; }
    const utterance = prepared ? prepared.utterance : this.adapter.speak(text!);
    this.utterance = utterance;
    const check = () => {
      if (this.utterance !== utterance) return;
      if (utterance.status.type !== "ended") { this.prefetch(); return; }
      this.unsubscribe?.();
      this.unsubscribe = null;
      this.utterance = null;
      if (utterance.status.reason !== "finished") { this.cancel(); return; }
      this.pump();
    };
    this.unsubscribe = utterance.subscribe(check);
    prepared?.start();
    check();
  }

  private prefetch() {
    // One request ahead, only after current synthesis has reached playback.
    if (this.prepared || !this.adapter.prepare || this.utterance?.status.type !== "running") return;
    const text = this.queue.shift();
    if (text) this.prepared = this.adapter.prepare(text);
  }

  cancel() {
    if (this.cancelled) return;
    this.cancelled = true;
    this.queue = [];
    this.pending = "";
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.prepared?.cancel();
    this.prepared = null;
    this.utterance?.cancel();
    this.utterance = null;
    this.onEnd();
  }
}
