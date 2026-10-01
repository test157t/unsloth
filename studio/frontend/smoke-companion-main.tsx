import {StrictMode,useState,useRef,useEffect} from "react";
import {createRoot} from "react-dom/client";
import {AvatarStage} from "./src/features/companion/avatar-stage";
import {vrmDefaults,hypnoDefaults} from "./src/features/companion/eris/defaults";
import {callModeHypnoSettings} from "./src/features/companion/eris/hypno-mapping";
import {resolveCompanionAssetUrl} from "./src/features/companion/asset-url";
import "./src/features/companion/eris/presentation.css";
function Smoke(){
 const [saved,setSaved]=useState<Record<string,unknown>>({});
 const [model,setModel]=useState('');const [narrow,setNarrow]=useState(true);
 useEffect(()=>{void fetch('/__smoke/vrm-settings').then(r=>r.json()).then(setSaved);},[]);
 const [enabled,setEnabled]=useState(true);const [effects,setEffects]=useState(false);const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{let disposed=false;let runtime:any;const url="/companion-runtime/hypnosis.js";
 void import(/* @vite-ignore */ url).then(m=>{if(disposed)return;runtime=m;if(effects&&host.current)m.startPresentation(callModeHypnoSettings(true,{...hypnoDefaults,sessionActive:true,ambientEnabled:false,breathGuidanceEnabled:false,spokenWhispersEnabled:false}),host.current,{resolveAssetUrl:resolveCompanionAssetUrl});else m.stopPresentation();}).catch(e=>{document.getElementById('errors')!.textContent=String(e);});
 return()=>{disposed=true;runtime?.stopPresentation();};},[effects]);
 return <><header style={{padding:12,position:"relative",zIndex:100001}}><button onClick={()=>setEnabled(!enabled)}>Toggle avatar</button><button aria-pressed={effects} onClick={()=>setEffects(!effects)}>Toggle effects</button><button onClick={()=>setNarrow(!narrow)}>Resize pane</button><select aria-label="Test model" value={model} onChange={e=>setModel(e.target.value)}><option value="">Saved model</option><option value="Mia.vrm">Mia.vrm</option><option value="113362770567175987.vrm">Alternate model</option></select><span id="errors"/></header><div className="eris-surface" style={{position:"relative",marginLeft:narrow?'50%':0,width:narrow?'50%':'100%',height:narrow?'60vh':'85vh',isolation:"isolate",overflow:"hidden"}}><div ref={host} style={{position:"absolute",inset:0}}/><AvatarStage animations={['/assets/vrm/animations/neutral.bvh']} settings={{...vrmDefaults,...saved,vrmEnabled:enabled,vrmShowStatus:true,vrmBlink:true,...(model?{vrmSelectedAgentId:'studio',vrmModelMap:{studio:{model:'/assets/vrm/models/'+model}}}:{}) }}/></div></>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><Smoke/></StrictMode>);

