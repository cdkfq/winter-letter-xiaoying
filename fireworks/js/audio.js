import { MusicLoader } from 'winter/music-loader';

export class WinterAudio extends EventTarget {
  constructor(config) {
    super(); this.config=config; this.context=null; this.effects=null; this.musicGain=null;this.master=null;
    this.buffer=null; this.source=null; this.pending=null; this.status='idle';
    this.wantsMusic=false; this.muted=false; this.offset=0; this.startedAt=0;
    this.volumeTarget=config.volume; this.lastEffect=-10; this.effectCount=0; this.attempt=0;
    this.receivedBytes=0;this.downloadAttempt=0;this.lastError=null;
    this.downloadData=null;this.selectedSource=null;this.noiseBuffers=new Map();this.burstEffects=0;this.recoveryTimer=0;this.recoveryRound=0;
    this.loader=new MusicLoader(config,state=>{
      this.receivedBytes=this.loader.receivedBytes;this.downloadAttempt=this.loader.retries+1;
      if(!this.source&&['loading','retrying','offline'].includes(state)&&this.status!==state)this.update(state);
      this.dispatchEvent(new Event('progress'));
    });
    this.onlineHandler=()=>{if(['error','offline'].includes(this.status)){if(this.wantsMusic)this.play();else this.preload().catch(()=>{});}};
    window.addEventListener('online',this.onlineHandler);
  }
  update(status) { this.status=status; this.dispatchEvent(new CustomEvent('statechange',{detail:{status,muted:this.muted,wantsMusic:this.wantsMusic}})); }
  async unlock() {
    if(!this.context){
      const AudioContext=window.AudioContext||window.webkitAudioContext;
      if(!AudioContext)throw new Error('AudioContext is unavailable');
      this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=this.muted?0:1;this.master.connect(this.context.destination);
      this.effects=this.context.createGain();this.effects.gain.value=.34;
      const limiter=this.context.createDynamicsCompressor();limiter.threshold.value=-16;limiter.knee.value=12;limiter.ratio.value=5;limiter.attack.value=.003;limiter.release.value=.22;
      this.effects.connect(limiter);limiter.connect(this.master);
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
      await this.preload();
      try{this.buffer=await this.context.decodeAudioData(this.downloadData.slice(0));}
      catch(error){
        this.loader.record(error,{phase:'decode',source:this.selectedSource?.src});
        this.loader.sourceIndex=this.loader.sourceIndex?0:1;this.downloadData=null;
        await this.preload();this.buffer=await this.context.decodeAudioData(this.downloadData.slice(0));
      }
      if(this.buffer.duration<Math.max(10,this.config.durationSeconds-.5))throw new Error('Music recording is incomplete');
      if(this.wantsMusic&&attempt===this.attempt)this.start();
      else if(!this.source)this.update('paused');
    }catch(error){
      this.lastError=error.message;
      console.warn('Background music:',error.message);
      if(attempt===this.attempt){this.update(navigator.onLine?'error':'offline');this.recover();}
    }
  }
  async preload(){
    if(this.downloadData)return this.downloadData;
    if(!this.pending)this.pending=this.loader.load().then(({data,source})=>{
      this.downloadData=data;this.selectedSource=source;this.lastError=null;this.recoveryRound=0;clearTimeout(this.recoveryTimer);
      if(!this.source)this.update(this.wantsMusic?'loading':'ready');return data;
    }).catch(error=>{this.lastError=error.message;if(!this.source)this.update(navigator.onLine?'error':'offline');throw error;}).finally(()=>{this.pending=null;});
    return this.pending;
  }
  recover(){
    if(!this.wantsMusic||!navigator.onLine||this.recoveryRound>=3)return;
    clearTimeout(this.recoveryTimer);const delay=[2500,7000,15000][this.recoveryRound++];
    this.update('retrying');this.recoveryTimer=setTimeout(()=>{if(this.wantsMusic)this.play();},delay);
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
    this.wantsMusic=false;++this.attempt;clearTimeout(this.recoveryTimer);
    if(this.source){this.offset=(this.offset+this.context.currentTime-this.startedAt)%this.buffer.duration;const old=this.source;this.source=null;old.stop();old.disconnect();}
    if(this.context){const now=this.context.currentTime;this.musicGain.gain.cancelScheduledValues(now);this.musicGain.gain.setValueAtTime(0,now);}
    this.update('paused');
  }
  toggle(){if(['error','offline'].includes(this.status))this.play();else if(this.wantsMusic)this.pause();else this.play();}
  setMuted(muted){
    this.muted=muted;
    if(this.context){const now=this.context.currentTime,param=this.master.gain;if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(now);else{const value=param.value;param.cancelScheduledValues(now);param.setValueAtTime(value,now);}param.linearRampToValueAtTime(muted?0:1,now+(muted?.035:.35));}
    this.update(this.status);
  }
  async effect(kind,power=1,position=.5){
    try{await this.unlock();}catch{return;}
    if(this.muted)return;
    const now=this.context.currentTime;if(now-this.lastEffect<.055)return;this.lastEffect=now;++this.effectCount;
    if(kind==='launch'){this.noise(.65,1800,.14,position);this.tone(380,.55,.035,'sine',1200,position);}
    else if(kind==='burst'){
      ++this.burstEffects;const p=Math.min(power,1.7);
      this.tone(82-power*12,.9,.7*p,'sine',28,position);
      this.noise(.44,240,.58*p,position);this.noise(1.25,2200,.24*p,position);
      this.crackle(.95,.20*p,position);
    }
    else if(kind==='crackle')this.crackle(.5,.11*Math.min(power,1.4),position);
    else if(kind==='paper')this.noise(.11,1600,.075);
    else if(kind==='switch'){this.tone(720,.055,.045,'sine',320);}
  }
  output(position){const ctx=this.context;if(!ctx.createStereoPanner)return this.effects;const pan=ctx.createStereoPanner();pan.pan.value=Math.max(-.7,Math.min(.7,(position-.5)*1.4));pan.connect(this.effects);return pan;}
  tone(frequency,duration,gain,type='sine',endFrequency,position=.5){
    const ctx=this.context,now=ctx.currentTime,osc=ctx.createOscillator(),env=ctx.createGain();
    osc.type=type;osc.frequency.setValueAtTime(frequency,now);if(endFrequency)osc.frequency.exponentialRampToValueAtTime(endFrequency,now+duration);
    env.gain.setValueAtTime(0,now);env.gain.linearRampToValueAtTime(gain,now+.008);env.gain.exponentialRampToValueAtTime(.0001,now+duration);
    const output=this.output(position);osc.connect(env);env.connect(output);osc.start(now);osc.stop(now+duration+.02);
    osc.onended=()=>{osc.disconnect();env.disconnect();if(output!==this.effects)output.disconnect();};
  }
  noise(duration,cutoff,gain,position=.5){
    const ctx=this.context,now=ctx.currentTime;let buffer=this.noiseBuffers.get(duration);
    if(!buffer){buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate);const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;this.noiseBuffers.set(duration,buffer);}
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),env=ctx.createGain();source.buffer=buffer;
    filter.type='bandpass';filter.frequency.value=cutoff;filter.Q.value=.7;env.gain.setValueAtTime(gain,now);env.gain.exponentialRampToValueAtTime(.0001,now+duration);
    const output=this.output(position);source.connect(filter);filter.connect(env);env.connect(output);source.start();source.onended=()=>{source.disconnect();filter.disconnect();env.disconnect();if(output!==this.effects)output.disconnect();};
  }
  crackle(duration,gain,position=.5){
    const ctx=this.context;let buffer=this.noiseBuffers.get('crackle'+duration);
    if(!buffer){buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate);const data=buffer.getChannelData(0);
      for(let i=0;i<18;i++){const at=Math.floor((.04+Math.random()*(duration-.08))*ctx.sampleRate),length=Math.floor(ctx.sampleRate*(.007+Math.random()*.016));for(let j=0;j<length&&at+j<data.length;j++)data[at+j]+=(Math.random()*2-1)*Math.exp(-j/(length*.15));}
      this.noiseBuffers.set('crackle'+duration,buffer);}
    const source=ctx.createBufferSource(),env=ctx.createGain(),output=this.output(position);source.buffer=buffer;env.gain.value=gain;source.connect(env);env.connect(output);source.start();source.onended=()=>{source.disconnect();env.disconnect();if(output!==this.effects)output.disconnect();};
  }
  snapshot(){return{status:this.status,wantsMusic:this.wantsMusic,muted:this.muted,hasBuffer:!!this.buffer,duration:this.buffer?.duration??0,offset:this.offset,contextState:this.context?.state??'none',gain:this.musicGain?.gain.value??0,outputGain:(this.musicGain?.gain.value??0)*(this.master?.gain.value??1),masterGain:this.master?.gain.value??1,receivedBytes:this.receivedBytes,totalBytes:this.loader.totalBytes,downloadAttempt:this.downloadAttempt,lastError:this.lastError,burstEffects:this.burstEffects,download:this.loader.snapshot()};}
}
