if (!globalThis.$) {
    globalThis.$ = (selector) => {
        const elements = typeof selector === 'string'
            ? selector.trimStart().startsWith('<')
                ? (() => { const t = document.createElement('template'); t.innerHTML = selector; return Array.from(t.content.children); })()
                : selector.includes(':visible')
                    ? (() => {
                        const parts = selector.split(',').map(s => s.trim());
                        const result = [];
                        for (const part of parts) {
                            const clean = part.replace(/:visible/g, '').trim();
                            if (!clean) continue;
                            for (const node of document.querySelectorAll(clean)) {
                                if (node.getClientRects().length > 0) result.push(node);
                            }
                        }
                        return result;
                    })()
                    : Array.from(document.querySelectorAll(selector))
            : selector instanceof NodeList || Array.isArray(selector) ? Array.from(selector) : selector ? [selector] : [];
        const element = elements[0] || null;
        const api = {
            0: element,
            length: elements.length,
            addClass: (name) => { for (const item of elements) item?.classList?.add?.(...String(name).split(/\s+/).filter(Boolean)); return api; },
            removeClass: (name) => { for (const item of elements) item?.classList?.remove?.(...String(name).split(/\s+/).filter(Boolean)); return api; },
            toggleClass: (name, force) => { for (const item of elements) for (const cls of String(name).split(/\s+/).filter(Boolean)) item?.classList?.toggle?.(cls, force); return api; },
            text: (value) => { if (value === undefined) return element?.textContent || ''; for (const item of elements) item.textContent = String(value); return api; },
            val: (value) => { if (value === undefined) return element?.value; for (const item of elements) item.value = value; return api; },
            is: (query) => query === ':visible' ? !!(element && element.getClientRects().length) : !!element?.matches?.(query),
            show: () => { for (const item of elements) if (item?.style) item.style.display = ''; return api; },
            hide: () => { for (const item of elements) if (item?.style) item.style.display = 'none'; return api; },
            toggle: (force) => { for (const item of elements) if (item?.style) item.style.display = force ? '' : 'none'; return api; },
            slideToggle: () => { for (const item of elements) if (item?.style) item.style.display = item.style.display === 'none' ? '' : 'none'; return api; },
            append: (content) => { for (const item of elements) appendContent(item, content); return api; },
            prepend: (content) => { for (const item of elements) prependContent(item, content); return api; },
            empty: () => { for (const item of elements) item.textContent = ''; return api; },
            find: (query) => globalThis.$(element ? element.querySelectorAll(query) : []),
            remove: () => { for (const item of elements) item?.remove?.(); return api; },
            trigger: (type) => { for (const item of elements) item?.dispatchEvent?.(new Event(String(type).split('.')[0], { bubbles: true })); return api; },
            on: (type, delegatedOrListener, listener) => { for (const item of elements) item?.addEventListener?.(String(type).split('.')[0], listener || delegatedOrListener); return api; },
            off: () => api,
            prop: (name, value) => { if (value === undefined) return element?.[name]; for (const item of elements) item[name] = value; return api; },
            attr: (name, value) => { if (value === undefined) return element?.getAttribute?.(name); for (const item of elements) item?.setAttribute?.(name, value); return api; },
            css: (name, value) => { if (typeof name === 'object') { for (const item of elements) Object.assign(item.style, name); return api; } if (value === undefined) return element ? getComputedStyle(element).getPropertyValue(name) : ''; for (const item of elements) item.style[name] = value; return api; },
            data: (name, value) => { if (!element) return undefined; element.__nitralData ||= {}; if (value === undefined) return element.__nitralData[name]; for (const item of elements) { item.__nitralData ||= {}; item.__nitralData[name] = value; } return api; },
            closest: (query) => globalThis.$(element?.closest?.(query)),
            not: (query) => globalThis.$(elements.filter((item) => !item.matches?.(query))),
            toArray: () => elements,
            first: () => globalThis.$(elements[0]),
            filter: (callback) => globalThis.$(elements.filter((el, i) => callback.call(el, i, el))),
            end: () => api,
        };
        return api;
    };
}
// Adapted ErisHub hypnosis renderer; generated declaration closure, with Studio-owned speech boundaries.
const nitralState = { callbacks: {}, activeAgentName: 'Mia', activeAgentId: 'studio', characters: ['Mia'], chatMessages: [], userName: 'User', suppressOverlay: false, extension_settings: { callmode: {}, tts: { tts_volume: 100, playbackBar: { tts_volume: 100 } } } };
const extension_settings = nitralState.extension_settings;
function mapCallModeSettings(settings = {}) {
    return {
        silenceThreshold: Number(settings.callModeSilenceThresholdMs ?? 800),
        hideChatShield: settings.callModeHideChatShield === true,
        randomCallEnabled: settings.callModeRandomCallEnabled === true,
        randomCallMinMinutes: Number(settings.callModeRandomCallMinMinutes ?? 10),
        randomCallMaxMinutes: Number(settings.callModeRandomCallMaxMinutes ?? 45),
        randomCallCooldownMinutes: Number(settings.callModeRandomCallCooldownMinutes ?? 60),
        asr_endpoint: String(settings.callModeAsrEndpoint || 'http://127.0.0.1:8889'),
        asr_model: String(settings.callModeAsrModel || 'large-v3-turbo'),
        asr_wrapInQuotes: settings.callModeWrapQuotes === true,
        client_noise_gate: Math.max(0.0005, Math.min(0.05, (Number(settings.callModeNoiseGatePercent ?? 17) || 17) / 1000)),
        muteReleasesMic: settings.callModeMuteReleasesMic === true,
        preferBuiltInMic: settings.callModePreferBuiltInMic !== false,
        inputDeviceId: String(settings.callModeInputDeviceId || '').trim(),
        overlayEnabled: settings.callModeOverlayEnabled !== false,
        overlayTransparency: Math.max(0, Math.min(1, 1 - ((Number(settings.callModeOverlayTransparency ?? 50) || 50) / 100) * 0.55)),
        overlayScale: Math.max(0.1, Math.min(5, (Number(settings.callModeOverlayScale ?? 100) || 100) / 100)),
        overlayZIndex: Number(settings.callModeOverlayZIndex ?? 9998) || 9998,
        overlayPositionX: Number(settings.callModeOverlayPositionX ?? 50) || 50,
        overlayPositionY: Number(settings.callModeOverlayPositionY ?? 50) || 50,
        hypnoticEffectsEnabled: settings.callModeHypnoticEffectsEnabled === true,
        hypnoParticlesEnabled: settings.callModeParticlesEnabled === true,
        hypnoParticleStyle: ['snow', 'rain', 'firefly'].includes(String(settings.callModeParticleStyle)) ? String(settings.callModeParticleStyle) : 'snow',
        hypnoParticleCount: Number(settings.callModeParticleCount ?? 250),
        hypnoParticleFallRate: Number(settings.callModeParticleFallRate ?? 1),
        hypnoParticleImpactRate: Number(settings.callModeParticleImpactRate ?? 1),
        hypnoFireflyGlow: Number(settings.callModeFireflyGlow ?? 1),
        hypnoWhispersEnabled: settings.callModeHypnoWhispersEnabled === true,
        hypnoSpiralEnabled: settings.callModeHypnoSpiralEnabled === true,
        hypnoSnapSfxEnabled: settings.callModeHypnoSnapSfxEnabled === true,
        hypnoAmbientEnabled: settings.callModeHypnoAmbientEnabled === true,
        hypnoBreathCuesEnabled: settings.callModeHypnoBreathCuesEnabled === true,
        hypnoSpokenWhispersEnabled: settings.callModeHypnoSpokenWhispersEnabled === true,
        hypnoBreathGuidanceEnabled: settings.callModeHypnoBreathGuidanceEnabled === true,
        hypnoBreathGuidanceLeadMs: Number(settings.callModeHypnoBreathGuidanceLeadMs ?? 260),
        hypnoSpiralPreset: String(settings.callModeHypnoSpiralPreset || 'classic-vortex'),
        hypnoWhispers: String(settings.callModeHypnoWhispers || ''),
        subtitleEnabled: false,
        subtitleFontSize: Number(settings.callModeSubtitleFontSize ?? 20),
        subtitleTextColor: String(settings.callModeSubtitleTextColor || '#ffffff'),
        subtitleBackgroundColor: String(settings.callModeSubtitleBackgroundColor || '#000000'),
        subtitleBackgroundOpacity: Number(settings.callModeSubtitleBackgroundOpacity ?? 65),
        subtitleFontFamily: String(settings.callModeSubtitleFontFamily || ''),
        subtitleBottomOffset: Number(settings.callModeSubtitleHeight ?? 24),
        weatherContextEnabled: false,
        weatherRefreshMinutes: 30,
        weatherManualCity: '',
    };
}
function applyRuntimeHypnoSettings() {
    if (!callActive) return;
    overlaySpiralCanvas.lastTs = 0;
    overlaySpiralCanvas.spinCycleRings = [];
    if (extension_settings[MODULE_NAME]?.overlayEnabled) showCallOverlay();
    if (isHypnoFeatureEnabled('hypnoParticlesEnabled')) startHypnoParticles();
    else stopOverlayParticleCanvas(true);
    if (areHypnoticEffectsEnabled()) {
        if (isHypnoFeatureEnabled('hypnoWhispersEnabled')) startHypnoWhispers();
        else {
            stopHypnoWhispers();
            stopSpokenWhisperAudio(true);
        }
    } else {
        stopOverlaySpiralCanvas(true);
        stopHypnoWhispers();
        stopSpokenWhisperAudio(true);
    }
}
function getContext() {
    const name2 = nitralState.characters[0] || '';
    return {
        name2,
        groupId: null,
        groups: [],
        characters: nitralState.characters.map((name) => ({ name, avatar: `${name}.png` })),
        chat: nitralState.chatMessages,
        generate: () => nitralState.callbacks.generate?.(),
    };
}
function appendContent(parent, content) {
    if (!parent) return;
    if (typeof content === 'string') parent.insertAdjacentHTML('beforeend', content);
    else if (content?.nodeType) parent.appendChild(content);
    else if (content?.toArray) for (const item of content.toArray()) parent.appendChild(item);
}
function prependContent(parent, content) {
    if (!parent) return;
    if (typeof content === 'string') parent.insertAdjacentHTML('afterbegin', content);
    else if (content?.nodeType) parent.prepend(content);
    else if (content?.toArray) for (const item of content.toArray().reverse()) parent.prepend(item);
}
const console = { ...globalThis.console, debug: () => {} };
const DEBUG_PREFIX = '<CallMode> ';
const MODULE_NAME = 'callmode';
let callActive = false;
let callState = 'idle';
let callButton = null;
let overlayResizeFrameId = null;
let overlayResizeSettleTimer = null;
let overlayUiInteractionTimer = null;
let overlayVisualRefreshFrameId = null;
let overlayAnimationFrameId = null;
let overlayCssMotionActive = false;
let overlayCssMotionLastFrameAt = 0;
let overlayAnimationLastFrameAt = 0;
const overlayDomCache = {
    root: null,
    callUi: null,
    content: null,
    backdrop: null,
    effectsLayer: null,
    particleCanvas: null,
    statusText: null,
};
const overlayInlineStyleCache = {
    root: Object.create(null),
    backdrop: Object.create(null),
    vars: Object.create(null),
};
const overlayCanvasParticles = {
    canvas: null,
    ctx: null,
    rafId: null,
    particles: [],
    spriteCache: {
        snow: null,
        firefly: null,
    },
    style: 'snow',
    fallRate: 1,
    fireflyGlow: 1,
    drawWidth: 0,
    drawHeight: 0,
    lastTs: 0,
};
const overlaySpiralCanvas = {
    canvas: null,
    ctx: null,
    active: false,
    drawWidth: 0,
    drawHeight: 0,
    lastTs: 0,
    spinCycleRings: [],
    spinPulseRing: 0,
    spinPulseFrame: 0,
    renderedFrame: false,
};
const OVERLAY_CANVAS_FRAME_INTERVAL_MS = 1000 / 20;
const OVERLAY_ANIMATION_FRAME_INTERVAL_MS = 1000 / 30;
let waveformAnimationFrameId = null;
let waveformLevelSmoothed = 0;
let waveformBars = [];
let waveformTimeData = null;
let callSfxContext = null;
const CALL_BREATH_CUE_CANDIDATES = {
    in: ['/assets/call-mode/overlay/breathe_in.wav'],
    out: ['/assets/call-mode/overlay/breathe_out.wav'],
};
let callParticleAmbientPlayer = null;
const callBreathCueUrlCache = { in: null, out: null };
const callBreathCueResolvePromise = { in: null, out: null };
const callBreathCueUnavailable = new Set();
const callBreathCuePlayer = { in: null, out: null };
let callBreathInTimer = null;
let callBreathOutTimer = null;
let callBreathPromptInTimer = null;
let callBreathPromptOutTimer = null;
let callBreathHoldTimer = null;
let hypnoWhisperTimer = null;
let hypnoParticleImpactTimer = null;
let hypnoEasterEggTimer = null;
let tranceDepth = 0;
let tranceDepthDecayTimer = null;
let lastHypnoWhisperText = '';
let hypnoWhisperTickCount = 0;
let lastBreathPromptIn = '';
let lastBreathPromptOut = '';
const hypnoWhisperClearTimers = new Set();
const overlayImpactReleaseTimers = new Map();
const overlayElementPool = {
    whispers: [],
    particles: [],
    impacts: [],
};
const activeOverlayElements = {
    whispers: [],
    particles: [],
    impacts: [],
};
let overlayVisibilityListenerAttached = false;
let overlaySuspendedByVisibility = false;
let overlaySuspendedByUiInteraction = false;
const HYPNO_MAX_ACTIVE_WHISPERS = 2;
const HYPNO_WHISPER_POOL = [
    'relax',
    'drift',
    'deeper',
    'breathe for me',
    'follow my voice',
    'be still for me',
    'soften for me',
    'let your thoughts go',
    'drop your guard',
    'sink for me',
    'listen and obey',
    'empty that mind',
    'melt and yield',
    'submit to calm',
    'good pet',
    'good boy',
    'just like that',
    'nice and deep',
];
const SPOKEN_WHISPER_EVERY_N_VISUALS = 3;
const HYPNO_BREATH_PROMPTS_IN = [
    'breathe in for me',
    'inhale nice and slow',
    'in for me now',
    'draw it in and hold',
];
const HYPNO_BREATH_PROMPTS_OUT = [
    'and breathe out',
    'exhale and let go',
    'out for me now',
    'release it all',
];
const VOICEFORGE_PROVIDER_KEY = 'VoiceForge';
const DEFAULT_VOICE_MARKER = '[Default Voice]';
const DISABLED_VOICE_MARKER = 'disabled';
const WHISPER_AUDIO_MIN_INTERVAL_MS = 6000;
let whisperCharacterHint = null;
let lastWhisperAudioAt = 0;
function pickRandom(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return '';
    }
    return items[Math.floor(Math.random() * items.length)];
}
function pickRandomNot(items, previousValue = '') {
    if (!Array.isArray(items) || items.length === 0) {
        return '';
    }

    if (items.length === 1) {
        return items[0];
    }

    const prev = String(previousValue || '');
    const filtered = prev ? items.filter((item) => String(item) !== prev) : items;
    const pool = filtered.length > 0 ? filtered : items;
    return pool[Math.floor(Math.random() * pool.length)];
}
function isDocumentHidden() {
    return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}
