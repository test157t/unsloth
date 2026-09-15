// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved.

export function voiceForgeSettings(connectionId: string) {
	if (!connectionId.trim()) throw new Error("Choose a VoiceForge connection.");
	return {
		dictationEngine: "custom" as const,
		sttProviderId: connectionId,
		sttProviderModel: "whisper-large-v3-turbo",
		ttsEnabled: true,
		ttsEngine: "custom" as const,
		ttsProviderId: connectionId,
		ttsProviderModel: "omnivoice",
		ttsProviderVoice: "auto",
		ttsVoiceForgeRvc: "",
	};
}

export function voiceForgeRvcOptions(selection: string): {
	voiceforge_rvc_model?: string;
} {
	return selection
		? { voiceforge_rvc_model: selection === "__off__" ? "" : selection }
		: {};
}

/** VoiceForge accepts one segment per request. Preserve every character and
 * never split a surrogate pair; prefer sentence or word boundaries. */
export function splitVoiceForgeSpeech(text: string, limit = 1200): string[] {
	if (!Number.isInteger(limit) || limit < 1)
		throw new Error("Invalid segment limit");
	const characters = Array.from(text);
	const segments: string[] = [];
	let offset = 0;
	while (offset < characters.length) {
		let end = Math.min(offset + limit, characters.length);
		if (end < characters.length) {
			const minimum = offset + Math.floor(limit / 2);
			let boundary = -1;
			for (let i = end - 1; i >= minimum; i--) {
				if (/\s/u.test(characters[i]!)) {
					if (boundary < 0) boundary = i + 1;
					if (/[.!?。！？]/u.test(characters[i - 1] ?? "")) {
						boundary = i + 1;
						break;
					}
				}
			}
			if (boundary > offset) end = boundary;
		}
		segments.push(characters.slice(offset, end).join(""));
		offset = end;
	}
	return segments;
}
