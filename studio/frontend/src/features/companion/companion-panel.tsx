import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatSearch } from "@/features/chat";
import { stopSpeechPlayback } from "@/features/chat/speech-playback-owner";
import { AvatarStage } from "./avatar-stage";
import { AvatarSettings } from "./avatar-settings";
import { AvatarBackground } from "./avatar-background";
import { callModeHypnoSettings } from "./eris/hypno-mapping";
import { resolveCompanionAssetUrl } from "./asset-url";
import { speakCompanionCue, stopCompanionCue } from "./spoken-cues";
import { usePresentationSettings } from "./presentation-settings";
import type { PromptProfile } from "./eris/types";
import "./eris/presentation.css";

const studioProfile: PromptProfile[] = [{id:"studio",name:"Studio assistant",assistantName:"Mia",blocks:[]}];
type Effects = {startPresentation:(settings:Record<string,unknown>,host:HTMLElement,callbacks:Record<string,unknown>)=>void;stopPresentation:()=>void};

export function CompanionPanel({search: _search}:{search:ChatSearch}) {
  const {vrm,hypno,assets,ready,error,load,change}=usePresentationSettings();
  const savedProfiles=usePresentationSettings(s=>s.profiles);
  const profiles=savedProfiles.length?savedProfiles:studioProfile;
  const [tab,setTab]=useState<"avatar"|"hypnosis"|null>(null);
  const [runtimeError,setRuntimeError]=useState("");
  const host=useRef<HTMLDivElement>(null);
  const runtime=useRef<Effects|null>(null);
  const hypnoChange=useCallback((key:string,value:unknown)=>change("hypno",key,value),[change]);
  useEffect(()=>{if(!ready)void load();},[ready,load]);
  useEffect(()=>{
    let cancelled=false;
    const url="/companion-runtime/hypnosis.js";
    void import(/* @vite-ignore */ url).then((module:Effects)=>{
      if(cancelled||!host.current)return;
      runtime.current=module;
      if(hypno.sessionActive===true&&hypno.sessionPaused!==true){
        module.startPresentation(callModeHypnoSettings(true,hypno),host.current,{resolveAssetUrl:resolveCompanionAssetUrl,speak:speakCompanionCue,stopSpeech:stopCompanionCue});
      }else module.stopPresentation();
    }).catch(e=>{if(!cancelled)setRuntimeError(String(e));});
    return()=>{cancelled=true;runtime.current?.stopPresentation();};
  },[hypno]);
  useEffect(()=>()=>stopSpeechPlayback(),[]);
  function stop(){runtime.current?.stopPresentation();stopSpeechPlayback();hypnoChange("sessionActive",false);}
  return <section aria-label="Avatar companion" className="eris-surface companion-avatar-panel relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
    <div className="relative isolate min-h-0 flex-1 overflow-hidden">
      <AvatarBackground settings={vrm}/>
      <div ref={host} className="absolute inset-0"/>
      {ready&&<AvatarStage settings={vrm} profiles={profiles} animations={assets.animations.map(a=>a.url)}/>}
      {ready&&!vrm.vrmEnabled&&<div className="absolute inset-0 flex items-center justify-center"><button type="button" onClick={()=>setTab("avatar")} className="rounded border px-4 py-2">Choose and enable your avatar</button></div>}
      <div className="avatar-toolbar">
        <button type="button" onClick={()=>setTab(tab==="avatar"?null:"avatar")} aria-expanded={tab==="avatar"}>Avatar settings</button>
        <button type="button" onClick={()=>setTab(tab==="hypnosis"?null:"hypnosis")} aria-expanded={tab==="hypnosis"}>Hypnosis settings</button>
        <button type="button" onClick={stop}>Stop effects and speech</button>
      </div>
    </div>
    {(error||runtimeError)&&<p role="alert" className="p-3 text-destructive">{error||runtimeError}</p>}
    {tab&&<AvatarSettings open initialTab={tab} onClose={()=>setTab(null)}/>}
  </section>;
}