function resetOverlayInlineStyleCache() {
    overlayInlineStyleCache.root = Object.create(null);
    overlayInlineStyleCache.backdrop = Object.create(null);
    overlayInlineStyleCache.vars = Object.create(null);
}
function setCachedInlineStyle(element, cacheKey, prop, value) {
    if (!element) {
        return;
    }

    const nextValue = String(value);
    const cache = overlayInlineStyleCache[cacheKey];
    if (cache[prop] === nextValue) {
        return;
    }

    element.style.setProperty(prop, nextValue);
    cache[prop] = nextValue;
}
function removeOverlayActiveElement(poolKey, el) {
    const activeList = activeOverlayElements[poolKey];
    if (!activeList) {
        return;
    }
    const index = activeList.indexOf(el);
    if (index !== -1) {
        activeList.splice(index, 1);
    }
}
function acquireOverlayElement(poolKey, className) {
    const pool = overlayElementPool[poolKey];
    const element = pool && pool.length ? pool.pop() : document.createElement('div');
    element.className = className;
    element.removeAttribute('style');
    element.textContent = '';
    return element;
}
function releaseOverlayElement(poolKey, element) {
    if (!element) {
        return;
    }
    removeOverlayActiveElement(poolKey, element);
    if (element.parentNode) {
        element.parentNode.removeChild(element);
    }
    element.className = '';
    element.removeAttribute('style');
    element.textContent = '';
    const pool = overlayElementPool[poolKey];
    if (pool && pool.length < 600) {
        pool.push(element);
    }
}
function releaseOverlayImpactElement(element) {
    const releaseTimer = overlayImpactReleaseTimers.get(element);
    if (releaseTimer) {
        clearTimeout(releaseTimer);
        overlayImpactReleaseTimers.delete(element);
    }
    releaseOverlayElement('impacts', element);
}
function buildHypnoWhisperText() {
    const pool = getHypnoWhisperPool();
    const phrase = pickRandomNot(pool, lastHypnoWhisperText) || pickRandom(pool);
    lastHypnoWhisperText = phrase || lastHypnoWhisperText;
    return phrase;
}
function getHypnoWhisperPool() {
    const custom = String(extension_settings[MODULE_NAME]?.hypnoWhispers || '')
        .split(/\r?\n|\|/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 32);
    return custom.length ? custom : HYPNO_WHISPER_POOL;
}
function getCallSfxContext() {
    const AudioContextCtor = window.AudioContext;
    if (!AudioContextCtor) {
        return null;
    }

    if (!callSfxContext || callSfxContext.state === 'closed') {
        callSfxContext = new AudioContextCtor();
    }

    if (callSfxContext.state === 'suspended') {
        callSfxContext.resume().catch(() => {});
    }

    return callSfxContext;
}
function stopCallParticleAmbientLoop(resetPosition = true) {
    if (!callParticleAmbientPlayer) {
        return;
    }

    try {
        callParticleAmbientPlayer.pause();
        if (resetPosition) {
            callParticleAmbientPlayer.currentTime = 0;
        }
    } catch (e) {
        console.debug(DEBUG_PREFIX + 'Particle ambient stop skipped:', e);
    }
}
function shouldRunCallBreathCueLoop() {
    const settings = extension_settings[MODULE_NAME] || {};
    return isHypnoFeatureEnabled('hypnoBreathCuesEnabled') && callActive && settings.overlayEnabled === true;
}
async function resolveCallBreathCueAudioUrl(type = 'in') {
    const normalizedType = type === 'out' ? 'out' : 'in';
    if (callBreathCueUrlCache[normalizedType]) {
        return callBreathCueUrlCache[normalizedType];
    }
    if (callBreathCueResolvePromise[normalizedType]) {
        return callBreathCueResolvePromise[normalizedType];
    }

    callBreathCueResolvePromise[normalizedType] = (async () => {
        const candidates = CALL_BREATH_CUE_CANDIDATES[normalizedType] || CALL_BREATH_CUE_CANDIDATES.in;
        for (const filename of candidates) {
            if (callBreathCueUnavailable.has(filename)) {
                continue;
            }

            const url = new URL(filename, import.meta.url).href;
            try {
                const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
                if (response.ok) {
                    callBreathCueUrlCache[normalizedType] = url;
                    return url;
                }
            } catch (e) {
                // Ignore and continue with next candidate.
            }

            callBreathCueUnavailable.add(filename);
        }

        return null;
    })();

    const resolved = await callBreathCueResolvePromise[normalizedType];
    callBreathCueResolvePromise[normalizedType] = null;
    return resolved;
}
function playCallBreathCue(type = 'in') {
    const normalizedType = type === 'out' ? 'out' : 'in';

    resolveCallBreathCueAudioUrl(normalizedType)
        .then((url) => {
            if (!url || !shouldRunCallBreathCueLoop()) {
                return;
            }

            try {
                const player = callBreathCuePlayer[normalizedType] || new Audio(url);
                player.src = url;
                player.preload = 'auto';
                player.loop = false;
                player.playbackRate = 0.92;
                player.volume = toPerceptualAmbientVolume(getHypnoBreathCueVolume());
                player.currentTime = 0;
                callBreathCuePlayer[normalizedType] = player;
                player.play().catch(() => {});
            } catch (e) {
                console.debug(DEBUG_PREFIX + 'Breath cue play skipped:', e);
            }
        })
        .catch(() => {});
}
async function playBreathGuidancePrompt(type = 'in') {
  if (!isHypnoBreathGuidanceEnabled() || !callActive) return false;
  const phrase = pickRandomNot(type === 'out' ? HYPNO_BREATH_PROMPTS_OUT : HYPNO_BREATH_PROMPTS_IN, type === 'out' ? lastBreathPromptOut : lastBreathPromptIn);
  if (type === 'out') lastBreathPromptOut = phrase; else lastBreathPromptIn = phrase;
  return nitralState.callbacks.speak?.(phrase) || false;
 }
