// SPDX-License-Identifier: AGPL-3.0-only

/** One audible speech owner per browser. Prepared synthesis does not claim playback. */
let current: { cancel: () => void } | null = null;

export function isSpeechPlaybackActive(): boolean { return current !== null; }

export function stopSpeechPlayback(): void {
  const previous = current;
  current = null;
  previous?.cancel();
}

export function claimSpeechPlayback(cancel: () => void): () => void {
  stopSpeechPlayback();
  const owner = { cancel };
  current = owner;
  return () => {
    // A late completion from the previous owner cannot release its successor.
    if (current === owner) current = null;
  };
}
