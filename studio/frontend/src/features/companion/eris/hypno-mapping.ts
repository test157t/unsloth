// Adapted from ErisHub App.tsx.
export function callModeHypnoSettings(hypnoEnabled: boolean, settings: Record<string, unknown>) {
  const active = hypnoEnabled && settings.sessionActive === true && settings.overlayEnabled !== false;
  const particlesActive = hypnoEnabled && settings.overlayEnabled !== false && settings.particlesEnabled !== false;
  return {
    callModeHypnoticEffectsEnabled: active && settings.effectsEnabled !== false,
    callModeParticlesEnabled: particlesActive,
    callModeParticleStyle: settings.particleStyle,
    callModeParticleCount: settings.particleCount,
    callModeParticleFallRate: settings.particleFallRate,
    callModeParticleImpactRate: settings.particleImpactRate,
    callModeFireflyGlow: settings.fireflyGlow,
    callModeHypnoWhispersEnabled: active && settings.visualWhispersEnabled !== false,
    callModeHypnoSpiralEnabled: active && settings.spiralEnabled !== false && settings.spiralPreset !== "none",
    callModeHypnoSpiralPreset: settings.spiralPreset,
    callModeHypnoSnapSfxEnabled: active && settings.snapSfxEnabled !== false,
    callModeHypnoAmbientEnabled: active && settings.ambientEnabled !== false,
    callModeHypnoBreathCuesEnabled: active && settings.breathCuesEnabled !== false,
    callModeHypnoSpokenWhispersEnabled: active && settings.spokenWhispersEnabled === true,
    callModeHypnoBreathGuidanceEnabled: active && settings.breathGuidanceEnabled !== false,
    callModeHypnoBreathGuidanceLeadMs: settings.breathGuidanceLeadMs,
    callModeHypnoWhispers: settings.visualWhispers
  };
}