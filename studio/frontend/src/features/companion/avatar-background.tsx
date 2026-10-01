import { resolveCompanionAssetUrl } from "./asset-url";

export function AvatarBackground({settings}:{settings:Record<string,unknown>}) {
  const url=String(settings.backgroundUrl||"");
  if(!url)return null;
  return <div className="avatar-background" aria-hidden="true">
    <img src={resolveCompanionAssetUrl(url)} alt="" style={{filter:settings.blurBackground?"blur(8px)":undefined}}/>
    <div style={{background:`rgba(0,0,0,${Math.max(0,Math.min(100,Number(settings.dimStrength)||0))/100})`}}/>
  </div>;
}
