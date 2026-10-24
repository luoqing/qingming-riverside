import library from "./voice-library.json";
import {voiceForRole} from "./travel-data.js";
const KEY="bianhe-audio-v1";
export function createJourneyAudio() {
  const settings={music:true,effects:true,voice:true,heroVoice:"auto"};
  try {const saved=JSON.parse(localStorage.getItem(KEY));for(const key of ["music","effects","voice"]) if(typeof saved?.[key]==="boolean") settings[key]=saved[key];
    if(["auto","male","female"].includes(saved?.heroVoice))settings.heroVoice=saved.heroVoice;} catch {}
  let context, musicGain, effectsGain, note=0, player=null, generation=0, finish=null, paused=false;
  let played=0, ended=0, lastVoice="", lastSource="", lastText="";
  const recent=[];
  const synth=window.speechSynthesis;
  function tone(frequency,time,duration,volume,bus,type="sine") {
    if(!context || !bus) return;
    const oscillator=context.createOscillator(), gain=context.createGain();
    oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,time);
    gain.gain.setValueAtTime(0.0001,time);gain.gain.exponentialRampToValueAtTime(volume,time+0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001,time+duration);
    oscillator.connect(gain).connect(bus);oscillator.start(time);oscillator.stop(time+duration+0.02);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  }
  function apply() {
    if(context) {
      musicGain.gain.setTargetAtTime(settings.music && !paused ? (player ? 0.12 : 0.32) : 0,context.currentTime,0.12);
      effectsGain.gain.setTargetAtTime(settings.effects && !paused ? 0.3 : 0,context.currentTime,0.04);
    }
  }
  function start() {
    if(!context) {
      const Constructor=window.AudioContext||window.webkitAudioContext;
      if(!Constructor) return;
      context=new Constructor();musicGain=context.createGain();effectsGain=context.createGain();
      musicGain.connect(context.destination);effectsGain.connect(context.destination);
      // Original sparse pentatonic plucks; no downloaded or copyrighted recording.
      const melody=[293.66,0,349.23,392,0,523.25,440,0,392,349.23,0,293.66,261.63,0,293.66,0];
      setInterval(()=>{
        if(paused || !settings.music || context.state!=="running") return;
        const frequency=melody[note++%melody.length],time=context.currentTime+0.02;
        if(frequency) {tone(frequency,time,2.1,0.14,musicGain);tone(frequency*2,time,0.6,0.025,musicGain);}
      },850);
    }
    context.resume().catch(()=>{});apply();
  }
  function stopVoice() {
    generation++; if(player) {player.pause?.();player=null;} synth?.cancel();
    if(finish) {const done=finish;finish=null;done();} apply();
  }
  function speak(text, role={}) {
    stopVoice();
    if(!settings.voice || paused) return Promise.resolve();
    const token=generation;
    const voice=voiceForRole(role,settings.heroVoice);
    lastVoice=voice;
    lastText=text;
    return new Promise(resolve=>{
      let timeout;
      const done=()=>{
        clearTimeout(timeout);
        if(token===generation) {player=null;finish=null;apply();}
        resolve();
      };
      finish=done;
      const clip=library[voice+"|"+text];
      if(clip) {
        lastSource="embedded-neural-tts";
        player=new Audio(clip);player.volume=0.9;
        player.onended=()=>{ended++;done();};player.onerror=done;player.play().then(()=>{
          played++;recent.push({text,voice});if(recent.length>12)recent.shift();
        }).catch(done);
      } else if(synth && window.SpeechSynthesisUtterance) {
        lastSource="device-tts";
        const utterance=new SpeechSynthesisUtterance(text);utterance.lang="zh-CN";
        const voices=synth.getVoices().filter(v=>/^zh[-_](CN|Hans)/i.test(v.lang));
        utterance.voice=voices.find(v=>v.name.includes(voice.replace("zh-CN-","").replace("Neural",""))) || voices[0] || null;
        utterance.pitch=role.player || ["aya","doudou"].includes(role.id) ? 1.15 : role.id==="granny" ? 0.9 : 1;
        utterance.rate=role.id==="granny" ? 0.85 : 1;
        utterance.onend=done;utterance.onerror=done;player=utterance;synth.speak(utterance);
      } else {done();return;}
      timeout=setTimeout(()=>{if(token===generation){player?.pause?.();synth?.cancel();}done();},Math.max(12000,text.length*400));apply();
    });
  }
  return {settings,start,speak,stopVoice,
    setHeroVoice(value){if(["auto","male","female"].includes(value)){settings.heroVoice=value;try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{}}},
    toggle(key) {settings[key]=!settings[key];try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{} if(key==="voice"&&!settings.voice)stopVoice();apply();},
    pause(value) {paused=value;if(value)stopVoice();apply();},
    effect(kind) {if(!settings.effects||paused)return;start();const time=context?.currentTime;if(time===undefined)return;
      if(kind==="step") tone(100+Math.random()*35,time,0.055,0.035,effectsGain,"triangle");
      else if(kind==="drum") {tone(150,time,0.14,0.45,effectsGain);tone(77,time,0.18,0.3,effectsGain);}
      else {tone(523.25,time,0.25,0.16,effectsGain);tone(659.25,time+0.1,0.3,0.12,effectsGain);}
    },
    get speaking(){return !!player;},
    get embeddedClips(){return Object.keys(library).length;},
    get status(){return {speaking:!!player,embeddedClips:Object.keys(library).length,played,ended,lastVoice,lastSource,lastText,currentTime:player?.currentTime||0,recent:recent.map(line=>({...line})),musicNotes:note};},
  };
}