function applyBreathVisualPhase(phase = 'idle') {
    const overlay = $('#voiceforge_call_overlay');
    const strength = getHypnoBreathVisualStrength();
    const inScale = 1 + (0.08 * strength);
    const holdScale = 1 + (0.06 * strength);
    const outScale = 1 - (0.05 * strength);

    if (overlay.length) {
        overlay.attr('data-breath-phase', phase);
        const targetScale = phase === 'in' ? inScale : phase === 'hold' ? holdScale : phase === 'out' ? outScale : 1;
        overlay.css('--vf-breath-scale', targetScale.toFixed(3));
    }
}
function runBreathPhase(type = 'in') {
    if (!callActive || !shouldRunCallBreathCueLoop()) {
        return;
    }

    bumpTranceDepth(type === 'in' ? 0.02 : 0.014);
    applyBreathVisualPhase(type);
    playCallBreathCue(type);
}
function scheduleBreathPhaseWithGuidance(type = 'in', phaseStartDelayMs = 0) {
    const leadMs = getHypnoBreathGuidanceLeadMs();
    const hasGuidance = isHypnoBreathGuidanceEnabled() && leadMs > 0;
    const guidanceStartDelay = hasGuidance ? Math.max(0, phaseStartDelayMs - leadMs) : phaseStartDelayMs;

    return setTimeout(() => {
        if (!callActive || !shouldRunCallBreathCueLoop()) {
            return;
        }

        if (!hasGuidance) {
            runBreathPhase(type);
            return;
        }

        playBreathGuidancePrompt(type)
            .then((started) => {
                if (!callActive || !shouldRunCallBreathCueLoop()) {
                    return;
                }
                if (started) {
                    setTimeout(() => {
                        if (callActive && shouldRunCallBreathCueLoop()) {
                            runBreathPhase(type);
                        }
                    }, leadMs);
                } else {
                    runBreathPhase(type);
                }
            })
            .catch(() => {
                if (callActive && shouldRunCallBreathCueLoop()) {
                    runBreathPhase(type);
                }
            });
    }, guidanceStartDelay);
}
function stopCallBreathCueLoop(resetPosition = true) {
    if (callBreathInTimer) {
        clearTimeout(callBreathInTimer);
        callBreathInTimer = null;
    }
    if (callBreathOutTimer) {
        clearTimeout(callBreathOutTimer);
        callBreathOutTimer = null;
    }
    if (callBreathPromptInTimer) {
        clearTimeout(callBreathPromptInTimer);
        callBreathPromptInTimer = null;
    }
    if (callBreathPromptOutTimer) {
        clearTimeout(callBreathPromptOutTimer);
        callBreathPromptOutTimer = null;
    }
    if (callBreathHoldTimer) {
        clearTimeout(callBreathHoldTimer);
        callBreathHoldTimer = null;
    }

    applyBreathVisualPhase('idle');
    if (callButton) {
        callButton.classList.remove('vf-breath-hold');
        callButton.style.transform = '';
    }

    for (const type of ['in', 'out']) {
        const player = callBreathCuePlayer[type];
        if (!player) {
            continue;
        }

        try {
            player.pause();
            if (resetPosition) {
                player.currentTime = 0;
            }
        } catch (e) {
            console.debug(DEBUG_PREFIX + 'Breath cue stop skipped:', e);
        }
    }
}
function startCallBreathCueLoop() {
    stopCallBreathCueLoop(false);

    const tick = () => {
        if (!shouldRunCallBreathCueLoop()) {
            stopCallBreathCueLoop(false);
            return;
        }

        const inhaleMs = getHypnoBreathInDurationMs();
        const holdMs = getHypnoBreathHoldDurationMs();
        const exhaleMs = getHypnoBreathOutDurationMs();
        const restMs = getHypnoBreathRestDurationMs();
        const cycleMs = inhaleMs + holdMs + exhaleMs + restMs;

        callBreathPromptInTimer = scheduleBreathPhaseWithGuidance('in', 0);

        callBreathHoldTimer = setTimeout(() => {
            if (shouldRunCallBreathCueLoop()) {
                applyBreathVisualPhase('hold');
            }
        }, inhaleMs);

        callBreathOutTimer = scheduleBreathPhaseWithGuidance('out', inhaleMs + holdMs);

        callBreathPromptOutTimer = setTimeout(() => {
            if (shouldRunCallBreathCueLoop()) {
                applyBreathVisualPhase('idle');
            }
        }, inhaleMs + holdMs + exhaleMs);

        callBreathInTimer = setTimeout(tick, cycleMs);
    };

    tick();
}
function stopHypnoWhispers() {
    hypnoWhisperTickCount = 0;

    if (hypnoWhisperTimer) {
        clearTimeout(hypnoWhisperTimer);
        hypnoWhisperTimer = null;
    }

    for (const timerId of hypnoWhisperClearTimers) {
        clearTimeout(timerId);
    }
    hypnoWhisperClearTimers.clear();

    while (activeOverlayElements.whispers.length) {
        releaseOverlayElement('whispers', activeOverlayElements.whispers[activeOverlayElements.whispers.length - 1]);
    }

}
function applyTranceDepth() {
    const overlay = $('#voiceforge_call_overlay');
    if (!overlay.length) {
        return;
    }
    overlay.css('--vf-trance-depth', String(Math.max(0, Math.min(1, tranceDepth))));
}
function decayTranceDepthTick() {
    if (!callActive || !extension_settings[MODULE_NAME]?.overlayEnabled) {
        tranceDepthDecayTimer = null;
        return;
    }

    tranceDepth = Math.max(0, tranceDepth - 0.035);
    applyTranceDepth();
    if (tranceDepth > 0) {
        tranceDepthDecayTimer = setTimeout(decayTranceDepthTick, 1200);
    } else {
        tranceDepthDecayTimer = null;
    }
}
function bumpTranceDepth(amount = 0.06) {
    tranceDepth = Math.max(0, Math.min(1, tranceDepth + amount));
    applyTranceDepth();
    if (tranceDepthDecayTimer) {
        clearTimeout(tranceDepthDecayTimer);
    }
    tranceDepthDecayTimer = setTimeout(decayTranceDepthTick, 1300);
}
function stopHypnoEasterEggs() {
    if (hypnoEasterEggTimer) {
        clearTimeout(hypnoEasterEggTimer);
        hypnoEasterEggTimer = null;
    }

    if (tranceDepthDecayTimer) {
        clearTimeout(tranceDepthDecayTimer);
        tranceDepthDecayTimer = null;
    }

    const overlay = $('#voiceforge_call_overlay');
    overlay.removeClass('vf-eegg-vignette-pulse vf-eegg-focus-lock vf-eegg-time-slip vf-eegg-firefly-swarm vf-eegg-phase-lock vf-eegg-bloom');
    overlay.find('.vf-eegg-sigil').remove();
    tranceDepth = 0;
    lastHypnoWhisperText = '';
    lastBreathPromptIn = '';
    lastBreathPromptOut = '';
    applyTranceDepth();
}
function spawnEasterEggSigil() {
    const overlay = document.getElementById('voiceforge_call_overlay');
    if (!overlay) {
        return;
    }

    const phrases = ['focus', 'deeper', 'good', 'obey', 'soft', 'still', 'listen', 'drift'];
    const sigil = document.createElement('div');
    sigil.className = 'vf-eegg-sigil';
    sigil.textContent = pickRandom(phrases);
    const x = 18 + Math.random() * 64;
    const y = 18 + Math.random() * 62;
    const rot = -12 + Math.random() * 24;
    sigil.style.left = `${x}%`;
    sigil.style.top = `${y}%`;
    sigil.style.setProperty('--vf-sigil-rot', `${rot}deg`);
    sigil.style.setProperty('--vf-sigil-scale', `${(0.94 + Math.random() * 0.22).toFixed(3)}`);
    overlay.appendChild(sigil);
    setTimeout(() => sigil.remove(), 2600 + Math.floor(Math.random() * 1400));
}
function playMicroEarTone() {
    const ctx = getCallSfxContext();
    if (!ctx) {
        return;
    }

    try {
        const start = ctx.currentTime + 0.01;
        const duration = 0.22;
        const end = start + duration;
        const pan = (Math.random() < 0.5 ? -1 : 1) * (0.38 + Math.random() * 0.35);

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(640 + Math.random() * 260, start);
        osc.frequency.exponentialRampToValueAtTime(420 + Math.random() * 170, end);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.009, start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);

        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(pan, start);

        osc.connect(gain);
        gain.connect(panner);
        panner.connect(ctx.destination);

        osc.start(start);
        osc.stop(end);
    } catch (e) {
        // Ignore micro-tone failures.
    }
}
function triggerHypnoEasterEgg() {
    const overlay = $('#voiceforge_call_overlay');
    if (!overlay.length) {
        return;
    }

    const depth = Math.max(0, Math.min(1, tranceDepth));
    const roll = Math.random();

    if (roll < (0.22 + depth * 0.16)) {
        overlay.addClass('vf-eegg-vignette-pulse');
        setTimeout(() => overlay.removeClass('vf-eegg-vignette-pulse'), 1700 + Math.floor(900 * (1 - depth)));
    } else if (roll < (0.44 + depth * 0.15)) {
        overlay.addClass('vf-eegg-focus-lock');
        setTimeout(() => overlay.removeClass('vf-eegg-focus-lock'), 2600 + Math.floor(1800 * (1 - depth)));
    } else if (roll < (0.68 + depth * 0.12)) {
        overlay.addClass('vf-eegg-time-slip');
        setTimeout(() => overlay.removeClass('vf-eegg-time-slip'), 2400 + Math.floor(1500 * (1 - depth)));
    } else if (roll < 0.9) {
        overlay.addClass('vf-eegg-phase-lock');
        setTimeout(() => overlay.removeClass('vf-eegg-phase-lock'), 2600 + Math.floor(1200 * (1 - depth)));
    } else {
        if (getHypnoParticleStyle() === 'firefly') {
            overlay.addClass('vf-eegg-firefly-swarm');
            setTimeout(() => overlay.removeClass('vf-eegg-firefly-swarm'), 3200 + Math.floor(1800 * (1 - depth)));
        }
        if (depth > 0.35 && Math.random() < (0.4 + depth * 0.45)) {
            overlay.addClass('vf-eegg-bloom');
            setTimeout(() => overlay.removeClass('vf-eegg-bloom'), 1700 + Math.floor(700 * Math.random()));
        }
        playMicroEarTone();
    }

    if (depth > 0.22 && Math.random() < (0.18 + depth * 0.45)) {
        spawnEasterEggSigil();
    }
}
function startHypnoEasterEggs() {
    if (hypnoEasterEggTimer) {
        clearTimeout(hypnoEasterEggTimer);
        hypnoEasterEggTimer = null;
    }

    const tick = () => {
        if (!callActive || !areHypnoticEffectsEnabled() || !extension_settings[MODULE_NAME]?.overlayEnabled || isDocumentHidden()) {
            hypnoEasterEggTimer = null;
            return;
        }

        triggerHypnoEasterEgg();
        const depth = Math.max(0, Math.min(1, tranceDepth));
        const minMs = Math.max(6000, 18000 - Math.floor(depth * 11000));
        const maxMs = Math.max(minMs + 1200, 32000 - Math.floor(depth * 17000));
        const nextMs = minMs + Math.floor(Math.random() * (maxMs - minMs));
        hypnoEasterEggTimer = setTimeout(tick, nextMs);
    };

    hypnoEasterEggTimer = setTimeout(tick, 12000 + Math.floor(Math.random() * 7000));
}
function ensureOverlayParticleCanvas() {
    const overlay = document.getElementById('voiceforge_call_overlay');
    if (!overlay) {
        return null;
    }

    if (!overlayCanvasParticles.canvas || !overlay.contains(overlayCanvasParticles.canvas)) {
        const canvas = overlay.querySelector('.vf-call-particle-canvas');
        if (!canvas) {
            overlayCanvasParticles.canvas = null;
            overlayCanvasParticles.ctx = null;
            return null;
        }

        overlayCanvasParticles.canvas = canvas;
        overlayCanvasParticles.ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
        overlayCanvasParticles.drawWidth = 0;
        overlayCanvasParticles.drawHeight = 0;
    }

    return overlayCanvasParticles.canvas;
}
function ensureOverlaySpiralCanvas() {
    const canvas = ensureOverlayParticleCanvas();
    const overlay = document.getElementById('voiceforge_call_overlay');
    overlay?.querySelector('.vf-call-spiral-canvas')?.remove();

    overlaySpiralCanvas.canvas = canvas;
    overlaySpiralCanvas.ctx = overlayCanvasParticles.ctx;
    overlaySpiralCanvas.drawWidth = overlayCanvasParticles.drawWidth;
    overlaySpiralCanvas.drawHeight = overlayCanvasParticles.drawHeight;
    return canvas;
}
function resizeOverlayParticleCanvas(force = false) {
    const canvas = ensureOverlayParticleCanvas();
    const ctx = overlayCanvasParticles.ctx;
    if (!canvas || !ctx) {
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const drawWidth = Math.max(1, Math.round(rect.width));
    const drawHeight = Math.max(1, Math.round(rect.height));
    const dpr = Math.max(1, Math.min(1.5, window.devicePixelRatio || 1));
    const nextWidth = Math.max(1, Math.round(drawWidth * dpr));
    const nextHeight = Math.max(1, Math.round(drawHeight * dpr));

    if (!force && canvas.width === nextWidth && canvas.height === nextHeight && overlayCanvasParticles.drawWidth === drawWidth && overlayCanvasParticles.drawHeight === drawHeight) {
        return;
    }

    canvas.width = nextWidth;
    canvas.height = nextHeight;
    overlayCanvasParticles.drawWidth = drawWidth;
    overlayCanvasParticles.drawHeight = drawHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function resizeOverlaySpiralCanvas(force = false) {
    ensureOverlaySpiralCanvas();
    resizeOverlayParticleCanvas(force);
    overlaySpiralCanvas.drawWidth = overlayCanvasParticles.drawWidth;
    overlaySpiralCanvas.drawHeight = overlayCanvasParticles.drawHeight;
    overlaySpiralCanvas.ctx = overlayCanvasParticles.ctx;

    if (!overlaySpiralCanvas.canvas || !overlaySpiralCanvas.ctx) {
        return;
    }
}
function hasActiveOverlayAnimationWork() {
    return overlayCssMotionActive || overlaySpiralCanvas.active || overlayCanvasParticles.rafId !== null || waveformAnimationFrameId !== null;
}
function updateOverlayCssMotionFrame(ts) {
    if (!overlayCssMotionActive || !callActive || isDocumentHidden() || !extension_settings[MODULE_NAME]?.overlayEnabled) {
        overlayCssMotionActive = false;
        return false;
    }

    const now = Number.isFinite(ts) ? ts : performance.now();
    if (overlayCssMotionLastFrameAt !== 0 && (now - overlayCssMotionLastFrameAt) < WAVEFORM_FRAME_INTERVAL_MS) {
        return true;
    }
    overlayCssMotionLastFrameAt = now;

    const overlay = overlayDomCache.root?.[0] || document.getElementById('voiceforge_call_overlay');
    if (!overlay) {
        overlayCssMotionActive = false;
        return false;
    }

    if (!areHypnoticEffectsEnabled()) {
        setCachedInlineStyle(overlay, 'vars', '--vf-overlay-smoke-opacity', '0');
        setCachedInlineStyle(overlay, 'vars', '--vf-overlay-vignette-opacity', '0');
        setCachedInlineStyle(overlay, 'vars', '--vf-overlay-aurora-opacity', '0');
        setCachedInlineStyle(overlay, 'vars', '--vf-overlay-grid-y', '0px');
        setCachedInlineStyle(overlay, 'vars', '--vf-overlay-content-y', '0px');
        setCachedInlineStyle(overlay, 'vars', '--vf-overlay-screen-flash-opacity', '0');
        overlayCssMotionActive = false;
        return false;
    }

    const t = now / 1000;
    const breath = (Math.sin(t * 0.46) + 1) * 0.5;
    const slow = (Math.sin(t * 0.073) + 1) * 0.5;
    const drift = Math.sin(t * 0.19) * 0.62 + Math.sin(t * 0.047) * 0.32;
    const lift = Math.cos(t * 0.16) * 0.48 + Math.sin(t * 0.061) * 0.22;
    const depth = Math.max(0, Math.min(1, tranceDepth));

    setCachedInlineStyle(overlay, 'vars', '--vf-overlay-smoke-x', `${drift.toFixed(3)}%`);
    setCachedInlineStyle(overlay, 'vars', '--vf-overlay-smoke-y', `${lift.toFixed(3)}%`);
    setCachedInlineStyle(overlay, 'vars', '--vf-overlay-smoke-scale', (1.01 + breath * 0.01 + slow * 0.008).toFixed(4));
    setCachedInlineStyle(overlay, 'vars', '--vf-overlay-smoke-opacity', (0.24 + breath * 0.045 + depth * 0.035).toFixed(3));
    setCachedInlineStyle(overlay, 'vars', '--vf-overlay-vignette-opacity', (0.42 + depth * 0.16 + breath * 0.045).toFixed(3));
    setCachedInlineStyle(overlay, 'vars', '--vf-overlay-grid-y', `${((t * 0.62) % 72).toFixed(2)}px`);
    setCachedInlineStyle(overlay, 'vars', '--vf-overlay-aurora-rot', `${((t * -0.92) % 360).toFixed(2)}deg`);
    setCachedInlineStyle(overlay, 'vars', '--vf-overlay-aurora-opacity', (0.22 + slow * 0.08 + depth * 0.04).toFixed(3));
    setCachedInlineStyle(overlay, 'vars', '--vf-overlay-content-y', `${(Math.sin(t * 0.38) * 1.15).toFixed(2)}px`);
    setCachedInlineStyle(overlay, 'vars', '--vf-overlay-screen-flash-opacity', '0');

    const rings = overlay._vfCallRings || (overlay._vfCallRings = Array.from(overlay.querySelectorAll('.vf-ring')));
    for (let i = 0; i < rings.length; i++) {
        const phase = ((t * 0.11) + (i * 0.33)) % 1;
        const scale = 0.94 + phase * 0.52;
        const opacity = phase < 0.12
            ? phase / 0.12 * 0.22
            : Math.max(0, 0.22 * (1 - ((phase - 0.12) / 0.88)));
        const ring = rings[i];
        ring.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(3)}) rotate(${(phase * 180).toFixed(2)}deg)`;
        ring.style.opacity = opacity.toFixed(3);
        ring.style.borderWidth = `${Math.max(0.5, 2 - phase * 1.5).toFixed(2)}px`;
    }
    return true;
}
function stopOverlayAnimationLoopIfIdle() {
    if (hasActiveOverlayAnimationWork()) {
        return;
    }
    if (overlayAnimationFrameId !== null) {
        cancelAnimationFrame(overlayAnimationFrameId);
        overlayAnimationFrameId = null;
    }
}
function runOverlayAnimationFrame(ts) {
    overlayAnimationFrameId = null;

    const now = Number.isFinite(ts) ? ts : performance.now();
    if (overlayAnimationLastFrameAt !== 0 && (now - overlayAnimationLastFrameAt) < OVERLAY_ANIMATION_FRAME_INTERVAL_MS) {
        if (hasActiveOverlayAnimationWork()) {
            overlayAnimationFrameId = requestAnimationFrame(runOverlayAnimationFrame);
        }
        return;
    }
    overlayAnimationLastFrameAt = now;

    const cssMotionActive = updateOverlayCssMotionFrame(now);
    const spiralActive = renderOverlaySpiralCanvas(now, true);
    const sharedCanvas = overlaySpiralCanvas.canvas && overlaySpiralCanvas.canvas === overlayCanvasParticles.canvas;
    const particlesActive = renderOverlayParticleCanvas(now, !(sharedCanvas && overlaySpiralCanvas.renderedFrame));
    const waveformActive = updateCallWaveformFrame(now);

    if (cssMotionActive || spiralActive || particlesActive || waveformActive) {
        overlayAnimationFrameId = requestAnimationFrame(runOverlayAnimationFrame);
    }
}
function ensureOverlayAnimationLoop() {
    if (overlayAnimationFrameId !== null || !hasActiveOverlayAnimationWork()) {
        return;
    }
    overlayAnimationLastFrameAt = 0;
    overlayAnimationFrameId = requestAnimationFrame(runOverlayAnimationFrame);
}
function startOverlayCssMotion() {
    if (isDocumentHidden()) {
        return;
    }
    if (!areHypnoticEffectsEnabled()) {
        stopOverlayCssMotion();
        return;
    }
    overlayCssMotionActive = true;
    overlayCssMotionLastFrameAt = 0;
    ensureOverlayAnimationLoop();
}
function stopOverlayCssMotion() {
    overlayCssMotionActive = false;
    overlayCssMotionLastFrameAt = 0;
    stopOverlayAnimationLoopIfIdle();
}
function startOverlaySpiralCanvas() {
    if (isDocumentHidden()) {
        return;
    }
    overlaySpiralCanvas.active = true;
    overlaySpiralCanvas.lastTs = 0;
    ensureOverlaySpiralCanvas();
    resizeOverlaySpiralCanvas(true);
    ensureOverlayAnimationLoop();
}
function stopOverlaySpiralCanvas(clearFrame = true) {
    overlaySpiralCanvas.active = false;
    overlaySpiralCanvas.lastTs = 0;
    overlaySpiralCanvas.spinCycleRings = [];
    overlaySpiralCanvas.spinPulseRing = 0;
    overlaySpiralCanvas.spinPulseFrame = 0;
    overlaySpiralCanvas.renderedFrame = false;

    if (clearFrame && overlaySpiralCanvas.ctx && overlaySpiralCanvas.drawWidth > 0 && overlaySpiralCanvas.drawHeight > 0) {
        overlaySpiralCanvas.ctx.clearRect(0, 0, overlaySpiralCanvas.drawWidth, overlaySpiralCanvas.drawHeight);
    }
    stopOverlayAnimationLoopIfIdle();
}
function removeOverlaySpiralCanvas() {
    stopOverlaySpiralCanvas(true);
    overlaySpiralCanvas.canvas = null;
    overlaySpiralCanvas.ctx = null;
}
function drawOverlayVortexDots(ctx, width, height, now, reactiveLevel) {
    const maxRadius = Math.sqrt(width * width + height * height) * 0.55;
    const dotCount = Math.min(1000, Math.max(420, Math.floor(maxRadius * 1.25)));
    const angleSpeed = now * 0.031;
    const radiusStep = maxRadius / dotCount;
    const centerX = width / 2;
    const centerY = height / 2;
    const dotSize = Math.max(2.0, Math.min(5.2, Math.min(width, height) / 180));

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < dotCount; i++) {
        const radius = i * radiusStep;
        if (radius < 18) continue;
        const angle = i + angleSpeed;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        const progress = i / dotCount;
        const alpha = Math.max(0.014, Math.min(0.13, 0.02 + progress * 0.07 + reactiveLevel * 0.035));
        const warm = Math.floor(168 + progress * 72);
        const plum = Math.floor(96 + progress * 58);
        ctx.fillStyle = i % 5 === 0
            ? `rgba(${plum}, 74, 128, ${alpha.toFixed(3)})`
            : `rgba(255, ${warm}, 104, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, dotSize * (0.62 + progress * 0.48), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}
function rebuildOverlaySpinCycleRings(width, height) {
    const maxRadius = Math.sqrt(width * width + height * height) * 0.54;
    const ballCount = 20;
    const angleSlice = (Math.PI * 2) / ballCount;
    const rings = [];
    let radius = 4;
    let ballSize = 2;
    let offset = false;
    while (radius < maxRadius) {
        const angleMod = offset ? angleSlice * 0.5 : 0;
        const speed = offset ? 0.02 : -0.02;
        rings.push({ radius, angleMod, speed, baseAngle: 0 });
        offset = !offset;
        radius += ballSize;
        ballSize *= 1.3;
    }
    overlaySpiralCanvas.spinCycleRings = rings;
    overlaySpiralCanvas.spinPulseRing = rings.length + 2;
    overlaySpiralCanvas.spinPulseFrame = 0;
}
function drawOverlaySpinCycle(ctx, width, height, frameScale, reactiveLevel) {
    if (!overlaySpiralCanvas.spinCycleRings.length) {
        rebuildOverlaySpinCycleRings(width, height);
    }

    const rings = overlaySpiralCanvas.spinCycleRings;
    const ballCount = 20;
    const angleSlice = (Math.PI * 2) / ballCount;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.globalCompositeOperation = 'lighter';
    for (let r = 0; r < rings.length; r++) {
        const ring = rings[r];
        ring.baseAngle += ring.speed * frameScale;
        const progress = rings.length > 1 ? r / (rings.length - 1) : 0;
        const diameter = Math.max(2, 0.7 * ((Math.PI * 2 * ring.radius) / ballCount));
        const pulseDistance = Math.abs(r - overlaySpiralCanvas.spinPulseRing);
        const shadow = pulseDistance === 0 ? 0.42 : pulseDistance === 1 ? 0.52 : pulseDistance === 2 ? 0.63 : pulseDistance === 3 ? 0.75 : pulseDistance === 4 ? 0.86 : 1;
        const alpha = Math.max(0.006, Math.min(0.065, (0.011 + progress * 0.032 + reactiveLevel * 0.014) * shadow));
        for (let i = 0; i < ballCount; i++) {
            const angle = (i * angleSlice) + ring.angleMod + ring.baseAngle;
            const x = ring.radius * Math.cos(angle);
            const y = ring.radius * Math.sin(angle);
            ctx.fillStyle = i % 4 === 0
                ? `rgba(142, 92, 146, ${alpha.toFixed(3)})`
                : `rgba(94, 234, 212, ${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(x, y, diameter * 0.28, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();

    overlaySpiralCanvas.spinPulseFrame += frameScale;
    if (overlaySpiralCanvas.spinPulseFrame >= 4) {
        overlaySpiralCanvas.spinPulseRing = overlaySpiralCanvas.spinPulseRing > -2 ? overlaySpiralCanvas.spinPulseRing - 1 : rings.length + 2;
        overlaySpiralCanvas.spinPulseFrame = 0;
    }
}
function renderOverlaySpiralCanvas(ts, clearFrame = true) {
    overlaySpiralCanvas.renderedFrame = false;

    if (!overlaySpiralCanvas.active || !callActive || isDocumentHidden() || !extension_settings[MODULE_NAME]?.overlayEnabled || !isHypnoFeatureEnabled('hypnoSpiralEnabled')) {
        if (overlaySpiralCanvas.active) stopOverlaySpiralCanvas(false);
        return false;
    }

    const now = Number.isFinite(ts) ? ts : performance.now();
    if (overlaySpiralCanvas.lastTs !== 0 && (now - overlaySpiralCanvas.lastTs) < OVERLAY_CANVAS_FRAME_INTERVAL_MS) {
        return true;
    }

    const canvas = ensureOverlaySpiralCanvas();
    const ctx = overlaySpiralCanvas.ctx;
    if (!canvas || !ctx) {
        return false;
    }
    resizeOverlaySpiralCanvas(false);

    const width = overlaySpiralCanvas.drawWidth;
    const height = overlaySpiralCanvas.drawHeight;
    if (width <= 0 || height <= 0) {
        return true;
    }

    const dt = Math.min(0.08, Math.max(0.008, ((now - (overlaySpiralCanvas.lastTs || now)) / 1000) || 0.033));
    overlaySpiralCanvas.lastTs = now;
    const frameScale = dt * 30;
    const reactiveLevel = Math.max(0, Math.min(1, waveformLevelSmoothed || 0));

    if (clearFrame) {
        ctx.clearRect(0, 0, width, height);
    }
    const preset = getHypnoSpiralPreset();
    if (preset === 'none') {
        overlaySpiralCanvas.renderedFrame = true;
        return true;
    }
    if (preset === 'soft-orbital') {
        drawOverlaySpinCycle(ctx, width, height, frameScale * 0.55, reactiveLevel);
    } else if (preset === 'breathing-ring') {
        drawOverlayBreathingRing(ctx, width, height, now, reactiveLevel);
    } else if (preset === 'deep-tunnel') {
        drawOverlayDeepTunnel(ctx, width, height, now, reactiveLevel);
    } else if (preset === 'pendulum') {
        drawOverlayPendulum(ctx, width, height, now, reactiveLevel);
    } else {
        drawOverlayVortexDots(ctx, width, height, now, reactiveLevel);
        drawOverlaySpinCycle(ctx, width, height, frameScale, reactiveLevel);
    }
    overlaySpiralCanvas.renderedFrame = true;
    return true;
}
function stopOverlayParticleCanvas(clearFrame = true) {
    overlayCanvasParticles.rafId = null;

    overlayCanvasParticles.lastTs = 0;
    overlayCanvasParticles.particles = [];

    if (clearFrame && overlayCanvasParticles.ctx && overlayCanvasParticles.drawWidth > 0 && overlayCanvasParticles.drawHeight > 0) {
        overlayCanvasParticles.ctx.clearRect(0, 0, overlayCanvasParticles.drawWidth, overlayCanvasParticles.drawHeight);
    }
    stopOverlayAnimationLoopIfIdle();
}
function createCanvasParticle(style, zLayer, width, height, fallRate, fireflyGlow) {
    const safeFallRate = Math.max(0.25, fallRate);
    const far = zLayer === 'far';
    const mid = zLayer === 'mid';

    if (style === 'rain') {
        const alpha = far ? (0.22 + Math.random() * 0.18) : mid ? (0.32 + Math.random() * 0.2) : (0.44 + Math.random() * 0.26);
        const speed = (far ? 180 : mid ? 235 : 300) * safeFallRate;
        return {
            style,
            x: Math.random() * width,
            y: Math.random() * (height + 120) - 80,
            vx: (-20 + Math.random() * 14) * (far ? 0.55 : mid ? 0.75 : 1),
            vy: speed,
            alpha,
            width: far ? 0.8 : mid ? 1.1 : 1.4,
            height: far ? (7 + Math.random() * 7) : mid ? (9 + Math.random() * 8) : (12 + Math.random() * 9),
            strokeColor: `rgba(204, 230, 255, ${Math.max(0.04, Math.min(1, alpha)).toFixed(3)})`,
        };
    }

    if (style === 'firefly') {
        const glowScale = Math.max(0.5, Math.min(3, fireflyGlow));
        const baseX = Math.random() * width;
        const baseY = Math.random() * height;
        return {
            style,
            x: baseX,
            y: baseY,
            baseX,
            baseY,
            vx: (-8 + Math.random() * 16) * (far ? 0.35 : mid ? 0.55 : 0.75),
            vy: (-6 + Math.random() * 12) * (far ? 0.35 : mid ? 0.55 : 0.75),
            size: (far ? 0.85 : mid ? 1.15 : 1.5) + Math.random() * (far ? 0.35 : mid ? 0.45 : 0.6),
            alpha: far ? (0.12 + Math.random() * 0.12) : mid ? (0.18 + Math.random() * 0.15) : (0.24 + Math.random() * 0.18),
            phase: Math.random() * Math.PI * 2,
            twinkleSpeed: 0.75 + Math.random() * 1.45,
            wanderX: (far ? 8 : mid ? 13 : 18) * (0.7 + Math.random() * 0.7),
            wanderY: (far ? 6 : mid ? 10 : 14) * (0.7 + Math.random() * 0.7),
            glowScale,
        };
    }

    const speed = (far ? 38 : mid ? 58 : 76) * safeFallRate;
    return {
        style: 'snow',
        x: Math.random() * width,
        y: Math.random() * (height + 120) - 80,
        vx: (-12 + Math.random() * 24) * (far ? 0.45 : mid ? 0.7 : 1),
        vy: speed,
        size: (far ? 1.0 : mid ? 1.8 : 2.4) + Math.random() * (far ? 1.4 : mid ? 1.6 : 2.4),
        alpha: far ? (0.16 + Math.random() * 0.18) : mid ? (0.26 + Math.random() * 0.2) : (0.36 + Math.random() * 0.3),
        drift: 0.5 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
    };
}
function getOverlayParticleSprite(style) {
    const key = style === 'firefly' ? 'firefly' : 'snow';
    const cached = overlayCanvasParticles.spriteCache[key];
    if (cached) {
        return cached;
    }

    const size = 80;
    const sprite = document.createElement('canvas');
    sprite.width = size;
    sprite.height = size;

    const ctx = sprite.getContext('2d', { alpha: true });
    if (!ctx) {
        return null;
    }

    const c = size / 2;
    const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
    if (key === 'firefly') {
        gradient.addColorStop(0, 'rgba(255, 248, 188, 1)');
        gradient.addColorStop(0.35, 'rgba(255, 232, 142, 0.88)');
        gradient.addColorStop(0.72, 'rgba(255, 210, 120, 0.28)');
        gradient.addColorStop(1, 'rgba(255, 206, 120, 0)');
    } else {
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.45, 'rgba(236, 246, 255, 0.72)');
        gradient.addColorStop(0.78, 'rgba(214, 232, 250, 0.22)');
        gradient.addColorStop(1, 'rgba(210, 230, 255, 0)');
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.fill();

    overlayCanvasParticles.spriteCache[key] = sprite;
    return sprite;
}
function renderOverlayParticleCanvas(ts, clearFrame = true) {
    const ctx = overlayCanvasParticles.ctx;
    const width = overlayCanvasParticles.drawWidth;
    const height = overlayCanvasParticles.drawHeight;

    if (!ctx || width <= 0 || height <= 0 || !overlayCanvasParticles.particles.length || isDocumentHidden() || !callActive || !extension_settings[MODULE_NAME]?.overlayEnabled || !isHypnoFeatureEnabled('hypnoParticlesEnabled')) {
        overlayCanvasParticles.rafId = null;
        return false;
    }

    if (overlayCanvasParticles.lastTs !== 0 && (ts - overlayCanvasParticles.lastTs) < OVERLAY_CANVAS_FRAME_INTERVAL_MS) {
        return true;
    }

    const dt = Math.min(0.08, Math.max(0.008, ((ts - (overlayCanvasParticles.lastTs || ts)) / 1000) || 0.016));
    overlayCanvasParticles.lastTs = ts;

    if (clearFrame) {
        ctx.clearRect(0, 0, width, height);
    }
    ctx.globalCompositeOperation = 'source-over';

    for (const p of overlayCanvasParticles.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.style === 'firefly') {
            p.phase += p.twinkleSpeed * dt;
            p.baseX += p.vx * dt;
            p.baseY += p.vy * dt;
            if (p.baseX < -60) p.baseX = width + 60;
            if (p.baseX > width + 60) p.baseX = -60;
            if (p.baseY < -60) p.baseY = height + 60;
            if (p.baseY > height + 60) p.baseY = -60;
            p.x = p.baseX + Math.cos(p.phase * 0.85) * p.wanderX + Math.sin(p.phase * 0.31) * p.wanderX * 0.35;
            p.y = p.baseY + Math.sin(p.phase) * p.wanderY + Math.cos(p.phase * 0.43) * p.wanderY * 0.28;
        } else if (p.style === 'snow') {
            p.phase += p.drift * dt;
            p.x += Math.sin(p.phase) * 14 * dt;
        }

        if (p.style !== 'firefly') {
            if (p.x < -40) p.x = width + 20;
            if (p.x > width + 40) p.x = -20;
            if (p.y > height + 50) p.y = -30;
        }

        if (p.style === 'rain') {
            ctx.strokeStyle = p.strokeColor;
            ctx.lineWidth = p.width;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + p.vx * 0.045, p.y - p.height);
            ctx.stroke();
            continue;
        }

        if (p.style === 'firefly') {
            const alpha = Math.max(0.04, Math.min(0.52, p.alpha * (0.76 + Math.sin(p.phase * 2.1) * 0.18)));
            const core = Math.max(1.1, p.size * p.glowScale);
            const halo = core * 4.2;
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = alpha * 0.22;
            ctx.fillStyle = 'rgba(255, 188, 82, 1)';
            ctx.beginPath();
            ctx.arc(p.x, p.y, halo, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = 'rgba(255, 244, 170, 1)';
            ctx.beginPath();
            ctx.arc(p.x, p.y, core, 0, Math.PI * 2);
            ctx.fill();
            continue;
        }

        const alpha = Math.max(0.05, Math.min(1, p.alpha));
        const sprite = getOverlayParticleSprite(p.style);
        if (!sprite) {
            continue;
        }

        const diameter = p.size * 3.6;
        const half = diameter / 2;
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprite, p.x - half, p.y - half, diameter, diameter);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    return true;
}
function startOverlayParticleCanvas(style, count, fallRate, fireflyGlow) {
    if (!count) {
        stopOverlayParticleCanvas(true);
        return;
    }

    const canvas = ensureOverlayParticleCanvas();
    if (!canvas || !overlayCanvasParticles.ctx) {
        return;
    }

    resizeOverlayParticleCanvas(true);
    const width = overlayCanvasParticles.drawWidth;
    const height = overlayCanvasParticles.drawHeight;
    overlayCanvasParticles.style = style;
    overlayCanvasParticles.fallRate = fallRate;
    overlayCanvasParticles.fireflyGlow = fireflyGlow;
    overlayCanvasParticles.particles = [];

    for (let i = 0; i < count; i++) {
        const zLayer = Math.random() < 0.55 ? 'far' : 'mid';
        overlayCanvasParticles.particles.push(createCanvasParticle(style, zLayer, width, height, fallRate, fireflyGlow));
    }

    overlayCanvasParticles.lastTs = 0;
    overlayCanvasParticles.rafId = 1;
    ensureOverlayAnimationLoop();
}
function scheduleParticleImpacts(style = 'snow') {
    if (hypnoParticleImpactTimer) {
        clearTimeout(hypnoParticleImpactTimer);
        hypnoParticleImpactTimer = null;
    }

    if (style !== 'snow' && style !== 'rain') {
        return;
    }

    const tick = () => {
        if (!callActive || !extension_settings[MODULE_NAME]?.overlayEnabled || !isHypnoFeatureEnabled('hypnoParticlesEnabled') || isDocumentHidden()) {
            hypnoParticleImpactTimer = null;
            return;
        }

        const overlay = document.getElementById('voiceforge_call_overlay');
        const effectsLayer = overlay?.querySelector('.vf-call-effects-layer') || null;
        if (!overlay || !effectsLayer) {
            hypnoParticleImpactTimer = setTimeout(tick, 800);
            return;
        }

        const impactRate = getHypnoParticleImpactRate();
        const impactChance = (style === 'rain' ? 0.85 : 0.45) * impactRate;
        if (Math.random() < Math.min(0.98, Math.max(0, impactChance))) {
            const impact = acquireOverlayElement('impacts', `vf-call-impact vf-call-impact-${style}`);
            const x = 4 + Math.random() * 92;
            const y = 82 + Math.random() * 14;
            const scale = style === 'rain' ? 0.65 + Math.random() * 0.9 : 0.8 + Math.random() * 1.1;
            impact.style.left = `${x}%`;
            impact.style.top = `${y}%`;
            impact.style.transform = `translate(-50%, -50%) scale(${scale})`;
            effectsLayer.appendChild(impact);
            activeOverlayElements.impacts.push(impact);
            const impactLifetime = style === 'rain' ? 520 : 920;
            const releaseTimerId = setTimeout(() => {
                overlayImpactReleaseTimers.delete(impact);
                releaseOverlayImpactElement(impact);
            }, impactLifetime);
            overlayImpactReleaseTimers.set(impact, releaseTimerId);
        }

        const minDelayBase = style === 'rain' ? 220 : 560;
        const maxDelayBase = style === 'rain' ? 520 : 1200;
        const minDelay = Math.max(80, Math.round(minDelayBase / Math.max(0.15, impactRate)));
        const maxDelay = Math.max(minDelay + 60, Math.round(maxDelayBase / Math.max(0.15, impactRate)));
        hypnoParticleImpactTimer = setTimeout(tick, minDelay + Math.floor(Math.random() * (maxDelay - minDelay)));
    };

    hypnoParticleImpactTimer = setTimeout(tick, style === 'rain' ? 280 : 900);
}
function startHypnoParticles() {
    if (!isHypnoFeatureEnabled('hypnoParticlesEnabled') || isDocumentHidden()) return;

    const overlay = document.getElementById('voiceforge_call_overlay');
    const effectsLayer = overlay?.querySelector('.vf-call-effects-layer') || null;
    if (!overlay || !effectsLayer) return;

    const particleCount = getHypnoParticleCount();
    const fallRate = getHypnoParticleFallRate();
    const particleStyle = getHypnoParticleStyle();
    const fireflyGlow = getHypnoFireflyGlow();

    const canvasCount = particleCount;

    const sameCanvasParticles = overlayCanvasParticles.rafId !== null
        && overlayCanvasParticles.style === particleStyle
        && overlayCanvasParticles.particles.length === canvasCount
        && Math.abs(Number(overlayCanvasParticles.fallRate) - fallRate) < 0.001
        && Math.abs(Number(overlayCanvasParticles.fireflyGlow) - fireflyGlow) < 0.001;
    if (sameCanvasParticles) {
        ensureOverlayAnimationLoop();
        scheduleParticleImpacts(particleStyle);
        return;
    }

    while (activeOverlayElements.particles.length) {
        releaseOverlayElement('particles', activeOverlayElements.particles[activeOverlayElements.particles.length - 1]);
    }
    while (activeOverlayElements.impacts.length) {
        releaseOverlayImpactElement(activeOverlayElements.impacts[activeOverlayElements.impacts.length - 1]);
    }

    scheduleParticleImpacts(particleStyle);
    startOverlayParticleCanvas(particleStyle, canvasCount, fallRate, fireflyGlow);

}
function resolveWhisperCharacterName() {
    if (nitralState.activeAgentId) return nitralState.activeAgentId;
    if (nitralState.activeAgentName) return nitralState.activeAgentName;
    if (whisperCharacterHint) return whisperCharacterHint;

    const fallback = getCharacterNameFallback();
    if (fallback) return fallback;

    // Last resort: pick first named entry from voice map
    const providerSettings = getVoiceForgeProviderSettings();
    if (providerSettings?.voiceMap) {
        const keys = Object.keys(providerSettings.voiceMap);
        for (const key of keys) {
            if (key !== DEFAULT_VOICE_MARKER && key !== DISABLED_VOICE_MARKER) {
                return key;
            }
        }
    }

    return null;
}
function startHypnoWhispers() {
    if (!isHypnoFeatureEnabled('hypnoWhispersEnabled') || isDocumentHidden()) {
        stopHypnoWhispers();
        return;
    }

    stopHypnoWhispers();

    const tick = () => {
        if (!isHypnoFeatureEnabled('hypnoWhispersEnabled') || !callActive || !extension_settings[MODULE_NAME]?.overlayEnabled) {
            stopHypnoWhispers();
            return;
        }

        const overlay = document.getElementById('voiceforge_call_overlay');
        if (!overlay) {
            hypnoWhisperTimer = setTimeout(tick, 1200);
            return;
        }

        if (activeOverlayElements.whispers.length >= HYPNO_MAX_ACTIVE_WHISPERS) {
            releaseOverlayElement('whispers', activeOverlayElements.whispers[0]);
        }

        const whisperEl = acquireOverlayElement('whispers', 'vf-call-whisper');
        overlay.appendChild(whisperEl);
        activeOverlayElements.whispers.push(whisperEl);

        const text = buildHypnoWhisperText();
        const x = 14 + Math.random() * 72;
        const y = 12 + Math.random() * 76;
        const rotation = -8 + Math.random() * 16;
        whisperEl.textContent = text;
        whisperEl.style.setProperty('--vf-whisper-x', `${x}%`);
        whisperEl.style.setProperty('--vf-whisper-y', `${y}%`);
        whisperEl.style.setProperty('--vf-whisper-rot', `${rotation}deg`);
        whisperEl.classList.remove('is-visible');
        requestAnimationFrame(() => {
            if (activeOverlayElements.whispers.includes(whisperEl)) {
                whisperEl.classList.add('is-visible');
            }
        });

        bumpTranceDepth(0.018);
        hypnoWhisperTickCount += 1;
        if ((hypnoWhisperTickCount % SPOKEN_WHISPER_EVERY_N_VISUALS) === 0) {
            const charName = resolveWhisperCharacterName();
            if (charName) {
                playWhisperPhraseAudio(text, charName).catch(() => {});
            }
        }

        const clearTimerId = setTimeout(() => {
            whisperEl.classList.remove('is-visible');
            releaseOverlayElement('whispers', whisperEl);
            hypnoWhisperClearTimers.delete(clearTimerId);
        }, 3800);
        hypnoWhisperClearTimers.add(clearTimerId);

        hypnoWhisperTimer = setTimeout(tick, 8500 + Math.floor(Math.random() * 4500));
    };

    hypnoWhisperTimer = setTimeout(tick, 2200);
}
function getOverlayRoot(createIfMissing = false) {
    if (overlayDomCache.root && overlayDomCache.root.length && document.body?.contains(overlayDomCache.root[0])) {
        return overlayDomCache.root;
    }

    let overlay = $('#voiceforge_call_overlay');
    if (!overlay.length && createIfMissing) {
        overlay = $('<div id="voiceforge_call_overlay"></div>');
        $('body').append(overlay);
    }

    overlayDomCache.root = overlay.length ? overlay : null;
    return overlayDomCache.root || $();
}
function pauseOverlayVisualLoops() {
    if (overlaySuspendedByVisibility) {
        return;
    }

    overlaySuspendedByVisibility = true;

    const overlay = getOverlayRoot(false);
    if (overlay.length) {
        overlay.addClass('vf-overlay-no-effects');
    }

    stopHypnoWhispers();
    hypnoWhisperTickCount = 0;
    stopHypnoEasterEggs();
    stopCallBreathCueLoop(false);
    stopCallWaveformAnimation(false);
    stopOverlayCssMotion();
    stopOverlaySpiralCanvas(true);
}
function resumeOverlayVisualLoopsIfAllowed() {
    if (!overlaySuspendedByVisibility) {
        return;
    }

    if (isDocumentHidden()) {
        return;
    }

    overlaySuspendedByVisibility = false;

    const overlay = getOverlayRoot(false);
    if (overlay.length) {
        overlay.removeClass('vf-overlay-no-effects');
    }

    const settings = extension_settings[MODULE_NAME] || {};
    if (!callActive || settings.overlayEnabled !== true) {
        return;
    }

    startCallBreathCueLoop();
    startOverlayCssMotion();
    startOverlaySpiralCanvas();
    startHypnoWhispers();
    startHypnoParticles();
    startHypnoEasterEggs();

    if (shouldShowOverlayWaveform()) {
        startCallWaveformAnimation();
    }
}
function onOverlayVisibilityChange() {
    if (isDocumentHidden()) {
        pauseOverlayVisualLoops();
    } else {
        resumeOverlayVisualLoopsIfAllowed();
    }
}
function ensureOverlayVisibilityListener() {
    if (overlayVisibilityListenerAttached) {
        return;
    }
    document.addEventListener('visibilitychange', onOverlayVisibilityChange);
    overlayVisibilityListenerAttached = true;
}
function areHypnoticEffectsEnabled() {
    const settings = extension_settings[MODULE_NAME] || {};
    return settings.hypnoticEffectsEnabled === true;
}
function stopSpokenWhisperAudio() { nitralState.callbacks.stopSpeech?.(); }
async function playWhisperPhraseAudio(phrase, character) {
  if (!isSpokenWhispersEnabled() || !phrase || !callActive) return false;
  const now = Date.now();
  if(now - lastWhisperAudioAt < WHISPER_AUDIO_MIN_INTERVAL_MS) return false;
  const started = nitralState.callbacks.speak?.(phrase, character) || false;
  if(started) lastWhisperAudioAt = now;
  return started;
 }
function isHypnoFeatureEnabled(settingKey) {
    const settings = extension_settings[MODULE_NAME] || {};
    if (settingKey === 'hypnoParticlesEnabled') return settings.hypnoParticlesEnabled === true;
    return areHypnoticEffectsEnabled() && settings[settingKey] === true;
}
function getHypnoParticleCount() {
    const settings = extension_settings[MODULE_NAME] || {};
    const configured = Number(settings.hypnoParticleCount);
    if (Number.isFinite(configured)) return Math.max(0, Math.min(1000, Math.round(configured)));
    const isMobile = window.matchMedia('(max-width: 768px), (max-height: 700px)').matches;
    return isMobile ? 36 : 90;
}
function getHypnoParticleFallRate() {
    const raw = Number(extension_settings[MODULE_NAME]?.hypnoParticleFallRate);
    return Math.max(0.25, Math.min(4, Number.isFinite(raw) ? raw : 1));
}
function getHypnoParticleStyle() {
    const settings = extension_settings[MODULE_NAME] || {};
    if (settings.hypnoParticleStyle === 'rain' || settings.hypnoParticleStyle === 'firefly' || settings.hypnoParticleStyle === 'snow') {
        return settings.hypnoParticleStyle;
    }
    return 'snow';
}
function getHypnoParticleImpactRate() {
    const raw = Number(extension_settings[MODULE_NAME]?.hypnoParticleImpactRate);
    return Math.max(0, Math.min(4, Number.isFinite(raw) ? raw : 1));
}
function getHypnoFireflyGlow() {
    const raw = Number(extension_settings[MODULE_NAME]?.hypnoFireflyGlow);
    return Math.max(0.5, Math.min(4, Number.isFinite(raw) ? raw : 1));
}
function getHypnoSpiralPreset() {
    const preset = String(extension_settings[MODULE_NAME]?.hypnoSpiralPreset || 'none');
    return ['none', 'classic-vortex', 'soft-orbital', 'breathing-ring', 'deep-tunnel', 'pendulum'].includes(preset) ? preset : 'none';
}
function toPerceptualAmbientVolume(raw) {
    const clamped = Math.max(0, Math.min(1, Number(raw) || 0));
    return Math.pow(clamped, 2.4);
}
function getHypnoBreathCueVolume() {
    return 0.13;
}
function isHypnoBreathGuidanceEnabled() {
    return isHypnoFeatureEnabled('hypnoBreathGuidanceEnabled');
}
function getHypnoBreathGuidanceLeadMs() {
    const raw = Number(extension_settings[MODULE_NAME]?.hypnoBreathGuidanceLeadMs);
    return Math.max(0, Math.min(1500, Number.isFinite(raw) ? raw : 260));
}
function getHypnoBreathVisualStrength() {
    return 1.5;
}
function getHypnoBreathInDurationMs() {
    return 4000;
}
function getHypnoBreathHoldDurationMs() {
    return 6000;
}
function getHypnoBreathOutDurationMs() {
    return 8000;
}
function getHypnoBreathRestDurationMs() {
    return 1000;
}
function isSpokenWhispersEnabled() {
    return isHypnoFeatureEnabled('hypnoSpokenWhispersEnabled');
}
function shouldShowOverlayStatusText() {
    return false;
}
function shouldShowOverlayWaveform() { return false; }
function getVoiceForgeProviderSettings() {
    return extension_settings.tts?.[VOICEFORGE_PROVIDER_KEY] || null;
}
function getCharacterNameFallback() {
    const ctx = getContext();

    if (typeof ctx?.name2 === 'string' && ctx.name2.trim()) {
        return ctx.name2.trim();
    }

    if (Array.isArray(ctx?.chat)) {
        for (let i = ctx.chat.length - 1; i >= 0; i--) {
            const msg = ctx.chat[i];
            if (msg && !msg.is_user && typeof msg.name === 'string' && msg.name.trim()) {
                return msg.name.trim();
            }
        }
    }

    // Fallback: first character from context
    if (Array.isArray(ctx?.characters) && ctx.characters.length > 0) {
        const first = ctx.characters[0];
        if (typeof first?.name === 'string' && first.name.trim()) {
            return first.name.trim();
        }
    }

    return null;
}
function getTtsOutputLevel() { return nitralState.callbacks.outputLevel?.() || 0; }
function refreshWaveformBars() {
    const bars = document.querySelectorAll('#voiceforge_call_overlay .vf-call-waveform .vf-wave-bar');
    waveformBars = Array.from(bars);
    return waveformBars;
}
let waveformLastFrameAt = 0;
const WAVEFORM_FRAME_INTERVAL_MS = 1000 / 30;
function updateCallWaveformFrame(ts = performance.now()) {
    if (!callActive || isDocumentHidden()) {
        waveformAnimationFrameId = null;
        return false;
    }

    const now = Number.isFinite(ts) ? ts : performance.now();
    if (waveformLastFrameAt !== 0 && (now - waveformLastFrameAt) < WAVEFORM_FRAME_INTERVAL_MS) {
        return true;
    }
    waveformLastFrameAt = now;

    if (!waveformBars.length) {
        refreshWaveformBars();
    }

    if (!waveformBars.length) {
        const hasWaveformUi = !!document.querySelector('#voiceforge_call_overlay .vf-call-waveform');
        if (!hasWaveformUi) {
            waveformAnimationFrameId = null;
            return false;
        }
        return true;
    }

    const measuredLevel = getTtsOutputLevel();
    const hasSignal = measuredLevel !== null && measuredLevel > 0.02;
    const reactiveMode = callState === 'speaking' || hasSignal;

    if (reactiveMode) {
        const targetLevel = measuredLevel ?? 0.1;
        const attack = 0.6;
        const release = 0.25;
        const smoothing = targetLevel > waveformLevelSmoothed ? attack : release;
        waveformLevelSmoothed += (targetLevel - waveformLevelSmoothed) * smoothing;
    } else {
        waveformLevelSmoothed *= 0.85;
    }

    const overlay = overlayDomCache.root?.[0] || document.getElementById('voiceforge_call_overlay');
    if (overlay) {
        const reactiveLevel = reactiveMode ? Math.max(0, Math.min(1, waveformLevelSmoothed)) : 0;
        setCachedInlineStyle(overlay, 'vars', '--vf-overlay-reactive-level', reactiveLevel.toFixed(3));
    }

    const bars = waveformBars;
    const barCount = bars.length;
    const center = (barCount - 1) / 2;
    const t = now;

    for (let i = 0; i < barCount; i++) {
        const bar = bars[i];
        const distance = center > 0 ? Math.abs(i - center) / center : 0;
        const shape = 1 - distance * 0.35;
        const canned = (Math.sin((t / 145) + i * 0.72) + 1) * 0.16;
        const jitter = reactiveMode ? ((Math.sin((t / 120) + i * 0.8) + 1) * 0.04) : 0;
        const level = reactiveMode
            ? Math.max(0.12, Math.min(1.18, 0.13 + waveformLevelSmoothed * shape * 2.15 + jitter))
            : Math.max(0.12, Math.min(0.58, 0.16 + canned * shape));
        const opacity = Math.max(0.35, Math.min(0.95, 0.28 + level * 0.72));

        const transformValue = `scaleY(${level.toFixed(3)})`;
        const opacityValue = opacity.toFixed(3);
        if (bar.dataset.vfWaveTransform !== transformValue) {
            bar.style.transform = transformValue;
            bar.dataset.vfWaveTransform = transformValue;
        }
        if (bar.dataset.vfWaveOpacity !== opacityValue) {
            bar.style.opacity = opacityValue;
            bar.dataset.vfWaveOpacity = opacityValue;
        }
    }

    return true;
}
function startCallWaveformAnimation() {
    if (isDocumentHidden()) {
        return;
    }
    if (waveformAnimationFrameId) {
        return;
    }
    waveformLevelSmoothed = 0;
    waveformLastFrameAt = 0;
    refreshWaveformBars();
    for (const bar of waveformBars) {
        if (bar.style.animation !== 'none') {
            bar.style.animation = 'none';
        }
    }
    waveformAnimationFrameId = 1;
    ensureOverlayAnimationLoop();
}
function stopCallWaveformAnimation(enableCanned = false) {
    waveformAnimationFrameId = null;

    waveformLevelSmoothed = 0;
    waveformLastFrameAt = 0;
    waveformTimeData = null;
    refreshWaveformBars();
    for (const bar of waveformBars) {
        if (enableCanned) {
            bar.style.animation = '';
            bar.style.transform = '';
            bar.style.opacity = '';
            delete bar.dataset.vfWaveTransform;
            delete bar.dataset.vfWaveOpacity;
        } else {
            bar.style.animation = 'none';
            bar.style.transform = 'scaleY(0.12)';
            bar.style.opacity = '0.35';
            bar.dataset.vfWaveTransform = 'scaleY(0.12)';
            bar.dataset.vfWaveOpacity = '0.35';
        }
    }
    stopOverlayAnimationLoopIfIdle();
}
function applyOverlayCallUiVisibility() {
    const overlay = syncOverlayDomCache();
    if (!overlay || !overlay.length) {
        return;
    }

    const statusText = overlay.find('#vf-call-status-text').first();
    if (statusText.length) {
        statusText.css('display', shouldShowOverlayStatusText() ? '' : 'none');
    }

    const waveform = overlay.find('.vf-call-waveform').first();
    if (waveform.length) {
        const showWaveform = shouldShowOverlayWaveform();
        waveform.css('display', showWaveform ? '' : 'none');
        if (showWaveform && callActive) {
            startCallWaveformAnimation();
        } else {
            stopCallWaveformAnimation(false);
        }
    }
}
function ensureSubtitleElement() {}
function drawOverlayBreathingRing(ctx, width, height, now, reactiveLevel) {
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.sqrt(width * width + height * height) * 0.42;
    const breath = (Math.sin(now * 0.0013) + 1) * 0.5;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
        const progress = (i + breath) / 9;
        const radius = 24 + progress * maxRadius;
        const alpha = Math.max(0.018, 0.17 * (1 - progress) + reactiveLevel * 0.04);
        ctx.strokeStyle = i % 2 === 0 ? `rgba(190, 150, 255, ${alpha.toFixed(3)})` : `rgba(94, 234, 212, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 1.8 + (1 - progress) * 5;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}
function drawOverlayDeepTunnel(ctx, width, height, now, reactiveLevel) {
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.sqrt(width * width + height * height) * 0.58;
    const rotation = now * 0.00055;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 48; i++) {
        const angle = (i / 48) * Math.PI * 2;
        const wobble = Math.sin(now * 0.001 + i) * 0.12;
        const alpha = 0.026 + reactiveLevel * 0.025;
        ctx.strokeStyle = i % 3 === 0 ? `rgba(255, 177, 110, ${alpha.toFixed(3)})` : `rgba(154, 108, 255, ${alpha.toFixed(3)})`;
        ctx.lineWidth = i % 3 === 0 ? 2.2 : 1.1;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle + wobble) * 18, Math.sin(angle + wobble) * 18);
        ctx.lineTo(Math.cos(angle - wobble) * maxRadius, Math.sin(angle - wobble) * maxRadius);
        ctx.stroke();
    }
    for (let r = 0; r < 11; r++) {
        const progress = ((r / 11) + (now * 0.00012)) % 1;
        ctx.strokeStyle = `rgba(220, 190, 255, ${(0.12 * (1 - progress)).toFixed(3)})`;
        ctx.lineWidth = 1 + progress * 3;
        ctx.beginPath();
        ctx.arc(0, 0, 20 + progress * maxRadius, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}
function drawOverlayPendulum(ctx, width, height, now, reactiveLevel) {
    const centerX = width / 2;
    const centerY = height * 0.32;
    const length = Math.min(width, height) * 0.34;
    const swing = Math.sin(now * 0.00115) * 0.72;
    const bobX = centerX + Math.sin(swing) * length;
    const bobY = centerY + Math.cos(swing) * length;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(225, 205, 255, 0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();
    for (let i = 0; i < 7; i++) {
        const trailSwing = Math.sin(now * 0.00115 - i * 0.12) * 0.72;
        const tx = centerX + Math.sin(trailSwing) * length;
        const ty = centerY + Math.cos(trailSwing) * length;
        const alpha = (0.18 - i * 0.02) + reactiveLevel * 0.03;
        ctx.fillStyle = `rgba(255, 190, 125, ${Math.max(0.025, alpha).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(tx, ty, 26 - i * 2.4, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}
function addCallStyles() {
    const style = document.createElement('style');
    style.textContent = `
        #voiceforge_call_button {
            cursor: pointer;
            padding: 5px 8px;
            font-size: 1.1em;
            color: var(--accent);
            text-shadow: 0 0 8px var(--accent-glow);
            transition: transform 0.9s cubic-bezier(0.2, 0.7, 0.2, 1), opacity 0.25s ease, filter 0.7s ease;
            opacity: 0.7;
        }
        #voiceforge_call_button:hover {
            opacity: 1;
        }

        #voiceforge_microphone_button {
            color: #4ade80;
            text-shadow: 0 0 8px rgba(74, 222, 128, 0.55);
            transition: color 0.2s ease, text-shadow 0.2s ease, opacity 0.2s ease;
        }

        #voiceforge_microphone_button.muted {
            color: #ef4444;
            text-shadow: 0 0 8px rgba(239, 68, 68, 0.62);
        }

        #voiceforge_incoming_call_prompt,
        #voiceforge_outgoing_call_prompt {
            position: fixed;
            inset: 0;
            z-index: 2147483647;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            overflow: hidden;
            background:
                radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 18%),
                radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--accent-2) 18%, transparent), transparent 45%),
                linear-gradient(180deg, color-mix(in srgb, var(--bg) 72%, transparent), color-mix(in srgb, var(--bg) 92%, black));
            opacity: 0;
            pointer-events: none;
            transition: opacity 180ms ease;
            backdrop-filter: blur(10px) saturate(125%);
            -webkit-backdrop-filter: blur(10px) saturate(125%);
        }

        #voiceforge_incoming_call_prompt::before,
        #voiceforge_outgoing_call_prompt::before {
            content: '';
            position: absolute;
            inset: 0;
            background:
                repeating-linear-gradient(90deg, color-mix(in srgb, var(--accent-3) 5%, transparent) 0 1px, transparent 1px 72px),
                repeating-linear-gradient(0deg, color-mix(in srgb, var(--accent-3) 4%, transparent) 0 1px, transparent 1px 72px);
            opacity: 0.42;
            pointer-events: none;
        }

        #voiceforge_incoming_call_prompt::after,
        #voiceforge_outgoing_call_prompt::after {
            content: '';
            position: absolute;
            inset: 0;
            background:
                radial-gradient(circle at 50% 50%, transparent 0 28%, color-mix(in srgb, var(--bg) 34%, transparent) 66%, color-mix(in srgb, var(--bg) 78%, black) 100%),
                linear-gradient(120deg, color-mix(in srgb, var(--accent) 8%, transparent), transparent 38%, color-mix(in srgb, var(--accent-2) 5%, transparent) 78%, transparent);
            pointer-events: none;
        }

        #voiceforge_incoming_call_prompt.visible,
        #voiceforge_outgoing_call_prompt.visible {
            opacity: 1;
            pointer-events: auto;
        }

