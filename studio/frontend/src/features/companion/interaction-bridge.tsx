import { useEffect } from "react";
import { useAui } from "@assistant-ui/react";
import { useRouterState } from "@tanstack/react-router";
import { toast } from "@/lib/toast";

const areas=new Set(["head","chest","groin","butt","leftHand","rightHand","leftLeg","rightLeg","rightFoot","leftFoot"]);
export function AvatarInteractionBridge({active}:{active:boolean}) {
  const aui=useAui();
  const path=useRouterState({select:s=>s.location.pathname});
  useEffect(()=>{
    if(!active||(path!=="/companion"&&path!=="/code"))return;
    let last=0;
    function touched(event:Event){
      const detail=(event as CustomEvent).detail;
      if(!detail||!areas.has(detail.hitbox)||detail.autoSend!==true)return;
      if(Date.now()-last<800)return;last=Date.now();
      const thread=aui.thread();
      if(thread.getState().isRunning){toast.info("Avatar reacted. Wait for the current reply before sending another touch.");return;}
      const area=detail.hitbox.replace(/([A-Z])/g," $1").toLowerCase();
      try {void Promise.resolve(thread.append({role:"user",content:[{type:"text",text:`I touch your ${area}.`}],createdAt:new Date()})).catch(()=>toast.error("Could not send the avatar interaction."));}
      catch{toast.error("Choose a chat model to send avatar interactions.");}
    }
    window.addEventListener("nitral-vrm-hitbox-message",touched);
    return()=>window.removeEventListener("nitral-vrm-hitbox-message",touched);
  },[active,path,aui]);
  return null;
}
