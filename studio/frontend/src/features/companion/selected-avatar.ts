import type { PromptProfile } from "./eris/types";

export const studioAvatarProfiles: PromptProfile[] = [
  { id: "studio", name: "Studio assistant", assistantName: "Mia", blocks: [] },
];

export function selectedAvatarProfile<T extends { id: string }>(
  settings: Record<string, unknown>, profiles: T[],
) {
  return profiles.find((profile) => profile.id === settings.vrmSelectedAgentId) || profiles[0];
}
