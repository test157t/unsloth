// Isolated UI fixture: reads the selected model, never saves production settings or sends chat.
import {useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import {CompanionPanel} from "./src/features/companion/companion-panel";
import {CompanionDivider} from "./src/features/companion/companion-divider";
import {usePresentationSettings} from "./src/features/companion/presentation-settings";
import "./src/index.css";

function Smoke(){
 const [hit,setHit]=useState("No touch yet");
 useEffect(()=>{const listener=(e:Event)=>setHit(`Touch detected: ${(e as CustomEvent).detail.hitbox}`);window.addEventListener("nitral-vrm-hitbox-message",listener);return()=>window.removeEventListener("nitral-vrm-hitbox-message",listener);},[]);
 return <main className="studio-companion-workspace" style={{height:"100dvh"}}><section className="studio-conversation-surface" style={{padding:24}}><h1>Companion layout verification</h1><p>Settings stay in this fixture. No inference requests.</p><p role="status">{hit}</p></section><CompanionDivider/><CompanionPanel search={{} as any}/></main>;
}
const saved=await fetch('/__smoke/vrm-settings').then(r=>r.json());
usePresentationSettings.setState({ready:true,vrm:{...usePresentationSettings.getState().vrm,...saved,vrmShowStatus:true},assets:{models:[{name:'Mia',url:'/assets/vrm/models/Mia.vrm'}],animations:[{name:'Neutral',url:'/assets/vrm/animations/neutral.bvh'}],backgrounds:[{name:'Test image',url:'/__smoke/background.png'}]},change:(group,key,value)=>{usePresentationSettings.setState(s=>({[group]:{...s[group],[key]:value}}));},refreshAssets:async()=>{}});
createRoot(document.getElementById("root")!).render(<Smoke/>);
