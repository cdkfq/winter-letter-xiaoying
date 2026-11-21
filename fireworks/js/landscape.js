export function random(seed=318){let n=seed>>>0;return()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};}
export function glow(c,x,y,r,color,alpha=1){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(${color},${alpha})`);g.addColorStop(.3,`rgba(${color},${alpha*.25})`);g.addColorStop(1,`rgba(${color},0)`);c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
export class WinterLandscape{
  constructor(image){this.image=image;this.lampLit=true;this.anchors={};}
  async load(){try{await this.image.decode();}catch{document.body.classList.add('art-fallback');}}
  resize(w,h,dpr){
    this.w=w;this.h=h;this.dpr=dpr;this.narrow=w/h<.95;
    const iw=this.narrow?1024:1536,ih=this.narrow?1536:1024,scale=Math.max(w/iw,h/ih);
    this.scale=scale;this.offsetX=(w-iw*scale)*(this.narrow?.75:.5);this.offsetY=(h-ih*scale)*.5;this.iw=iw;this.ih=ih;
    const point=(x,y)=>({x:x*iw*scale+this.offsetX,y:y*ih*scale+this.offsetY});
    this.anchors={lamp:point(this.narrow?.844:.886,this.narrow?.57:.36),note:point(this.narrow?.555:.8,this.narrow?.84:.805)};
    this.skyBottom=point(.5,this.narrow?.57:.50).y;this.shoreY=point(.5,.67).y;
    this.water=this.narrow?[[.10,.67],[.59,.675],[.78,.73],[.65,.78],[.23,.86],[.08,.8]]:[[.10,.66],[.83,.65],[.83,.715],[.69,.78],[.49,.86],[.25,.88],[.09,.77]];
    for(const [key,p] of Object.entries(this.anchors)){
      const el=document.getElementById(key==='lamp'?'lamp-toggle':'note-open');el.style.left=Math.max(23,Math.min(w-23,p.x))+'px';el.style.top=Math.max(23,Math.min(h-145,p.y))+'px';
    }
    const lamp=this.anchors.lamp;document.documentElement.style.setProperty('--lamp-x',lamp.x+'px');document.documentElement.style.setProperty('--lamp-y',lamp.y+'px');
  }
  isWater(x,y){
    x=(x-this.offsetX)/(this.iw*this.scale);y=(y-this.offsetY)/(this.ih*this.scale);let inside=false;
    for(let i=0,j=this.water.length-1;i<this.water.length;j=i++){
      const a=this.water[i],b=this.water[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }return inside;
  }
  setLamp(value){this.lampLit=value;document.body.classList.toggle('lamp-dim',!value);}
}
