import {useCallback,useRef,useState} from "react";
import type {ChatSearch} from "@/features/chat";
import {EditorPage} from "./editor-page";
import "./editor-layout.css";

export function CodePanel({active,search:_search}:{active:boolean;search:ChatSearch}){
  const host=useRef<HTMLDivElement>(null);
  const [mounted,setMounted]=useState(active);
  if(active&&!mounted)setMounted(true);
  const layout=useCallback(({rail,right,preview}:{rail:number;right:number;preview:number})=>{
    const parent=host.current?.parentElement;if(!parent)return;
    parent.style.setProperty("--col-rail",`${rail}px`);
    parent.style.setProperty("--col-right",`${right}px`);
    parent.style.setProperty("--editor-preview-height",`${preview}px`);
  },[]);
  return <div ref={host} className={active?"eris-surface studio-editor-mount":"hidden"} inert={!active||undefined}>
    {mounted&&<EditorPage active={active} onLayout={layout}/>}
  </div>;
}
