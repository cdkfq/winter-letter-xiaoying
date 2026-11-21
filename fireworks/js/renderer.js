// Batch trails and stars into two GPU draws, with a Canvas fallback.
export class SparkRenderer{
  constructor(canvas,maximum){
    this.canvas=canvas;this.gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:false,powerPreference:'high-performance'});
    this.lines=new Float32Array(maximum*20*2*7);this.points=new Float32Array((maximum+500)*7);
    if(!this.gl){this.ctx=canvas.getContext('2d');this.mode='canvas';return;}
    this.mode='webgl';const g=this.gl;
    const compile=(kind,code)=>{const s=g.createShader(kind);g.shaderSource(s,code);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw new Error(g.getShaderInfoLog(s));return s;};
    const v=compile(g.VERTEX_SHADER,'attribute vec2 a_pos;attribute vec4 a_color;attribute float a_size;uniform vec2 u_resolution;uniform float u_dpr;varying vec4 v_color;void main(){vec2 p=a_pos/u_resolution*2.0-1.0;gl_Position=vec4(p.x,-p.y,0,1);gl_PointSize=a_size*u_dpr;v_color=a_color;}');
    const f=compile(g.FRAGMENT_SHADER,'precision mediump float;varying vec4 v_color;uniform float u_points;void main(){float a=1.0;vec3 color=v_color.rgb;if(u_points>0.5){vec2 p=(gl_PointCoord-0.5)*2.0;float r=dot(p,p);if(r>1.0)discard;a=exp(-5.0*r)*(1.0-smoothstep(0.6,1.0,r));color=mix(color,vec3(1.0,0.97,0.89),0.7*exp(-40.0*r));}gl_FragColor=vec4(color,v_color.a*a);}');
    const program=g.createProgram();g.attachShader(program,v);g.attachShader(program,f);g.linkProgram(program);if(!g.getProgramParameter(program,g.LINK_STATUS))throw new Error('Spark renderer could not link');
    g.useProgram(program);this.program=program;this.pos=g.getAttribLocation(program,'a_pos');this.color=g.getAttribLocation(program,'a_color');this.size=g.getAttribLocation(program,'a_size');
    this.resolution=g.getUniformLocation(program,'u_resolution');this.ratio=g.getUniformLocation(program,'u_dpr');this.pointMode=g.getUniformLocation(program,'u_points');
    this.lineBuffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.lineBuffer);g.bufferData(g.ARRAY_BUFFER,this.lines.byteLength,g.DYNAMIC_DRAW);
    this.pointBuffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.pointBuffer);g.bufferData(g.ARRAY_BUFFER,this.points.byteLength,g.DYNAMIC_DRAW);
    g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE);g.clearColor(0,0,0,0);
  }
  resize(w,h,dpr){this.w=w;this.h=h;this.dpr=dpr;this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);if(this.gl)this.gl.viewport(0,0,this.canvas.width,this.canvas.height);else this.ctx.setTransform(dpr,0,0,dpr,0,0);this.clear();}
  clear(){if(this.gl)this.gl.clear(this.gl.COLOR_BUFFER_BIT);else this.ctx.clearRect(0,0,this.w,this.h);}
  begin(){this.li=0;this.pi=0;this.clear();if(this.ctx){this.ctx.globalCompositeOperation='lighter';this.ctx.lineCap='round';}}
  vertex(array,index,x,y,color,alpha,size=1){array[index++]=x;array[index++]=y;array[index++]=color[0]/255;array[index++]=color[1]/255;array[index++]=color[2]/255;array[index++]=alpha;array[index++]=size;return index;}
  line(x1,y1,x2,y2,color,a1,a2=a1){
    if(this.gl){if(this.li+14>this.lines.length)return;this.li=this.vertex(this.lines,this.li,x1,y1,color,a1);this.li=this.vertex(this.lines,this.li,x2,y2,color,a2);}
    else{const c=this.ctx;c.strokeStyle=`rgba(${color},${(a1+a2)*.5})`;c.lineWidth=.8;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
  }
  point(x,y,size,color,alpha){
    if(this.gl){if(this.pi+7<=this.points.length)this.pi=this.vertex(this.points,this.pi,x,y,color,alpha,size);}
    else{const c=this.ctx;c.globalAlpha=alpha;const gr=c.createRadialGradient(x,y,0,x,y,size*.5);gr.addColorStop(0,'#fff7e6');gr.addColorStop(.17,`rgba(${color},.9)`);gr.addColorStop(1,`rgba(${color},0)`);c.fillStyle=gr;c.fillRect(x-size*.5,y-size*.5,size,size);c.globalAlpha=1;}
  }
  finish(){
    if(!this.gl)return;const g=this.gl;g.useProgram(this.program);g.uniform2f(this.resolution,this.w,this.h);g.uniform1f(this.ratio,this.dpr);
    for(const [array,count,buffer,primitive,points] of [[this.lines,this.li,this.lineBuffer,g.LINES,0],[this.points,this.pi,this.pointBuffer,g.POINTS,1]]){
      if(!count)continue;g.bindBuffer(g.ARRAY_BUFFER,buffer);g.bufferSubData(g.ARRAY_BUFFER,0,array.subarray(0,count));g.enableVertexAttribArray(this.pos);g.vertexAttribPointer(this.pos,2,g.FLOAT,false,28,0);g.enableVertexAttribArray(this.color);g.vertexAttribPointer(this.color,4,g.FLOAT,false,28,8);g.enableVertexAttribArray(this.size);g.vertexAttribPointer(this.size,1,g.FLOAT,false,28,24);g.uniform1f(this.pointMode,points);g.drawArrays(primitive,0,count/7);
    }
  }
}
