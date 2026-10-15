# NCR Drive — Godot 4.3 core

Branch: `feature/ncr-drive-godot-core`. The existing web game remains alongside
this separate Godot entry point; no web source files were changed.

## Run on Mac

1. Check out this branch (or download its ZIP from GitHub and extract it).
2. In standard Godot 4.3, choose Import and select the root `project.godot`.
3. Press F6 on `scenes/maps/test_district.tscn`, or F5 to run the project.

Uses the Compatibility renderer and built-in GodotPhysics3D. No C#, plugins,
paid assets, or external packages are needed.

## Controls

- WASD / arrows: camera-relative walking; throttle/reverse/steering in car.
- Shift: sprint (7 m/s); normal walking is 3.5 m/s.
- Space: jump on foot; rear-wheel handbrake in car.
- F near the right-side driver door: enter. F below 15 km/h: exit.
- S while moving forward brakes before reversing; W does the converse.
- Mouse: orbit on foot. Esc releases the mouse; click captures it again.
- Tab: `phone_toggle` binding only; phone UI is outside this milestone.

Vehicle forward is local +Z. The camera sits behind it on -Z, front wheels
are on +Z, and the Indian right-side door is on -X. The player faces -Z.
All rates/forces are exported for tuning. The car settles under gravity when
first spawned; exiting applies parking brakes, clears velocity and sleeps it.
The exit capsule is checked against the world before restoring player control.

## Validation

With a Godot 4.3 executable named `godot`:

```sh
godot --headless --path . --editor --quit
godot --headless --path . --script tests/godot/core_smoke.gd
```

The integration test loads the real district and checks ground contact, door
detection, enter/camera/collision handoff, acceleration, brake-to-reverse,
handbrake, steering sign, exit speed limit, blocked exits, restored walking,
and jumping. Godot's headless dummy renderer can emit a `mesh_get_surface_count`
null-mesh message on shutdown with these CSG placeholders; this is separate
from script parsing and the test assertions.

This is a prototype physics foundation, not a production vehicle simulation.
Visual inspection and hands-on handling tuning on the target Mac/mobile devices
remain necessary. The chase camera is a fixed child camera; camera obstruction
avoidance for vehicles, touch controls, phone UI, traffic and missions are not
included. The 60 m test pad has open edges and no respawn system yet.