.vf-incoming-call-card {
            width: min(92vw, 360px);
            padding: 28px 22px 22px;
            border-radius: 26px;
            color: var(--text);
            text-align: center;
            background:
                radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 42%),
                linear-gradient(180deg, color-mix(in srgb, var(--surface) 82%, transparent), color-mix(in srgb, var(--bg) 86%, black));
            border: 1px solid var(--accent-line);
            box-shadow:
                0 28px 90px rgba(0, 0, 0, 0.62),
                inset 0 1px 0 color-mix(in srgb, var(--accent-3) 12%, transparent),
                0 0 74px var(--accent-glow);
            backdrop-filter: blur(18px) saturate(135%);
            -webkit-backdrop-filter: blur(18px) saturate(135%);
            transform: translateY(12px) scale(0.96);
            transition: transform 180ms ease;
            position: relative;
            z-index: 1;
        }

        @media (max-width: 768px) {
            #voiceforge_incoming_call_prompt,
            #voiceforge_outgoing_call_prompt {
                backdrop-filter: blur(4px) saturate(110%);
                -webkit-backdrop-filter: blur(4px) saturate(110%);
            }
            .vf-incoming-call-card {
                backdrop-filter: blur(8px) saturate(120%);
                -webkit-backdrop-filter: blur(8px) saturate(120%);
            }
        }

        #voiceforge_incoming_call_prompt.visible .vf-incoming-call-card,
        #voiceforge_outgoing_call_prompt.visible .vf-incoming-call-card {
            transform: translateY(0) scale(1);
        }

        .vf-outgoing-call-card {
            box-shadow:
                0 28px 90px rgba(0, 0, 0, 0.62),
                inset 0 1px 0 color-mix(in srgb, var(--accent-3) 12%, transparent),
                0 0 74px var(--accent-glow);
        }

        .vf-incoming-call-orb {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 92px;
            height: 92px;
            margin-bottom: 16px;
            border-radius: 50%;
            color: var(--text);
            font-size: 34px;
            background:
                radial-gradient(circle at 36% 24%, color-mix(in srgb, var(--accent-3) 52%, transparent), transparent 30%),
                radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--accent) 30%, transparent), color-mix(in srgb, var(--bg) 94%, black) 67%);
            border: 1px solid var(--accent-line-strong);
            box-shadow: 0 0 0 0 var(--accent-glow), inset 0 0 26px var(--accent-fill), 0 0 24px var(--accent-glow);
            animation: vf-incoming-call-ring 1.45s ease-out infinite;
        }

        .vf-incoming-call-orb i {
            animation: vf-incoming-call-wiggle 820ms ease-in-out infinite;
        }

        .vf-outgoing-call-orb {
            background:
                radial-gradient(circle at 36% 24%, color-mix(in srgb, var(--accent-3) 52%, transparent), transparent 30%),
                radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--accent) 30%, transparent), color-mix(in srgb, var(--bg) 94%, black) 67%);
            animation: vf-outgoing-call-ring 1.2s ease-out infinite;
        }

        .vf-incoming-call-label {
            margin-bottom: 5px;
            font-size: 0.82rem;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: var(--muted);
        }

        .vf-incoming-call-name {
            margin-bottom: 22px;
            font-size: clamp(24px, 7vw, 36px);
            line-height: 1.05;
            font-weight: 700;
            text-shadow: 0 0 22px var(--accent-glow);
            word-break: break-word;
        }

        .vf-incoming-call-actions {
            display: flex;
            gap: 12px;
            justify-content: center;
        }

        .vf-incoming-call-actions .menu_button {
            min-width: 116px;
            min-height: 44px;
            border-radius: 999px;
            font-weight: 700;
        }

        .vf-outgoing-call-status {
            margin-top: -10px;
            color: var(--muted);
            font-size: 0.95rem;
            letter-spacing: 0.04em;
            animation: vf-outgoing-call-status 1.2s ease-in-out infinite;
        }

        .vf-incoming-call-deny {
            background: var(--surface-2) !important;
            color: var(--text) !important;
            border-color: var(--accent-line) !important;
        }

        .vf-incoming-call-accept {
            background: var(--accent) !important;
            color: var(--text-inverse) !important;
            border-color: var(--accent-line-strong) !important;
        }

        .vf-incoming-call-deny:hover,
        .vf-incoming-call-accept:hover {
            filter: brightness(1.08);
        }

        .vf-incoming-call-deny:active,
        .vf-incoming-call-accept:active {
            transform: translateY(1px);
        }

        .vf-incoming-call-deny i,
        .vf-incoming-call-accept i {
            color: currentColor !important;
        }

        @keyframes vf-incoming-call-ring {
            0% { box-shadow: 0 0 0 0 var(--accent-line-strong), inset 0 0 26px var(--accent-fill), 0 0 24px var(--accent-glow); }
            70% { box-shadow: 0 0 0 26px transparent, inset 0 0 26px var(--accent-fill), 0 0 24px var(--accent-glow); }
            100% { box-shadow: 0 0 0 0 transparent, inset 0 0 26px var(--accent-fill), 0 0 24px var(--accent-glow); }
        }

        @keyframes vf-incoming-call-wiggle {
            0%, 100% { transform: rotate(0deg); }
            15% { transform: rotate(-14deg); }
            30% { transform: rotate(12deg); }
            45% { transform: rotate(-8deg); }
            60% { transform: rotate(6deg); }
            75% { transform: rotate(-2deg); }
        }

        @keyframes vf-outgoing-call-ring {
            0% { box-shadow: 0 0 0 0 var(--accent-line-strong), inset 0 0 26px var(--accent-fill), 0 0 24px var(--accent-glow); }
            72% { box-shadow: 0 0 0 30px transparent, inset 0 0 26px var(--accent-fill), 0 0 24px var(--accent-glow); }
            100% { box-shadow: 0 0 0 0 transparent, inset 0 0 26px var(--accent-fill), 0 0 24px var(--accent-glow); }
        }

        @keyframes vf-outgoing-call-status {
            0%, 100% { opacity: 0.55; }
            50% { opacity: 1; }
        }

        #qr--bar.voiceforge-call-qr-inline {
            width: auto;
            max-width: min(28vw, 240px);
            min-width: 0;
            overflow-x: auto;
            overflow-y: hidden;
            opacity: 1;
            margin: 0 2px;
            order: 0;
            flex: 0 0 auto;
            height: calc(var(--bottomFormBlockSize) - 2px);
            align-items: center;
        }

        #leftSendForm > #qr--bar.voiceforge-call-qr-inline,
        #rightSendForm > #qr--bar.voiceforge-call-qr-inline {
            width: auto;
            height: calc(var(--bottomFormBlockSize) - 2px);
            align-self: center;
            border: 0;
        }

        #qr--bar.voiceforge-call-qr-inline > .qr--buttons {
            width: auto;
            max-width: 100%;
            flex-wrap: nowrap;
            justify-content: flex-start;
            gap: 3px;
        }

        #qr--bar.voiceforge-call-qr-inline > .qr--buttons .qr--button {
            min-width: calc(var(--bottomFormBlockSize) - 10px);
            min-height: calc(var(--bottomFormBlockSize) - 10px);
            height: calc(var(--bottomFormBlockSize) - 10px);
            padding: 0 4px;
            border-radius: 7px;
            font-size: 0.82em;
            line-height: 1;
        }

        #qr--bar.voiceforge-call-qr-inline::-webkit-scrollbar {
            height: 0;
            width: 0;
        }

        #qr--bar.voiceforge-call-qr-inline > .qr--buttons .qr--button .qr--button-label {
            display: none;
        }

        #qr--bar.voiceforge-call-qr-inline > .qr--buttons .qr--button .qr--button-icon {
            margin-right: 0;
        }

        #qr--bar.voiceforge-call-qr-inline > #qr--popoutTrigger {
            display: none !important;
        }

        #extensionsMenu > #qr--bar.voiceforge-call-qr-in-wand {
            width: 100%;
            max-width: 100%;
            margin: 0;
            opacity: 1;
            padding: 2px;
            overflow: visible;
        }

        #extensionsMenu > #qr--bar.voiceforge-call-qr-in-wand > .qr--buttons {
            width: 100%;
            max-width: 100%;
            justify-content: flex-start;
            flex-wrap: wrap;
            gap: 4px;
        }

        #extensionsMenu > #qr--bar.voiceforge-call-qr-in-wand > #qr--popoutTrigger {
            display: none !important;
        }

        .vf-call-whisper {
            position: absolute;
            left: var(--vf-whisper-x, 50%);
            top: var(--vf-whisper-y, 50%);
            z-index: 100;
            pointer-events: none;
            opacity: 0;
            color: rgba(255, 220, 170, 0.4);
            font-size: clamp(12px, 1.6vw, 20px);
            font-weight: 300;
            letter-spacing: 0.4em;
            text-transform: uppercase;
            text-shadow: 0 0 10px rgba(255, 200, 140, 0.3), 0 0 20px rgba(255, 170, 100, 0.15);
            will-change: transform, opacity;
            animation: vf-whisper-hypnotic 3.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            transform: translateZ(0);
        }

        .vf-call-whisper.is-visible {
            animation: vf-whisper-hypnotic 3.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        @keyframes vf-whisper-hypnotic {
            0% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.4) rotate(0deg);
            }
            12% {
                opacity: 0.6;
                transform: translate(-50%, -50%) scale(1.1) rotate(3deg);
            }
            35% {
                opacity: 0.5;
                transform: translate(-50%, -52%) scale(1) rotate(-2deg);
            }
            65% {
                opacity: 0.3;
                transform: translate(-50%, -54%) scale(0.95) rotate(1deg);
            }
            100% {
                opacity: 0;
                transform: translate(-50%, -58%) scale(0.8) rotate(-3deg);
            }
        }

        .voiceforge-call-subtitle {
            position: fixed;
            left: 50%;
            bottom: 24px;
            transform: translateX(-50%);
            color: #ffffff;
            font-size: 20px;
            line-height: 1.4;
            text-align: center;
            z-index: 9999;
            pointer-events: none;
            text-shadow: 0 0 12px rgba(0, 0, 0, 0.9), 0 2px 6px rgba(0, 0, 0, 0.8);
            background: rgba(0, 0, 0, 0.65);
            padding: 8px 18px;
            border-radius: 999px;
            max-width: min(72vw, 640px);
            font-weight: 500;
            letter-spacing: 0.015em;
            transition: opacity 100ms ease, transform 100ms ease;
        }

        .voiceforge-call-subtitle.vf-subtitle-no-bg {
            background: transparent !important;
            border-color: transparent !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
        }

        .voiceforge-call-subtitle::before {
            content: '';
            position: absolute;
            inset: -50%;
            background: radial-gradient(ellipse at center, rgba(255, 200, 150, 0.15) 0%, transparent 60%);
            mix-blend-mode: screen;
            opacity: 0.4;
            animation: voiceforge-subtitle-soft-pulse 3s ease-in-out infinite;
            pointer-events: none;
        }

        .voiceforge-call-subtitle::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(135deg, rgba(255, 180, 120, 0.05) 0%, transparent 50%, rgba(255, 150, 80, 0.03) 100%);
            pointer-events: none;
            animation: voiceforge-subtitle-shimmer 8s ease-in-out infinite;
        }

        .voiceforge-call-subtitle.vf-subtitle-no-bg::before,
        .voiceforge-call-subtitle.vf-subtitle-no-bg::after {
            display: none;
        }

        .voiceforge-call-subtitle.in-overlay {
            position: absolute;
            left: 50%;
            right: auto;
            transform: translateX(-50%);
            bottom: max(12px, env(safe-area-inset-bottom));
            z-index: 2147483647;
        }

