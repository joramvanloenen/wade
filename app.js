/* Wade — dependency-free WebGL 2, endless floating-origin shallows. */
'use strict';
(() => {
const $ = id => document.getElementById(id);
const canvas = $('scene');
const gl = canvas.getContext('webgl2', {alpha:false, antialias:false, depth:true, powerPreference:'high-performance'});
if (!gl) { $('error').classList.remove('hidden'); return; }
const PI = Math.PI, TAU = PI * 2;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const lerp = (a,b,t) => a+(b-a)*t;
const smooth = (a,b,t) => lerp(a,b,1-Math.exp(-t));
const fract = x => x-Math.floor(x);
const hash = (x,z=0) => fract(Math.sin(x*127.1+z*311.7)*43758.5453);
const add = (a,b) => [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub = (a,b) => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul = (a,s) => [a[0]*s,a[1]*s,a[2]*s];
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len = a => Math.hypot(...a);
const norm = a => mul(a,1/(len(a)||1));
const ident = () => new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function mm(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
function trs(p,s=[1,1,1],ry=0){let c=Math.cos(ry),n=Math.sin(ry);return new Float32Array([c*s[0],0,n*s[0],0,0,s[1],0,0,-n*s[2],0,c*s[2],0,...p,1]);}
function perspective(f,a,n,z){let t=1/Math.tan(f/2);return new Float32Array([t/a,0,0,0,0,t,0,0,0,0,(z+n)/(n-z),-1,0,0,2*z*n/(n-z),0]);}
function lookAt(eye,target){let z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
function segment(a,b,r1,r2=r1){let y=sub(b,a),l=len(y);y=norm(y);let x=norm(cross(Math.abs(y[1])>.98?[0,0,1]:[0,1,0],y)),z=cross(x,y);let mid=mul(add(a,b),.5);return new Float32Array([...mul(x,r1),0,...mul(y,l),0,...mul(z,r2),0,...mid,1]);}
function program(v,f){const p=gl.createProgram();for(const [type,src] of [[gl.VERTEX_SHADER,v],[gl.FRAGMENT_SHADER,f]]){let s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);gl.deleteShader(s);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return {p,u:new Map()};}
function uniform(p,name,type,value){let u=p.u.get(name);if(u===undefined){u=gl.getUniformLocation(p.p,name);p.u.set(name,u);}if(u===null)return;if(type==='m4')gl.uniformMatrix4fv(u,false,value);else gl['uniform'+type](u,value);}
function mesh(pos,nor,idx){let vao=gl.createVertexArray();gl.bindVertexArray(vao);for(const [i,data] of [[0,pos],[1,nor]]){let b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,0,0);}let b=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(idx),gl.STATIC_DRAW);gl.bindVertexArray(null);return {vao,count:idx.length};}
function sphere(rings=10,segs=16){let p=[],n=[],i=[];for(let r=0;r<=rings;r++)for(let s=0;s<=segs;s++){let a=r/rings*PI,b=s/segs*TAU,v=[Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b)];p.push(...v);n.push(...v);}for(let r=0;r<rings;r++)for(let s=0;s<segs;s++){let a=r*(segs+1)+s,b=a+segs+1;i.push(a,b,a+1,b,b+1,a+1);}return mesh(p,n,i);}
function cylinder(segs=12){let p=[],n=[],i=[];for(let y=0;y<2;y++)for(let s=0;s<=segs;s++){let a=s/segs*TAU;p.push(Math.cos(a),y-.5,Math.sin(a));n.push(Math.cos(a),0,Math.sin(a));}for(let s=0;s<segs;s++){i.push(s,s+segs+1,s+1,s+1,s+segs+1,s+segs+2);}for(let y=0;y<2;y++){let b=p.length/3;p.push(0,y-.5,0);n.push(0,y?1:-1,0);for(let s=0;s<=segs;s++){let a=s/segs*TAU;p.push(Math.cos(a),y-.5,Math.sin(a));n.push(0,y?1:-1,0);if(s) i.push(b,b+s,b+s+1);}}return mesh(p,n,i);}
function grid(res=100,size=80){let p=[],n=[],i=[];for(let z=0;z<=res;z++)for(let x=0;x<=res;x++){p.push((x/res-.5)*size,0,(z/res-.5)*size);n.push(0,1,0);}for(let z=0;z<res;z++)for(let x=0;x<res;x++){let a=z*(res+1)+x,b=a+res+1;i.push(a,a+1,b,b,a+1,b+1);}return mesh(p,n,i);}
const GLSL=`#version 300 es
precision highp float;
`;
const common=`
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+1.),f.x),f.y);}
vec3 fog(vec3 col,vec3 p,vec3 eye){float d=length(p.xz-eye.xz);float f=1.-exp(-d*d*.00065);return mix(col,vec3(.49,.69,.61),f);}
`;
const simVS=GLSL+`out vec2 uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,0,1);}`;
const waveEncoding=`
vec2 decodeWave(vec4 v,float encoded){vec2 q=vec2(dot(v.rg,vec2(65280.,255.)),dot(v.ba,vec2(65280.,255.)));return mix(v.rg,(q-32767.)/32767.,encoded);}
vec2 packWave(float v){float q=floor(clamp(v,-1.,1.)*32767.+32767.+.5);return vec2(floor(q/256.),mod(q,256.))/255.;}
`;
const simFS=GLSL+waveEncoding+`in vec2 uv;out vec4 color;uniform sampler2D state;uniform vec2 texel,shift;uniform vec4 forces[4];uniform float dt,c2,encoded;
vec2 readState(vec2 p){if(any(lessThan(p,vec2(0)))||any(greaterThan(p,vec2(1))))return vec2(0);return decodeWave(texture(state,p),encoded);}
void main(){vec2 p=uv+shift;vec2 s=readState(p);float lap=readState(p+vec2(texel.x,0)).r+readState(p-vec2(texel.x,0)).r+readState(p+vec2(0,texel.y)).r+readState(p-vec2(0,texel.y)).r-4.*s.r;
float v=(s.g+lap*c2*dt)*exp(-dt*1.25);for(int i=0;i<4;i++){vec2 d=(uv-forces[i].xy)/forces[i].z;float q=dot(d,d)*2.5;v+=forces[i].w*exp(-q)*(1.-q)*dt;}float h=clamp(s.r+v*dt,-.24,.24);float edge=min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y));float absorb=smoothstep(0.,.06,edge);v*=absorb;h*=absorb;vec2 outState=vec2(h,clamp(v,-.95,.95));color=mix(vec4(outState,0,1),vec4(packWave(outState.x),packWave(outState.y)),encoded);}`;
const meshVS=GLSL+`layout(location=0)in vec3 position;layout(location=1)in vec3 normal;uniform mat4 model,vp;out vec3 w,n;void main(){w=(model*vec4(position,1)).xyz;n=normalize(transpose(inverse(mat3(model)))*normal);gl_Position=vp*vec4(w,1);}`;
const meshFS=GLSL+common+`in vec3 w,n;out vec4 color;uniform vec3 tint,eye;uniform float depth,alpha;
void main(){vec3 N=normalize(n);float light=max(dot(N,normalize(vec3(-.6,1.,.35))),0.);vec3 c=tint*(.65+light*.42);if(w.y<depth){float wet=clamp((depth-w.y)*2.,0.,.55);c=mix(c,vec3(.22,.52,.43),wet);c*=.92+.08*sin(w.x*24.+w.z*13.);}c=fog(c,w,eye);color=vec4(c,alpha);}`;
const groundVS=GLSL+`layout(location=0)in vec3 position;uniform mat4 vp;uniform vec2 center;out vec3 w;void main(){w=vec3(position.x+center.x,-.055,position.z+center.y);gl_Position=vp*vec4(w,1);}`;
const groundFS=GLSL+common+waveEncoding+`in vec3 w;out vec4 color;uniform sampler2D waves;uniform vec2 simOrigin,worldOffset;uniform float simSize,time,depth,encoded;uniform vec3 eye;uniform vec4 footShadows[2];uniform vec3 bodyShadow;
float height(vec2 p){vec2 u=(p-simOrigin)/simSize+.5;float h=decodeWave(texture(waves,clamp(u,0.,1.)),encoded).x;return h*step(0.,u.x)*step(u.x,1.)*step(0.,u.y)*step(u.y,1.);}
void main(){vec2 p=w.xz+worldOffset;float h=height(w.xz);vec2 grad=vec2(height(w.xz+vec2(.08,0))-height(w.xz-vec2(.08,0)),height(w.xz+vec2(0,.08))-height(w.xz-vec2(0,.08)))*3.;p+=grad;
float grain=noise(p*38.);float sand=noise(p*.45);float ridges=sin(p.x*7.2+p.y*1.8+noise(p*1.6)*2.);vec3 c=mix(vec3(.60,.66,.47),vec3(.83,.80,.60),sand);c+=grain*.035+ridges*.008;
float grass=smoothstep(.62,.82,noise(p*.21))*smoothstep(.42,.8,noise(p*5.));c=mix(c,vec3(.31,.49,.32),grass*.55);
vec2 cells=p*2.5;vec2 id=floor(cells),f=fract(cells);float rnd=hash21(id);vec2 q=f-vec2(.22+hash21(id+1.)*.55,.22+hash21(id+2.)*.55);float rock=1.-smoothstep(.045,.12,length(q*vec2(1.,1.6)));rock*=step(.78,rnd);c=mix(c,vec3(.39,.48,.37)+rnd*.10,rock*.6);
float a=sin(p.x*5.+sin(p.y*3.1+time*.35)*2.+time*.37);float b=sin(p.y*6.1+sin(p.x*2.6-time*.28)*2.);float caustic=pow(max(0.,1.-abs(a+b)*1.8),9.);c+=vec3(.18,.20,.10)*caustic*.55;float lens=clamp(length(grad)*1.5,0.,.35);c+=lens;
float shadow=exp(-dot((w.xz-bodyShadow.xz-vec2(.18,-.12))/vec2(.42,.64),(w.xz-bodyShadow.xz-vec2(.18,-.12))/vec2(.42,.64))*1.8)*.24;for(int i=0;i<2;i++){vec2 q=(w.xz-footShadows[i].xy)/vec2(.19,.29);shadow+=exp(-dot(q,q)*1.5)*.25;}c*=1.-clamp(shadow,0.,.52);c=mix(c,vec3(.26,.53,.43),depth*.28);color=vec4(fog(c,w,eye),1);}`;
const waterVS=GLSL+waveEncoding+`layout(location=0)in vec3 position;uniform mat4 vp;uniform vec2 center,simOrigin;uniform sampler2D waves;uniform float simSize,depth,encoded;out vec3 w;
void main(){w=vec3(position.x+center.x,depth,position.z+center.y);vec2 uv=(w.xz-simOrigin)/simSize+.5;float h=decodeWave(texture(waves,clamp(uv,0.,1.)),encoded).x;h*=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);w.y+=h*.5;gl_Position=vp*vec4(w,1);}`;
const waterFS=GLSL+common+waveEncoding+`in vec3 w;out vec4 color;uniform sampler2D waves;uniform vec2 simOrigin,worldOffset,texel;uniform float simSize,time,encoded,depth;uniform vec3 eye;uniform vec4 feet[2];
float H(vec2 p){vec2 uv=(p-simOrigin)/simSize+.5;float v=decodeWave(texture(waves,clamp(uv,0.,1.)),encoded).x;return v*step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);}
void main(){vec2 p=w.xz+worldOffset;float d=simSize*texel.x;float h=H(w.xz);vec2 g=vec2(H(w.xz+vec2(d,0))-H(w.xz-vec2(d,0)),H(w.xz+vec2(0,d))-H(w.xz-vec2(0,d)))/(2.*d);
vec2 wind=vec2(cos(p.x*2.4+p.y*1.3+time*.5)*.007+cos(p.x*7.5-p.y*4.2-time*.8)*.003,cos(p.y*3.6+p.x*.7-time*.4)*.007);vec3 N=normalize(vec3(-g.x*1.9-wind.x,1.,-g.y*1.9-wind.y));vec3 V=normalize(eye-w);float fresnel=.025+.7*pow(1.-max(dot(N,V),0.),5.);vec3 L=normalize(vec3(-.6,1.,.35));vec3 R=reflect(-V,N);float sun=pow(max(dot(R,L),0.),180.);float shine=pow(max(dot(N,normalize(L+V)),0.),90.);
vec3 reflection=mix(vec3(.51,.72,.67),vec3(.85,.87,.72),smoothstep(-.1,.75,R.y));reflection+=vec3(1.,.85,.50)*sun*.8;float foam=0.;for(int i=0;i<2;i++){float r=length(w.xz-feet[i].xy);foam+=exp(-pow((r-.12)/.04,2.))*feet[i].z;}foam+=smoothstep(.027,.09,length(g))*smoothstep(.025,.09,abs(h))*.18;
vec3 c=mix(vec3(.37,.66,.55),reflection,fresnel*1.7);c+=vec3(.9,.92,.75)*(shine*.35+foam*.38);float opacity=clamp(.11+fresnel*.65+shine*.16+foam*.2,.1,.65);color=vec4(fog(c,w,eye),opacity);}`;
const skyFS=GLSL+`in vec2 uv;out vec4 color;uniform float time;void main(){vec3 c=mix(vec3(.52,.72,.64),vec3(.79,.84,.72),smoothstep(.0,1.,uv.y));color=vec4(c,1);}`;
const fishVS=GLSL+`layout(location=0)in vec3 position;layout(location=1)in vec3 normal;layout(location=2)in vec4 instance;layout(location=3)in vec4 behavior;uniform mat4 vp;uniform float time,depth;out vec3 w,n;out float shade;
void main(){vec3 p=position;float tail=smoothstep(-.1,.4,p.z);p.x+=sin(time*(7.+behavior.y*9.)+behavior.z-p.z*7.)*.075*tail*tail*(.3+behavior.y);p*=instance.w;float s=sin(instance.z),c=cos(instance.z);mat3 rot=mat3(c,0,-s,0,1,0,s,0,c);w=rot*p+vec3(instance.x,min(depth-.06,.14)+sin(time+behavior.z)*.018,instance.y);n=rot*normal;shade=behavior.x;gl_Position=vp*vec4(w,1);}`;
const fishFS=GLSL+common+`in vec3 w,n;in float shade;out vec4 color;uniform vec3 eye;void main(){vec3 c=mix(vec3(.23,.43,.39),vec3(.65,.66,.40),shade);float lit=max(dot(normalize(n),normalize(vec3(-.6,1.,.35))),0.);c*=.62+lit*.5;c+=pow(max(dot(normalize(n),normalize(vec3(-.6,1.,.35))),0.),10.)*.18;color=vec4(fog(c,w,eye),1);}`;
let programs;
try{programs={sim:program(simVS,simFS),mesh:program(meshVS,meshFS),ground:program(groundVS,groundFS),water:program(waterVS,waterFS),sky:program(simVS,skyFS),fish:program(fishVS,fishFS)};}catch(e){console.error(e);$('error').classList.remove('hidden');return;}
const shapes={sphere:sphere(),cylinder:cylinder(),ground:grid(1,220),water:grid(112,80)};
const quad=gl.createVertexArray();
// A tapered body and flexible tail, along local -Z (forward).
function fishMesh(){let p=[],n=[],idx=[];const sections=[[-.58,.001],[-.4,.065],[-.2,.10],[0,.075],[.23,.022],[.34,.015],[.5,.10]];for(let k=0;k<sections.length;k++)for(let i=0;i<8;i++){let a=i/8*TAU,[z,r]=sections[k];p.push(Math.cos(a)*r,Math.sin(a)*r*.58,z);n.push(Math.cos(a),Math.sin(a),0);}for(let k=0;k<sections.length-1;k++)for(let i=0;i<8;i++){let a=k*8+i,b=k*8+(i+1)%8;idx.push(a,a+8,b,b,a+8,b+8);}return mesh(p,n,idx);}
const fishShape=fishMesh(),instanceBuffer=gl.createBuffer(),behaviorBuffer=gl.createBuffer();
gl.bindVertexArray(fishShape.vao);for(const [loc,b] of [[2,instanceBuffer],[3,behaviorBuffer]]){gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,4,gl.FLOAT,false,0,0);gl.vertexAttribDivisor(loc,1);}gl.bindVertexArray(null);
const floatRT=!!gl.getExtension('EXT_color_buffer_float');
let simN=192,simSize=16,sim=[],read=0,simOrigin=[0,0],simAcc=0;
function initSimulation(n){for(const r of sim){gl.deleteFramebuffer(r.fbo);gl.deleteTexture(r.tex);}sim=[];simN=n;for(let i=0;i<2;i++){let tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,floatRT?gl.RG16F:gl.RGBA8,n,n,0,floatRT?gl.RG:gl.RGBA,floatRT?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,floatRT?gl.LINEAR:gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,floatRT?gl.LINEAR:gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);let fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Water framebuffer unavailable');gl.clearColor(floatRT?0:127/255,floatRT?0:1,floatRT?0:127/255,1);gl.clear(gl.COLOR_BUFFER_BIT);sim.push({tex,fbo});}gl.bindFramebuffer(gl.FRAMEBUFFER,null);read=0;}
try{initSimulation(matchMedia('(pointer:coarse)').matches?160:224);}catch(e){console.error(e);$('error').classList.remove('hidden');return;}
let started=false,paused=false,time=0,depth=.32,speed=0,targetSpeed=0,heading=0,turn=0,distance=0,stillTime=10,worldOffset=[0,0],frameNo=0;
const player=[0,0,0];
const legs=[{side:-1,foot:[-.15,.045,0],start:[-.15,.045,0],end:[-.15,.045,0],swing:false,t:0,old:[-.15,.045,0],force:0,wet:1},{side:1,foot:[.15,.045,0],start:[.15,.045,0],end:[.15,.045,0],swing:false,t:0,old:[.15,.045,0],force:0,wet:1}];
let nextLeg=0,stepClock=0,bob=0,lean=0;
const forward=()=>[Math.sin(heading),0,-Math.cos(heading)];
const local=(x,y,z)=>[player[0]+Math.cos(heading)*x-Math.sin(heading)*z,y,player[2]+Math.sin(heading)*x+Math.cos(heading)*z];
function stepLeg(leg){leg.start=leg.foot.slice();const stride=.22+speed*.26;leg.end=local(leg.side*.145,.045,-stride);leg.t=0;leg.swing=true;leg.duration=clamp(.42-speed*.10,.24,.42);}
function updateLegs(dt){stepClock-=dt;const f=forward();if(speed>.04&&stepClock<=0){let leg=legs[nextLeg];if(!leg.swing){stepLeg(leg);nextLeg=1-nextLeg;stepClock=clamp(.47-speed*.115,.25,.46);}}
for(const leg of legs){leg.old=leg.foot.slice();if(leg.swing){leg.t=Math.min(1,leg.t+dt/leg.duration);let t=leg.t,s=t*t*(3-2*t);leg.foot=[lerp(leg.start[0],leg.end[0],s),.045+Math.sin(PI*t)*(.10+speed*.06),lerp(leg.start[2],leg.end[2],s)];if(t>=1){leg.swing=false;if(soundOn)splash(.2+speed*.3);}}
// Feet remain planted in world space; correct only by taking another step.
let delta=sub(leg.foot,local(leg.side*.145,.045,0));if(!leg.swing&&len(delta)>.59){stepLeg(leg);}
const v=len(sub(leg.foot,leg.old))/Math.max(dt,.001);let immersion=clamp((depth-leg.foot[1])/.15,0,1);leg.force=clamp(v*.55,0,1.8)*immersion;leg.wet=immersion;}
bob=smooth(bob,speed>.04?Math.sin(time*(2.1+speed)*TAU)*.016*clamp(speed,0,1):Math.sin(time*1.7)*.005,dt*9);lean=smooth(lean,speed*.04,dt*4);}
const fishCount=72,fish=[],fishInstances=new Float32Array(fishCount*4),fishBehavior=new Float32Array(fishCount*4);
for(let i=0;i<fishCount;i++){let angle=hash(i+1)*TAU,r=1.5+hash(i+99)*13;fish.push({x:Math.cos(angle)*r,z:Math.sin(angle)*r,vx:0,vz:0,a:angle,size:.25+hash(i+8)*.19,seed:hash(i+11)*TAU,timid:hash(i+5),fear:0,cruise:.17+hash(i+4)*.12});}
let curiousCount=0;
function updateFish(dt){curiousCount=0;for(let i=0;i<fish.length;i++){let f=fish[i],dx=f.x-player[0],dz=f.z-player[2],d=Math.hypot(dx,dz);if(d>19){let a=hash(i+Math.floor(time*.7)+313)*TAU;f.x=player[0]+Math.sin(a)*(12+hash(i+time)*3);f.z=player[2]+Math.cos(a)*(12+hash(i+time)*3);f.vx=0;f.vz=0;dx=f.x-player[0];dz=f.z-player[2];d=Math.hypot(dx,dz);}
let fx=0,fz=0,v=f.cruise;
let danger=speed>.10&&d<3.2+speed*.6;if(danger)f.fear=1;else f.fear=Math.max(0,f.fear-dt*.27);
if(f.fear>.08){fx=dx/(d||1);fz=dz/(d||1);v=.4+f.fear*(1.+speed*.45);fx+=Math.sin(time*3+f.seed)*.3;fz+=Math.cos(time*2+f.seed)*.3;}
else if(stillTime>1.5+f.timid*2&&d<10){const leg=legs[i%2];let orbit=.4+f.timid*.52;let a=time*(.24+f.timid*.22)+f.seed;let tx=leg.foot[0]+Math.cos(a)*orbit,tz=leg.foot[2]+Math.sin(a)*orbit;fx=tx-f.x;fz=tz-f.z;v=Math.min(.45,Math.hypot(fx,fz)*.7+.05);if(d<1.7)curiousCount++;}
else {let a=f.seed+Math.sin(time*.13+f.seed)*1.6;fx=Math.sin(a);fz=Math.cos(a);if(d<1.2){fx+=dx*2;fz+=dz*2;}}
// Soft local separation and avoidance of the two actual feet, even at rest.
for(let j=0;j<fish.length;j++){if(j===i)continue;let o=fish[j],x=f.x-o.x,z=f.z-o.z,dd=x*x+z*z;if(dd<.18&&dd>.0001){fx+=x/(dd+.06)*.04;fz+=z/(dd+.06)*.04;}}
for(const leg of legs){let x=f.x-leg.foot[0],z=f.z-leg.foot[2],dd=x*x+z*z;if(dd<.10){fx+=x/(dd+.008)*.18;fz+=z/(dd+.008)*.18;}}
let m=Math.hypot(fx,fz)||1;f.vx=smooth(f.vx,fx/m*v,dt*(danger?9:3));f.vz=smooth(f.vz,fz/m*v,dt*(danger?9:3));f.x+=f.vx*dt;f.z+=f.vz*dt;if(Math.hypot(f.vx,f.vz)>.01)f.a=Math.atan2(-f.vx,-f.vz);fishInstances.set([f.x,f.z,f.a,f.size],i*4);fishBehavior.set([f.timid,Math.hypot(f.vx,f.vz),f.seed,0],i*4);}}
// Small reed islands and lily pads are generated by world-cell coordinates.
let environment=null,envKey='';
const envVS=GLSL+`layout(location=0)in vec3 position;layout(location=1)in vec3 normal;layout(location=2)in vec3 tint;uniform mat4 vp;uniform float time;out vec3 w,n,col;void main(){w=position;w.x+=sin(time*.8+w.z*.4)*.05*pow(max(w.y,0.),2.);n=normal;col=tint;gl_Position=vp*vec4(w,1);}`;
const envFS=GLSL+common+`in vec3 w,n,col;out vec4 color;uniform vec3 eye;void main(){float l=abs(dot(normalize(n),normalize(vec3(-.6,1.,.35))));color=vec4(fog(col*(.72+l*.28),w,eye),1);}`;
programs.env=program(envVS,envFS);
function makeEnvironment(){const cx=Math.floor((player[0]+worldOffset[0])/8),cz=Math.floor((player[2]+worldOffset[1])/8);let key=cx+','+cz+','+depth.toFixed(2)+','+worldOffset.join(',');if(key===envKey)return;envKey=key;
let pos=[],nor=[],cols=[],idx=[];
function tri(a,b,c,col){let k=pos.length/3,n=norm(cross(sub(b,a),sub(c,a)));pos.push(...a,...b,...c);nor.push(...n,...n,...n);cols.push(...col,...col,...col);idx.push(k,k+1,k+2);}
for(let z=cz-4;z<=cz+4;z++)for(let x=cx-4;x<=cx+4;x++){let seed=hash(x,z);if(seed>.24)continue;let px=x*8+hash(x+40,z)*6-worldOffset[0],pz=z*8+hash(x,z+90)*6-worldOffset[1];if(Math.hypot(px-player[0],pz-player[2])>33)continue;
if(seed<.07){for(let j=0;j<11;j++){let a=hash(x+j*3,z+6)*TAU,r=hash(x+j,z)*.48,sx=px+Math.cos(a)*r,sz=pz+Math.sin(a)*r,h=.5+hash(x+j,z+19)*.8;let w=.025+hash(x+1,z+j)*.015;let top=[sx+Math.cos(a)*.1,h,sz+Math.sin(a)*.1],base=[sx,depth-.04,sz];let side=[Math.cos(a)*w,0,Math.sin(a)*w];tri(sub(base,side),add(base,side),top,[.24+seed,.40+hash(j,x)*.08,.22]);let leaf=[sx+Math.sin(a)*.2,h*.8,sz+Math.cos(a)*.24],mid=[sx,h*.48,sz];tri(sub(mid,side),add(mid,side),leaf,[.32,.47,.25]);if(j%3===0){let q=[top[0],top[1]+.12,top[2]];tri(sub(top,mul(side,1.9)),add(top,mul(side,1.9)),q,[.37,.29,.17]);}}}
else {for(let j=0;j<3;j++){let a=hash(x+j,z+2)*TAU,r=hash(x+j,z+33)*.6,sx=px+Math.cos(a)*r,sz=pz+Math.sin(a)*r,rad=.16+hash(x,z+j)*.17;let cent=[sx,depth+.012,sz];for(let k=1;k<19;k++){let aa=(k/20)*TAU+a,bb=((k+1)/20)*TAU+a;tri(cent,[sx+Math.cos(aa)*rad,depth+.008,sz+Math.sin(aa)*rad],[sx+Math.cos(bb)*rad,depth+.008,sz+Math.sin(bb)*rad],[.26,.44+seed*.2,.26]);}if(j===0&&seed<.12){let cent=[sx,depth+.08,sz];for(let k=0;k<7;k++){let aa=k/7*TAU;tri(cent,[sx+Math.cos(aa)*.09,depth+.025,sz+Math.sin(aa)*.09],[sx+Math.cos(aa+.55)*.07,depth+.025,sz+Math.sin(aa+.55)*.07],[.91,.88,.69]);}}}}
}
if(environment){for(const b of environment.buffers)gl.deleteBuffer(b);gl.deleteVertexArray(environment.vao);}let vao=gl.createVertexArray(),buffers=[];gl.bindVertexArray(vao);for(const [loc,data] of [[0,pos],[1,nor],[2,cols]]){let b=gl.createBuffer();buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);}let b=gl.createBuffer();buffers.push(b);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(idx),gl.STATIC_DRAW);gl.bindVertexArray(null);environment={vao,count:idx.length,buffers};}
let viewProjection=ident(),eye=[0,6,8],cameraAngle=0;
const colors={skin:[.75,.55,.37],shirt:[.77,.34,.24],shorts:[.22,.36,.32],hat:[.88,.80,.58],band:[.44,.41,.27],pack:[.68,.56,.32]};
function drawMesh(shape,model,col,alpha=1){const p=programs.mesh;uniform(p,'model','m4',model);uniform(p,'tint','3fv',col);uniform(p,'alpha','1f',alpha);gl.bindVertexArray(shape.vao);gl.drawElements(gl.TRIANGLES,shape.count,gl.UNSIGNED_SHORT,0);}
function ellipsoid(p,s,col,rot=heading){drawMesh(shapes.sphere,trs(p,s,rot),col);}
function limb(a,b,r,col,r2=r){drawMesh(shapes.cylinder,segment(a,b,r,r2),col);}
function legKnee(hip,ankle){const axis=norm(sub(ankle,hip)),d=Math.min(len(sub(ankle,hip)),.85),L=.43;const along=d*.5,bend=Math.sqrt(Math.max(0,L*L-along*along));const f=forward();let plane=norm(sub(f,mul(axis,dot(f,axis))));return add(add(hip,mul(axis,along)),mul(plane,bend));}
function drawPlayer(){const p=programs.mesh;gl.useProgram(p.p);uniform(p,'vp','m4',viewProjection);uniform(p,'eye','3fv',eye);uniform(p,'depth','1f',depth);const hipY=.885+bob;const torso=local(0,1.15+bob,-lean);ellipsoid(torso,[.225,.30,.14],colors.shirt);ellipsoid(local(0,hipY,.015),[.225,.145,.15],colors.shorts);
for(const leg of legs){const hip=local(leg.side*.135,hipY,0),ankle=add(leg.foot,[0,.075,.015]);const knee=legKnee(hip,ankle);let hem=add(hip,mul(sub(knee,hip),.66));limb(hip,hem,.103,colors.shorts,.10);limb(hem,knee,.075,colors.skin,.073);ellipsoid(knee,[.076,.079,.076],colors.skin);limb(knee,ankle,.060,colors.skin,.065);const foot=add(leg.foot,mul(forward(),.058));let roll=leg.swing?Math.sin(leg.t*TAU)*.2:0;let m=trs(foot,[.074,.05,.16],heading);if(roll){let c=Math.cos(roll),s=Math.sin(roll),rx=new Float32Array([1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]);m=mm(m,rx);}drawMesh(shapes.sphere,m,colors.skin);
const armSwing=clamp(dot(sub(leg.foot,player),forward())*speed*.38,-.18,.18);const shoulder=local(leg.side*.22,1.34+bob,-lean),elbow=local(leg.side*(.29+speed*.016),1.10+bob,armSwing-lean),wrist=local(leg.side*.28,.875+bob,armSwing*1.4-lean);limb(shoulder,add(shoulder,mul(sub(elbow,shoulder),.4)),.085,colors.shirt);limb(add(shoulder,mul(sub(elbow,shoulder),.4)),elbow,.055,colors.skin);limb(elbow,wrist,.048,colors.skin);ellipsoid(wrist,[.05,.076,.048],colors.skin);}
limb(local(0,1.36+bob,-lean),local(0,1.48+bob,-lean),.068,colors.skin);ellipsoid(local(0,1.57+bob,-lean),[.143,.18,.137],colors.skin);ellipsoid(local(0,1.59+bob,-.144-lean),[.042,.042,.028],colors.skin);drawMesh(shapes.cylinder,trs(local(0,1.69+bob,-lean),[.32,.025,.29],heading),colors.hat);ellipsoid(local(0,1.735+bob,-lean),[.213,.12,.20],colors.hat);drawMesh(shapes.cylinder,trs(local(0,1.695+bob,-lean),[.21,.046,.198],heading),colors.band);
ellipsoid(local(0,1.15+bob,.137-lean),[.147,.22,.068],colors.pack);for(let s of [-1,1])limb(local(s*.12,1.38+bob,.065-lean),local(s*.12,.95+bob,.13-lean),.018,colors.band);}
function updateWater(dt){simAcc=Math.min(simAcc+dt,.08);let h=1/60,count=0;const p=programs.sim;gl.useProgram(p.p);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.bindVertexArray(quad);uniform(p,'state','1i',0);uniform(p,'texel','2fv',[1/simN,1/simN]);uniform(p,'dt','1f',h);uniform(p,'c2','1f',Math.min(9.81*depth/((simSize/simN)**2),.35/(h*h)));uniform(p,'encoded','1f',floatRT?0:1);
while(simAcc>=h&&count<4){let nextOrigin=[player[0],player[2]],shift=[(nextOrigin[0]-simOrigin[0])/simSize,(nextOrigin[1]-simOrigin[1])/simSize];uniform(p,'shift','2fv',shift);let forces=[];for(const leg of legs){let foot=leg.foot;forces.push((foot[0]-nextOrigin[0])/simSize+.5,(foot[2]-nextOrigin[1])/simSize+.5,.17/simSize,-leg.force*28.);}
for(const leg of legs){let hip=local(leg.side*.135,.885+bob,0),ankle=add(leg.foot,[0,.075,0]),knee=legKnee(hip,ankle),t=clamp((depth-ankle[1])/(knee[1]-ankle[1]),0,1),shin=add(ankle,mul(sub(knee,ankle),t));forces.push((shin[0]-nextOrigin[0])/simSize+.5,(shin[2]-nextOrigin[1])/simSize+.5,.12/simSize,-(speed*.25+leg.force*.5)*14.);}
uniform(p,'forces[0]','4fv',forces);gl.bindFramebuffer(gl.FRAMEBUFFER,sim[1-read].fbo);gl.viewport(0,0,simN,simN);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,sim[read].tex);gl.drawArrays(gl.TRIANGLES,0,3);read=1-read;simOrigin=nextOrigin;simAcc-=h;count++;}gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
function bindWaves(p){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,sim[read].tex);uniform(p,'waves','1i',0);uniform(p,'simOrigin','2fv',simOrigin);uniform(p,'worldOffset','2fv',worldOffset);uniform(p,'simSize','1f',simSize);uniform(p,'texel','2fv',[1/simN,1/simN]);uniform(p,'encoded','1f',floatRT?0:1);}
let pixelScale=Math.min(devicePixelRatio||1,1.5),quality='auto';
function resize(){const w=Math.round(innerWidth*pixelScale),h=Math.round(innerHeight*pixelScale);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}}resize();addEventListener('resize',resize);
function render(){gl.viewport(0,0,canvas.width,canvas.height);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.depthMask(true);let p=programs.sky;gl.useProgram(p.p);gl.bindVertexArray(quad);uniform(p,'time','1f',time);gl.drawArrays(gl.TRIANGLES,0,3);gl.clear(gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
const portrait=canvas.height>canvas.width;const aspect=canvas.width/canvas.height;
cameraAngle=smooth(cameraAngle,heading,1/60*2.5);const camR=portrait?6.4:6.8,camH=portrait?6.3:5.4;eye=[player[0]-Math.sin(cameraAngle)*camR,camH,player[2]+Math.cos(cameraAngle)*camR];const target=[player[0]+Math.sin(cameraAngle)*1.7,.42,player[2]-Math.cos(cameraAngle)*1.7];viewProjection=mm(perspective((portrait?53:46)*PI/180,aspect,.08,250),lookAt(eye,target));
p=programs.ground;gl.useProgram(p.p);bindWaves(p);uniform(p,'vp','m4',viewProjection);uniform(p,'center','2fv',[player[0],player[2]]);uniform(p,'time','1f',time);uniform(p,'depth','1f',depth);uniform(p,'eye','3fv',eye);uniform(p,'bodyShadow','3fv',local(0,.8,0));uniform(p,'footShadows[0]','4fv',legs.flatMap(l=>[l.foot[0],l.foot[2],l.foot[1],0]));gl.bindVertexArray(shapes.ground.vao);gl.drawElements(gl.TRIANGLES,shapes.ground.count,gl.UNSIGNED_SHORT,0);
p=programs.fish;gl.useProgram(p.p);uniform(p,'vp','m4',viewProjection);uniform(p,'eye','3fv',eye);uniform(p,'time','1f',time);uniform(p,'depth','1f',depth);gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer);gl.bufferData(gl.ARRAY_BUFFER,fishInstances,gl.DYNAMIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,behaviorBuffer);gl.bufferData(gl.ARRAY_BUFFER,fishBehavior,gl.DYNAMIC_DRAW);gl.bindVertexArray(fishShape.vao);gl.drawElementsInstanced(gl.TRIANGLES,fishShape.count,gl.UNSIGNED_SHORT,0,fishCount);
makeEnvironment();p=programs.env;gl.useProgram(p.p);uniform(p,'vp','m4',viewProjection);uniform(p,'eye','3fv',eye);uniform(p,'time','1f',time);gl.bindVertexArray(environment.vao);gl.drawElements(gl.TRIANGLES,environment.count,gl.UNSIGNED_SHORT,0);
drawPlayer();p=programs.water;gl.useProgram(p.p);bindWaves(p);uniform(p,'vp','m4',viewProjection);uniform(p,'center','2fv',[player[0],player[2]]);uniform(p,'eye','3fv',eye);uniform(p,'time','1f',time);uniform(p,'depth','1f',depth);uniform(p,'feet[0]','4fv',legs.flatMap(l=>[l.foot[0],l.foot[2],l.force*.5,0]));gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.bindVertexArray(shapes.water.vao);gl.drawElements(gl.TRIANGLES,shapes.water.count,gl.UNSIGNED_SHORT,0);gl.depthMask(true);gl.disable(gl.BLEND);gl.bindVertexArray(null);}
// Origin rebasing bounds render coordinates without limiting accumulated travel.
function rebase(){if(Math.hypot(player[0],player[2])<128)return;let sx=Math.round(player[0]/64)*64,sz=Math.round(player[2]/64)*64;player[0]-=sx;player[2]-=sz;worldOffset[0]+=sx;worldOffset[1]+=sz;for(const l of legs)for(const k of ['foot','start','end','old']){l[k][0]-=sx;l[k][2]-=sz;}for(const f of fish){f.x-=sx;f.z-=sz;}simOrigin[0]-=sx;simOrigin[1]-=sz;envKey='';}
let pointer=null,anchor=[0,0],finger=[0,0],didMove=false,keys=new Set(),hintTimer=0,uiTimer=0;
function guide(){const on=pointer!==null&&$('guideToggle').checked;$('touchGuide').style.opacity=on?'1':'0';if(!on)return;let [x,y]=anchor,[a,b]=finger;for(const [id,px,py] of [['touchOrigin',x,y],['touchThumb',a,b],['touchText',a,b]]){let el=$(id);el.style.left=px+'px';el.style.top=py+'px';}let line=$('touchLine');line.style.left=x+'px';line.style.top=y+'px';line.style.width=Math.hypot(a-x,b-y)+'px';line.style.transform=`rotate(${Math.atan2(b-y,a-x)}rad)`;$('touchText').textContent=targetSpeed>.9?'BRISK':targetSpeed>.1?'WADE':'STILL';}
function controlFromTouch(){let range=clamp(innerHeight*.26,100,230);targetSpeed=clamp(.32+(anchor[1]-finger[1])/range*1.5,0,1.8);turn=clamp((finger[0]-anchor[0])/Math.min(140,innerWidth*.3),-1,1);guide();}
canvas.addEventListener('pointerdown',e=>{if(!started||paused||pointer!==null)return;pointer=e.pointerId;anchor=[e.clientX,e.clientY];finger=anchor.slice();canvas.setPointerCapture(e.pointerId);controlFromTouch();if(soundOn&&audio?.state==='suspended')audio.resume();});
canvas.addEventListener('pointermove',e=>{if(e.pointerId!==pointer)return;finger=[e.clientX,e.clientY];controlFromTouch();if(Math.hypot(finger[0]-anchor[0],finger[1]-anchor[1])>15){didMove=true;hintTimer=3;}});
function stopInput(){pointer=null;targetSpeed=0;turn=0;keys.clear();guide();}
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(e.pointerId===pointer)stopInput();});
addEventListener('blur',stopInput);
addEventListener('keydown',e=>{if(!started||paused||e.target.matches('input,select,button'))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','w','a','s','d','W','A','S','D'].includes(e.key)){e.preventDefault();keys.add(e.key.toLowerCase());didMove=true;hintTimer=3;if(e.key===' '){targetSpeed=0;keys.clear();}}});
addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());if(!keys.size&&pointer===null){targetSpeed=0;turn=0;}});
function updateControls(dt){if(pointer===null&&keys.size){if(keys.has('w')||keys.has('arrowup'))targetSpeed=clamp(targetSpeed+dt*.8,.3,1.8);if(keys.has('s')||keys.has('arrowdown'))targetSpeed=Math.max(0,targetSpeed-dt*1.4);turn=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);}}
$('begin').addEventListener('click',()=>{started=true;$('intro').classList.add('leaving');$('hud').classList.remove('hidden');setTimeout(()=>$('intro').classList.add('hidden'),1100);});
function settings(open){paused=open;stopInput();$('settings').classList.toggle('hidden',!open);$('settingsBtn').setAttribute('aria-expanded',String(open));}
$('settingsBtn').onclick=()=>settings(!paused);$('closeSettings').onclick=()=>settings(false);addEventListener('keydown',e=>{if(e.key==='Escape')settings(false);});
$('depth').oninput=e=>{depth=Number(e.target.value);$('depthVal').textContent=depth<.22?'Ankle deep':depth>.41?'Knee deep':'Shin deep';envKey='';};
$('quality').onchange=e=>{quality=e.target.value;pixelScale=quality==='low'?1:Math.min(devicePixelRatio||1,quality==='high'?2:1.5);initSimulation(quality==='high'?256:quality==='low'?128:matchMedia('(pointer:coarse)').matches?160:224);resize();};$('guideToggle').onchange=guide;
let audio=null,soundOn=false,master=null;
function initAudio(){const C=window.AudioContext||window.webkitAudioContext;if(!C)return;audio=new C();master=audio.createGain();master.gain.value=.22;master.connect(audio.destination);const b=audio.createBuffer(1,audio.sampleRate*3,audio.sampleRate),d=b.getChannelData(0);let last=0;for(let i=0;i<d.length;i++){last=(last+(Math.random()*2-1)*.03)*.99;d[i]=last;}let src=audio.createBufferSource();src.buffer=b;src.loop=true;let filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=400;let gain=audio.createGain();gain.gain.value=.2;src.connect(filter);filter.connect(gain);gain.connect(master);src.start();}
function splash(strength){if(!audio||audio.state!=='running'||!soundOn)return;let dur=.24+strength*.13,b=audio.createBuffer(1,Math.ceil(audio.sampleRate*dur),audio.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++){let t=i/d.length;d[i]=(Math.random()*2-1)*Math.pow(1-t,2)*Math.min(t*20,1)*strength*.22;}let src=audio.createBufferSource(),filter=audio.createBiquadFilter();src.buffer=b;filter.type='bandpass';filter.frequency.value=600+strength*500;filter.Q.value=.5;src.connect(filter);filter.connect(master);src.start();src.onended=()=>{src.disconnect();filter.disconnect();};}
$('sound').onclick=()=>{if(!audio)initAudio();if(!audio)return;soundOn=!soundOn;if(soundOn)audio.resume();master.gain.setTargetAtTime(soundOn ? .22 : 0,audio.currentTime,.15);$('sound').setAttribute('aria-label',soundOn?'Mute water sound':'Enable water sound');$('soundwave').setAttribute('d',soundOn?'M17 8c2 2 2 6 0 8M20 5c4 4 4 10 0 14':'m17 9 4 6m0-6-4 6');};
let last=performance.now(),frameAverage=16.7,adaptClock=0,hidden=false;
document.addEventListener('visibilitychange',()=>{hidden=document.hidden;stopInput();if(hidden&&audio)audio.suspend();else{last=performance.now();simAcc=0;if(soundOn&&audio)audio.resume();}});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();hidden=true;$('error').classList.remove('hidden');});canvas.addEventListener('webglcontextrestored',()=>location.reload());
function frame(now){requestAnimationFrame(frame);if(hidden)return;let elapsed=now-last;last=now;let dt=clamp(elapsed/1000,0,.05);frameAverage=lerp(frameAverage,Math.min(elapsed,100),.025);time+=dt;
updateControls(dt);speed=smooth(speed,started&&!paused?targetSpeed:0,dt*(targetSpeed>speed?1.7:3.5));if(speed<.002)speed=0;heading+=turn*dt*(.65+speed*.15);let f=forward();player[0]+=f[0]*speed*dt;player[2]+=f[2]*speed*dt;distance+=speed*dt;stillTime=speed<.07?stillTime+dt:0;updateLegs(dt);rebase();updateFish(dt);updateWater(dt);render();frameNo++;
uiTimer+=dt;if(uiTimer>.2){uiTimer=0;$('distance').textContent=Math.floor(distance);$('speedFill').style.height=(speed/1.8*100)+'%';$('speedLabel').textContent=speed<.05?'STILL':speed<.45?'DRIFT':speed<1.1?'WADE':'BRISK';$('fishState').textContent=speed>.2?'The fish make room for you':curiousCount>0?`${curiousCount} curious ${curiousCount===1?'visitor':'visitors'}`:stillTime>3?'Wait gently. They’ll come closer.':'The shallows are settling';}
if(didMove){hintTimer-=dt;if(hintTimer<=0)$('hint').style.opacity='0';}
adaptClock+=dt;if(quality==='auto'&&adaptClock>8){adaptClock=0;if(frameAverage>25&&pixelScale>1){pixelScale=Math.max(1,pixelScale-.25);resize();}if(frameAverage>34&&simN>128)initSimulation(128);}}
// Read-only diagnostics for meaningful automated checks and future tuning.
window.Wade={get state(){return {started,speed,targetSpeed,heading,distance,stillTime,curiousCount,player:player.slice(),worldOffset:worldOffset.slice(),legs:legs.map(l=>({foot:l.foot.slice(),swing:l.swing})),fish:fish.map(f=>({x:f.x,z:f.z,fear:f.fear})),simulation:{resolution:simN,floatRT,frameAverage},frames:frameNo};}};
requestAnimationFrame(frame);
})();
