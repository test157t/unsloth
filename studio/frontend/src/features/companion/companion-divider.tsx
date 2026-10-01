import { useEffect, useRef, useState } from "react";
import { PaneDivider } from "./pane-divider";
import { usePresentationSettings } from "./presentation-settings";

export function CompanionDivider() {
  const host=useRef<HTMLDivElement>(null);
  const saved=usePresentationSettings(s=>s.vrm.companionChatWidth);
  const change=usePresentationSettings(s=>s.change);
  const [width,setWidth]=useState(Number(saved)||460);
  const [available,setAvailable]=useState(1200);
  useEffect(()=>{if(Number(saved)>0)setWidth(Number(saved));},[saved]);
  useEffect(()=>{const parent=host.current?.parentElement;if(!parent)return;const observer=new ResizeObserver(()=>setAvailable(parent.clientWidth));observer.observe(parent);return()=>observer.disconnect();},[]);
  useEffect(()=>{host.current?.parentElement?.style.setProperty("--companion-chat-width",`${Math.min(width,Math.max(260,available-300))}px`);},[width,available]);
  return <div ref={host} className="companion-divider"><PaneDivider label="Resize companion chat and avatar" value={width} min={260} max={Math.max(260,available-300)} onChange={setWidth} onCommit={value=>change("vrm","companionChatWidth",value)}/></div>;
}