@media (max-width: 768px) {
            .voiceforge-call-subtitle {
                left: 12px;
                right: 12px;
                transform: none;
                width: auto;
                max-width: none;
                bottom: calc(env(safe-area-inset-bottom) + 12px);
                font-size: clamp(13px, 3.7vw, 18px);
                padding: 4px 7px;
            }
            .voiceforge-call-subtitle,
            .voiceforge-call-subtitle::before,
            .voiceforge-call-subtitle::after,
            .voiceforge-call-subtitle-text {
                animation: none !important;
            }
        }

        .voiceforge-call-subtitle-text {
            position: relative;
            display: inline;
            z-index: 1;
            letter-spacing: 0.01em;
            text-shadow:
                0 0 8px rgba(255, 255, 255, 0.3),
                0 0 16px rgba(255, 200, 150, 0.15),
                0 1px 0 rgba(0, 0, 0, 0.12);
            animation: voiceforge-subtitle-text-drift 2.8s ease-in-out infinite, voiceforge-subtitle-text-glow 4s ease-in-out infinite;
        }

        .voiceforge-call-subtitle-text.subtitle-refresh {
            animation:
                voiceforge-subtitle-text-drift 2.8s ease-in-out infinite,
                voiceforge-subtitle-text-glow 4s ease-in-out infinite,
                voiceforge-subtitle-text-pop 560ms cubic-bezier(0.2, 0.7, 0.2, 1);
        }

        @keyframes voiceforge-subtitle-breathe {
            0%, 100% {
                filter: saturate(100%) brightness(100%);
                box-shadow: 0 8px 28px rgba(0, 0, 0, 0.42), 0 0 40px rgba(255, 180, 120, 0.08);
            }
            50% {
                filter: saturate(118%) brightness(106%);
                box-shadow: 0 12px 34px rgba(0, 0, 0, 0.5), 0 0 60px rgba(255, 180, 120, 0.12);
            }
        }

        @keyframes voiceforge-subtitle-glow {
            0%, 100% {
                border-color: rgba(255, 255, 255, 0.2);
            }
            50% {
                border-color: rgba(255, 200, 150, 0.35);
            }
        }

        @keyframes voiceforge-subtitle-soft-pulse {
            0%, 100% {
                opacity: 0.3;
                transform: scale(1);
            }
            50% {
                opacity: 0.5;
                transform: scale(1.05);
            }
        }

        @keyframes voiceforge-subtitle-shimmer {
            0%, 100% {
                transform: translateX(-100%);
            }
            50% {
                transform: translateX(100%);
            }
        }

        @keyframes voiceforge-subtitle-text-drift {
            0%, 100% {
                letter-spacing: 0.01em;
                text-shadow:
                    0 0 8px rgba(255, 255, 255, 0.3),
                    0 0 16px rgba(255, 200, 150, 0.15),
                    0 1px 0 rgba(0, 0, 0, 0.12);
            }
            50% {
                letter-spacing: 0.022em;
                text-shadow:
                    0 0 14px rgba(255, 255, 255, 0.5),
                    0 0 24px rgba(255, 200, 150, 0.25),
                    0 1px 0 rgba(0, 0, 0, 0.12);
            }
        }

        @keyframes voiceforge-subtitle-text-glow {
            0%, 100% {
                filter: brightness(1);
            }
            50% {
                filter: brightness(1.08);
            }
        }

        @keyframes voiceforge-subtitle-text-pop {
            0% {
                transform: scale(0.98);
                opacity: 0.45;
                filter: blur(1px);
            }
            100% {
                transform: scale(1);
                opacity: 1;
                filter: blur(0px);
            }
        }

        @media (prefers-reduced-motion: reduce) {
            .vf-incoming-call-orb,
            .vf-incoming-call-orb i,
            .vf-outgoing-call-status,
            .voiceforge-call-subtitle,
            .voiceforge-call-subtitle::before,
            .voiceforge-call-subtitle-text,
            .voiceforge-call-subtitle-text.subtitle-refresh {
                animation: none !important;
            }
        }
        
        /* Active call - green */
        #voiceforge_call_button.active {
            color: #4ade80;
            opacity: 1;
            text-shadow: 0 0 8px #4ade80;
        }
        
        /* Listening - pulsing green */
        #voiceforge_call_button.listening {
            animation: call-listen-pulse 1s ease-in-out infinite;
        }
        
        /* Speaking - blue */
        #voiceforge_call_button.speaking {
            color: #60a5fa;
            text-shadow: 0 0 8px #60a5fa;
            animation: none;
        }
        
        @keyframes call-listen-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        #voiceforge_call_button.vf-breath-hold {
            animation: call-breath-hold 0.62s ease-in-out infinite;
        }

        @keyframes call-breath-hold {
            0%, 100% { filter: brightness(1); }
            50% { filter: brightness(1.12); }
        }
        
