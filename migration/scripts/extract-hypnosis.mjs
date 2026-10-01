import fs from 'node:fs';
import ts from '../../studio/frontend/node_modules/typescript/lib/typescript.js';
const source=fs.readFileSync('D:/Github/ErisHub/server/modules/Embody/callmode/call-mode.js','utf8');
const ast=ts.createSourceFile('effects.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const declarations=new Map();
for(const node of ast.statements){
 if(ts.isFunctionDeclaration(node)&&node.name)declarations.set(node.name.text,node);
 if(ts.isVariableStatement(node))for(const decl of node.declarationList.declarations)if(ts.isIdentifier(decl.name))declarations.set(decl.name.text,node);
}
const boundary=new Map([
 ['nitralState',`const nitralState = { callbacks: {}, activeAgentName: 'Mia', activeAgentId: 'studio', characters: ['Mia'], chatMessages: [], userName: 'User', suppressOverlay: false, extension_settings: { callmode: {}, tts: { tts_volume: 100, playbackBar: { tts_volume: 100 } } } };`],
 ['playWhisperPhraseAudio',`async function playWhisperPhraseAudio(phrase, character) {
  if (!isSpokenWhispersEnabled() || !phrase || !callActive) return false;
  const now = Date.now();
  if(now - lastWhisperAudioAt < WHISPER_AUDIO_MIN_INTERVAL_MS) return false;
  const started = nitralState.callbacks.speak?.(phrase, character) || false;
  if(started) lastWhisperAudioAt = now;
  return started;
 }`],
 ['playBreathGuidancePrompt',`async function playBreathGuidancePrompt(type = 'in') {
  if (!isHypnoBreathGuidanceEnabled() || !callActive) return false;
  const phrase = pickRandomNot(type === 'out' ? HYPNO_BREATH_PROMPTS_OUT : HYPNO_BREATH_PROMPTS_IN, type === 'out' ? lastBreathPromptOut : lastBreathPromptIn);
  if (type === 'out') lastBreathPromptOut = phrase; else lastBreathPromptIn = phrase;
  return nitralState.callbacks.speak?.(phrase) || false;
 }`],
 ['stopSpokenWhisperAudio',`function stopSpokenWhisperAudio() { nitralState.callbacks.stopSpeech?.(); }`],
 ['getTtsOutputLevel',`function getTtsOutputLevel() { return nitralState.callbacks.outputLevel?.() || 0; }`],
 ['shouldShowOverlayWaveform',`function shouldShowOverlayWaveform() { return false; }`],
 ['ensureSubtitleElement',`function ensureSubtitleElement() {}`],
 ['updateCallOverlayStatus',`function updateCallOverlayStatus() {}`],
 ['endCall',`function endCall() { stopPresentation(); }`],
]);
const chosen=new Set();
function visitName(name){ if(chosen.has(name)||!declarations.has(name))return; chosen.add(name); if(boundary.has(name)) { const fragment=ts.createSourceFile("boundary.js",boundary.get(name),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS); const walk=n=>{if(ts.isIdentifier(n)&&n.text!==name)visitName(n.text);ts.forEachChild(n,walk)};walk(fragment);return; }
 const node=declarations.get(name);function walk(child){if(ts.isIdentifier(child)&&declarations.has(child.text)&&child.text!==name)visitName(child.text);ts.forEachChild(child,walk)};walk(node);
}
for(const name of ['showCallOverlay','hideCallOverlay','addCallStyles','mapCallModeSettings','applyRuntimeHypnoSettings','ensureOverlayVisibilityListener','appendContent','prependContent'])visitName(name);
let code='// Adapted ErisHub hypnosis renderer; generated declaration closure, with Studio-owned speech boundaries.\n';
const emitted=new Set();
for(const node of ast.statements){
 const names=[...chosen].filter(name=>declarations.get(name)===node);
 if(!names.length)continue;
 if(names.some(name=>boundary.has(name))){for(const name of names)if(boundary.has(name)&&!emitted.has(name)){code+=boundary.get(name)+'\n';emitted.add(name)};if(names.every(name=>boundary.has(name)))continue;}
 code+=node.getText(ast).replace(/^export /,'')+'\n';
}
// Keep the source's small DOM adapter. It is the renderer's dependency, not its call/ASR engine.
const domAdapter=ast.statements.find(n=>ts.isIfStatement(n)&&n.expression.getText(ast)==='!globalThis.$');
code=domAdapter.getText(ast)+'\n'+code;
code+=`\nlet presentationStylesReady = false;
export function startPresentation(settings, host, callbacks = {}) {
 if (!presentationStylesReady) { addCallStyles(); presentationStylesReady = true; }
 Object.assign(nitralState.callbacks, callbacks);
 Object.assign(extension_settings.callmode, mapCallModeSettings(settings));
 callActive = true;
 const root = getOverlayRoot(true)[0]; host.appendChild(root);
 root.style.position='absolute'; root.style.inset='0'; root.style.width='100%'; root.style.height='100%'; root.style.pointerEvents='none';
 showCallOverlay(); ensureOverlayVisibilityListener();
}
export function stopPresentation() { callActive = false; stopOverlayParticleCanvas(true); hideCallOverlay(); document.getElementById('voiceforge_call_overlay')?.remove(); }
`;
code += `
const resolveAsset = value => nitralState.callbacks.resolveAssetUrl?.(value) || value;
const fetch = (value, init) => globalThis.fetch(resolveAsset(value), init);
class Audio extends globalThis.Audio { constructor(value) { super(...(value ? [resolveAsset(value)] : [])); } set src(value) { super.src = resolveAsset(value); } get src() { return super.src; } }
`;
fs.writeFileSync('studio/frontend/public/companion-runtime/hypnosis.js',code);
fs.writeFileSync('migration/evidence/hypnosis-extraction.json',JSON.stringify({source:'ErisHub/server/modules/Embody/callmode/call-mode.js',declarations:[...chosen].sort(),studioBoundaries:[...boundary.keys()].filter(k=>chosen.has(k))},null,2));
console.log('Extracted',chosen.size,'declarations',code.length,'bytes');
console.log([...chosen].filter(n=>/asr|capture|websocket|WhisperBlob|generate|startCall|stopAudio/i.test(n)));
