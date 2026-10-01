import { useCallback, useState } from "react";
import { authFetch, getAuthSessionEpoch } from "@/features/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EmbodyVrmPanel } from "./eris/EmbodyVrmPanel";
import { HypnoPanel } from "./eris/HypnoPanel";
import { studioAvatarProfiles } from "./selected-avatar";
import { usePresentationSettings } from "./presentation-settings";
import { resolveCompanionAssetUrl } from "./asset-url";
import "./workspace.css";

export function AvatarSettings({initialTab="avatar",open,onClose}:{initialTab?:"avatar"|"hypnosis"|"background";open:boolean;onClose:()=>void}) {
  const state=usePresentationSettings();
  const [tab,setTab]=useState(initialTab);
  const [error,setError]=useState("");
  const [uploading,setUploading]=useState(false);
  const profiles=state.profiles.length?state.profiles:studioAvatarProfiles;
  const set=useCallback((key:string,value:unknown)=>state.change("vrm",key,value),[state.change]);
  async function upload(file:File) {
    const epoch=getAuthSessionEpoch();
    setUploading(true);setError("");
    try {
      const body=new FormData();body.append("file",file);
      const response=await authFetch("/api/companion/backgrounds",{method:"POST",body});
      const result=await response.json();if(!response.ok)throw new Error(result.detail||"Background upload failed");
      if(epoch!==getAuthSessionEpoch())return;
      await state.refreshAssets();if(epoch===getAuthSessionEpoch())set("backgroundUrl",result.url);
    }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setUploading(false);}
  }
  return <Dialog open={open} onOpenChange={value=>{if(!value)onClose();}}><DialogContent className="eris-surface avatar-settings-dialog sm:max-w-3xl">
    <DialogHeader><DialogTitle>Avatar & atmosphere</DialogTitle><DialogDescription>Model, interactions and scenery for Companion and Code.</DialogDescription></DialogHeader>
    <nav className="avatar-settings-tabs" aria-label="Avatar settings sections">{([['avatar','Avatar'],['background','Background'],['hypnosis','Hypnosis']] as const).map(([id,label])=><button key={id} type="button" aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</nav>
    {(error||state.error)&&<p role="alert">{error||state.error}</p>}
    <div className="avatar-settings-body">
      {tab==="avatar"&&<EmbodyVrmPanel settings={state.vrm} vrmAssets={state.assets} promptProfiles={profiles} onSettingChange={set} onError={setError} refreshVrmAssets={state.refreshAssets}/>}
      {tab==="hypnosis"&&<HypnoPanel settings={state.hypno} promptProfiles={profiles} onSettingChange={(key,value)=>state.change("hypno",key,value)}/>}
      {tab==="background"&&<div className="avatar-background-settings">
        <p>Choose an image, then adjust dimming and blur as in ErisHub.</p>
        <label className="avatar-upload">{uploading?"Uploading…":"Upload background image"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.target.value="";}}/></label>
        <div className="avatar-background-grid"><button type="button" aria-pressed={!state.vrm.backgroundUrl} onClick={()=>set("backgroundUrl","")}>No background</button>{(state.assets.backgrounds||[]).filter(a=>/\.(png|jpe?g|webp)$/i.test(a.url)).map(a=><button type="button" key={a.url} aria-pressed={state.vrm.backgroundUrl===a.url} onClick={()=>set("backgroundUrl",a.url)}><img src={resolveCompanionAssetUrl(a.url)} alt=""/><span>{a.name}</span></button>)}</div>
        <label>Dim background · {Number(state.vrm.dimStrength)||0}%<input type="range" min={0} max={100} value={Number(state.vrm.dimStrength)||0} onChange={e=>set("dimStrength",Number(e.target.value))}/></label>
        <label className="checkbox_label"><input type="checkbox" checked={state.vrm.blurBackground===true} onChange={e=>set("blurBackground",e.target.checked)}/> Blur background</label>
      </div>}
    </div>
  </DialogContent></Dialog>;
}
