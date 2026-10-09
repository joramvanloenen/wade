import ctypes as C, os, re, json
from pathlib import Path
os.environ['EGL_PLATFORM']='surfaceless'
egl=C.CDLL('libEGL.so.1'); gl=C.CDLL('libGL.so.1')
def fn(lib,name,restype,args):
 f=getattr(lib,name);f.restype=restype;f.argtypes=args;return f
ptr=C.c_void_p; i=C.c_int; u=C.c_uint; f=C.c_float
getdisplay=fn(egl,'eglGetDisplay',ptr,[ptr]); display=getdisplay(None)
a=i();b=i();assert fn(egl,'eglInitialize',u,[ptr,C.POINTER(i),C.POINTER(i)])(display,C.byref(a),C.byref(b))
assert fn(egl,'eglBindAPI',u,[u])(0x30A0)
attrs=(i*13)(0x3024,8,0x3023,8,0x3022,8,0x3025,24,0x3033,1,0x3040,0x40,0x3038)
config=ptr(); num=i();assert fn(egl,'eglChooseConfig',u,[ptr,C.POINTER(i),C.POINTER(ptr),i,C.POINTER(i)])(display,attrs,C.byref(config),1,C.byref(num)) and num.value
ctx=fn(egl,'eglCreateContext',ptr,[ptr,ptr,ptr,C.POINTER(i)])(display,config,None,(i*3)(0x3098,3,0x3038))
surf=fn(egl,'eglCreatePbufferSurface',ptr,[ptr,ptr,C.POINTER(i)])(display,config,(i*5)(0x3057,960,0x3056,720,0x3038))
assert ctx and surf and fn(egl,'eglMakeCurrent',u,[ptr,ptr,ptr,ptr])(display,surf,surf,ctx)
getstr=fn(gl,'glGetString',C.c_char_p,[u]);print('Native validation:',getstr(0x1F02).decode())
create=fn(gl,'glCreateShader',u,[u]);source=fn(gl,'glShaderSource',None,[u,i,C.POINTER(C.c_char_p),C.POINTER(i)]);compile=fn(gl,'glCompileShader',None,[u]);get=fn(gl,'glGetShaderiv',None,[u,u,C.POINTER(i)]);log=fn(gl,'glGetShaderInfoLog',None,[u,i,C.POINTER(i),C.c_void_p])
if __name__=='__main__':
 shaders=json.load(open(Path(__file__).parent/'.output'/'shaders.json'))
 for j,s in enumerate(shaders):
  shader=create(s['type']);data=C.c_char_p(s['source'].encode());source(shader,1,C.byref(data),None);compile(shader);ok=i();get(shader,0x8B81,C.byref(ok))
  if not ok.value:
   buf=C.create_string_buffer(8192);log(shader,8192,None,buf);raise RuntimeError(f'Shader {j}: {buf.value.decode()}')
 print(f'{len(shaders)} GLSL ES shaders compiled successfully')
