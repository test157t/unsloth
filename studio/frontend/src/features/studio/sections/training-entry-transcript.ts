// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

export type TrainingTranscriptMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  reasoning?: string;
};

const ROLE_PATTERNS = [
  /<\|turn>(system|user|model|assistant|tool)\s*\n?([\s\S]*?)<turn\|>/g,
  /<start_of_turn>(system|user|model|assistant|tool)\s*\n?([\s\S]*?)<end_of_turn>/g,
  /<\|im_start\|>(system|user|model|assistant|tool)\s*\n?([\s\S]*?)<\|im_end\|>/g,
  /<\|start_header_id\|>(system|user|model|assistant|tool)<\|end_header_id\|>\s*\n?([\s\S]*?)(?=<\|eot_id\|>|<\|end_of_text\|>)/g,
  /<\|(system|user|model|assistant|tool)\|>\s*\n?([\s\S]*?)(?=<\|(?:system|user|model|assistant|tool)\|>|$)/g,
];

function role(value: string): TrainingTranscriptMessage["role"] {
  return value === "model" ? "assistant" : value as TrainingTranscriptMessage["role"];
}

function message(value: string, content: string): TrainingTranscriptMessage | null {
  const resolvedRole = role(value);
  let trimmed = content.trim();
  if (resolvedRole === "system") {
    // Gemma-4 emits this protocol token in a synthetic system turn to activate
    // thinking. It is part of the model input, not system-prompt content.
    trimmed = trimmed.replace(/^<\|think\|>\s*/, "").trim();
  }
  if (resolvedRole !== "assistant") {
    return trimmed ? { role: resolvedRole, content: trimmed } : null;
  }
  const channel = trimmed.match(
    /<\|channel\|?>\s*(?:thought|analysis)\s*\n?([\s\S]*?)<channel\|>([\s\S]*)/,
  );
  if (!channel) return { role: resolvedRole, content: trimmed };
  return {
    role: resolvedRole,
    reasoning: (channel[1] ?? "").trim(),
    content: (channel[2] ?? "").trim(),
  };
}

function collectPattern(text: string, pattern: RegExp): TrainingTranscriptMessage[] {
  const messages: TrainingTranscriptMessage[] = [];
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const content = (match[2] ?? "").trim();
    if (content) {
      const parsed = message(match[1] ?? "user", content);
      if (parsed) messages.push(parsed);
    }
  }
  return messages;
}

function parseMistral(text: string): TrainingTranscriptMessage[] {
  const messages: TrainingTranscriptMessage[] = [];
  const pattern = /\[INST\]([\s\S]*?)\[\/INST\]([\s\S]*?)(?=\[INST\]|$)/g;
  for (const match of text.matchAll(pattern)) {
    let user = (match[1] ?? "").trim();
    const system = user.match(/<<SYS>>([\s\S]*?)<<\/SYS>>/);
    if (system?.[1]?.trim()) {
      messages.push({ role: "system", content: system[1].trim() });
      user = user.replace(system[0], "").trim();
    }
    if (user) messages.push({ role: "user", content: user });
    const assistant = (match[2] ?? "").replace(/<\/s>|<eos>/g, "").trim();
    if (assistant) messages.push({ role: "assistant", content: assistant });
  }
  return messages;
}

export function parseTrainingTranscript(text: string): TrainingTranscriptMessage[] {
  for (const pattern of ROLE_PATTERNS) {
    const messages = collectPattern(text, pattern);
    if (messages.length > 0) return messages;
  }
  return parseMistral(text);
}
