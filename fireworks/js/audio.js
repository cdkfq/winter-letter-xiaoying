export class WinterAudio extends EventTarget {
  constructor(config) {
    super(); this.config=config; this.context=null; this.effects=null; this.musicGain=null;this.master=null;
    this.buffer=null; this.source=null; this.pending=null; this.status='idle';
    this.wantsMusic=false; this.muted=false; this.offset=0; this.startedAt=0;
    this.volumeTarget=config.volume; this.lastEffect=-10; this.effectCount=0; this.attempt=0;
    this.receivedBytes=0;this.downloadAttempt=0;this.lastError=null;
  }
  update(status) { this.status=status; this.dispatchEvent(new CustomEvent('statechange',{detail:{status,muted:this.muted,wantsMusic:this.wantsMusic}})); }
  async unlock() {
    if(!this.context){
      const AudioContext=window.AudioContext||window.webkitAudioContext;
      if(!AudioContext)throw new Error('AudioContext is unavailable');
      this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=this.muted?0:1;this.master.connect(this.context.destination);
      this.effects=this.context.createGain();this.effects.gain.value=.2;this.effects.connect(this.master);
      this.musicGain=this.context.createGain();this.musicGain.gain.value=0;this.musicGain.connect(this.master);
    }
    if(this.context.state==='suspended')await this.context.resume();
  }
  async play() {
    this.wantsMusic=true;const attempt=++this.attempt;
    try{
      await this.unlock();
      if(!this.wantsMusic||attempt!==this.attempt)return;
      if(this.buffer){this.start();return;}
      this.update('loading');
      if(!this.pending)this.pending=this.download().finally(()=>{this.pending=null;});
      this.buffer=await this.pending;
      if(this.wantsMusic&&attempt===this.attempt)this.start();
      else if(!this.source)this.update('paused');
    }catch(error){
      this.lastError=error.message;
      console.warn('Background music:',error.message);
      if(attempt===this.attempt){this.wantsMusic=false;this.update('error');}
    }
  }
  async download(){
    const key=new URL(this.config.src,location.href).href;let cache=null;
    try{cache=await caches.open('winter-letter-music-v1');}catch{}
    const verify=async bytes=>{
      if(bytes.byteLength!==this.config.bytes)throw new Error('Music file is incomplete');
      if(globalThis.crypto?.subtle){const digest=await crypto.subtle.digest('SHA-256',bytes),hex=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');if(hex!==this.config.sha256)throw new Error('Music integrity check failed');}
    };
    let bytes;
    if(cache){try{const saved=await cache.match(key);if(saved){const data=await saved.arrayBuffer();await verify(data);bytes=data;}}catch{await cache.delete(key).catch(()=>{});}}
    if(!bytes){
      this.receivedBytes=0;const size=262144,total=this.config.bytes;
      const block=async(start,end)=>{
        for(let attempt=0;attempt<2;attempt++){
          this.downloadAttempt=attempt+1;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.config.downloadTimeoutMs);
          try{
            const response=await fetch(key,{headers:{Range:`bytes=${start}-${end}`},cache:'no-store',signal:controller.signal});
            if(!response.ok)throw new Error(`Music HTTP ${response.status}`);
            const data=await response.arrayBuffer();
            if(response.status===200){if(data.byteLength!==total)throw new Error('Music file is incomplete');return{data,full:true};}
            if(response.status!==206||response.headers.get('Content-Range')!==`bytes ${start}-${end}/${total}`||data.byteLength!==end-start+1)throw new Error('Music range is incomplete');
            return{data,full:false};
          }catch(error){if(attempt||!this.wantsMusic)throw error;}finally{clearTimeout(timer);}
        }
      };
      const first=await block(0,Math.min(total-1,size-1));
      if(first.full)bytes=first.data;
      else{
        const combined=new Uint8Array(total);combined.set(new Uint8Array(first.data),0);this.receivedBytes=first.data.byteLength;this.dispatchEvent(new Event('progress'));
        let next=size,failed=false;
        const worker=async()=>{while(next<total&&!failed){const start=next;next+=size;try{const part=await block(start,Math.min(total-1,start+size-1));if(part.full)throw new Error('Server changed its range response');combined.set(new Uint8Array(part.data),start);this.receivedBytes+=part.data.byteLength;this.dispatchEvent(new Event('progress'));}catch(error){failed=true;throw error;}}};
        const outcomes=await Promise.allSettled([worker(),worker(),worker(),worker()]);const failure=outcomes.find(row=>row.status==='rejected');if(failure)throw failure.reason;bytes=combined.buffer;
      }
      await verify(bytes);if(cache)try{await cache.put(key,new Response(bytes.slice(0),{headers:{'Content-Type':'audio/mpeg'}}));}catch{}
    }
    this.receivedBytes=bytes.byteLength;this.dispatchEvent(new Event('progress'));
    const buffer=await this.context.decodeAudioData(bytes);if(buffer.duration<Math.max(10,this.config.durationSeconds-.5))throw new Error('Music recording is incomplete');return buffer;
  }
  start(){
    if(!this.wantsMusic||!this.buffer||this.source)return;
    const now=this.context.currentTime;
    const source=this.context.createBufferSource();source.buffer=this.buffer;source.loop=true;source.connect(this.musicGain);
    this.musicGain.gain.cancelScheduledValues(now);this.musicGain.gain.setValueAtTime(0,now);
    this.musicGain.gain.linearRampToValueAtTime(this.volumeTarget,now+this.config.fadeInSeconds);
    source.start(0,this.offset%this.buffer.duration);this.source=source;this.startedAt=now;
    this.update('playing');
  }
  pause(){
    this.wantsMusic=false;++this.attempt;
    if(this.source){this.offset=(this.offset+this.context.currentTime-this.startedAt)%this.buffer.duration;const old=this.source;this.source=null;old.stop();old.disconnect();}
    if(this.context){const now=this.context.currentTime;this.musicGain.gain.cancelScheduledValues(now);this.musicGain.gain.setValueAtTime(0,now);}
    this.update('paused');
  }
  toggle(){if(this.wantsMusic)this.pause();else this.play();}
  setMuted(muted){
    this.muted=muted;
    if(this.context){const now=this.context.currentTime,param=this.master.gain;if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(now);else{const value=param.value;param.cancelScheduledValues(now);param.setValueAtTime(value,now);}param.linearRampToValueAtTime(muted?0:1,now+(muted?.035:.35));}
    this.update(this.status);
  }
  async effect(kind,power=1){
    try{await this.unlock();}catch{return;}
    if(this.muted)return;
    const now=this.context.currentTime;if(now-this.lastEffect<.075)return;this.lastEffect=now;++this.effectCount;
    if(kind==='launch'){this.noise(.55,1600,.12);this.tone(420,.42,.025,'sine',900);}
    else if(kind==='burst'){this.tone(64,.65,.31*Math.min(power,1.4),'sine',35);this.noise(.5,520,.26);this.noise(.95,3900,.09);}
    else if(kind==='paper')this.noise(.11,1600,.075);
    else if(kind==='switch'){this.tone(720,.055,.045,'sine',320);}
  }
  tone(frequency,duration,gain,type='sine',endFrequency){
    const ctx=this.context,now=ctx.currentTime,osc=ctx.createOscillator(),env=ctx.createGain();
    osc.type=type;osc.frequency.setValueAtTime(frequency,now);if(endFrequency)osc.frequency.exponentialRampToValueAtTime(endFrequency,now+duration);
    env.gain.setValueAtTime(0,now);env.gain.linearRampToValueAtTime(gain,now+.008);env.gain.exponentialRampToValueAtTime(.0001,now+duration);
    osc.connect(env);env.connect(this.effects);osc.start(now);osc.stop(now+duration+.02);
    osc.onended=()=>{osc.disconnect();env.disconnect();};
  }
  noise(duration,cutoff,gain){
    const ctx=this.context,now=ctx.currentTime,buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),env=ctx.createGain();source.buffer=buffer;
    filter.type='bandpass';filter.frequency.value=cutoff;filter.Q.value=.7;env.gain.setValueAtTime(gain,now);env.gain.exponentialRampToValueAtTime(.0001,now+duration);
    source.connect(filter);filter.connect(env);env.connect(this.effects);source.start();source.onended=()=>{source.disconnect();filter.disconnect();env.disconnect();};
  }
  snapshot(){return{status:this.status,wantsMusic:this.wantsMusic,muted:this.muted,hasBuffer:!!this.buffer,duration:this.buffer?.duration??0,offset:this.offset,contextState:this.context?.state??'none',gain:this.musicGain?.gain.value??0,outputGain:(this.musicGain?.gain.value??0)*(this.master?.gain.value??1),masterGain:this.master?.gain.value??1,receivedBytes:this.receivedBytes,totalBytes:this.config.bytes,downloadAttempt:this.downloadAttempt,lastError:this.lastError};}
}
