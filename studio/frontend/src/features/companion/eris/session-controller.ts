// Pure session controller adapted from ErisHub App.tsx and actionBus.ts.
export type HypnoTrackerDecision = {
  stage?: string;
  progress?: number;
  readiness?: string;
  userSignal?: string;
  decision?: string;
  awaitingFeedback?: boolean;
  feedback?: string;
  nextInstruction?: string;
  technique?: string;
  stageGoal?: string;
  checkInPrompt?: string;
  checkIn?: string;
  candidateBranches?: HypnoBranch[];
  selectedBranchId?: string;
  branchReason?: string;
  directorNote?: string;
  effects?: { spiralPreset?: string; particleStyle?: string; whispers?: string[] };
};
export type HypnoBranch = {
  id?: string;
  label?: string;
  stage?: string;
  technique?: string;
  goal?: string;
  reason?: string;
  readinessNeeded?: string;
  intensity?: string;
  effectsPlan?: string;
  effects?: HypnoBranchEffects;
  comfortScore?: number;
  goalFitScore?: number;
  readinessScore?: number;
  noveltyScore?: number;
  intensityScore?: number;
  totalScore?: number;
  visits?: number;
  valueEstimate?: number;
  confidence?: number;
  rolloutSummary?: string;
};
export type HypnoBranchEffects = { spiralPreset?: string; particleStyle?: string; particleCount?: number; whispers?: string[] };
export const HYPNO_SESSION_STAGES = ["induction", "deepener", "body", "reinforcement", "ending"];
export const HYPNO_SPIRAL_PRESETS = new Set(["none", "classic-vortex", "soft-orbital", "breathing-ring", "deep-tunnel", "pendulum"]);
export const HYPNO_PARTICLE_STYLES = new Set(["snow", "rain", "firefly"]);
export const HYPNO_BLOCK_ADVANCE_SIGNALS = new Set(["not-ready", "confused", "overwhelmed", "pause", "stop", "end"]);
export const HYPNO_PAUSE_DECISIONS = new Set(["pause_session"]);
export const HYPNO_END_DECISIONS = new Set(["end_session"]);
export function hypnoStageIndex(value: unknown) {
  return HYPNO_SESSION_STAGES.indexOf(String(value || "").toLowerCase());
}
export function sanitizeHypnoTrackerText(value: unknown, maxLength = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
export function parseJsonArraySetting(value: unknown) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
export function hypnoScore(value: unknown, fallback = 50) {
  const raw = Number(value);
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(raw) ? raw : fallback)));
}
export function sanitizeHypnoBranchEffects(value: unknown): Required<HypnoBranchEffects> {
  const effects = value && typeof value === "object" ? value as HypnoBranchEffects : {};
  const spiralPreset = sanitizeHypnoTrackerText(effects.spiralPreset || "none", 40);
  const particleStyle = sanitizeHypnoTrackerText(effects.particleStyle || "snow", 40);
  const whispers = Array.isArray(effects.whispers) ? effects.whispers.map((item) => sanitizeHypnoTrackerText(item, 60)).filter(Boolean).slice(0, 6) : [];
  return {
    spiralPreset: HYPNO_SPIRAL_PRESETS.has(spiralPreset) ? spiralPreset : "none",
    particleStyle: HYPNO_PARTICLE_STYLES.has(particleStyle) ? particleStyle : "snow",
    particleCount: Math.max(0, Math.min(1000, Math.round(Number(effects.particleCount) || 250))),
    whispers
  };
}
export function sanitizeHypnoBranches(value: unknown): Required<HypnoBranch>[] {
  const items = Array.isArray(value) ? value : [];
  return items.slice(0, 5).map((item, index) => {
    const branch = item && typeof item === "object" ? item as HypnoBranch : {};
    const fallbackId = `branch-${index + 1}`;
    const comfortScore = hypnoScore(branch.comfortScore);
    const goalFitScore = hypnoScore(branch.goalFitScore);
    const readinessScore = hypnoScore(branch.readinessScore);
    const noveltyScore = hypnoScore(branch.noveltyScore, 35);
    const intensityScore = hypnoScore(branch.intensityScore, 40);
    const computedTotal = Math.round((comfortScore * 0.3) + (goalFitScore * 0.25) + (readinessScore * 0.25) + (noveltyScore * 0.1) + ((100 - intensityScore) * 0.1));
    return {
      id: sanitizeHypnoTrackerText(branch.id || fallbackId, 80) || fallbackId,
      label: sanitizeHypnoTrackerText(branch.label || branch.technique || fallbackId, 80),
      stage: sanitizeHypnoTrackerText(branch.stage || "", 60),
      technique: sanitizeHypnoTrackerText(branch.technique || "", 120),
      goal: sanitizeHypnoTrackerText(branch.goal || "", 220),
      reason: sanitizeHypnoTrackerText(branch.reason || "", 260),
      readinessNeeded: sanitizeHypnoTrackerText(branch.readinessNeeded || "", 120),
      intensity: sanitizeHypnoTrackerText(branch.intensity || "", 60),
      effectsPlan: sanitizeHypnoTrackerText(branch.effectsPlan || "", 180),
      effects: sanitizeHypnoBranchEffects(branch.effects),
      comfortScore,
      goalFitScore,
      readinessScore,
      noveltyScore,
      intensityScore,
      totalScore: hypnoScore(branch.totalScore, computedTotal),
      visits: Math.max(0, Math.min(99, Math.round(Number(branch.visits) || 1))),
      valueEstimate: hypnoScore(branch.valueEstimate, computedTotal),
      confidence: hypnoScore(branch.confidence, Math.round((comfortScore + readinessScore) / 2)),
      rolloutSummary: sanitizeHypnoTrackerText(branch.rolloutSummary || "", 220)
    };
  }).filter((branch) => branch.label || branch.technique || branch.goal);
}
export function appendHypnoPathNode(settings: Record<string, unknown>, patch: Record<string, unknown>) {
  const path = parseJsonArraySetting(settings.sessionPathJson).slice(-11);
  const node = {
    stage: patch.sessionStage,
    progress: patch.sessionStageProgress,
    technique: patch.sessionTechnique,
    goal: patch.sessionStageGoal,
    branchId: patch.sessionSelectedBranchId,
    reason: patch.sessionBranchReason,
    score: patch.sessionSelectedBranchScore,
    effects: patch.sessionSelectedBranchEffectsJson,
    readiness: patch.sessionReadiness,
    at: Date.now()
  };
  return JSON.stringify([...path, node]);
}
export function extractJsonObject(text: string) {
  const raw = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    throw new Error("Tracker did not return valid JSON.");
  }
}
export function validateHypnoTrackerDecision(settings: Record<string, unknown>, decision: HypnoTrackerDecision) {
  const currentStage = String(settings.sessionStage || "induction").toLowerCase();
  const currentStageIndex = Math.max(0, hypnoStageIndex(currentStage));
  const requestedStage = String(decision.stage || currentStage).toLowerCase();
  const requestedStageIndex = hypnoStageIndex(requestedStage);
  const userSignal = sanitizeHypnoTrackerText(decision.userSignal || "unknown", 64).toLowerCase();
  const modelDecision = sanitizeHypnoTrackerText(decision.decision || "continue_current_stage", 80).toLowerCase();
  const blocksAdvance = HYPNO_BLOCK_ADVANCE_SIGNALS.has(userSignal) || ["not-ready", "overwhelmed", "confused", "paused"].includes(String(decision.readiness || "").toLowerCase());
  let stage = currentStageIndex >= 0 ? HYPNO_SESSION_STAGES[currentStageIndex] : "induction";
  if (!blocksAdvance && requestedStageIndex >= 0) {
    stage = HYPNO_SESSION_STAGES[Math.min(currentStageIndex + 1, Math.max(currentStageIndex, requestedStageIndex))];
  }
  const stageChanged = stage !== currentStage;
  const rawProgress = Number(decision.progress);
  const currentProgress = Number(settings.sessionStageProgress) || 0;
  const progress = Math.round(Math.max(0, Math.min(100, Number.isFinite(rawProgress) ? rawProgress : currentProgress)));
  const branches = sanitizeHypnoBranches(decision.candidateBranches);
  const selectedBranchId = sanitizeHypnoTrackerText(decision.selectedBranchId || branches[0]?.id || "", 80);
  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) || branches[0];
  const settingsPatch: Record<string, unknown> = {
    sessionStage: stage,
    sessionStageProgress: stageChanged ? Math.min(progress, 15) : progress,
    sessionReadiness: sanitizeHypnoTrackerText(decision.readiness || "unknown", 80),
    sessionFeedback: sanitizeHypnoTrackerText(decision.feedback || "tracker reviewed latest user response", 600),
    sessionUserSignal: userSignal,
    sessionModelDecision: modelDecision,
    sessionNextInstruction: sanitizeHypnoTrackerText(decision.nextInstruction || "Continue the current guided relaxation stage gently and do not skip ahead.", 900),
    sessionTechnique: sanitizeHypnoTrackerText(decision.technique || selectedBranch?.technique || settings.sessionTechnique || "", 160),
    sessionStageGoal: sanitizeHypnoTrackerText(decision.stageGoal || selectedBranch?.goal || settings.sessionStageGoal || "", 300),
    sessionCheckInPrompt: sanitizeHypnoTrackerText(decision.checkInPrompt || settings.sessionCheckInPrompt || decision.checkIn || "", 300),
    sessionCandidateBranchesJson: JSON.stringify(branches),
    sessionSelectedBranchId: selectedBranchId,
    sessionSelectedBranchScore: selectedBranch ? selectedBranch.totalScore : 0,
    sessionSelectedBranchEffectsJson: JSON.stringify(selectedBranch?.effects || sanitizeHypnoBranchEffects({})),
    sessionBranchReason: sanitizeHypnoTrackerText(decision.branchReason || selectedBranch?.reason || "", 400),
    sessionDirectorNote: sanitizeHypnoTrackerText(decision.directorNote || "", 500),
    sessionAwaitingFeedback: decision.awaitingFeedback === true || String(decision.checkIn || "").toLowerCase() === "required",
    sessionTurnCount: Math.max(0, Math.floor(Number(settings.sessionTurnCount) || 0)) + 1,
    sessionStageTurnCount: stageChanged ? 0 : Math.max(0, Math.floor(Number(settings.sessionStageTurnCount) || 0)) + 1
  };
  if (selectedBranch?.effects) {
    const effects = sanitizeHypnoBranchEffects(selectedBranch.effects);
    settingsPatch.spiralPreset = effects.spiralPreset;
    settingsPatch.spiralEnabled = effects.spiralPreset !== "none";
    settingsPatch.particlesEnabled = effects.particleCount > 0;
    settingsPatch.particleStyle = effects.particleStyle;
    settingsPatch.particleCount = effects.particleCount;
    if (effects.whispers.length > 0) {
      settingsPatch.visualWhispersEnabled = true;
      settingsPatch.visualWhispers = effects.whispers.join("\n");
    }
  }
  settingsPatch.sessionPathJson = appendHypnoPathNode(settings, settingsPatch);
  if (HYPNO_PAUSE_DECISIONS.has(modelDecision) || userSignal === "pause" || userSignal === "stop") settingsPatch.sessionPaused = true;
  if (HYPNO_END_DECISIONS.has(modelDecision) || userSignal === "end") {
    settingsPatch.sessionActive = false;
    settingsPatch.sessionPaused = false;
  }
  return settingsPatch;
}
export function initialHypnoSessionTree(style: string, ending: string, contract: string) {
  const baseGoal = contract || [style, ending].filter(Boolean).join("; ") || "establish a safe, slow guided relaxation induction";
  const styleHint = style || "guided";
  const branches = [
    {
      id: "breath-anchor-opening",
      label: "Breath anchor opening",
      stage: "induction",
      technique: "breath pacing",
      goal: `open the ${styleHint} session by matching attention to an easy breath rhythm`,
      reason: "Initial rollout prior: a breath anchor gives the guide the clearest first read on pacing, comfort, and readiness.",
      readinessNeeded: "unclear or settling",
      intensity: "low",
      effectsPlan: "breath-synced visuals with minimal pull",
      effects: { spiralPreset: "breathing-ring", particleStyle: "snow", particleCount: 160, whispers: ["breathe", "softly settle"] },
      comfortScore: 92,
      goalFitScore: 82,
      readinessScore: 76,
      noveltyScore: 35,
      intensityScore: 18,
      totalScore: 86,
      visits: 4,
      valueEstimate: 86,
      confidence: 78,
      rolloutSummary: "Most imagined first replies become calmer or give usable pacing feedback without forcing a deeper move."
    },
    {
      id: "body-tension-map",
      label: "Body tension map",
      stage: "induction",
      technique: "progressive relaxation",
      goal: "sample where the body is holding tension and release it region by region",
      reason: "Initial rollout prior: body-based induction can reveal whether the session should evolve toward somatic imagery or remain breath-led.",
      readinessNeeded: "settling",
      intensity: "low",
      effectsPlan: "soft orbital motion and light particles to support body scanning",
      effects: { spiralPreset: "soft-orbital", particleStyle: "snow", particleCount: 140, whispers: ["soften", "release"] },
      comfortScore: 88,
      goalFitScore: 78,
      readinessScore: 68,
      noveltyScore: 42,
      intensityScore: 20,
      totalScore: 80,
      visits: 3,
      valueEstimate: 80,
      confidence: 70,
      rolloutSummary: "Rollouts work best when the user's first feedback mentions heaviness, warmth, tightness, or comfort in the body."
    },
    {
      id: "safe-place-orientation",
      label: "Safe-place orientation",
      stage: "induction",
      technique: "safe-place imagery",
      goal: "build a stable imagined place before asking for stronger absorption",
      reason: "Initial rollout prior: if the contract emphasizes comfort, sleep, uncertainty, or emotional safety, imagery may outperform pure breath pacing.",
      readinessNeeded: "unclear",
      intensity: "low",
      effectsPlan: "dim effects and use sparse fireflies for spaciousness",
      effects: { spiralPreset: "none", particleStyle: "firefly", particleCount: 80, whispers: ["safe", "easy"] },
      comfortScore: 96,
      goalFitScore: 72,
      readinessScore: 82,
      noveltyScore: 36,
      intensityScore: 8,
      totalScore: 84,
      visits: 3,
      valueEstimate: 84,
      confidence: 74,
      rolloutSummary: "Simulated continuations preserve agency well and tend to produce clearer preference feedback before intensifying."
    },
    {
      id: "contract-clarity-branch",
      label: "Contract clarity branch",
      stage: "induction",
      technique: "responsive pacing",
      goal: "ask one compact missing-detail question before committing the induction route",
      reason: "Initial rollout prior: when the contract is thin, one precise question can beat guessing the first experiential direction.",
      readinessNeeded: "not-ready or unclear",
      intensity: "low",
      effectsPlan: "minimal effects while the guide resolves the next branch",
      effects: { spiralPreset: "none", particleStyle: "snow", particleCount: 0, whispers: [] },
      comfortScore: 90,
      goalFitScore: 58,
      readinessScore: 92,
      noveltyScore: 20,
      intensityScore: 0,
      totalScore: 76,
      visits: 2,
      valueEstimate: 76,
      confidence: 68,
      rolloutSummary: "Low visit count because it is valuable only when missing details would otherwise make the first branch brittle."
    }
  ];
  const selected = branches[0];
  return {
    branches,
    selected,
    path: [{ stage: "induction", progress: 10, technique: selected.technique, goal: baseGoal, branchId: selected.id, reason: selected.reason, score: selected.totalScore, effects: selected.effects, readiness: "settling", at: Date.now() }]
  };
}
