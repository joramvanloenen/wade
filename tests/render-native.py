from importlib.machinery import SourceFileLoader
from pathlib import Path
root=Path(__file__).resolve().parent
output=root/'.output'
M=SourceFileLoader('native',str(root/'native-gl.py')).load_module()
C,gl=M.C,M.gl
import json,numpy as np,sys
from PIL import Image
ptr=C.c_void_p;i=C.c_int;u=C.c_uint;f=C.c_float
handles={}; arr_cache=[]
def resolve(x):
 if isinstance(x,dict) and 'handle' in x:return handles[x['handle']]
 return x
spec={
 'attachShader':(None,[u,u]),'deleteShader':(None,[u]),'compileShader':(None,[u]),'linkProgram':(None,[u]),'useProgram':(None,[u]),
 'bindVertexArray':(None,[u]),'bindBuffer':(None,[u,u]),'enableVertexAttribArray':(None,[u]),'vertexAttribDivisor':(None,[u,u]),
 'bindTexture':(None,[u,u]),'texParameteri':(None,[u,u,i]),'bindFramebuffer':(None,[u,u]),'framebufferTexture2D':(None,[u,u,u,u,i]),
 'clearColor':(None,[f,f,f,f]),'clear':(None,[u]),'viewport':(None,[i,i,i,i]),'activeTexture':(None,[u]),'disable':(None,[u]),'enable':(None,[u]),'depthMask':(None,[C.c_ubyte]),'depthFunc':(None,[u]),'blendFunc':(None,[u,u]),
 'drawArrays':(None,[u,i,i]),'uniform1i':(None,[i,i]),'uniform1f':(None,[i,f]),
}
for t in json.load(open(sys.argv[1] if len(sys.argv)>1 else output/'trace.json')):
 name=t['call'];args=[resolve(x) for x in t['args']];ret=t['ret'];val=None
 if name in ['createBuffer','createTexture','createVertexArray','createFramebuffer']:
  target={'createBuffer':'Buffers','createTexture':'Textures','createVertexArray':'VertexArrays','createFramebuffer':'Framebuffers'}[name];a=u();M.fn(gl,'glGen'+target,None,[i,C.POINTER(u)])(1,C.byref(a));val=a.value
 elif name in ['deleteBuffer','deleteTexture','deleteVertexArray','deleteFramebuffer']:
  target={'deleteBuffer':'Buffers','deleteTexture':'Textures','deleteVertexArray':'VertexArrays','deleteFramebuffer':'Framebuffers'}[name];a=u(args[0]);M.fn(gl,'glDelete'+target,None,[i,C.POINTER(u)])(1,C.byref(a))
 elif name=='createProgram':val=M.fn(gl,'glCreateProgram',u,[])()
 elif name=='createShader':val=M.create(*args)
 elif name=='shaderSource':
  data=C.c_char_p(args[1].encode());M.source(args[0],1,C.byref(data),None)
 elif name=='getUniformLocation':val=M.fn(gl,'glGetUniformLocation',i,[u,C.c_char_p])(args[0],args[1].encode())
 elif name=='bufferData':
  typ=C.c_ushort if args[0]==34963 else f;a=(typ*len(args[1]))(*args[1]);M.fn(gl,'glBufferData',None,[u,C.c_size_t,ptr,u])(args[0],C.sizeof(a),a,args[2])
 elif name=='vertexAttribPointer':M.fn(gl,'glVertexAttribPointer',None,[u,i,u,C.c_ubyte,i,ptr])(*args[:-1],ptr(args[-1]))
 elif name=='texImage2D':
  a=(C.c_ubyte*len(args[-1]))(*args[-1]) if isinstance(args[-1],list) else None;M.fn(gl,'glTexImage2D',None,[u,i,i,i,i,i,u,u,ptr])(*args[:-1],a)
 elif name=='uniformMatrix4fv':
  a=(f*len(args[2]))(*args[2]);M.fn(gl,'glUniformMatrix4fv',None,[i,i,C.c_ubyte,C.POINTER(f)])(args[0],1,args[1],a)
 elif name in ['uniform2fv','uniform3fv','uniform4fv']:
  a=(f*len(args[1]))(*args[1]);M.fn(gl,'gl'+name[0].upper()+name[1:],None,[i,i,C.POINTER(f)])(args[0],len(args[1])//int(name[7]),a)
 elif name=='drawElements':M.fn(gl,'glDrawElements',None,[u,i,u,ptr])(*args[:-1],ptr(args[-1]))
 elif name=='drawElementsInstanced':M.fn(gl,'glDrawElementsInstanced',None,[u,i,u,ptr,i])(*args[:3],ptr(args[3]),args[4])
 elif name in spec:M.fn(gl,'gl'+name[0].upper()+name[1:],*spec[name])(*[0 if a is None else a for a in args])
 else:raise RuntimeError('Unknown GL call '+name)
 if ret:handles[ret['handle']]=val
 err=M.fn(gl,'glGetError',u,[])()
 if err:raise RuntimeError(f'{name}: GL error {hex(err)}')
M.fn(gl,'glFinish',None,[])()
a=np.zeros((720,960,4),dtype=np.uint8);M.fn(gl,'glReadPixels',None,[i,i,i,i,u,u,ptr])(0,0,960,720,6408,5121,a.ctypes.data)
Image.fromarray(a[::-1]).convert('RGB').save(output/'wading.jpg' if len(sys.argv)>1 else output/'scene.jpg',quality=93)
print('Native GPU scene rendered without GL errors.')

if len(sys.argv)>1:
 data=json.load(open(sys.argv[1]));simfbos=[t['ret']['handle'] for t in data if t['call']=='createFramebuffer'][:2];lastfbo=next(t for t in reversed(data) if t['call']=='bindFramebuffer' and t['args'][1] is not None and t['args'][1]['handle'] in simfbos)['args'][1]['handle']
 M.fn(gl,'glBindFramebuffer',None,[u,u])(36160,handles[lastfbo])
 a=np.zeros((224,224,4),dtype=np.float32);M.fn(gl,'glReadPixels',None,[i,i,i,i,u,u,ptr])(0,0,224,224,6408,5126,a.ctypes.data)
 height=a[:,:,0];print('GPU ripple height range:',float(height.min()),float(height.max()))
 assert np.all(np.isfinite(height)) and np.max(np.abs(height))>.001 and np.max(np.abs(height))<.23,'stable, nonzero water field'
 print('PASS: actual GPU water responds to walking without reaching stability clamps.')
