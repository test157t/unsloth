import { create } from "zustand";
import { authFetch, AUTH_SESSION_CLEARED_EVENT, AUTH_SESSION_STORED_EVENT } from "@/features/auth";
import { vrmDefaults, hypnoDefaults } from "./eris/defaults";
import type { VrmAssets } from "./eris/EmbodyVrmPanel";
import type { PromptProfile } from "./eris/types";

type Settings = Record<string, unknown>;
type State = {vrm: Settings; hypno: Settings; profiles:PromptProfile[]; assets: VrmAssets; ready: boolean; error: string; load: () => Promise<void>; refreshAssets: () => Promise<void>; change: (group: "vrm" | "hypno",key: string,value: unknown) => void; patch:(group:"vrm"|"hypno",values:Settings)=>void};
let epoch = 0;
let saves = Promise.resolve();
async function json(path: string, init?: RequestInit) {
  const response = await authFetch(`/api/companion/${path}`,init);
  if(!response.ok) throw new Error((await response.json().catch(()=>null))?.detail || `Companion request failed (${response.status})`);
  return response.json();
}
export const usePresentationSettings = create<State>((set,get)=>({
  vrm:{...vrmDefaults},hypno:{...hypnoDefaults},profiles:[],assets:{models:[],animations:[]},ready:false,error:"",
  load:async()=>{
    const generation = epoch;
    try {
      const [saved,assets] = await Promise.all([json("settings"),json("assets")]);
      if(generation !== epoch) return;
      set({vrm:{...vrmDefaults,...saved.vrm},hypno:{...hypnoDefaults,...saved.hypno,sessionActive:false,sessionPaused:false},profiles:saved.profiles||[],assets,ready:true,error:""});
    } catch(error){if(generation === epoch) set({error:String(error)});}
  },
  refreshAssets:async()=>{const generation=epoch;const assets=await json("assets");if(generation===epoch)set({assets});},
  change:(group,key,value)=>{
    get().patch(group,{[key]:value});
  },
  patch:(group,values)=>{
    if(!get().ready)return;
    set({[group]:{...get()[group],...values}});
    const generation = epoch;
    const {vrm,hypno,profiles}=get();
    saves=saves.catch(()=>{}).then(async()=>{
      if(generation!==epoch)return;
      try {await json("settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({vrm,hypno,profiles})});}
      catch(error){if(generation===epoch)set({error:String(error)});}
    });
  },
}));
function reset(){epoch++;usePresentationSettings.setState({vrm:{...vrmDefaults},hypno:{...hypnoDefaults},profiles:[],assets:{models:[],animations:[]},ready:false,error:""});}
window.addEventListener(AUTH_SESSION_CLEARED_EVENT,reset);
window.addEventListener(AUTH_SESSION_STORED_EVENT,reset);