/* Call mode overlay */
#voiceforge_call_overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  min-width: 100vw;
  min-height: 100vh;
  pointer-events: none;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: none;
  contain: layout paint style;
  --overlay-position-x: 50%;
  --overlay-position-y: 50%;
  --overlay-scale: 1;
}

#voiceforge_call_overlay.vf-overlay-resizing,
#voiceforge_call_overlay.vf-overlay-resizing * {
  animation: none !important;
  transition: none !important;
}

#voiceforge_call_overlay.vf-overlay-interacting,
#voiceforge_call_overlay.vf-overlay-interacting * {
  animation-play-state: paused !important;
}

#voiceforge_call_overlay.vf-overlay-interacting .vf-call-backdrop {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

        /* Call mode TTS volume control */
        .voiceforge-volume-control {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        
        #voiceforge_call_volume_button {
            cursor: pointer;
            padding: 5px 8px;
            font-size: 1.1em;
            color: var(--SmartThemeBodyColor);
            transition: all 0.2s ease;
            opacity: 0.7;
        }
        
        #voiceforge_call_volume_button:hover {
            opacity: 1;
        }
        
        .voiceforge-volume-slider-wrapper {
            position: fixed;
            z-index: 99999;
            padding: 8px 4px;
            background: var(--SmartThemeBlurTintColor, rgba(0,0,0,0.8));
            border-radius: 12px;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.2s ease, visibility 0.2s ease;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            pointer-events: none;
            transform: translateX(-50%);
        }
        
        #voiceforge_call_volume_slider {
            writing-mode: bt-lr; /* IE/Edge */
            -webkit-appearance: slider-vertical; /* WebKit */
            width: 20px;
            height: 100px;
            padding: 0 5px;
            cursor: pointer;
            background: transparent;
        }
        
        #voiceforge_call_volume_slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: var(--accent);
            box-shadow: 0 0 8px var(--accent-glow);
            cursor: pointer;
            margin-top: -5px;
			transform: translateX(36%)
        }
        
        #voiceforge_call_volume_slider::-webkit-slider-runnable-track {
            width: 4px;
            height: 100%;
            background: linear-gradient(180deg, var(--accent), var(--accent-fill-strong));
            border-radius: 2px;
        }
        
        #voiceforge_call_volume_slider::-moz-range-thumb {
            width: 14px;
            height: 14px;
            border: none;
            border-radius: 50%;
            background: var(--accent);
            box-shadow: 0 0 8px var(--accent-glow);
            cursor: pointer;
        }
        
        #voiceforge_call_volume_slider::-moz-range-track {
            width: 4px;
            height: 100%;
            background: linear-gradient(180deg, var(--accent), var(--accent-fill-strong));
            border-radius: 2px;
        }

        #voiceforge_call_mic_level_track {
            position: relative;
            width: 100%;
            height: 10px;
            border-radius: 999px;
            overflow: hidden;
            border: 1px solid var(--SmartThemeBorderColor);
            background: rgba(0, 0, 0, 0.25);
        }

        #voiceforge_call_mic_level_fill {
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            width: 0%;
            transition: width 60ms linear;
            background: linear-gradient(90deg, #5ec4ff 0%, #4ba3ff 100%);
        }

        #voiceforge_call_mic_gate_marker {
            position: absolute;
            top: -1px;
            width: 2px;
            height: 12px;
            background: rgba(255, 255, 255, 0.92);
            left: 17%;
            pointer-events: none;
            box-shadow: 0 0 6px rgba(255, 255, 255, 0.35);
        }

