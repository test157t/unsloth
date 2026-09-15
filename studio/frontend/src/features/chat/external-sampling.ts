import type { ProviderCapabilities } from "./provider-capabilities";
import type { InferenceParams } from "./types/runtime";

/** External requests omit controls shown as Off; temperature zero is still greedy sampling. */
export function externalSamplingParams(
  params: InferenceParams,
  capabilities: ProviderCapabilities | null | undefined,
) {
  return {
    ...(capabilities?.temperature !== false ? { temperature: params.temperature } : {}),
    ...(capabilities?.topP !== false && params.topP !== 1 ? { top_p: params.topP } : {}),
    ...(capabilities?.topK && params.topK !== 0 ? { top_k: params.topK } : {}),
    ...(capabilities?.minP && params.minP !== 0 ? { min_p: params.minP } : {}),
    ...(capabilities?.repetitionPenalty && params.repetitionPenalty !== 1
      ? { repetition_penalty: params.repetitionPenalty } : {}),
    ...(capabilities?.presencePenalty && params.presencePenalty !== 0
      ? { presence_penalty: params.presencePenalty } : {}),
  };
}
