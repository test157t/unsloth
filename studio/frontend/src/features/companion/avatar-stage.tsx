import type { ComponentProps } from "react";
import { VrmStage } from "./eris/VrmStage";
import { selectedAvatarProfile, studioAvatarProfiles } from "./selected-avatar";
import type { PromptProfile } from "./eris/types";
import { defaultMappingGroup } from "./eris/EmbodyVrmPanel";

export function AvatarStage({settings, animations, profiles = studioAvatarProfiles}: {settings: Record<string, unknown>; animations: string[]; profiles?: PromptProfile[]}) {
  const s = settings;
  const map = (s.vrmModelMap || {}) as Record<string, {model?: string}>;
  const profile = selectedAvatarProfile(s, profiles.length ? profiles : studioAvatarProfiles);
  const modelUrl = map[profile.id]?.model || "";
  const savedModelSettings = ((s.vrmModelSettings || {}) as Record<string, Record<string, unknown>>)[modelUrl] || {};
  const modelSettings: Record<string, unknown> = {...savedModelSettings, hitboxes_mapping: {...defaultMappingGroup("hitbox"), ...(savedModelSettings.hitboxes_mapping as object || {})}};
  const b = (key: string) => s[key] === true;
  const n = (key: string, fallback: number) => Number.isFinite(Number(s[key])) ? Number(s[key]) : fallback;
  const props: ComponentProps<typeof VrmStage> = {
    animations, modelUrl, modelSettings, characters: [profile.assistantName || profile.name],
    enabled: b("vrmEnabled"), blink: b("vrmBlink"), naturalIdle: s.vrmNaturalIdle !== false,
    followCamera: b("vrmFollowCamera"), followCursor: b("vrmFollowCursor"), hitboxes: b("vrmHitboxes"),
    autoSendHitboxMessage: b("vrmAutoSendHitboxMessage"),
    chestJiggleEnabled: b("vrmChestJiggleEnabled"), chestJiggleAccelerometer: b("vrmChestJiggleAccelerometer"),
    chestJiggleStrength: n("vrmChestJiggleStrength",35), chestJiggleSoftness:n("vrmChestJiggleSoftness",45),
    chestJiggleGravity:n("vrmChestJiggleGravity",20), chestJiggleVertical:n("vrmChestJiggleVertical",100),
    chestJiggleSway:n("vrmChestJiggleSway",100), chestJiggleDepth:n("vrmChestJiggleDepth",70),
    lightColor:String(s.vrmLightColor || "#ffffff"), lightIntensity:n("vrmLightIntensity",100), lightPreset:String(s.vrmLightPreset || "studio"),
    rimLightEnabled:s.vrmRimLightEnabled !== false, rimLightColor:String(s.vrmRimLightColor || "#d9e8ff"),rimLightIntensity:n("vrmRimLightIntensity",85),
    fillLightIntensity:n("vrmFillLightIntensity",35),ambientLightIntensity:n("vrmAmbientLightIntensity",45),keyLightAngle:n("vrmKeyLightAngle",35),lightingContrast:n("vrmLightingContrast",55),
    modelZIndex:n("vrmModelZIndex",4),modelsCache:b("vrmModelsCache"),animationsCache:b("vrmAnimationsCache"),showGrid:b("vrmShowGrid"),showStatus:b("vrmShowStatus"),ttsLipsSync:b("vrmTtsLipsSync"),
    positionX:Number(modelSettings.x ?? s.vrmModelPositionX ?? 0),positionY:Number(modelSettings.y ?? s.vrmModelPositionY ?? 0),positionZ:Number(modelSettings.z ?? 0),
    rotationX:Number(modelSettings.rx ?? s.vrmModelRotationX ?? 0),rotationY:Number(modelSettings.ry ?? s.vrmModelRotationY ?? 0),rotationZ:Number(modelSettings.rz ?? 0),scale:Number(modelSettings.scale ?? s.vrmModelScale ?? 3),
  };
  return <VrmStage {...props}/>;
}
