import { CONFIG } from 'winter/config';
import { WinterAudio } from 'winter/audio';
import { WinterLandscape,random } from 'winter/landscape';
import { Fireworks } from 'winter/fireworks';
const $=s=>document.querySelector(s),root=$('#night'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const audio=new WinterAudio(CONFIG.music),landscape=new WinterLandscape($('#scene-art'));
await Promise.allSettled([landscape.load(),document.fonts.load('32px WinterTitle'),document.fonts.load('16px WinterLetter')]);
const fireworks=new Fireworks($('#fireworks'),landscape,(kind,power,silent,position)=>{if(!silent)audio.effect(kind,power,position);});
const weather=$('#weather'),c=weather.getContext('2d'),touch=$('#sky-touch'),rng=random(291),snow=[];
let w=0,h=0,dpr=1,frameId=0,lastFrame=0,elapsed=0,ready=false,holding=null,captionTimer=0,focusBeforeNote=null,firstGesture=false,staticPaint=true;
let actualFrames=0,lastFpsSample=0,fps=0,oldStage='',openingStarted=false,snowEnergy=0,visibleSnow=0,preloadStarted=false;
function resize(){
  const width=root.clientWidth,height=root.clientHeight,ratio=Math.min(devicePixelRatio||1,CONFIG.maximumPixelRatio);if(w===width&&h===height&&dpr===ratio)return;
  w=width;h=height;dpr=ratio;landscape.resize(w,h,dpr);fireworks.resize(w,h,dpr);weather.width=Math.round(w*dpr);weather.height=Math.round(h*dpr);c.setTransform(dpr,0,0,dpr,0,0);
  snow.length=0;for(let i=0;i<Math.min(640,Math.max(300,w*h/2300));i++)snow.push({x:rng()*w,y:rng()*h,z:rng(),phase:rng()*Math.PI*2,drift:rng()});
  fireworks.reduced=reduced.matches;staticPaint=true;oldStage='';
}
function say(text,duration=6000){clearTimeout(captionTimer);$('#caption').textContent=text;$('#status').textContent=text;if(duration)captionTimer=setTimeout(()=>$('#caption').textContent='雪慢慢落，我们慢慢看。',duration);}
function awaken(){audio.unlock().catch(()=>{});if(!firstGesture){firstGesture=true;if(!audio.wantsMusic)audio.play();}}
function fire(x,y,power=1){awaken();fireworks.time=elapsed;if(fireworks.manual(x,y,power)){say(power>1.35?'这一朵，攒得久一点，也亮得久一点。':'星火正向你点的那片天空飞去。');staticPaint=true;}}
touch.addEventListener('pointerdown',event=>{if(holding||event.button>0)return;event.preventDefault();audio.unlock().catch(()=>{});holding={id:event.pointerId,x:event.clientX,y:event.clientY,start:performance.now()};touch.setPointerCapture(event.pointerId);});
touch.addEventListener('pointermove',event=>{if(holding&&holding.id===event.pointerId){holding.x=event.clientX;holding.y=event.clientY;}});
touch.addEventListener('pointerup',event=>{if(!holding||holding.id!==event.pointerId)return;const press=holding;holding=null;fireworks.charge=null;const duration=(performance.now()-press.start)/1000;fire(event.clientX,event.clientY,1+Math.min(1,duration/1.6)*.8);});
for(const type of ['pointercancel','lostpointercapture'])touch.addEventListener(type,()=>{holding=null;fireworks.charge=null;staticPaint=true;});
touch.addEventListener('keydown',event=>{if(event.code==='Space'||event.code==='Enter'){event.preventDefault();if(!event.repeat)fire(w*(.3+Math.random()*.4),h*(.3+Math.random()*.2),1.15);}});
$('#launch').addEventListener('click',()=>{awaken();fireworks.time=elapsed;if(fireworks.showStarted!==null){fireworks.stopShow();say('让夜空，歇一小会儿。');}else{fireworks.show();say('先点亮一束，再慢慢铺满这片天空。',9000);}staticPaint=true;});
$('#music-toggle').addEventListener('click',()=>{audio.unlock().catch(()=>{});audio.toggle();firstGesture=true;});
$('#sound-toggle').addEventListener('click',()=>{audio.unlock().catch(()=>{});audio.setMuted(!audio.muted);});
$('#lamp-toggle').addEventListener('click',()=>{landscape.setLamp(!landscape.lampLit);$('#lamp-toggle').setAttribute('aria-pressed',String(landscape.lampLit));$('#lamp-toggle').setAttribute('aria-label',landscape.lampLit?'调暗湖岸的路灯':'把湖岸的路灯调亮');audio.effect('switch');say(landscape.lampLit?'给雪地，留一盏暖灯。':'灯暗一点，烟花就更清楚了。');staticPaint=true;});
const note=$('#note-dialog');$('#note-open').addEventListener('click',()=>{focusBeforeNote=document.activeElement;audio.effect('paper');note.showModal();});
note.addEventListener('close',()=>focusBeforeNote?.focus({preventScroll:true}));note.addEventListener('click',event=>{if(event.target===note){const r=note.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)note.close();}});
audio.addEventListener('statechange',({detail:{status,muted,wantsMusic}})=>{
  document.body.classList.toggle('is-playing',status==='playing');document.body.classList.toggle('is-loading',['loading','retrying'].includes(status));document.body.classList.toggle('is-muted',muted);
  $('#music-toggle').setAttribute('aria-pressed',String(wantsMusic));$('#music-toggle').setAttribute('aria-label',wantsMusic?'暂停音乐':'播放冯提莫的 What Are Words');$('#sound-toggle').setAttribute('aria-pressed',String(muted));$('#sound-toggle').setAttribute('aria-label',muted?'打开声音':'关闭声音');
  $('#music-label').textContent=status==='loading'?'准备音乐…':status==='retrying'?'继续载歌…':status==='offline'?'等待网络':status==='ready'?'播放音乐':status==='playing'?'What Are Words':status==='error'?'继续下载':'听首歌';
  $('#music-status').textContent=['loading','retrying'].includes(status)?'音乐正在准备，烟花可以先放。':status==='offline'?'网络断开了，恢复后继续准备音乐。':status==='error'?'音乐下载中断，已保留进度，点右上角继续。':status==='ready'?'音乐已准备好，点一下就能听。':status==='paused'?'音乐歇一会儿，烟花继续。':'What Are Words · 冯提莫';if(status==='playing')say('歌慢慢响起来了。',5000);staticPaint=true;
});
function updateWeather(dt){snowEnergy+=(fireworks.intensity-snowEnergy)*(1-Math.exp(-dt*1.6));}
function drawWeather(dt){
  c.clearRect(0,0,w,h);c.fillStyle='#e2eaf6';visibleSnow=0;const density=.22+.78*snowEnergy;
  for(let i=0;i<snow.length;i++){
    const p=snow[i];if(reduced.matches&&i%4)continue;
    if(!reduced.matches){p.y+=dt*(9+p.z*p.z*31)*(1+snowEnergy*.8);p.x+=dt*(2+p.drift*5+Math.sin(elapsed*.18+p.phase)*5)*(1+snowEnergy*.65);if(p.y>h+12){p.y=-12;p.x=rng()*w;}if(p.x>w+12)p.x=-12;}
    const visibility=Math.min(1,Math.max(0,(density-i/snow.length)*18));if(!visibility)continue;++visibleSnow;
    c.globalAlpha=(.13+p.z*.42)*visibility;const radius=(.5+p.z*p.z*2.5)*(1+snowEnergy*.85);
    if(p.z>.88){c.beginPath();for(let j=0;j<3;j++){const a=j*Math.PI/3+(reduced.matches?0:elapsed*.08)+p.phase,xx=Math.cos(a)*radius,yy=Math.sin(a)*radius;c.moveTo(p.x-xx,p.y-yy);c.lineTo(p.x+xx,p.y+yy);}c.strokeStyle='#e3edf6';c.lineWidth=.65;c.stroke();}else{c.beginPath();c.arc(p.x,p.y,radius,0,Math.PI*2);c.fill();}
  }c.globalAlpha=1;$('#snow-light').style.opacity=String(fireworks.light.intensity*.13);
}
audio.addEventListener('progress',()=>{if(['loading','retrying'].includes(audio.status))$('#music-label').textContent=(audio.status==='retrying'?'续载 ':'载歌 ')+Math.min(100,Math.floor(audio.receivedBytes/audio.loader.totalBytes*100))+'%';});
const labels={idle:'从一束微光，到满天绽放',kindling:'零星升空，雪也轻轻落',gathering:'星火相逢，雪渐渐密了',blooming:'花开成簇，雪落得更大',finale:'满天烟花，赴一场盛大的雪',afterglow:'余光落下，下一场正在路上'};
function updateShow(){const active=fireworks.showStarted!==null;if(oldStage!==fireworks.stage){oldStage=fireworks.stage;$('#show-stage').textContent=labels[oldStage];$('#launch-label').textContent=active?'暂停这场烟花':'点燃这场烟花';$('#launch').setAttribute('aria-pressed',String(active));document.body.classList.toggle('show-running',active);}$('#show-progress').style.transform=`scaleX(${active?Math.min(1,fireworks.showElapsed/fireworks.showDuration):0})`;}
function frame(now){
  frameId=0;if(document.hidden)return;frameId=requestAnimationFrame(frame);if(now-lastFrame<1000/CONFIG.maximumFps-.4)return;
  const dt=Math.min(.06,(now-lastFrame)/1000||.016);lastFrame=now;elapsed+=dt;actualFrames++;if(now-lastFpsSample>=1000){fps=actualFrames*1000/(now-lastFpsSample);actualFrames=0;lastFpsSample=now;}
  if(reduced.matches&&!staticPaint)return;
  if(holding&&!reduced.matches)fireworks.setCharge(holding.x,holding.y,Math.min(1,(now-holding.start)/1600));
  if(!reduced.matches){fireworks.update(dt,elapsed);fireworks.draw();}updateWeather(dt);drawWeather(dt);updateShow();staticPaint=false;
  if(!ready){ready=true;requestAnimationFrame(()=>document.body.classList.add('is-ready'));}
  if(!openingStarted&&!reduced.matches&&elapsed>1.8){openingStarted=true;fireworks.launch(w*.67,h*.37,.95,{color:0,type:'willow',silent:true});}
}
window.addEventListener('resize',resize);new ResizeObserver(resize).observe(root);
reduced.addEventListener('change',()=>{fireworks.reduced=reduced.matches;fireworks.stopShow();fireworks.rockets.length=0;fireworks.sparks.length=0;fireworks.halos.length=0;fireworks.renderer.clear();holding=null;fireworks.charge=null;staticPaint=true;});
function resumeFrames(){lastFrame=performance.now();staticPaint=true;if(!frameId)frameId=requestAnimationFrame(frame);}
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frameId);frameId=0;holding=null;fireworks.charge=null;}else resumeFrames();});
window.addEventListener('pagehide',()=>{audio.pause();if(audio.context){audio.context.close().catch(()=>{});audio.context=null;}firstGesture=false;cancelAnimationFrame(frameId);frameId=0;});window.addEventListener('pageshow',event=>{if(event.persisted)resumeFrames();});
resize();lastFrame=performance.now();lastFpsSample=lastFrame;frameId=requestAnimationFrame(frame);
setTimeout(()=>{preloadStarted=true;audio.preload().catch(()=>{});},700);
if(new URLSearchParams(location.search).has('debug'))window.winter={audio,landscape,fireworks,advance(seconds){for(let i=0;i<Math.ceil(seconds*60);i++){elapsed+=1/60;fireworks.update(1/60,elapsed);updateWeather(1/60);}fireworks.draw();drawWeather(0);updateShow();},snapshot:()=>({ready,width:w,height:h,dpr,reducedMotion:reduced.matches,time:elapsed,fps,maximumFps:CONFIG.maximumFps,art:$('#scene-art').currentSrc,fireworks:fireworks.snapshot(),weather:{intensity:snowEnergy,visible:visibleSnow,maximum:snow.length,maxRadius:3*(1+snowEnergy*.85)},music:audio.snapshot(),lampLit:landscape.lampLit,noteOpen:note.open})};
