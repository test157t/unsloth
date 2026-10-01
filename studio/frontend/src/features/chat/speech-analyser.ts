/** Analyse the existing Studio audio element; this owns neither synthesis nor playback. */
let context: AudioContext | null = null;
let active: AnalyserNode | null = null;
export function speechOutputAnalyser(){return active;}
export function attachSpeechAnalyser(audio: HTMLAudioElement): () => void {
  let source: MediaElementAudioSourceNode;
  let analyser: AnalyserNode;
  try {
    context ??= new AudioContext();
    analyser = context.createAnalyser();
    analyser.fftSize=2048;
    source=context.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(context.destination);
    void context.resume().catch(()=>{});
  }catch { return ()=>{}; }
  const started=()=>{
    active=analyser;
    window.dispatchEvent(new Event("studio-speech-start"));
  };
  audio.addEventListener("playing",started);
  return ()=>{
    audio.removeEventListener("playing",started);
    source.disconnect();analyser.disconnect();
    if(active===analyser){active=null;window.dispatchEvent(new Event("studio-speech-end"));}
  };
}
