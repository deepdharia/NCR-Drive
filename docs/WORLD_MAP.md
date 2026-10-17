# Connected NCR world

This is original compressed fictional geography, not an accurate Delhi/NCR replica.
No real road alignment, map imagery or external geographic data was imported.
One unit = one metre; +X east, +Z south, +Y up. Vehicle forward is +Z; heading/yaw
is `atan2(dx, dz)` about +Y. A forward lane's left offset is `(dz, -dx)`.

## Topology

```text
Gurgaon avenue loop ← southwest parkway ← Delhi CP → east link → Yamuna → Noida sector grid
```

Gurgaon is southwest (negative X, positive Z); Noida is east (positive X), beyond
the river. There is no Gurgaon–Noida road bypass: every legal graph route uses
Delhi. Both corridors and all regional loops are continuous two-way paved roads.
The bridge is a flat 22m deck at the same driving height as the adjoining roads,
with water 1m below and side rails. No stacked drivable geometry exists.

CP's radius-44m ring and six 12m-wide radial roads keep the existing scale,
colonnades, park, motor pool and mission targets. Its graph ring has 72 short
chords inside the existing rendered circular pavement. The new 22m corridors use
bends and wide overlapping junction ends. Gurgaon has four 28m office avenues;
Noida has 24m sector streets and a middle cross street. Road/junction/lane,
destination and recovery IDs are in `src/world/WorldRoads.ts`.

## Measured lengths

Calculated with Euclidean segment sums from shared centreline endpoints; each
physical road counted once, regardless of two opposing lanes. No vehicle scaling
or stretched original district is used.

| Roads | Unique centreline metres |
| --- | ---: |
| Delhi CP ring and radials | 792.37 |
| Delhi–Gurgaon corridor | 2,683.64 |
| Delhi–Noida corridor including bridge | 2,956.34 |
| Gurgaon business loop | 1,600.00 |
| Noida sector grid | 2,000.00 |
| **Total** | **10,032.35** |

From east arcade `{92,0}`, directed route lengths to stopping bays:

| Bay | Routed metres | At 18m/s, before stops/turns |
| --- | ---: | ---: |
| Gurgaon Cyber Plaza | 3,132.14 | 2m 54s |
| Gurgaon Office Gardens | 3,900.04 | 3m 37s |
| Noida Sector 18 | 3,585.06 | 3m 19s |
| Noida Sector Gardens | 3,587.30 | 3m 19s |

These are route-length measurements and speed estimates, not human playtest times.
The outer loops sometimes add distance to approach a bay from the correct left
lane. Target ordinary speeds are 15–20m/s on corridors, slower at junctions; this
puts central journeys near the requested 3–6 minutes. Actual driven timings and
software-renderer limitations belong in PLAYTESTS.md.

## Reachable destinations and recovery

- Gurgaon: `gurgaon-plaza` (-2100,1910), `gurgaon-office` (-2100,2290).
- Noida: `noida-sector18` (3200,60), `noida-gardens` (3200,440).
- Each outer road/corridor has two recovery poses, offset onto a left lane,
  away from junctions; original 18 CP pads keep their locations and get stable IDs.
- Recovery searches the nearest road's region, checks enlarged whole-car and door
  clearance against scenery and actors, and leaves all state untouched if blocked.

## Shared systems and budgets

Each road has ownership, width, endpoints and two stable directed lanes. Outer
lane endpoints are trimmed to junction-edge ports, making forward connector
turns instead of reaching the centre and turning back into following traffic.
The rendered junction pavement still uses overlapping full road ends. All
outgoing junction transitions are allowed except immediate reversal when another
road is available; wide Delhi corridor mouths, outer avenue/sector junctions and dead ends allow reversal. Dijkstra includes lane travel and
junction connectors, rejects endpoints outside paved envelopes and takes a legal
loop for a target behind on the same lane. Bays are off the through lane with
short safe approaches. UI rerouting is bounded to 750ms (target changes immediate).

Radar follows the player. DelhiOS displays the whole network with region names,
route and destination dots; distant local targets clamp to the radar edge.

Traffic defaults to six vehicles, hard-capped at ten. It follows the graph at
6m/s in CP, 8m/s in outer cities and 12m/s on corridors, sweeps collision, brakes ahead and yields by stable index at junctions.
Distant recycling occurs outside 650m, into clear locations 300–500m from focus,
away from outer destination bays and other actors, with one attempt/car/second. Nearby blocked cars wait;
there is no near-player teleport or extra queue allocation. This deliberately
simple model has no dynamic detours or sophisticated traffic signals.

Collision uses a global 48m spatial hash with every spanning cell populated.
Only local cells enter the original swept narrow phase. All collision stays
available globally, independent of visibility/speed; no streaming race can omit
a boundary barrier. Regional scenery uses shared box/plane geometry, instanced
buildings and markings, sparse planted median islands and bounded chunk visibility.
Vehicle views also activate only within 450m; their metadata/colliders stay global. Lightweight graph and mission
metadata stay global. Render resources are created once and disposed by Game's
owned-resource cleanup. Pause exposes a bounded 300-frame p50/p95 window and
render calls/triangles/geometries/textures for device test collection.

## Gameplay / saves

Existing taxi, courier and chapter remain. DelhiOS adds direct Delhi→Gurgaon and
Gurgaon→Noida (via Delhi) fare selection; fare = ₹300 + ₹0.8 per routed metre,
plus existing ₹150 clean bonus, with no taxi timer. Regional Dispatch reuses the
existing story runner: Delhi pickup → Gurgaon bay, 12 minutes, ₹2,400, then an
optional Noida fare via Delhi. Completion events pay once per accepted run;
replays retain the original replay-reward policy. Recovery cancels jobs with no
payment. No new persistent fields: v2 career/settings, backups and v1 migration
remain unchanged; active jobs/locations reset on reload.
