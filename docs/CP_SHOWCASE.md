# CP evening delivery

Start the game, enter the gold Parvaaz with F / DRIVE, open DelhiOS and choose
**Start CP evening delivery** under City Stories. The car starts at the west
junction facing Market Lane. All original stories, courier jobs and other regions
remain available; a running job prevents accepting another.

1. Drive west through the market entrance to the cold-store bay at (-342, 4).
2. Stop below 2 km/h for 1.5 seconds to collect the parcel.
3. Return to the marked public parking bay beside Neem Chai at (-173, -12.5).
   Pull in facing toward/away from the shops so the whole car fits inside the
   3.2×6m bay; stopping beside the bay does not advance the objective.
4. Brake and stop; after the objective changes, use F / EXIT.
5. Walk to Neem Chai at (-164, -12). The 1.5-second handover pays ₹900 only
   after the career record is saved. The nominal drive is 467 metres.

The original CP street/junction network and Market Lane are reused. The authored
showcase corridor runs approximately 424 metres from the circle's west edge to
the market's far end. No new region or road system is introduced.

Keyboard: W/S throttle/reverse, A/D steer, Space handbrake, F enter/exit/interact,
Tab phone, Escape pause. Touch: accelerator, independent service brake, reverse
selector and joystick. Pause/focus loss releases held input.

Reward writes include cash and courier completion in one existing version-3 save.
Failed writes leave the mission active and wallet unchanged; courier retries at
one-second intervals while at the handover, and story retries after one second.
The UI explicitly reports failure. Keep the tab open to retry after temporary
quota failures. Active jobs are session-only and are lost on reload, including
uncommitted handovers. Replaying a completed story is still allowed and represents
a new job; courier completion persists and prevents a second courier payout.
Unknown/invalid/future saves retain the existing overwrite protection. If storage
was inaccessible at startup, the session stays playable but rewards cannot be
committed; reopening after storage is restored is required. This avoids replacing
an unread existing career with a fresh wallet.

The new art uses merged geometry and shared materials, a local 32px grounding
mask, distance culling and the existing quality presets. The mask remains on Low. The broad terrain plane is depth-biased behind road
and paving layers to prevent wide-view occlusion; landscape notices sit above
the central player/car focus.
Population collision is sampled once per rendered simulation frame, covering the
650m active traffic range; recovery checks include all populations because a
recovery pad can be farther away. See [SHOWCASE_ASSETS.md](SHOWCASE_ASSETS.md).

Verification and measured limitations are recorded in
[evidence/cp-showcase/VERIFICATION.md](evidence/cp-showcase/VERIFICATION.md).
