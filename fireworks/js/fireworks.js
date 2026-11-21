import { CONFIG } from 'winter/config';
import { random } from 'winter/landscape';
import { SparkRenderer } from 'winter/renderer';
const TAU=Math.PI*2;
export class Fireworks{
  constructor(canvas,landscape,onSound){
    this.renderer=new SparkRenderer(canvas,CONFIG.maximumParticles);this.canvas=canvas;this.landscape=landscape;this.onSound=onSound;this.rng=random(866);
    this.rockets=[];this.sparks=[];this.halos=[];this.scheduled=[];this.count=0;this.burstCount=0;this.time=0;this.charge=null;this.reduced=false;this.lastPower=0;
    this.light={x:0,intensity:0,color:CONFIG.fireworkPalette[0]};this.showStarted=null;this.showDuration=43;this.lastBurst=null;this.stage='idle';this.lastDirect=-10;
  }
  resize(w,h,dpr){this.w=w;this.h=h;this.dpr=dpr;this.renderer.resize(w,h,dpr);this.stopShow();this.rockets.length=0;this.sparks.length=0;this.halos.length=0;this.charge=null;}
  safeTarget(x,y){return{x:Math.max(1,Math.min(this.w-1,x)),y:Math.max(1,Math.min(this.h-1,y))};}
  direct(x,y,power=1,options={}){
    if(this.time-this.lastDirect<.085)return false;this.lastDirect=this.time;
    const p=this.safeTarget(x,y);++this.count;this.lastPower=power;
    const shell={...p,power,color:options.color??this.count%CONFIG.fireworkPalette.length,type:power>1.35?'willow':['peony','silver','willow','dahlia'][this.count%4],silent:options.silent};
    if(this.reduced)this.staticBurst(shell);else this.burst(shell);return true;
  }
  launch(x,y,power=1,options={}){
    if(this.rockets.length>=22)return false;
    const p=this.safeTarget(x,y);++this.count;this.lastPower=power;
    const shell={...p,power,color:options.color??this.count%CONFIG.fireworkPalette.length,type:options.type??'willow',silent:options.silent};
    if(this.reduced){this.staticBurst(shell);return true;}
    const sx=options.sx??this.w*(.22+this.rng()*.56),sy=this.landscape.shoreY;
    this.rockets.push({...shell,tx:p.x,ty:p.y,x:sx,y:sy,sx,sy,age:0,duration:.8+this.rng()*.38,trail:[]});this.onSound?.('launch',power,shell.silent);return true;
  }
  show(silent=false){
    if(this.showStarted!==null)return false;
    if(this.reduced){this.direct(this.w*.52,this.h*.4,1.5,{color:0,silent});return true;}
    this.showStarted=this.time;this.stage='kindling';const shots=[];
    const volley=(at,n,power,spread)=>{for(let i=0;i<n;i++){
      const x=n===1?.5:(.07+i/(n-1)*.86),jitter=(this.rng()-.5)*.055;
      shots.push({at:this.time+at+i*.075,x:(.5+(x-.5)*spread+jitter)*this.w,y:(.16+this.rng()*.26)*this.h,power:power*(.84+this.rng()*.27),color:(i+Math.floor(at/3))%4,type:['willow','peony','silver','dahlia'][(i+Math.floor(at))%4],silent,sx:this.w*(.17+i/Math.max(1,n-1)*.66)});
    }};
    [0,3.0,6.0].forEach(t=>volley(t,1,.9,.45));[9,11.7,14.4,17.1].forEach(t=>volley(t,2,1.0,.85));
    [20,22.2,24.4,26.6,28.8].forEach(t=>volley(t,4,1.05,1));[31,32.8,34.6,36.4,38.2,40].forEach(t=>volley(t,7,1.13,1));
    volley(41.3,9,1.3,1);this.scheduled.push(...shots.sort((a,b)=>a.at-b.at));return true;
  }
  stopShow(){this.scheduled.length=0;this.showStarted=null;this.stage='idle';}
  burst(shell){
    const{x,y,power,color,type,silent}=shell,rng=this.rng;++this.burstCount;this.lastBurst={x,y,power,type,at:this.time};
    const scale=Math.min(this.w,this.h)*.00135,limit=this.renderer.mode==='webgl'?CONFIG.maximumParticles:2200;
    const amount=Math.min(Math.round((type==='willow'?200:165)*power),Math.max(0,limit-this.sparks.length));
    for(let i=0;i<amount;i++){
      const angle=i*2.3999632297+rng()*.13,depth=1-2*(i+.5)/amount,radius=Math.sqrt(1-depth*depth),layer=.68+rng()*.32;
      const speed=(type==='willow'?190:type==='dahlia'?235:215)*scale*power*layer,life=(type==='willow'?3.6:2.25)+rng()*.9,willow=type==='willow';
      this.sparks.push({x,y,vx:Math.cos(angle)*radius*speed,vy:Math.sin(angle)*radius*speed,age:0,life,color,phase:rng()*TAU,willow,twinkle:type==='silver'||i%7===0,gravity:(willow?27:32)*scale,drag:willow?.54:.85,size:(.7+rng()*.65)*Math.max(.7,scale),history:new Float32Array((willow?18:10)*2),historySize:willow?18:10,index:0,samples:0,clock:0,reflect:i%3===0});
    }
    this.halos.push({x,y,power,color,age:0,life:.6});this.light={x,intensity:Math.min(1,.45*power),color:CONFIG.fireworkPalette[color]};this.onSound?.('burst',power,silent);
  }
  staticBurst(shell){this.sparks.length=0;this.rockets.length=0;this.halos.length=0;this.burst(shell);this.update(.6,this.time);for(const p of this.sparks)p.vx=p.vy=0;this.draw();this.sparks.length=0;}
  setCharge(x,y,amount){this.charge={x,y,amount};}
  update(dt,time){
    this.time=time;while(this.scheduled.length&&time>=this.scheduled[0].at){const shot=this.scheduled.shift();this.launch(shot.x,shot.y,shot.power,shot);}
    if(this.showStarted!==null){const t=time-this.showStarted;this.stage=t<9?'kindling':t<20?'gathering':t<31?'blooming':t<43?'finale':'afterglow';if(t>48){this.showStarted=null;this.stage='idle';}}
    this.light.intensity*=Math.exp(-dt*2.5);
    for(let i=this.rockets.length-1;i>=0;i--){const r=this.rockets[i];r.age+=dt;const t=Math.min(1,r.age/r.duration),e=1-(1-t)**1.6;r.x=r.sx+(r.tx-r.sx)*e;r.y=r.sy+(r.ty-r.sy)*e;r.trail.unshift({x:r.x,y:r.y});if(r.trail.length>14)r.trail.pop();if(t===1){this.burst(r);this.rockets.splice(i,1);}}
    for(let i=this.sparks.length-1;i>=0;i--){
      const p=this.sparks[i];p.age+=dt;if(p.age>p.life){this.sparks[i]=this.sparks[this.sparks.length-1];this.sparks.pop();continue;}
      p.vx*=Math.exp(-p.drag*dt);p.vy*=Math.exp(-p.drag*dt);p.vy+=p.gravity*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.clock+=dt;
      if(p.clock>=.033){p.clock%=.033;p.history[p.index*2]=p.x;p.history[p.index*2+1]=p.y;p.index=(p.index+1)%p.historySize;p.samples=Math.min(p.samples+1,p.historySize);}
    }
    for(let i=this.halos.length-1;i>=0;i--){const halo=this.halos[i];halo.age+=dt;if(halo.age>halo.life)this.halos.splice(i,1);}
  }
  draw(){
    const r=this.renderer;r.begin();const palette=CONFIG.fireworkPalette,w=this.w,h=this.h;
    for(const rocket of this.rockets){for(let j=1;j<rocket.trail.length;j++)r.line(rocket.trail[j-1].x,rocket.trail[j-1].y,rocket.trail[j].x,rocket.trail[j].y,palette[0],(1-j/rocket.trail.length)*.8);r.point(rocket.x,rocket.y,9,palette[0],1);}
    for(const p of this.sparks){
      const t=p.age/p.life,fade=Math.min(1,p.age*18)*Math.pow(1-t,p.willow?.65:1.2),flicker=p.twinkle&&t>.45?.25+.75*Math.max(0,Math.sin(p.age*28+p.phase)):1,alpha=fade*flicker,color=palette[p.color];if(alpha<.01)continue;
      let x=p.x,y=p.y;for(let j=0;j<p.samples;j++){const ix=(p.index-1-j+p.historySize)%p.historySize,nx=p.history[ix*2],ny=p.history[ix*2+1],a=alpha*(1-j/p.samples)*.64;r.line(x,y,nx,ny,color,a,a*.85);x=nx;y=ny;}
      r.point(p.x,p.y,(p.twinkle?7:5.3)*p.size,color,alpha);
      if(p.reflect){const yy=this.landscape.shoreY+(h*.55-p.y)*.28+(Math.sin(p.phase)*.04+.03)*h,xx=p.x+Math.sin(yy*.19+this.time*1.2)*3;if(this.landscape.isWater(xx,yy))r.line(xx-3-p.size*3,yy,xx+3+p.size*3,yy,color,alpha*.22);}
    }
    for(const p of this.halos)r.point(p.x,p.y,Math.min(w,h)*(.05+p.age*.1)*p.power,palette[p.color],(1-p.age/p.life)**2*.5);
    if(this.charge){const{x,y,amount}=this.charge;r.point(x,y,20+amount*45,palette[0],.5);for(let i=0;i<18;i++){const a=i/18*TAU+this.time*1.4,rr=12+17*(1-amount);r.point(x+Math.cos(a)*rr,y+Math.sin(a)*rr,4,palette[0],.6);}}
    r.finish();
  }
  snapshot(){return{launched:this.count,bursts:this.burstCount,rockets:this.rockets.length,particles:this.sparks.length,scheduled:this.scheduled.length,charged:!!this.charge,lastPower:this.lastPower,lastBurst:this.lastBurst,stage:this.stage,showElapsed:this.showStarted===null?0:this.time-this.showStarted,showDuration:this.showDuration,renderer:this.renderer.mode};}
}
