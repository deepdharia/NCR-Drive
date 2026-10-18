# NCR road topology

Metres; +X east, +Z south, +Y up. Vehicles face +Z; yaw = atan2(dx,dz). Every road has stable IDs, endpoints, width and region; two directed left-hand lanes derive offsets and permitted junction transitions. Road centreline is counted once, not once per lane. `WorldRoads.ts` is shared by rendering, route finding, maps, traffic and recovery metadata.

| Area | Topology |
| --- | --- |
| Delhi / CP | Radius-44 m circle, 72 road chords, six 86 m radial approaches; existing colonnades and courier plaza |
| Market Lane | New `market-lane`, `radial-3` (−130,0) ↔ `market-west` (−380,0): **250 m**, width18 m, west turnaround; three shops on north pavement, marked crossing at x−244, occupied-car bay on south side, cold-store goods bay (−342,4) |
| Gurgaon corridor | Southwest from CP radial2 to (−1900,1900), bends and two-way approach |
| Gurgaon | Four 400 m avenues, wide junctions, Cyber Plaza and Office Gardens bays |
| Noida corridor | East from CP radial0, bridge from (1200,−170) to (1550,−170), river below; flat drivable deck |
| Noida | Planned 400 m sector perimeter and middle avenue; Sector18 and Gardens bays |

Unique centreline: previous **10,032.35 m**, plus **250 m** market = **10,282.35 m** (source sum `uniqueRoadLength`; rounding to centimetres). Gurgaon↔Noida passes through Delhi. No teleport/menu travel connects regions. Vehicle/metre scale is preserved. All geometry is original compressed fiction; no real-road alignment or accuracy claim.

Navigation uses directed Dijkstra on legal lanes, rejects off-road/unreachable endpoints, follows explicit stadium-plaza and paved market/parking-bay approaches, and reroutes no more than every750 ms. Local minimap follows the actor; DelhiOS provides regional overview. Remaining route distance is displayed. Mission destinations are separate from arbitrary building locations.

Collision uses a48 m hash containing multi-cell solids and swept narrow phase. Ground/barriers remain global independent of camera chunks. Market pavement/crossing are flush for existing flat grounding; benches have reserved seats and shops have solid counters/back walls. The Central Delhi scenic flyover is not an elevated drivable route. Regional/corridor recovery validates whole car and exit door before changing state; no clear pad leaves state unchanged.

Existing measured ordinary-input regional journey evidence is historical in `history/`; current regression runs are recorded in PLAYTESTS. The original 3–6 minute central-to-outer design target depends on actual driving speed and traffic; do not infer current device travel times from centreline length or controlled actor placement. Owner ordinary-speed pacing/handling review remains required.
