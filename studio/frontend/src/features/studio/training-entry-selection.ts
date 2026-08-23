// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

export function selectedTrainingEntryStep(
  hoveredStep: number | null,
  pinnedStep: number | null,
  currentStep: number,
): number {
  return hoveredStep ?? pinnedStep ?? currentStep;
}
