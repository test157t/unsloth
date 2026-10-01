import {useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import {authFetch} from "@/features/auth";

export function pickRepositoryDirectory():Promise<string|null>{
  return new Promise(resolve=>{
    const host=document.createElement("div");document.body.appendChild(host);
    const root=createRoot(host);
    const close=(path:string|null)=>{root.unmount();host.remove();resolve(path);};
    root.render(<DirectoryPicker close={close}/>);
  });
}
function DirectoryPicker({close}:{close:(path:string|null)=>void}){
  const [path,setPath]=useState("");
  const [listing,setListing]=useState<{path:string;parent:string;directories:string[]}>({path:"",parent:"",directories:[]});
  const [error,setError]=useState("");
  useEffect(()=>{
    const controller=new AbortController();setError("");
    void authFetch(`/api/code/directories?path=${encodeURIComponent(path)}`,{signal:controller.signal}).then(async response=>{
      const data=await response.json();if(!response.ok)throw new Error(data.detail||"Cannot open folder");
      if(!controller.signal.aborted)setListing(data);
    }).catch(e=>{if(!controller.signal.aborted)setError(String(e));});
    return()=>controller.abort();
  },[path]);
  return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-6" onKeyDown={e=>{if(e.key==="Escape")close(null);}}>
    <section role="dialog" aria-modal="true" aria-label="Select repository directory" className="flex max-h-[75vh] w-[640px] flex-col gap-3 rounded-xl border bg-background p-5 text-foreground">
      <h2>Select repository directory</h2>
      <form onSubmit={e=>{e.preventDefault();setPath(new FormData(e.currentTarget).get("path") as string);}} className="flex gap-2"><input autoFocus name="path" key={listing.path} defaultValue={listing.path} aria-label="Directory path" className="min-w-0 flex-1 border p-2"/><button type="submit">Open</button></form>
      {error&&<p role="alert">{error}</p>}
      <button type="button" onClick={()=>setPath(listing.parent)}>Parent directory</button>
      <div className="min-h-40 overflow-auto">{listing.directories.map(folder=><button className="block w-full p-2 text-left hover:bg-accent" type="button" key={folder} onClick={()=>setPath(folder)}>{folder}</button>)}</div>
      <div className="flex justify-end gap-4"><button type="button" onClick={()=>close(null)}>Cancel</button><button type="button" disabled={!listing.path||!!error||path!==listing.path} onClick={()=>close(listing.path)}>Select this directory</button></div>
    </section>
  </div>;
}
