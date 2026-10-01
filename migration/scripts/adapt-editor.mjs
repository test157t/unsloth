import fs from 'node:fs';
const source=fs.readFileSync('D:/Github/ErisHub/src/components/editor/EditorPage.tsx','utf8');
let text=source;
text=text.replace(text.slice(0,text.indexOf('type ProjectFileItem')),`// Adapted from ErisHub EditorPage; see migration/13-faithful-feature-integration.md.
import {type CSSProperties,type KeyboardEvent,type MouseEvent as ReactMouseEvent,memo,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {tokenize} from './tokenizer';
import {createProjectApi,deleteProjectApi,listProjectsApi,updateProjectApi,type ProjectRecord,editorFetch as fetch,postJson} from './studio-editor-api';
import {AvatarStage} from '@/features/companion/avatar-stage';
import {usePresentationSettings} from '@/features/companion/presentation-settings';
import {runEditorCode} from './studio-editor-api';
import '@/features/companion/eris/presentation.css';
`);
text=text.replace(/type BackgroundAsset[\s\S]*?type EditorWorkspaceState/, 'type EditorWorkspaceState');
text=text.replace(/function readLegacyEditorState\(\)[\s\S]*?type EditorPageProps/, 'type EditorPageProps');
const start=text.indexOf('type EditorPageProps');
const body=text.indexOf('  const legacyEditorState',start);
text=text.slice(0,start)+`type EditorPageProps={onLayout:(layout:{rail:number;right:number;preview:number})=>void};
export const EditorPage=memo(function EditorPage({onLayout}:EditorPageProps){
  const [error,onError]=useState('');
  const presentation=usePresentationSettings();
  useEffect(()=>{if(!presentation.ready)void presentation.load();},[presentation.ready]);
  const [pythonRuns,setPythonRuns]=useState<Record<string,PythonRunState>>({});
  const onRefreshAuditLog=()=>{};
  const editorCodeCompletionEnabled=true;
  const computationEnabled=true;
  const runPythonCode=(id:string,code:string)=>runCode(id,code,'python');
  const runJavaScriptCode=(id:string,code:string)=>runCode(id,code,'javascript');
  async function runCode(id:string,code:string,language:'python'|'javascript'){
    setPythonRuns(r=>({...r,[id]:{status:'running',output:''}}));
    try{const result=await runEditorCode(selectedProjectId,code,language);setPythonRuns(r=>({...r,[id]:{status:'done',output:result.output}}));}
    catch(e){setPythonRuns(r=>({...r,[id]:{status:'error',output:String(e)}}));}
  }
`+text.slice(body);
text=text.replace('useMemo(readLegacyEditorState, [])','useMemo(():EditorWorkspaceState => ({}), [])');
text=text.replace('  const latestMessage = messages.at(-1);','');
text=text.replace(/  useEffect\(\(\) => \{\s+const chatLog = chatLogRef.current;[\s\S]*?\}, \[latestMessage[^\n]*\n/,'');
text=text.replace(/    const providerConfig = provider as ProviderConfig \| null;[\s\S]*?    const prefix =/,'    const prefix =');
text=text.replace('provider: providerConfig, modules, prefix','prefix');
text=text.replace('{ provider, root: directory, files: filesForSummary }','{ root: directory, files: filesForSummary }');
text=text.replaceAll('/api/workspace-root','/api/code/root').replaceAll('/api/workspace-state','/api/code/state').replaceAll('/api/modules/projects/','/api/code/').replaceAll('/api/modules/core-assistant/projects/','/api/code/projects/').replaceAll('/api/pick-directory','/api/code/pick-directory');
// The persistent Studio ChatPage occupies the right grid cell; do not copy ErisHub's chat runtime.
const col=text.indexOf('    <div className="editor-col-chat">');
const end=text.indexOf('    {showCreateDialog ?',col);
text=text.slice(0,col)+`    <aside className="editor-presence-preview" ref={previewRef} aria-label="Avatar preview" style={{height:previewHeight}}>
      {presentation.ready&&<AvatarStage settings={presentation.vrm} animations={presentation.assets.animations.map(a=>a.url)}/>}
      <div className="editor-preview-height-handle" onMouseDown={e=>{e.preventDefault();previewHeightDragRef.current={startY:e.clientY,height:previewHeight};}}/>
    </aside>
    {error?<p role="alert" className="editor-error-text">{error}</p>:null}
`+text.slice(end);
text=text.replace('  return <section className="page editor-page"',`  useEffect(()=>onLayout({rail:colWidths.rail,right:colWidths.right,preview:previewHeight}),[colWidths,previewHeight,onLayout]);
  return <section className="page editor-page"`);
text=text.replace('<div className="editor-code-meta">',`<div className="button-row"><button type="button" onClick={()=>void saveFile()} disabled={isSaving}>Save</button><button type="button" onClick={runCurrentPythonNow} disabled={activeRun?.status==='running'}>Run Python</button><button type="button" onClick={runCurrentJavaScriptNow} disabled={activeRun?.status==='running'}>Run JavaScript</button><button type="button" onClick={()=>void requestEditorCompletion()}>Complete (Alt+Space)</button></div>{activeRun&&<pre role="log" className="editor-run-output">{activeRun.status==='running'?'Running…':activeRun.output}</pre>}<div className="editor-code-meta">`);
// Source's truncated buffer recovery and auto-save loop are replaced by revision-aware explicit saves.
text=text.replace('content.slice(0, 8000)','content');
text=text.replace(/  useEffect\(\(\) => \{\s+if \(!draftName.trim\(\)\) return;[\s\S]*?\}, \[content, draftName[^\n]*\n/,'');
fs.writeFileSync('studio/frontend/src/features/code/editor-page.tsx',text);
fs.copyFileSync('D:/Github/ErisHub/src/lib/tokenizer.ts','studio/frontend/src/features/code/tokenizer.ts');