#voiceforge_call_overlay {
    --vf-breath-scale: 1;
    --vf-trance-depth: 0;
    --vf-call-amber: 216, 180, 254;
    --vf-call-copper: 94, 234, 212;
    --vf-call-plum: 124, 58, 237;
    --vf-call-ink: 5, 4, 10;
    --vf-overlay-reactive-level: 0;
    --vf-overlay-smoke-opacity: 0;
    --vf-overlay-vignette-opacity: 0;
    --vf-overlay-aurora-opacity: 0;
    --vf-overlay-content-y: 0px;
    --vf-overlay-grid-y: 0px;
}

#voiceforge_call_overlay .vf-call-ui {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    isolation: isolate;
    contain: paint;
}

#voiceforge_call_overlay .vf-call-ui::before {
    content: '';
    position: absolute;
    inset: -35%;
    z-index: 2;
    pointer-events: none;
    background:
        radial-gradient(ellipse at 23% 20%, rgba(var(--vf-call-amber), 0.07) 0%, rgba(var(--vf-call-copper), 0.018) 48%, transparent 74%),
        radial-gradient(ellipse at 78% 66%, rgba(var(--vf-call-plum), 0.078) 0%, rgba(var(--vf-call-copper), 0.014) 45%, transparent 70%),
        radial-gradient(ellipse at 50% 86%, rgba(var(--vf-call-amber), 0.035) 0%, rgba(var(--vf-call-copper), 0.01) 40%, transparent 65%);
    filter: blur(58px);
    mix-blend-mode: screen;
    transform-origin: 50% 50%;
    transform: translate3d(var(--vf-overlay-smoke-x, 0%), var(--vf-overlay-smoke-y, 0%), 0) scale(var(--vf-overlay-smoke-scale, 1));
    opacity: var(--vf-overlay-smoke-opacity, 0.35);
    will-change: transform, opacity;
}

