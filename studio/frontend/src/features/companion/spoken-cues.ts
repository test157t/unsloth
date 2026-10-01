import { StudioSpeechSynthesisAdapter } from "@/features/chat/adapters/studio-speech-synthesis-adapter";
import { claimSpeechPlayback, isSpeechPlaybackActive } from "@/features/chat/speech-playback-owner";

let cancelCue = () => {};
export function stopCompanionCue(){cancelCue();}
export function speakCompanionCue(text: string): boolean {
  if(!text.trim()||isSpeechPlaybackActive())return false;
  const utterance=new StudioSpeechSynthesisAdapter({externallyOwned:true}).speak(text);
  const release=claimSpeechPlayback(()=>utterance.cancel());
  const cancel=()=>{utterance.cancel();release();};
  cancelCue=cancel;
  const unsubscribe=utterance.subscribe(()=>{
    if(utterance.status.type!=="ended")return;
    release();unsubscribe();
    if(cancelCue===cancel)cancelCue=()=>{};
  });
  return true;
}
