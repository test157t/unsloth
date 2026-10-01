import { authFetch } from "@/features/auth";
import { listChatProjects, saveChatProject, updateChatProject, deleteChatProject, streamChatCompletions } from "@/features/chat/api/chat-api";
import type { ProjectRecord as StudioProject } from "@/features/chat/types";
import { useChatRuntimeStore } from "@/features/chat/stores/chat-runtime-store";
import { useExternalProvidersStore } from "@/features/chat/stores/external-providers-store";
import { parseExternalModelId, getExternalProviderApiKey, toExternalBackendProviderType } from "@/features/chat/external-providers";
import { encryptProviderApiKey } from "@/features/chat/api/providers-api";
import { workspaceAction, listWorkspace, type DocumentSnapshot } from "./api";
import { pickRepositoryDirectory } from "./directory-picker";

export type ProjectRecord={id:string;name:string;status:"enabled"|"disabled";directory:string;summary:string};
const projectView=(p:StudioProject):ProjectRecord=>({id:p.id,name:p.name,status:p.archived?"disabled":"enabled",directory:p.repositoryPath||p.sandboxPath||"",summary:p.instructions||""});
export async function listProjectsApi(){return (await listChatProjects({includeArchived:true})).map(projectView);}
export async function createProjectApi(body:Record<string,unknown>){
  const now=Date.now();
  let p=await saveChatProject({id:crypto.randomUUID(),name:String(body.name),instructions:String(body.summary||""),archived:false,createdAt:now,updatedAt:now});
  if(body.directory)p=await updateChatProject(p.id,{repositoryPath:String(body.directory)});
  return projectView(p);
}
export async function updateProjectApi(id:string,body:Partial<ProjectRecord>){
  return projectView(await updateChatProject(id,{
    ...(body.name!==undefined?{name:body.name}:{}),...(body.summary!==undefined?{instructions:body.summary}:{}),
    ...(body.directory!==undefined?{repositoryPath:body.directory||null}:{}),...(body.status!==undefined?{archived:body.status==="disabled"}:{}),updatedAt:Date.now(),
  }));
}
export const deleteProjectApi=(id:string)=>deleteChatProject(id,{deleteFiles:false});
const revisions=new Map<string,string>();
async function sessionForRoot(root:string){
  const projects=await listProjectsApi();
  const project=projects.find(p=>p.directory===root&&p.status==="enabled");
  if(!project)throw new Error("Select an enabled Studio project before editing its files.");
  return `project-${project.id}`;
}
export async function runEditorCode(project:string,content:string,language:"python"|"javascript"){
  if(!project)throw new Error("Select a project before running code.");
  return workspaceAction<{output:string}>(`project-${project}`,"run",{content,language});
}
async function complete(prompt:string,signal?:AbortSignal){
  const checkpoint=useChatRuntimeStore.getState().params.checkpoint;
  if(!checkpoint)throw new Error("Select a model in Studio to use completion.");
  const external=parseExternalModelId(checkpoint);
  const connections=useExternalProvidersStore.getState();
  const provider=external?connections.providers.find(p=>p.id===external.providerId):undefined;
  if(external&&(!connections.connectionsEnabled||!provider))throw new Error("Enable the selected Studio connection first.");
  const key=provider?getExternalProviderApiKey(provider.id):null;
  const encrypted=key?await encryptProviderApiKey(key):undefined;
  let result="";
  for await(const chunk of streamChatCompletions({model:external?.modelId||checkpoint,messages:[{role:"user",content:prompt}],stream:true,max_tokens:1024,
    ...(provider&&external?{provider_id:provider.id,provider_type:toExternalBackendProviderType(provider.providerType),external_model:external.modelId,provider_base_url:provider.baseUrl,provider_api_type:provider.apiType,encrypted_api_key:encrypted}:{}),
  },signal||new AbortController().signal)){
    result+=chunk.choices?.[0]?.delta?.content||"";
  }
  return result;
}
/** Adapt the source editor's data contract to Studio's project and workspace authorities. */
export async function editorFetch(value:string,init?:RequestInit):Promise<Response>{
  const url=new URL(value,window.location.origin);
  const body=typeof init?.body==="string"?JSON.parse(init.body):{};
  const route=url.pathname;
  const root=String(body.root||url.searchParams.get("root")||"");
  let result:unknown;
  if(route==="/api/code/state")return authFetch(value,init);
  if(route==="/api/code/root")result={root:""};
  else if(route==="/api/code/pick-directory"){
    const path=await pickRepositoryDirectory();result={success:!!path,path:path||""};
  }else if(route==="/api/code/llm-complete"){
    const completion=await complete(`Complete the code at the cursor in ${body.filePath}. Return only the inserted code, without fences or explanation. Preserve indentation.\nPREFIX:\n${body.prefix}\nCURSOR\nSUFFIX:\n${body.suffix}`,init?.signal||undefined);
    result={completion};
  }else if(route.endsWith("/repo-summary")){
    const id=decodeURIComponent(route.split("/").at(-2)!);
    const summary=await complete(`Summarize this repository from the following file inventory. Clearly distinguish inference from verified source facts.\n${JSON.stringify(body.files)}`,init?.signal||undefined);
    result={item:await updateProjectApi(id,{summary})};
  }else{
    const session=await sessionForRoot(root);
    const file=String(body.file||url.searchParams.get("file")||"");
    const key=JSON.stringify([session,file]);
    if(route==="/api/code/files"){
      const listing=await listWorkspace(session);result={files:listing.files.map(f=>({path:f.name,name:f.name,size:f.size,updatedAt:""}))};
    }else if(route==="/api/code/file"){
      const snapshot=await workspaceAction<DocumentSnapshot>(session,init?.method==="PUT"?"save":"read",{filename:file,...(init?.method==="PUT"?{content:body.content,revision:revisions.get(key)||null}:{})});
      revisions.set(key,snapshot.revision);result={file:{path:file,content:snapshot.content}};
    }else if(route==="/api/code/git-review")result=await workspaceAction(session,"review");
    else {
      const action=route.split("/").at(-1)!;
      if(!["stage","ignore","init","commit"].includes(action))throw new Error("Unknown editor operation");
      const paths:string[]=body.paths||[""];
      for(const filename of paths)result=await workspaceAction(session,action==="stage"&&body.stage===false?"unstage":action,{filename:filename||undefined,message:body.message});
    }
  }
  return Response.json(result);
}
export async function postJson(url:string,body:unknown,method="POST"){
  const response=await editorFetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const value=await response.json();
  if(!response.ok)throw new Error(value.detail||"Editor request failed");
  return value;
}
