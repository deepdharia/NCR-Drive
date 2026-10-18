# Rendering and visual slice

The approved V1 foundation36ec239 is retained beneath Living Delhi. One-metre units, original fictional geography, existing driving and the flat ground model are preserved. This is stylized authored scenery, not a scanned or photorealistic city replica.

CP roads use an explicit annular/radial union at shared edges. PBR asphalt/plaster/paving have deterministic local256–512px maps and metre-scale projection; regional roads share the same asphalt system. Neutral daylight uses the existing sky/environment, haze, tone mapping and bounded directional shadows. A supported scenic flyover has a usable ground underpass; elevated driving/ramp physics is not implemented.

Market Lane adds250 m of flat road and flush pavement, shop-front counters/awnings, benches, fruit/kettle/cup props, original bilingual business signs, bins, cables, planted edges, a zebra crossing and a signed public pull-off. Counter/back-wall/facade/bench/pole collision matches the rendered layout. A walking visibility graph routes around static furniture locally; vehicle routes keep shared directed lanes.

Characters use a locally packaged Quaternius CC0 adult,65 bones and9,264 triangles, original clothing palettes and21 authored Blender clips. Shared geometry/materials, per-actor shared skeletons and independent mixers bound resources. Hand-held props attach to the actual hand bone at the grip. Original IK brings cups to the mouth and driver hands to the wheel; seated/pedal feet and pavement offsets are checked numerically. Blends last0.18 s. Motion remains authored/stylized, with human art review still required.

The compact has rounded coachwork, glass, open cabin floor/cushions, driver, animated front doors, steering wheel and wheel rotation, with existing suspension/body feedback. Tires remain round and0.32 m radius. Other roster bodies remain prototype variants; shared control/door/recovery behavior is also tested with sedan/SUV dimensions without presenting stretched copies as finished vehicle art.

Low/Balanced/High preserve existing DPR, shadow, vehicle-detail and scenery-distance budgets. Static shop resources are merged/shared, roads/buildings/markings use existing instancing/chunks, vehicles have a two-mesh distant proxy, and adults stop expensive animation beyond local distance. All collision remains indexed globally, independent of camera visibility. Steam/smoke/actors/queues/audio voices are bounded. Dispose stops mixers/audio and releases skeleton bone textures, owned geometry/materials/textures and the WebGL context.

`test:visual` inspects retained CP/outer-region scenes, tire contact, preset/resource cycles and disposal. `test:living-wiring` inspects market/people/interior scenes, actor clearance and local touch transactions; placements are disclosed. `test:living` uses ordinary inputs against shipped dist. Current actual results and screenshots are recorded in PLAYTESTS; the old V1 screenshot gallery is explicitly historical under`history/`.

Physical M1/Android frame times and human evaluation of hands/feet/cups/doors, mix and enjoyment remain owner acceptance. Software-renderer frame samples are diagnostics, not a device FPS claim. Keep content density below the interaction/route/clearance budget before expanding art variants.
