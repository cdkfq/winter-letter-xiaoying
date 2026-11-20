/* Winter postcard. Native Canvas is the artwork itself; no remote assets or libraries at runtime.
   Design dials: variance 6, motion 8, density 3. Forest green and champagne, an intimate winter letter.
   Layer scale: artwork 0, greeting/tree input 1, controls 2, celebration 3, toast 4, native dialogs top layer. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('scene');
  const ctx = canvas.getContext('2d', { alpha: true });
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motionQuery.matches;
  const TAU = Math.PI * 2;
  const FRAME_INTERVAL = 1000 / 120;
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const ease = v => { v = clamp(v); return v * v * (3 - 2 * v); };
  let seed = 241225;
  function random() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  let width, height, dpr, treeHeight, treeRadius, treeTop, treeBottom, centerX;
  let rotCos=1,rotSin=0;
  let rotation = .22, targetRotation = .22, time = 0, previous = 0, introStart = 0;
  let frameId = 0, active = true, drag = null, energy = 0, wishAt = -100, lastInteraction = 0;
  let nextFrameAt = 0;
  let wind=0,starMessageIndex=0;
  const meteors=[];
  const backdrop=document.createElement('canvas');
  const canopy=document.createElement('canvas');
  const ornamentAtlas=document.createElement('canvas');
  let snowSprite;
  let starLit = false;
  let savedWish = '';
  try { savedWish = localStorage.getItem('winter-postcard-wish') || ''; starLit = !!savedWish; } catch (_) {}
  const foliage = [], lights = [], ornaments = [], ribbon = [], motes = [], bursts = [], entranceDust = [];
  const sprites = {};
  const pineAtlas=document.createElement('canvas');
  const colors = { gold: [239,197,117], cream: [255,236,181], pale: [211,229,194], green: [101,166,112], red: [188,71,65], white: [224,237,221] };
  function sprite(name) {
    if (sprites[name]) return sprites[name];
    const s = document.createElement('canvas'); s.width = s.height = 64;
    const c = s.getContext('2d'); const [r,g,b] = colors[name];
    const grad = c.createRadialGradient(32,32,0,32,32,32);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(.065, `rgba(${r},${g},${b},.95)`);
    grad.addColorStop(.16, `rgba(${r},${g},${b},.32)`);
    grad.addColorStop(.4, `rgba(${r},${g},${b},.07)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    c.fillStyle = grad; c.fillRect(0,0,64,64); sprites[name] = s; return s;
  }
  Object.keys(colors).forEach(sprite);

  function radiusAt(t) {
    return Math.pow(Math.max(t,0),.88) * (.96+.035*Math.cos(t*TAU*7.2));
  }
  function makePineSprites() {
    // One atlas: eight hand drawn boughs, 32 cached directions. No per-needle work per frame.
    const cell=128;
    pineAtlas.width=32*cell;pineAtlas.height=8*cell;
    const atlas=pineAtlas.getContext('2d');
    const palettes=[['#102f22','#235439','#467a50','#8b9d6c'],['#123628','#2c6242','#59865a','#a1b17d'],['#193d2b','#3c6b45','#759061','#c1c497'],['#10291e','#204730','#40643e','#84966b']];
    for(let row=0;row<8;row++) {
      const [dark,mid,light,tip]=palettes[row%4];
      const s=document.createElement('canvas');s.width=s.height=cell;
      const c=s.getContext('2d');c.translate(64,64);c.lineCap='round';
      const bend=row<4?-1:1;
      c.strokeStyle=dark;c.lineWidth=3;c.beginPath();c.moveTo(-48,3);c.quadraticCurveTo(3,9*bend,51,-6);c.stroke();
      // Tapered, irregular needles with a dark underside and an illuminated edge.
      for(let i=0;i<48;i++) {
        const x=-46+i*2,y=Math.sin(i/47*Math.PI)*5*bend-i*.12;
        const length=(8+Math.sin((i+3)/53*Math.PI)*14)*(1+.13*Math.sin(i*3.1+row));
        for(const sign of [-1,1]) {
          const endX=x-8-Math.sin(i*2.7+row)*4,endY=y+sign*length;
          c.fillStyle=i%4===0?light:mid;
          c.beginPath();c.moveTo(x+1.2,y);c.quadraticCurveTo(x-2,y+sign*length*.7,endX,endY);c.quadraticCurveTo(x-6,y+sign*length*.45,x-1,y);c.fill();
          c.strokeStyle=dark;c.lineWidth=.65;c.beginPath();c.moveTo(x,y);c.lineTo(endX,endY);c.stroke();
          if(i%3===0) {c.strokeStyle=sign<0?light:mid;c.lineWidth=.6;c.beginPath();c.moveTo(x-3,y+sign*length*.48);c.lineTo(endX,endY);c.stroke();}
        }
      }
      // Side shoots break up the fern-like regularity of the earlier tree.
      for(let j=0;j<7;j++) {
        const x=-35+j*12,sign=j%2?-1:1,yy=Math.sin(j/6*Math.PI)*5*bend;
        c.strokeStyle=dark;c.lineWidth=1.3;c.beginPath();c.moveTo(x,yy);c.lineTo(x-10,yy+sign*23);c.stroke();
        for(let k=0;k<7;k++) {
          const px=x-k*1.45,py=yy+sign*k*3;
          c.strokeStyle=k%3===0?light:mid;c.lineWidth=1.15;
          c.beginPath();c.moveTo(px,py);c.lineTo(px-9,py+sign*4);c.moveTo(px,py);c.lineTo(px+3,py+sign*8);c.stroke();
        }
      }
      // Frost is deliberately sparse, so the foliage retains its deep green body.
      c.strokeStyle=tip;c.lineWidth=.7;
      for(let i=0;i<8;i++) {const x=-36+i*10;c.beginPath();c.moveTo(x,-11-(i%3)*3);c.lineTo(x-3,-13-(i%3)*3);c.stroke();}
      for(let turn=0;turn<32;turn++) {
        atlas.save();atlas.translate(turn*cell+64,row*cell+64);atlas.rotate(turn/32*TAU);atlas.drawImage(s,-64,-64);atlas.restore();
      }
    }
  }
  function createTree() {
    seed=241225;
    // Interleaved whorls, uneven tips and a dense inner crown make a continuous, living silhouette.
    for(let tier=0;tier<19;tier++) {
      const t=.014+tier/18*.91,count=8+Math.floor(tier*.47);
      for(let branch=0;branch<count;branch++) {
        const a=branch/count*TAU+tier*2.39996+(random()-.5)*.23;
        for(let k=0;k<5;k++) {
          const reach=.14+k*.205,r=radiusAt(t)*reach;
          const y=t+.047*Math.pow(reach,1.2)+(random()-.5)*.027;
          foliage.push({x:Math.cos(a)*r,z:Math.sin(a)*r,t:y,s:.78+random()*.38,color:Math.floor(random()*8),a,reach,tilt:(random()-.5)*.7,phase:random()*TAU});
        }
      }
    }
    for(let i=0;i<385;i++) {
      const t=.035+Math.pow(random(),.82)*.92,a=random()*TAU,r=radiusAt(t)*(.66+random()*.33);
      lights.push({x:Math.cos(a)*r,z:Math.sin(a)*r,t,s:1.05+random()*1.65,phase:random()*TAU,warm:random()>.07});
    }
    for(let i=0;i<390;i++) {
      const t=.035+i/389*.925,a=t*TAU*3.85+.24,r=radiusAt(t)*1.025;
      ribbon.push({x:Math.cos(a)*r,z:Math.sin(a)*r,t,s:i%6===0?1.8:.5,phase:i*.13});
    }
    for(let i=0;i<58;i++) {
      const t=.18+i/57*.75,a=i*2.39996+.43,r=radiusAt(t)*(.84+random()*.09);
      ornaments.push({x:Math.cos(a)*r,z:Math.sin(a)*r,t,s:3.9+random()*2.8,finish:i%9===0?3:i%4===0?1:i%5===0?2:0,type:i%17===9?'bow':i%5===2?'drop':'ball',phase:random()*TAU});
    }
    for(let i=0;i<142;i++) {
      const depth=random();
      motes.push({x:random(),y:random(),s:depth>.8?2.6+random()*2.2:depth>.45?1.2+random()*1.2:.45+random()*.8,depth,phase:random()*TAU});
    }
    for(let i=0;i<190;i++) {
      const t=random(),a=random()*TAU,r=radiusAt(t)*(.45+random()*.6);
      entranceDust.push({x:Math.cos(a)*r,z:Math.sin(a)*r,t,phase:random()*TAU,s:.55+random()*1.2,spread:.25+random()*.65});
    }
  }

  function makeSnowSprite() {
    const s=document.createElement('canvas');s.width=s.height=80;
    const c=s.getContext('2d');c.translate(40,40);c.strokeStyle='#e0ece2';c.lineWidth=2.2;c.lineCap='round';
    for(let i=0;i<6;i++) {
      c.save();c.rotate(i*TAU/6);c.beginPath();c.moveTo(0,0);c.lineTo(0,-29);
      for(const y of [-13,-21]){c.moveTo(0,y);c.lineTo(-6,y-5);c.moveTo(0,y);c.lineTo(6,y-5);}
      c.stroke();c.restore();
    }
    snowSprite=s;
  }

  function makeBackdrop() {
    backdrop.width=Math.round(width*dpr);backdrop.height=Math.round(height*dpr);
    const c=backdrop.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);
    const landscape=width>=700&&height<530;
    // A cached winter clearing: distant, misted pines and soft light along the sides.
    for(const [x,y,r,rgb,opacity] of [[.05,.34,.7,'115,151,119',.13],[1.03,.62,.55,'185,154,94',.09],[.17,.83,.58,'98,140,122',.13]]) {
      const g=c.createRadialGradient(width*x,height*y,0,width*x,height*y,width*r);
      g.addColorStop(0,`rgba(${rgb},${opacity})`);g.addColorStop(1,`rgba(${rgb},0)`);
      c.fillStyle=g;c.fillRect(0,0,width,height);
    }
    c.save();c.globalCompositeOperation='screen';
    for(let i=0;i<3;i++) {
      c.save();c.translate(width*(-.07+i*.47),height*.3);c.rotate(-.3+i*.12);c.scale(width*.24,height*.68);
      const g=c.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,'rgba(179,203,156,.037)');g.addColorStop(.45,'rgba(151,180,139,.02)');g.addColorStop(1,'rgba(116,154,123,0)');
      c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();
    }
    c.restore();
    const horizon=height*(landscape?.91:.86);
    c.save();c.filter='blur(2px)';
    for(let layer=0;layer<2;layer++) {
      for(let i=0;i<15;i++) {
        const x=width*((i/14)*1.24-.12+layer*.017);
        if(Math.abs(x-centerX)<treeRadius*1.1)continue;
        const h=height*(.08+((i*7+layer*5)%11)/11*.15),y=horizon+layer*19;
        c.fillStyle=layer?'rgba(3,19,13,.29)':'rgba(37,64,49,.19)';
        for(let branch=0;branch<5;branch++) {
          const top=y-h+branch*h*.14,half=h*(.1+branch*.03);
          c.beginPath();c.moveTo(x,top);c.lineTo(x-half,top+h*.37);c.quadraticCurveTo(x,top+h*.32,x+half,top+h*.37);c.closePath();c.fill();
        }
      }
    }
    c.restore();
    // Warm circles suggest lights far away, with a clear center reserved for the tree.
    for(let i=0;i<25;i++) {
      const left=i%2===0,edge=.03+((i*13)%23)/23*.2;
      const x=width*(left?edge:1-edge),y=height*(.31+((i*17)%29)/29*.59);
      if(Math.abs(x-centerX)<treeRadius*1.18&&y>treeTop)continue;
      const r=3+(i%5)*2.2,g=c.createRadialGradient(x,y,0,x,y,r*2.4);
      g.addColorStop(0,`rgba(224,198,140,${.04+(i%3)*.018})`);g.addColorStop(.4,'rgba(213,185,124,.028)');g.addColorStop(1,'rgba(213,185,124,0)');
      c.fillStyle=g;c.beginPath();c.arc(x,y,r*2.4,0,TAU);c.fill();
    }
    const mist=c.createLinearGradient(0,horizon-height*.15,0,height);
    mist.addColorStop(0,'rgba(18,44,34,0)');mist.addColorStop(.48,'rgba(58,84,63,.10)');mist.addColorStop(1,'rgba(8,28,20,0)');c.fillStyle=mist;c.fillRect(0,horizon-height*.15,width,height*.3);
  }

  function drawSnow(now,dt,foreground) {
    for(const p of motes) {
      const near=p.depth>.8;
      if(near!==foreground)continue;
      if(!reduced) {
        p.y=(p.y+dt*(.009+p.depth*.019))%1.06;
        p.x=(p.x+wind*dt*(.05+p.depth*.09)+1.1)%1.1;
      }
      const drift=reduced?Math.sin(p.phase)*5:Math.sin(now*.3+p.phase)*(7+p.depth*13);
      const x=p.x*width+drift,y=p.y*height-8;
      const inText=y>70&&y<treeTop-25&&Math.abs(x-width*.5)<width*.39;
      const alpha=(near?.52:.16+p.depth*.27)*(inText?.42:1);
      const size=p.s*(width<500?.86:1);
      if(near) {
        ctx.save();ctx.translate(x,y);ctx.rotate(p.phase+(reduced?0:now*.1));ctx.globalAlpha=alpha;
        const q=size*2.7;ctx.drawImage(snowSprite,-q/2,-q/2,q,q);ctx.restore();
      } else {
        ctx.globalAlpha=alpha;ctx.fillStyle='#d7e3d5';ctx.beginPath();ctx.arc(x,y,size,0,TAU);ctx.fill();
      }
    }
  }

  function drawMeteors(dt) {
    if(reduced)return;
    for(let i=meteors.length-1;i>=0;i--) {
      const m=meteors[i];m.life+=dt;const t=m.life/1.6;
      if(t>=1){meteors.splice(i,1);continue;}
      const x=m.x+width*.62*t,y=m.y+height*.21*t,alpha=Math.sin(t*Math.PI);
      const tail=Math.min(width*.18,90),g=ctx.createLinearGradient(x-tail,y-tail*.45,x,y);
      g.addColorStop(0,'rgba(242,220,164,0)');g.addColorStop(1,`rgba(255,234,181,${alpha*.75})`);
      ctx.globalAlpha=1;ctx.strokeStyle=g;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x-tail,y-tail*.45);ctx.lineTo(x,y);ctx.stroke();glow(x,y,3.2,'cream',alpha);
    }
  }

  function resize() {
    const box = $('postcard').getBoundingClientRect(); width=box.width; height=box.height;
    dpr = Math.min(devicePixelRatio || 1, 2); canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const mobile=width<700, landscape=width>=700&&height<530;
    centerX = landscape ? width*.73 : width*.5;
    const greetingBottom=$('greeting-line').offsetTop+document.querySelector('.greeting').offsetTop+$('greeting-line').offsetHeight;
    const hintTop=document.querySelector('.bottom-area').offsetTop+$('touch-hint').offsetTop;
    // +50% projected tree area against revision 3, with the same viewport and default greeting.
    // Allocate height first; widen the crown when the greeting limits available height.
    const oldTop=landscape?94:mobile?(height<741?268.765625:321.234375):Math.max(269,height*.31,width>=1000?338.609375:315.40625);
    const oldHeight=Math.max(160,(landscape?height-53:height-(mobile?178:181))-oldTop);
    const oldRadius=Math.min(oldHeight*.397,width*(landscape?.185:mobile?.39:.25));
    const targetArea=oldHeight*oldRadius*1.5;
    const minimumTop=landscape?79:greetingBottom+40;
    treeBottom=landscape?height-34:hintTop-26;
    const availableHeight=Math.max(130,treeBottom-minimumTop);
    treeHeight=Math.min(oldHeight*Math.sqrt(1.5),availableHeight);
    const maximumRadius=width*(landscape?.226:mobile?.475:.35);
    treeRadius=Math.min(targetArea/treeHeight,maximumRadius);
    treeHeight=Math.min(targetArea/treeRadius,availableHeight);
    treeTop=treeBottom-treeHeight;
    const hit=$('tree-touch');hit.style.left=centerX+'px';hit.style.top=(treeTop-24)+'px';hit.style.height=(treeHeight+38)+'px';hit.style.width=Math.min(width*.98,treeRadius*2.25)+'px';
    $('star-touch').style.left=centerX+'px';$('star-touch').style.top=(treeTop-14)+'px';
    canvas.dataset.treeHeight=treeHeight.toFixed(2);canvas.dataset.treeRadius=treeRadius.toFixed(2);canvas.dataset.treeTop=treeTop.toFixed(2);canvas.dataset.treeBottom=treeBottom.toFixed(2);
    canvas.dataset.areaIncrease=(treeHeight*treeRadius/(oldHeight*oldRadius)-1).toFixed(4);
    makeBackdrop();
    makeCanopy();
    if (reduced) render(time, 0);
  }

  function project(p) {
    const x=p.x*rotCos+p.z*rotSin, z=-p.x*rotSin+p.z*rotCos;
    const perspective=1+z*.075;
    return {x:centerX+x*treeRadius*perspective,y:treeTop+p.t*treeHeight+z*treeRadius*.115,z,scale:perspective};
  }
  function glow(x,y,size,name,alpha=1) {
    if (alpha<=0) return;
    ctx.globalAlpha=clamp(alpha); const q=size*5;
    ctx.drawImage(sprites[name],x-q/2,y-q/2,q,q);
  }
  function star(x,y,r,alpha) {
    ctx.save();ctx.translate(x,y);ctx.globalAlpha=alpha;
    const g=ctx.createRadialGradient(0,0,0,0,0,r*5);
    g.addColorStop(0,'rgba(255,221,150,.2)');g.addColorStop(.35,'rgba(247,204,124,.07)');g.addColorStop(1,'rgba(247,204,124,0)');
    ctx.fillStyle=g;ctx.fillRect(-r*5,-r*5,r*10,r*10);
    ctx.beginPath();
    for(let i=0;i<10;i++) {const a=-Math.PI/2+i*Math.PI/5,q=i%2?r*.42:r; i?ctx.lineTo(Math.cos(a)*q,Math.sin(a)*q):ctx.moveTo(Math.cos(a)*q,Math.sin(a)*q);}
    ctx.closePath();const metal=ctx.createLinearGradient(-r,-r,r,r);metal.addColorStop(0,'#fff1ba');metal.addColorStop(.44,'#eed18b');metal.addColorStop(1,'#bd8a42');
    ctx.fillStyle=metal;ctx.shadowColor='#f1c26d';ctx.shadowBlur=17;ctx.fill();ctx.shadowBlur=0;
    for(let i=0;i<10;i++) {
      const a=-Math.PI/2+i*Math.PI/5,b=a+Math.PI/5,q=i%2?r*.42:r,next=(i+1)%2?r*.42:r;
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*q,Math.sin(a)*q);ctx.lineTo(Math.cos(b)*next,Math.sin(b)*next);ctx.closePath();
      ctx.fillStyle=i%2?'rgba(255,247,209,.25)':'rgba(129,85,29,.12)';ctx.fill();
    }
    ctx.strokeStyle='rgba(255,241,196,.75)';ctx.lineWidth=.6;
    for(let i=0;i<5;i++){const a=-Math.PI/2+i*TAU/5;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);ctx.stroke();}
    ctx.restore();
  }
  function burst(x,y,amount=30,strong=false) {
    if(reduced) {energy=.25; render(time,0);return;}
    for(let i=0;i<amount;i++) {const a=random()*TAU,v=(strong?34:14)+random()*(strong?125:66);
      bursts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-(strong?28:8),life:0,max:1.05+random()*1.1,size:.7+random()*1.7});}
    if(bursts.length>400) bursts.splice(0,bursts.length-400);
    energy=Math.min(energy+(strong?.7:.24),1.4);
  }

  function drawGround(reveal,elapsed) {
    ctx.save();ctx.globalAlpha=reveal;ctx.translate(centerX,treeBottom+12);ctx.scale(1,.19);
    const floor=ctx.createRadialGradient(0,0,0,0,0,treeRadius*1.3);
    floor.addColorStop(0,'rgba(210,204,152,.22)');floor.addColorStop(.42,'rgba(151,169,125,.07)');floor.addColorStop(1,'rgba(129,170,110,0)');
    ctx.fillStyle=floor;ctx.fillRect(-treeRadius*1.3,-treeRadius*1.3,treeRadius*2.6,treeRadius*2.6);
    const opening=reduced?0:Math.sin(clamp((elapsed-.55)/1.9)*Math.PI);
    for(let i=0;i<2;i++) {
      ctx.globalAlpha=reveal*(.085+opening*.3)/(i+1);ctx.strokeStyle='#e4cd92';ctx.lineWidth=1.4;
      ctx.beginPath();ctx.ellipse(0,0,treeRadius*(1.02+i*.15),treeRadius*(1.02+i*.15),0,0,TAU);ctx.stroke();
    }
    ctx.restore();
    for(let i=0;i<45;i++) {
      const a=i*2.39996,r=treeRadius*(.27+((i*17)%47)/47*.94);
      glow(centerX+Math.cos(a)*r,treeBottom+11+Math.sin(a)*r*.13,.65+(i%4)*.14,'gold',reveal*(.1+((i%7)/7)*.24));
    }
  }
  function makeCanopy() {
    const pad=24;
    canopy.width=Math.ceil((treeRadius*2+pad*2)*dpr);canopy.height=Math.ceil((treeHeight+pad*2)*dpr);
    const c=canopy.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.translate(treeRadius+pad,pad);
    const base=c.createLinearGradient(-treeRadius,0,treeRadius,0);
    base.addColorStop(0,'#102e22');base.addColorStop(.32,'#244e32');base.addColorStop(.58,'#153d29');base.addColorStop(.9,'#0c2c20');base.addColorStop(1,'#143525');
    c.fillStyle=base;c.beginPath();c.moveTo(0,0);
    for(let i=1;i<=90;i++){const t=i/90;c.lineTo(radiusAt(t)*treeRadius*.93,t*treeHeight);}
    for(let i=90;i>=1;i--){const t=i/90;c.lineTo(-radiusAt(t)*treeRadius*.93,t*treeHeight);}
    c.closePath();c.fill();
    // Soft, overlapping whorls sit beneath the needles and carry the crown's volume.
    for(let tier=17;tier>=0;tier--) {
      const t=.05+tier/17*.9,r=radiusAt(t)*treeRadius*.94,y=t*treeHeight;
      const shade=c.createLinearGradient(-r,y-10,r,y+28);
      shade.addColorStop(0,'rgba(80,118,68,.2)');shade.addColorStop(.4,'rgba(50,88,48,.36)');shade.addColorStop(1,'rgba(4,25,17,.5)');
      c.fillStyle=shade;c.beginPath();c.moveTo(0,y-treeHeight*.13);
      c.bezierCurveTo(-r*.2,y-10,-r*.74,y+5,-r,y+16);
      for(let i=0;i<=14;i++) {const x=-r+i/14*r*2;c.lineTo(x,y+13+Math.sin(i*2.9+tier)*3.2);}
      c.bezierCurveTo(r*.75,y+2,r*.25,y-11,0,y-treeHeight*.13);c.fill();
    }
  }
  function drawCanopy(elapsed) {
    const reveal=ease((elapsed-.75)/3.4);
    if(!reveal)return;
    const crop=clamp((elapsed-1.24)/3.05),sy=Math.max(0,(1-crop)*canopy.height),sh=canopy.height-sy;
    if(sh<=0)return;
    const feather=Math.min(sh,treeHeight*.12*dpr),full=sh-feather,x=centerX-treeRadius-24,y=treeTop-24;
    if(crop===1){ctx.globalAlpha=.9*reveal;ctx.drawImage(canopy,x,y,canopy.width/dpr,canopy.height/dpr);return;}
    // Feather the assembling crown behind the loose needles; never reveal a flat cut edge.
    if(full>0){ctx.globalAlpha=.9*reveal;ctx.drawImage(canopy,0,sy+feather,canopy.width,full,x,y+(sy+feather)/dpr,canopy.width/dpr,full/dpr);}
    for(let i=0;i<12;i++){
      const strip=feather/12,sourceY=sy+i*strip;
      ctx.globalAlpha=.9*reveal*ease((i+.5)/12);
      ctx.drawImage(canopy,0,sourceY,canopy.width,strip,x,y+sourceY/dpr,canopy.width/dpr,strip/dpr+.1);
    }
  }
  function drawRibbon(points,now,elapsed,front,pulse) {
    const path=new Path2D();let connected=false;
    for(let i=0;i<points.length;i++) {
      const {p,q}=points[i];
      const shown=elapsed>1.12+(1-p.t)*3.15;
      if((q.z>=0)!==front||!shown){connected=false;continue;}
      if(!connected)path.moveTo(q.x,q.y);else path.lineTo(q.x,q.y);
      connected=true;
    }
    ctx.globalAlpha=front?.83:.23;ctx.lineWidth=Math.max(1.2,treeRadius*.015);ctx.strokeStyle=front?'#9d7845':'#75613c';ctx.stroke(path);
    ctx.globalAlpha=front?.92:.23;ctx.lineWidth=Math.max(.6,treeRadius*.006);ctx.strokeStyle='#d9b97a';ctx.stroke(path);
    ctx.save();ctx.translate(0,-.65);ctx.globalAlpha=front?.76:.16;ctx.lineWidth=.55;ctx.strokeStyle='#fff0c1';ctx.stroke(path);ctx.restore();
    for(const {p,q} of points) {
      if(p.s<1||(q.z>=0)!==front)continue;
      const a=ease((elapsed-1.12-(1-p.t)*3.15)/.55);if(!a)continue;
      glow(q.x,q.y,p.s*pulse,'gold',a*(front?.86:.17)*(.9+Math.sin(now*1.1+p.phase)*.1));
      if(front) {ctx.globalAlpha=a*.95;ctx.fillStyle='#ffeec1';ctx.beginPath();ctx.arc(q.x,q.y,.65,0,TAU);ctx.fill();}
    }
  }
  function makeOrnamentSprites() {
    const cell=96;ornamentAtlas.width=cell*4;ornamentAtlas.height=cell*3;
    const c=ornamentAtlas.getContext('2d');
    const finishes=[['#fff8d9','#e8d198','#aa8746','#4d402a'],['#ffd2b6','#c97b62','#914232','#3b1c20'],['#ffffff','#e0e2cc','#9dafa0','#364b40'],['#fff0b6','#c8aa61','#817444','#343b26']];
    for(let type=0;type<3;type++)for(let finish=0;finish<4;finish++) {
      const r=18,p=finishes[finish];c.save();c.translate(finish*cell+48,type*cell+45);
      if(type===2) {
        const silk=c.createLinearGradient(-32,-10,32,20);silk.addColorStop(0,finish===1?'#6a2825':'#8a723d');silk.addColorStop(.3,finish===1?'#dc9c82':'#e7d29c');silk.addColorStop(.5,finish===1?'#9d4a3e':'#a68a50');silk.addColorStop(.75,finish===1?'#bb6754':'#d2b87b');silk.addColorStop(1,finish===1?'#692820':'#7b663c');
        c.fillStyle=silk;
        for(const side of [-1,1]) {
          c.beginPath();c.moveTo(0,0);c.bezierCurveTo(side*r,-r*1.7,side*r*2.15,-r*.8,side*r*1.7,r*.42);c.quadraticCurveTo(side*r,r*.58,0,0);c.fill();
          c.beginPath();c.moveTo(0,0);c.lineTo(side*r*.33,r*1.8);c.lineTo(side*r*.63,r*1.3);c.lineTo(side*r*.94,r*1.46);c.lineTo(side*r*.6,r*.13);c.fill();
          c.strokeStyle='rgba(255,228,177,.32)';c.lineWidth=.7;c.beginPath();c.moveTo(side*2,-2);c.quadraticCurveTo(side*20,-13,side*29,-6);c.stroke();
        }
        c.fillStyle=p[1];c.fillRect(-3,-4,6,9);c.restore();continue;
      }
      c.strokeStyle='#b6a578';c.lineWidth=1;c.beginPath();c.moveTo(0,-r-12);c.lineTo(0,-r-2);c.stroke();
      c.fillStyle='#b69b64';c.fillRect(-4,-r-3,8,5);c.strokeStyle='#f0dc9d';c.lineWidth=.75;c.strokeRect(-3.5,-r-2.5,7,4);
      const shape=new Path2D();
      if(type===1){shape.moveTo(0,-r);shape.bezierCurveTo(r*1.3,-r*.2,r*.86,r*.85,0,r*1.55);shape.bezierCurveTo(-r*.86,r*.85,-r*1.3,-r*.2,0,-r);}
      else shape.arc(0,0,r,0,TAU);
      const g=c.createRadialGradient(-r*.42,-r*.5,.1,0,0,r*1.17);g.addColorStop(0,p[0]);g.addColorStop(.18,p[1]);g.addColorStop(.64,p[2]);g.addColorStop(1,p[3]);c.fillStyle=g;c.fill(shape);
      c.save();c.clip(shape);c.strokeStyle='rgba(255,236,191,.42)';c.lineWidth=.55;
      for(let i=-2;i<=2;i++) {c.beginPath();c.ellipse(0,0,Math.max(2,r*(.3+Math.abs(i)*.31)),r*1.5,i*.1,0,TAU);c.stroke();}
      c.beginPath();c.ellipse(0,r*.24,r*1.03,r*.22,0,0,TAU);c.stroke();
      c.fillStyle='rgba(255,236,183,.63)';
      for(let i=0;i<15;i++) {const a=i/15*TAU;c.beginPath();c.arc(Math.sin(a)*r*.84,Math.cos(a)*r*.18+r*.24,.65,0,TAU);c.fill();}
      c.restore();
      c.strokeStyle='rgba(255,242,208,.66)';c.lineWidth=.65;c.beginPath();c.arc(0,0,r*.84,-2.9,-.6);c.stroke();
      c.fillStyle='rgba(255,255,234,.85)';c.beginPath();c.ellipse(-r*.37,-r*.47,r*.12,r*.26,.55,0,TAU);c.fill();
      c.fillStyle='rgba(255,247,222,.26)';c.beginPath();c.ellipse(r*.5,r*.3,r*.05,r*.3,-.4,0,TAU);c.fill();c.restore();
    }
  }
  function drawOrnament(p,q,alpha,settle=1) {
    const r=p.s*q.scale*clamp(treeRadius/146,.65,1.65),type=p.type==='bow'?2:p.type==='drop'?1:0;
    const scale=r/18,side=96*scale;
    ctx.globalAlpha=alpha;
    ctx.drawImage(ornamentAtlas,p.finish*96,type*96,96,96,q.x-side/2,q.y-side*45/96-(1-settle)*12,side,side);
  }
  function drawEntrance(elapsed,front) {
    if(reduced||elapsed<0||elapsed>6.7)return;
    // A falling seed of light leads into a rising helix, rather than an opacity-only reveal.
    if(elapsed<.9&&front) {
      const travel=clamp(elapsed/.82);
      for(let i=0;i<33;i++) {
        const t=clamp(travel-i*.008),u=ease(t);
        const x=centerX+treeRadius*(1.5*(1-u)+Math.sin(u*Math.PI)*.3),y=treeTop-treeHeight*.18+u*(treeHeight*1.18+10);
        glow(x,y,i===0?4:1.5,'cream',(1-i/33)*ease(elapsed/.15)*(1-ease((elapsed-.75)/.15)));
      }
    }
    const growth=clamp((elapsed-.68)/3.65),fade=1-ease((elapsed-4.25)/.6);
    if(growth>0&&growth<1) {
      for(let i=0;i<64;i++) {
        const t=clamp(1-growth+i*.0027),a=t*TAU*3.85+.24,r=radiusAt(t)*1.06;
        const q=project({x:Math.cos(a)*r,z:Math.sin(a)*r,t});if((q.z>=0)!==front)continue;
        glow(q.x,q.y,i===0?5:1.6,'cream',fade*(1-i/64)*(front?.95:.38));
      }
    }
    for(const p of entranceDust) {
      const local=clamp((elapsed-.8-(1-p.t)*2.95)/1.1);
      if(local<=0||local>=1)continue;
      const target=project(p);if((target.z>=0)!==front)continue;
      const gather=1-ease(local),a=p.phase+gather*2.2;
      const x=target.x+Math.cos(a)*treeRadius*p.spread*gather,y=target.y+treeHeight*.15*gather;
      glow(x,y,p.s,'gold',Math.sin(local*Math.PI)*(front?.85:.3));
    }
    if(front&&elapsed>4.65) {
      const t=clamp((elapsed-4.65)/1.6),radius=treeRadius*(.06+t*.47),alpha=Math.sin(t*Math.PI)*(1-t);
      for(let i=0;i<34;i++) {
        const a=i/34*TAU+t*.3;
        glow(centerX+Math.cos(a)*radius,treeTop-14+Math.sin(a)*radius*.73,1+(i%3)*.2,'cream',alpha*.8);
      }
      glow(centerX,treeTop-14,17,'gold',Math.sin(t*Math.PI)*.25);
    }
  }
  function render(now,dt) {
    const elapsed=reduced?10:now-introStart;
    const all=ease((elapsed-.65)/3.8),pulse=1+energy*.09;
    rotCos=Math.cos(rotation);rotSin=Math.sin(rotation);
    ctx.clearRect(0,0,width,height);ctx.globalAlpha=1;ctx.drawImage(backdrop,0,0,width,height);
    drawSnow(now,dt,false);drawGround(ease((elapsed-.55)/1.1),elapsed);drawEntrance(elapsed,false);
    if(all>0) {
      ctx.globalAlpha=all*.65;ctx.strokeStyle='#776e43';ctx.lineWidth=treeRadius*.048;ctx.beginPath();ctx.moveTo(centerX,treeBottom+4);ctx.lineTo(centerX,treeBottom-24);ctx.stroke();
      const ribbonPoints=ribbon.map(p=>({p,q:project(p)}));
      drawRibbon(ribbonPoints,now,elapsed,false,pulse);
      const branches=foliage.map(p=>({p,q:project(p)})).sort((a,b)=>a.q.z-b.q.z);
      let crownDrawn=false;
      for(const {p,q} of branches) {
        if(q.z>=-.1&&!crownDrawn){drawCanopy(elapsed);crownDrawn=true;}
        const reveal=ease((elapsed-.9-(1-clamp(p.t))*2.95)/.85);if(!reveal)continue;
        const front=clamp((q.z+1)/2),length=treeRadius*(.15+.102*p.t)*p.s*(1-p.reach*.08)*q.scale;
        const direction=Math.atan2(.23+q.z*.16,Math.cos(p.a-rotation))+p.tilt;
        const turn=Math.round(((direction%TAU+TAU)%TAU)/TAU*32)%32,side=length*1.24;
        const x=centerX+(q.x-centerX)*(.7+.3*reveal),y=q.y+(1-reveal)*15;
        const lit=clamp(q.z/Math.max(.1,radiusAt(p.t))*.5+.5);
        const palette=lit>.8?(p.color%4===0?2:1):lit<.38?3:0;
        ctx.globalAlpha=(.5+front*.47)*reveal;
        ctx.drawImage(pineAtlas,turn*128,((p.color>=4?4:0)+palette)*128,128,128,x-side/2,y-side/2,side,side);
      }
      drawRibbon(ribbonPoints,now,elapsed,true,pulse);
      const ordered=ornaments.map(p=>({p,q:project(p)})).sort((a,b)=>a.q.z-b.q.z);
      for(const {p,q} of ordered) {
        if(q.z<-.04)continue;
        const a=ease((elapsed-1.75-(1-p.t)*2.6)/.8);if(!a)continue;
        drawOrnament(p,q,a*(q.z<0?.3:.98),a);
      }
      ctx.save();ctx.globalCompositeOperation='lighter';
      const wave=clamp((elapsed-4.7)/1.3);
      for(const p of lights) {
        const q=project(p),a=ease((elapsed-1.1-(1-clamp(p.t))*3.15)/.7);
        const twinkle=.76+Math.sin(now*(.55+p.s*.19)+p.phase)*.2;
        const sweep=elapsed>4.7&&elapsed<6?Math.max(0,1-Math.abs(p.t-wave)*10)*.55:0;
        glow(q.x,q.y,p.s*pulse*(1.18+sweep*.5),p.warm?'gold':'pale',a*(twinkle+sweep)*(q.z<0?.055:.9));
        if(q.z>.12&&p.s>2.25) {ctx.globalAlpha=a*.85;ctx.fillStyle='#fff1c9';ctx.beginPath();ctx.arc(q.x,q.y,.58+p.s*.08,0,TAU);ctx.fill();}
        if(q.z>.3&&p.phase%1<.09&&twinkle>.85) {
          ctx.globalAlpha=a*.57;ctx.strokeStyle='#fff0c9';ctx.lineWidth=.5;const r=2.8*pulse;
          ctx.beginPath();ctx.moveTo(q.x-r,q.y);ctx.lineTo(q.x+r,q.y);ctx.moveTo(q.x,q.y-r*1.4);ctx.lineTo(q.x,q.y+r*1.4);ctx.stroke();
        }
      }
      ctx.restore();
      const starReveal=ease((elapsed-4.38)/.95),starPulse=reduced?1:1+Math.sin(now*1.4)*.025+energy*.08;
      star(centerX,treeTop-14,Math.max(12,Math.min(20,treeHeight*.039))*starPulse*(.65+.35*starReveal),starReveal);
      if(starLit) {const q=project({x:.23,z:.6,t:.35});glow(q.x,q.y,7,'cream',.65*all);star(q.x,q.y,5.5,.9*all);}
    }
    drawEntrance(elapsed,true);
    if(!reduced)for(let i=bursts.length-1;i>=0;i--) {
      const p=bursts[i];p.life+=dt;if(p.life>=p.max){bursts.splice(i,1);continue;}
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=18*dt;p.vx*=Math.pow(.95,dt*60);
      glow(p.x,p.y,p.size,'cream',Math.pow(1-p.life/p.max,1.5));
    }
    const wishProgress=now-wishAt;
    if(wishProgress>=0&&wishProgress<2.5&&!reduced) {
      const t=clamp(wishProgress/2.5),x=centerX+Math.sin(t*TAU*1.5)*(1-t)*treeRadius*.8,y=treeBottom-t*(treeHeight+12);
      glow(x,y,9,'cream',1);if(random()>.25)burst(x,y,1,false);
    }
    drawMeteors(dt);drawSnow(now,dt,true);ctx.globalAlpha=1;wind*=Math.pow(.3,dt);energy=Math.max(0,energy-dt*.65);
    canvas.dataset.ready=elapsed>6.7?'true':'false';
  }
  function tick(stamp) {
    if(!active)return;
    // Preserve the 120 Hz schedule across display refreshes; discard missed slots after a stall.
    if(!reduced) {
      if(nextFrameAt&&stamp+.1<nextFrameAt){frameId=requestAnimationFrame(tick);return;}
      nextFrameAt=nextFrameAt?nextFrameAt+FRAME_INTERVAL:stamp+FRAME_INTERVAL;
      if(nextFrameAt<stamp)nextFrameAt=stamp+FRAME_INTERVAL;
    }
    const seconds=stamp/1000;let dt=previous?Math.min(seconds-previous,.05):.016;previous=seconds;
    time=seconds;
    if(!reduced) {if(!drag)targetRotation+=dt*.065;rotation+=(targetRotation-rotation)*Math.min(1,dt*6);}
    render(time,dt);
    if(!reduced)frameId=requestAnimationFrame(tick);
  }
  function start() {cancelAnimationFrame(frameId);previous=0;nextFrameAt=0;frameId=requestAnimationFrame(tick);}

  const hit=$('tree-touch');
  hit.addEventListener('pointerdown',e=> {
    if(e.button!==0&&e.pointerType==='mouse')return;
    hit.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,moved:0};
  });
  hit.addEventListener('pointermove',e=> {
    if(!drag||drag.id!==e.pointerId)return;
    const delta=e.clientX-drag.lastX;drag.moved+=Math.abs(delta);targetRotation+=delta*.009;drag.lastX=e.clientX;wind=clamp(delta*.15,-1.8,1.8);
    if(reduced){rotation=targetRotation;render(time,0);}
  });
  hit.addEventListener('pointerup',e=> {
    if(!drag||drag.id!==e.pointerId)return;
    const moved=drag.moved;drag=null;
    if(moved<10) {const box=canvas.getBoundingClientRect();burst(e.clientX-box.left,e.clientY-box.top,36);chime();}
    lastInteraction=time;
  });
  hit.addEventListener('pointercancel',()=>{drag=null;});
  hit.addEventListener('keydown',e=> {
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();targetRotation+=e.key==='ArrowLeft'?-.35:.35;if(reduced){rotation=targetRotation;render(time,0);}}
  });
  hit.addEventListener('click',e=>{if(e.detail===0){burst(centerX,treeTop+treeHeight*.45,36);chime();}});

  let toastTimer,celebrationTimer;
  function toast(message,special=false) {$('toast').textContent=message;$('toast').classList.toggle('star-message',special);$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),special?4400:3200);}
  const starMessages=['今夜的星光，都偏爱你。','愿你被这个世界温柔以待。','想见的人，终会相逢。','好消息正在悄悄靠近你。','小颖，每一天都要开心呀。'];
  $('star-touch').addEventListener('click',()=> {
    toast(starMessages[starMessageIndex++%starMessages.length],true);
    burst(centerX,treeTop-14,58,true);chime(true);
    if(!reduced)meteors.push({x:width*.08,y:Math.max(70,treeTop-65),life:0});
  });
  $('replay').addEventListener('click',()=> {
    introStart=time;bursts.length=0;wishAt=-100;energy=0;
    $('celebration').classList.remove('visible');
    if(reduced)render(time,0);else toast('再为你亮起一次');
  });

  function openDialog(dialog) {if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}
  function closeDialog(dialog) {if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');}
  const wishDialog=$('wish-dialog'),shareDialog=$('share-dialog');
  $('wish').addEventListener('click',()=>{$('wish-text').value=savedWish;openDialog(wishDialog);});
  $('close-dialog').addEventListener('click',()=>closeDialog(wishDialog));
  for(const dialog of [wishDialog,shareDialog])dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(dialog);}});
  $('wish-form').addEventListener('submit',e=> {
    e.preventDefault();const value=$('wish-text').value.trim();if(!value){$('wish-text').setCustomValidity('写下一点小小的期待吧');$('wish-text').reportValidity();return;}
    savedWish=value;let stored=true;try{localStorage.setItem('winter-postcard-wish',value);}catch(_){stored=false;}
    starLit=true;closeDialog(wishDialog);wishAt=time;energy=1;
    burst(centerX,treeTop-14,76,true);chime(true);
    $('celebration').classList.add('visible');clearTimeout(celebrationTimer);celebrationTimer=setTimeout(()=>$('celebration').classList.remove('visible'),3500);
    $('wish').querySelector('span').textContent='我的小小心愿';
    if(!stored)toast('星星收到啦。本次浏览期间为你留着');
    if(reduced)render(time,0);
  });
  $('wish-text').addEventListener('input',()=>$('wish-text').setCustomValidity(''));
  if(savedWish)$('wish').querySelector('span').textContent='我的小小心愿';

  let incomingName='',incomingMessage='';
  function readGreeting() {
    try {
      const data=new URLSearchParams(location.hash.slice(1));incomingName=(data.get('to')||'').slice(0,18);incomingMessage=(data.get('words')||'').slice(0,48);
      $('dedication').textContent=incomingName?`把这个冬天的温柔，送给${incomingName}`:'把这个冬天的温柔，送给你';
      $('greeting-line').textContent=incomingMessage||'愿你所念，皆有回响。';
      if(width)requestAnimationFrame(resize);
    } catch(_){}
  }
  readGreeting();window.addEventListener('hashchange',readGreeting);
  $('share').addEventListener('click',()=> {
    $('recipient').value=incomingName;$('message').value=incomingMessage;$('manual-copy').hidden=true;openDialog(shareDialog);
  });
  $('close-share').addEventListener('click',()=>closeDialog(shareDialog));
  $('copy-share').addEventListener('click',async()=> {
    const url=new URL(location.href);const params=new URLSearchParams();
    const to=$('recipient').value.trim(),words=$('message').value.trim();if(to)params.set('to',to);if(words)params.set('words',words);url.hash=params.toString();
    if(location.protocol==='file:'){toast('发布为网页后，就能把链接送给朋友');return;}
    try{await navigator.clipboard.writeText(url.href);closeDialog(shareDialog);toast('链接已复制，送给你惦记的人吧');}
    catch(_){$('share-link').value=url.href;$('manual-copy').hidden=false;$('share-link').focus();$('share-link').select();}
  });

  // The song is mastered 12 dB quieter in the file itself, including on iOS,
  // where the media element's volume setting follows the device volume.
  const backgroundMusic=$('background-music');
  let preparedMusicSource='';
  let audio=null,master=null,musicOn=false,playAttempt=0,musicReady=false,musicLoading=null;
  function ensureAudio() {
    if(!audio) {const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error('no audio');audio=new AC({latencyHint:'playback'});master=audio.createGain();master.gain.value=.18;master.connect(audio.destination);}
    return audio;
  }
  function tone(midi,when,duration=2,volume=.2) {
    if(!audio||!master)return;
    const freq=440*Math.pow(2,(midi-69)/12);
    for(const [multiple,level] of [[1,1],[2.003,.21],[3.99,.055]]) {
      const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.value=freq*multiple;
      gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(volume*level,when+.012);gain.gain.exponentialRampToValueAtTime(.0001,when+duration);
      osc.connect(gain);gain.connect(master);osc.start(when);osc.stop(when+duration+.05);
    }
  }
  function musicUI() {
    const pending=musicOn&&!musicReady,label=pending?'取消音乐播放':musicOn?'关闭音乐':'开启音乐';
    $('music').setAttribute('aria-pressed',String(musicOn));$('music').setAttribute('aria-busy',String(pending));
    $('music').setAttribute('aria-label',label);$('music').title=pending?'音乐准备中':label;
    $('music').querySelector('.music-off').hidden=musicOn;$('music').querySelector('.music-on').hidden=!musicOn;
  }
  function prepareMusic() {
    if(musicReady)return Promise.resolve();
    if(musicLoading)return musicLoading;
    musicLoading=(async()=> {
      if(backgroundMusic.dataset.embedded==='true') {
        // Single-file sharing starts the artwork before the music arrives.
        // Wait for the payload at the end of the document without blocking drawing.
        if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
        preparedMusicSource=JSON.parse($('music-data').textContent);
      } else {
        // The normal website keeps its HTML small and silently caches the song
        // after its first frame. Only a complete download is handed to the player.
        let lastError;
        for(let attempt=0;attempt<2;attempt++) {
          const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
          try {
            const response=await fetch(backgroundMusic.dataset.payload||backgroundMusic.dataset.src,{signal:controller.signal,cache:'force-cache',priority:'low'});
            if(!response.ok)throw Error('music download');
            if(backgroundMusic.dataset.payload) {
              const documentText=await response.text();
              const payload=new DOMParser().parseFromString(documentText,'text/html').getElementById('music-data');
              preparedMusicSource=JSON.parse(payload.textContent);
              if(!preparedMusicSource.startsWith('data:audio/mpeg;base64,')||atob(preparedMusicSource.split(',')[1]).length!==Number(backgroundMusic.dataset.bytes))throw Error('incomplete music');
            } else {
              const blob=await response.blob();
              if(blob.size!==Number(backgroundMusic.dataset.bytes))throw Error('incomplete music');
              preparedMusicSource=URL.createObjectURL(blob);
            }
            lastError=null;break;
          } catch(error){lastError=error;}
          finally {clearTimeout(timeout);}
        }
        if(lastError)throw lastError;
      }
      backgroundMusic.src=preparedMusicSource;backgroundMusic.load();
      musicReady=true;musicUI();
    })().catch(error=>{musicLoading=null;throw error;});
    return musicLoading;
  }
  function stopMusic() {
    musicOn=false;playAttempt++;backgroundMusic.pause();musicUI();
    if(audio&&master){master.gain.cancelScheduledValues(audio.currentTime);master.gain.setTargetAtTime(.0001,audio.currentTime,.05);}
  }
  async function playMusic(announce=false) {
    const attempt=++playAttempt;musicOn=true;musicUI();
    try {
      if(!musicReady){if(announce)toast('正在准备音乐，稍等一下');await prepareMusic();}
      if(attempt!==playAttempt||!musicOn||document.hidden)return;
      if(backgroundMusic.error||backgroundMusic.src!==preparedMusicSource){backgroundMusic.src=preparedMusicSource;backgroundMusic.load();}
      // When already prepared, call play directly within the tap for mobile Safari.
      await backgroundMusic.play();
      if(attempt!==playAttempt||!musicOn)return;
      if(document.hidden){backgroundMusic.pause();return;}
      if(announce)toast('让这首歌，陪你看雪');
    } catch(error) {
      if(attempt!==playAttempt||!musicOn)return;
      stopMusic();toast(error.name==='NotAllowedError'?'音乐准备好了，轻触右上角播放':'音乐暂时没能加载，再试一次吧');
    }
  }
  $('music').addEventListener('click',()=>{if(musicOn)stopMusic();else playMusic(true);});
  backgroundMusic.addEventListener('error',()=> {
    if(musicOn){stopMusic();toast('音乐暂时没能加载，再试一次吧');}
  });
  function chime(major=false) {
    if(!musicOn||backgroundMusic.paused)return;
    try {
      ensureAudio();if(audio.state==='suspended')audio.resume().catch(()=>{});
      master.gain.cancelScheduledValues(audio.currentTime);master.gain.setTargetAtTime(.18,audio.currentTime,.1);
      const now=audio.currentTime;tone(major?84:79,now,1.3,.18);if(major){tone(88,now+.16,1.4,.15);tone(91,now+.32,1.8,.12);}
    } catch(_){}
  }
  function pauseForBackground() {
    playAttempt++;backgroundMusic.pause();
    if(audio&&audio.state==='running')audio.suspend().catch(()=>{});
  }

  document.addEventListener('visibilitychange',()=> {
    active=!document.hidden;
    if(!active){cancelAnimationFrame(frameId);pauseForBackground();}
    else {if(musicOn)playMusic();start();}
  });
  const motionChange=e=>{reduced=e.matches;start();};
  if(motionQuery.addEventListener)motionQuery.addEventListener('change',motionChange);else motionQuery.addListener(motionChange);
  window.addEventListener('resize',resize);
  window.addEventListener('pagehide',()=>{active=false;cancelAnimationFrame(frameId);pauseForBackground();});
  window.addEventListener('pageshow',e=>{if(e.persisted){active=!document.hidden;if(active){if(musicOn)playMusic();start();}}});
  createTree();makePineSprites();makeOrnamentSprites();makeSnowSprite();resize();introStart=performance.now()/1000;start();
  // Prepare music on opening, after allowing the artwork its first frame.
  requestAnimationFrame(()=>prepareMusic().catch(()=>{}));
  if(document.fonts)document.fonts.ready.then(resize);
})();