#voiceforge_call_overlay .vf-call-ui::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    background:
        radial-gradient(circle at 50% 50%, rgba(216, 180, 254, 0.12) 0%, rgba(94, 234, 212, 0.045) 35%, transparent 60%);
    mix-blend-mode: screen;
    opacity: var(--vf-overlay-screen-flash-opacity, 0);
}

.vf-call-backdrop-shell {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    contain: paint;
}

.vf-call-backdrop {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    background:
        radial-gradient(circle at 50% 42%, rgba(var(--vf-call-amber), 0.035), transparent 34%),
        linear-gradient(135deg, rgba(14, 9, 22, 0.86), rgba(4, 4, 9, 0.82) 54%, rgba(12, 6, 13, 0.86));
    backdrop-filter: blur(14px) saturate(82%);
    -webkit-backdrop-filter: blur(14px) saturate(82%);
    overflow: hidden;
    isolation: isolate;
    will-change: transform, opacity;
    contain: paint;
}

.vf-call-effects-layer {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    contain: paint;
}

.vf-call-effects-layer::before {
    content: '';
    position: absolute;
    inset: -24%;
    z-index: 1;
    pointer-events: none;
    background:
        conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(var(--vf-call-amber), 0.045) 42deg, transparent 86deg, rgba(var(--vf-call-plum), 0.052) 168deg, transparent 226deg, rgba(var(--vf-call-copper), 0.035) 292deg, transparent 360deg);
    filter: blur(22px);
    mix-blend-mode: screen;
    opacity: var(--vf-overlay-aurora-opacity, 0.24);
    transform: rotate(var(--vf-overlay-aurora-rot, 0deg)) scale(1.04);
    transform-origin: 50% 50%;
    will-change: transform, opacity;
}

.vf-call-particle-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
    opacity: 0.72;
    transform: translateZ(0);
}

.vf-call-spiral-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2;
    opacity: 0.46;
    mix-blend-mode: screen;
    transform: translateZ(0);
}

.vf-call-vignette {
    position: absolute;
    inset: -10%;
    z-index: 2;
    pointer-events: none;
    background:
        radial-gradient(circle at 50% 47%, transparent 24%, rgba(var(--vf-call-amber), 0.028) 50%, transparent 75%),
        radial-gradient(circle at 50% 50%, transparent 42%, rgba(0, 0, 0, 0.28) 100%),
        repeating-linear-gradient(0deg, transparent 0px, transparent 5px, rgba(var(--vf-call-amber), 0.006) 5px, rgba(var(--vf-call-amber), 0.006) 6px, transparent 6px, transparent 12px);
    opacity: var(--vf-overlay-vignette-opacity, 0.45);
    transform-origin: 50% 50%;
}

.vf-call-backdrop-layer {
    position: absolute;
    inset: -18%;
    pointer-events: none;
    z-index: 1;
    transform: translateZ(0);
}

.vf-call-backdrop-layer.hypno-grid {
    background-image:
        linear-gradient(rgba(var(--vf-call-amber), 0.008) 1px, transparent 1px),
        linear-gradient(90deg, rgba(var(--vf-call-amber), 0.008) 1px, transparent 1px);
    background-size: 72px 72px;
    background-position: 0 var(--vf-overlay-grid-y, 0px);
    opacity: 0;
}

#voiceforge_call_overlay.vf-hypnotic-effects-active .vf-call-backdrop-layer.hypno-grid {
    opacity: 0.28;
}

.vf-call-content {
    position: absolute;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 28px 32px 24px;
    text-align: center;
    left: var(--overlay-position-x, 50%);
    top: var(--overlay-position-y, 50%);
    transform: translate(-50%, calc(-50% + var(--vf-overlay-content-y, 0px))) scale(var(--overlay-scale, 1));
    transform-origin: center center;
    will-change: transform, opacity;
    contain: layout;
    overflow: visible;
}
    `;
    document.head.appendChild(style);
}
function getOverlayDisplaySettings() {
    const settings = extension_settings[MODULE_NAME] || {};
    const rawTransparency = Number(settings.overlayTransparency);
    const transparency = Math.max(0, Math.min(1, Number.isFinite(rawTransparency) ? rawTransparency : 0.5));
    const rawZIndex = parseInt(settings.overlayZIndex, 10);
    const zIndex = Math.max(0, Math.min(2147483646, Number.isFinite(rawZIndex) ? rawZIndex : 9998));
    const rawScale = Number(settings.overlayScale);
    const scale = Math.max(0.1, Math.min(5, Number.isFinite(rawScale) ? rawScale : 1.0));
    const rawPositionX = Number(settings.overlayPositionX);
    const positionX = Math.max(0, Math.min(100, Number.isFinite(rawPositionX) ? rawPositionX : 50));
    const rawPositionY = Number(settings.overlayPositionY);
    const positionY = Math.max(0, Math.min(100, Number.isFinite(rawPositionY) ? rawPositionY : 50));

    return {
        transparency,
        zIndex,
        scale,
        positionX,
        positionY,
    };
}
function getAdaptiveOverlayScale(scale) {
    const width = Math.max(1, window.innerWidth || 1);
    const height = Math.max(1, window.innerHeight || 1);
    const widthFit = Math.min(1, width / 420);
    const heightFit = Math.min(1, height / 420);
    const fit = Math.max(0.45, Math.min(widthFit, heightFit));
    return Math.max(0.1, Math.min(5, scale * fit));
}
function syncOverlayDomCache() {
    const overlay = getOverlayRoot(false);
    if (!overlay.length) {
        clearOverlayDomCache();
        return null;
    }

    if (!overlayDomCache.callUi || !overlayDomCache.callUi.length || !overlay[0].contains(overlayDomCache.callUi[0])) {
        overlayDomCache.callUi = overlay.find('.vf-call-ui').first();
    }
    if (!overlayDomCache.content || !overlayDomCache.content.length || !overlay[0].contains(overlayDomCache.content[0])) {
        overlayDomCache.content = overlay.find('.vf-call-content').first();
    }
    if (!overlayDomCache.backdrop || !overlayDomCache.backdrop.length || !overlay[0].contains(overlayDomCache.backdrop[0])) {
        overlayDomCache.backdrop = overlay.find('.vf-call-backdrop').first();
    }
    if (!overlayDomCache.effectsLayer || !overlayDomCache.effectsLayer.length || !overlay[0].contains(overlayDomCache.effectsLayer[0])) {
        overlayDomCache.effectsLayer = overlay.find('.vf-call-effects-layer').first();
    }
    if (!overlayDomCache.particleCanvas || !overlayDomCache.particleCanvas.length || !overlay[0].contains(overlayDomCache.particleCanvas[0])) {
        overlayDomCache.particleCanvas = overlay.find('.vf-call-particle-canvas').first();
    }
    if (!overlayDomCache.statusText || !overlayDomCache.statusText.length || !overlay[0].contains(overlayDomCache.statusText[0])) {
        overlayDomCache.statusText = overlay.find('#vf-call-status-text').first();
    }

    return overlay;
}
function updateCallOverlayStatus() {}
function hideCallOverlay() {
    if (overlayResizeFrameId !== null) {
        cancelAnimationFrame(overlayResizeFrameId);
        overlayResizeFrameId = null;
    }
    if (overlayResizeSettleTimer) {
        clearTimeout(overlayResizeSettleTimer);
        overlayResizeSettleTimer = null;
    }
    if (overlayUiInteractionTimer) {
        clearTimeout(overlayUiInteractionTimer);
        overlayUiInteractionTimer = null;
    }
    overlaySuspendedByUiInteraction = false;
    if (overlayVisualRefreshFrameId !== null) {
        cancelAnimationFrame(overlayVisualRefreshFrameId);
        overlayVisualRefreshFrameId = null;
    }
    stopCallWaveformAnimation(false);
    stopOverlayCssMotion();
    removeOverlaySpiralCanvas();
    stopCallBreathCueLoop(true);
    stopCallParticleAmbientLoop(true);
    stopHypnoWhispers();
    stopHypnoEasterEggs();
    stopSpokenWhisperAudio(true);
    overlaySuspendedByVisibility = false;
    const overlay = getOverlayRoot(false);
    if (overlay.length) {
        overlay.removeClass('vf-overlay-resizing vf-overlay-interacting vf-overlay-no-effects vf-hypnotic-effects-active').hide();
    }
    clearOverlayDomCache();
}
function clearOverlayDomCache() {
    overlayDomCache.root = null;
    overlayDomCache.callUi = null;
    overlayDomCache.content = null;
    overlayDomCache.backdrop = null;
    overlayDomCache.effectsLayer = null;
    overlayDomCache.particleCanvas = null;
    overlayDomCache.statusText = null;
    resetOverlayInlineStyleCache();
    overlayCanvasParticles.canvas = null;
    overlayCanvasParticles.ctx = null;
    overlaySpiralCanvas.canvas = null;
    overlaySpiralCanvas.ctx = null;
    const overlay = document.getElementById('voiceforge_call_overlay');
    if (overlay?._vfCallRings) {
        delete overlay._vfCallRings;
    }
}
function showCallOverlay() {
    if (!callActive || !extension_settings[MODULE_NAME]?.overlayEnabled || nitralState.suppressOverlay) {
        return;
    }

    const overlay = getOverlayRoot(true);
    if (!overlay.length) {
        return;
    }

    const cfg = getOverlayDisplaySettings();
    const transparency = cfg.transparency;
    const zIndex = cfg.zIndex;
    const positionX = cfg.positionX;
    const positionY = cfg.positionY;
    const effectiveScale = getAdaptiveOverlayScale(cfg.scale);
    const spiralEnabled = isHypnoFeatureEnabled('hypnoSpiralEnabled');
    const hypnoticEffectsEnabled = areHypnoticEffectsEnabled();

    overlay.toggleClass('vf-hypnotic-effects-active', hypnoticEffectsEnabled);
    overlay.toggleClass('vf-hypno-spiral-disabled', !spiralEnabled);
    overlay.attr('data-breath-phase', overlay.attr('data-breath-phase') || 'idle');
    if (!overlay[0].style.getPropertyValue('--vf-breath-scale')) {
        setCachedInlineStyle(overlay[0], 'vars', '--vf-breath-scale', '1');
    }

    setCachedInlineStyle(overlay[0], 'vars', '--overlay-position-x', positionX + '%');
    setCachedInlineStyle(overlay[0], 'vars', '--overlay-position-y', positionY + '%');
    setCachedInlineStyle(overlay[0], 'vars', '--overlay-scale', String(effectiveScale));

    overlay.find('.voiceforge-call-gif').remove();

    setCachedInlineStyle(overlay[0], 'root', 'background-image', 'none');
    setCachedInlineStyle(overlay[0], 'root', 'background-color', 'transparent');
    setCachedInlineStyle(overlay[0], 'root', 'opacity', '1');
    setCachedInlineStyle(overlay[0], 'root', 'z-index', String(zIndex));
    setCachedInlineStyle(overlay[0], 'root', 'display', 'block');
    setCachedInlineStyle(overlay[0], 'root', 'visibility', 'visible');

    // Create default call UI if it doesn't exist
    let callUI = overlayDomCache.callUi && overlayDomCache.callUi.length ? overlayDomCache.callUi : overlay.find('.vf-call-ui');
    if (callUI.length && (!callUI.find('.vf-call-backdrop-shell').length || !callUI.find('.vf-call-effects-layer').length || !callUI.find('.vf-call-particle-canvas').length)) {
        callUI.remove();
        callUI = $();
        overlayDomCache.callUi = null;
    }
    if (!callUI.length) {
        callUI = $(`
                <div class="vf-call-ui">
                    <div class="vf-call-backdrop-shell">
                        <div class="vf-call-backdrop"></div>
                    </div>
                    <div class="vf-call-effects-layer">
                        <canvas class="vf-call-particle-canvas"></canvas>
                        <div class="vf-call-backdrop-layer hypno-grid"></div>
                        <div class="vf-call-vignette"></div>
                    </div>
                    <div class="vf-call-content">
                        <div class="vf-call-avatar">
                            <div class="vf-call-avatar-circle">
                                <i class="fa-solid fa-phone"></i>
                            </div>
                            <div class="vf-call-rings">
                                <div class="vf-ring vf-ring-1"></div>
                                <div class="vf-ring vf-ring-2"></div>
                                <div class="vf-ring vf-ring-3"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `);
        overlay.append(callUI);
    }
    const effectsLayer = callUI.find('.vf-call-effects-layer').first();
    overlayDomCache.callUi = callUI;
    syncOverlayDomCache();

    overlayDomCache.content = overlayDomCache.content && overlayDomCache.content.length ? overlayDomCache.content : overlay.find('.vf-call-content').first();

    // Apply transparency to backdrop
    const backdrop = overlayDomCache.backdrop && overlayDomCache.backdrop.length ? overlayDomCache.backdrop : overlay.find('.vf-call-backdrop');
    if (backdrop.length) {
        setCachedInlineStyle(backdrop[0], 'backdrop', 'opacity', String(transparency));
    }
    overlayDomCache.backdrop = backdrop;

    if (overlayDomCache.particleCanvas?.length) {
        ensureOverlayParticleCanvas();
        resizeOverlayParticleCanvas(true);
    }
    ensureOverlaySpiralCanvas();
    resizeOverlaySpiralCanvas(true);

    // Update call status based on current state
    updateCallOverlayStatus();
    applyOverlayCallUiVisibility();
    startCallBreathCueLoop();
    startOverlayCssMotion();
    startOverlaySpiralCanvas();

    // Ensure subtitles are rendered in the overlay layer while call overlay is active.
    ensureSubtitleElement();

    if (isDocumentHidden()) {
        overlaySuspendedByUiInteraction = false;
        pauseOverlayVisualLoops();
    } else {
        overlaySuspendedByVisibility = false;
        overlaySuspendedByUiInteraction = false;
        overlay.removeClass('vf-overlay-no-effects');
        startHypnoWhispers();
        startHypnoParticles();
        startHypnoEasterEggs();
    }
}

let presentationStylesReady = false;
export function startPresentation(settings, host, callbacks = {}) {
 if (!presentationStylesReady) { addCallStyles(); presentationStylesReady = true; }
 Object.assign(nitralState.callbacks, callbacks);
 Object.assign(extension_settings.callmode, mapCallModeSettings(settings));
 callActive = true;
 const root = getOverlayRoot(true)[0]; host.appendChild(root);
 root.style.position='absolute'; root.style.inset='0'; root.style.width='100%'; root.style.height='100%'; root.style.pointerEvents='none';
 showCallOverlay(); ensureOverlayVisibilityListener();
}
export function stopPresentation() { callActive = false; stopOverlayParticleCanvas(true); hideCallOverlay(); document.getElementById('voiceforge_call_overlay')?.remove(); }

const resolveAsset = value => nitralState.callbacks.resolveAssetUrl?.(value) || value;
const fetch = (value, init) => globalThis.fetch(resolveAsset(value), init);
class Audio extends globalThis.Audio { constructor(value) { super(...(value ? [resolveAsset(value)] : [])); } set src(value) { super.src = resolveAsset(value); } get src() { return super.src; } }
