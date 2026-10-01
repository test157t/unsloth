import { useRef, type PointerEvent } from "react";

/** Pointer capture keeps resize working across the canvas, outside the handle, and on touch. */
export function PaneDivider({label, axis = "x", value, min, max, onChange, onCommit, className = "", direction = 1}: {
  label: string; axis?: "x" | "y"; value: number; min: number; max: number;
  onChange: (value: number) => void; onCommit?: (value: number) => void; className?: string; direction?: number;
}) {
  const drag = useRef<{position: number; value: number; latest: number} | null>(null);
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const coordinate = (e: PointerEvent) => axis === "x" ? e.clientX : e.clientY;
  return <div role="separator" tabIndex={0} aria-label={label} aria-orientation={axis === "x" ? "vertical" : "horizontal"}
    aria-valuemin={min} aria-valuemax={max} aria-valuenow={Math.round(value)} className={`studio-pane-divider ${axis === "y" ? "horizontal" : ""} ${className}`}
    onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drag.current={position:coordinate(e),value,latest:value};}}
    onPointerMove={e=>{if(!drag.current)return;const next=clamp(drag.current.value+direction*(coordinate(e)-drag.current.position));drag.current.latest=next;onChange(next);}}
    onLostPointerCapture={()=>{if(drag.current)onCommit?.(drag.current.latest);drag.current=null;}}
    onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
    onKeyDown={e=>{const delta=e.key==="ArrowLeft"||e.key==="ArrowUp"?-20:e.key==="ArrowRight"||e.key==="ArrowDown"?20:0;if(!delta&&e.key!=="Home"&&e.key!=="End")return;e.preventDefault();const next=e.key==="Home"?min:e.key==="End"?max:clamp(value+direction*delta);onChange(next);onCommit?.(next);}}><span/></div>;
}
