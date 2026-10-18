"""Prepare the licensed Quaternius base; original clothes palette and animation.
Run: blender -b --python scripts/prepare-character.py -- input.glb output.glb
No network, external animation or proprietary asset is used by this script.
"""
import bpy, math, sys
from mathutils import Quaternion, Vector
args=sys.argv[sys.argv.index('--')+1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=args[0])
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
def mat(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.85
 return m
mats=[mat('Skin',(.43,.235,.13)),mat('Shirt',(.18,.35,.35)),mat('Trousers',(.045,.065,.09)),mat('Shoes',(.035,.027,.022)),mat('Hair',(.025,.018,.014)),mat('Eyes',(.1,.075,.05))]
for o in list(bpy.context.scene.objects):
 if o.type!='MESH':continue
 o.data.materials.clear()
 for m in mats:o.data.materials.append(m)
 for p in o.data.polygons:
  v=sum((o.matrix_world@o.data.vertices[i].co for i in p.vertices),Vector())/len(p.vertices)
  p.material_index=5 if 'Eyes' in o.name else 4 if 'Eyebrow' in o.name else 3 if v.z<.10 else 2 if v.z<.95 else 1 if v.z<1.56 and abs(v.x)<.53 else 0
  p.use_smooth=True
 if len(o.data.polygons)>3000:
  bpy.context.view_layer.objects.active=o
  mod=o.modifiers.new('Mobile topology','DECIMATE');mod.ratio=.58
  bpy.ops.object.modifier_apply(modifier=mod.name)
# A close-cropped original hair cap bound to the head, rather than another actor.
bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=1,location=(0,.02,1.775))
hair=bpy.context.object;hair.name='Cropped hair';hair.scale=(.101,.104,.052)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
hair.data.materials.append(mats[4]);g=hair.vertex_groups.new(name='Head');g.add(list(range(len(hair.data.vertices))),1,'REPLACE')
mod=hair.modifiers.new('Humanoid skin','ARMATURE');mod.object=rig
bones=list(rig.data.bones); rest={b.name:b.matrix_local.to_quaternion() for b in bones}
clips=['idle','walk','run','turn','talk','wait','sit_down','sit','stand','drink','pay','react','flee','enter','exit','takeover','smoke','prepare','sit_drink','sit_smoke','drive']
rig.animation_data_create()
for name in clips:
 action=bpy.data.actions.new(name);rig.animation_data.action=action
 for frame in range(0,31,2):
  t=frame/30;phase=t*math.tau;d={};rootdrop=0
  for side,sign in [('l',1),('r',-1)]:d['upperarm_'+side]=Quaternion((0,1,0),sign*1.35)
  if name in ['walk','run','flee']:
   amp=.72 if name in ['run','flee'] else .42
   for side,sign in [('l',1),('r',-1)]:
    swing=math.sin(phase)*sign
    d['thigh_'+side]=Quaternion((1,0,0),-amp*swing)
    d['calf_'+side]=Quaternion((1,0,0),-amp*swing+max(0,-swing)*amp*1.7)
    d['foot_'+side]=Quaternion((1,0,0),0)
    d['upperarm_'+side]=Quaternion((1,0,0),amp*swing*.65)@Quaternion((0,1,0),sign*1.35)
   rootdrop=.015*math.cos(phase*2)
  if name in ['sit','sit_down','stand','enter','exit','sit_drink','sit_smoke','drive']:
   f=1 if name in ['sit','sit_drink','sit_smoke','drive'] else t*t*(3-2*t) if name in ['sit_down','enter'] else 1-t*t*(3-2*t)
   rootdrop=-.40*f
   for side in ['l','r']:
    d['thigh_'+side]=Quaternion((1,0,0),-1.5*f);d['calf_'+side]=Quaternion((1,0,0),0);d['foot_'+side]=Quaternion((1,0,0),0)
  if name in ['talk','react','takeover','prepare']:
   d['upperarm_r']=Quaternion((1,0,0),-.45-.15*math.sin(phase))@Quaternion((0,1,0),-1.0)
   d['lowerarm_r']=Quaternion((1,0,0),-.95-.15*math.sin(phase))@Quaternion((0,1,0),-1.0)
  if name in ['drink','smoke','pay','sit_drink','sit_smoke']:
   # Original analytic two-bone IK: the grip reaches the cup/phone, not the wrist.
   shoulder=rig.data.bones['upperarm_r'].head_local.copy()
   sip=(math.sin(phase)+1)/2
   target=Vector((-.09,-.20,1.36+.20*sip)) if name!='pay' else Vector((-.13,-.29,1.30))
   l1=rig.data.bones['upperarm_r'].length;l2=rig.data.bones['lowerarm_r'].length
   delta=target-shoulder;length=delta.length;axis=delta.normalized()
   along=(l1*l1-l2*l2+length*length)/(2*length)
   pref=Vector((-1,0,-.8));bend=(pref-axis*pref.dot(axis)).normalized()
   elbow=shoulder+axis*along+bend*math.sqrt(max(0,l1*l1-along*along))
   for bone,aim in [('upperarm_r',elbow-shoulder),('lowerarm_r',target-elbow),('hand_r',Vector((0,-.12,1)))]:
    rb=rig.data.bones[bone];d[bone]=(rb.tail_local-rb.head_local).rotation_difference(aim)
   d['Head']=Quaternion((1,0,0),.08 if name!='pay' else .18)
  if name=='drive':
   for side in ['l','r']:
    d['calf_'+side]=Quaternion((1,0,0),-1.0)
    shoulder=rig.data.bones['upperarm_'+side].head_local.copy()
    target=Vector((.18 if side=='l' else -.18,-.40,1.38))
    upper=rig.data.bones['upperarm_'+side];lower=rig.data.bones['lowerarm_'+side]
    axis=(target-shoulder).normalized();length=(target-shoulder).length
    along=(upper.length**2-lower.length**2+length**2)/(2*length)
    pref=Vector((1 if side=='l' else -1,0,-.8));bend=(pref-axis*pref.dot(axis)).normalized()
    elbow=shoulder+axis*along+bend*math.sqrt(max(0,upper.length**2-along**2))
    for bone,aim in [('upperarm_'+side,elbow-shoulder),('lowerarm_'+side,target-elbow),('hand_'+side,Vector((0,-1,0)))]:
     rb=rig.data.bones[bone];d[bone]=(rb.tail_local-rb.head_local).rotation_difference(aim)
  if name=='turn':d['spine_03']=Quaternion((0,0,1),.22*math.sin(phase))
  desired={}
  for b in bones:
   parentQ=desired[b.parent.name] if b.parent else Quaternion()
   localRest=rest[b.parent.name].inverted()@rest[b.name] if b.parent else rest[b.name]
   desiredQ=d[b.name]@rest[b.name] if b.name in d else parentQ@localRest
   pb=rig.pose.bones[b.name];pb.rotation_mode='QUATERNION';pb.rotation_quaternion=localRest.inverted()@parentQ.inverted()@desiredQ
   pb.location=(0,0,0)
   if b.name=='root':pb.location=rest[b.name].inverted()@Vector((0,0,rootdrop))
   if b.name in d or b.name=='root':pb.keyframe_insert(data_path='rotation_quaternion',frame=frame);pb.keyframe_insert(data_path='location',frame=frame)
   desired[b.name]=desiredQ
 action.use_fake_user=True
 track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action)
rig.animation_data.action=None
for tr in rig.animation_data.nla_tracks:tr.mute=True
bpy.context.scene.render.fps=30
bpy.ops.export_scene.gltf(filepath=args[1],export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_morph=False,export_force_sampling=True,export_frame_range=False,export_yup=True,export_nla_strips=True)
print('Living Delhi character prepared',args[1])
