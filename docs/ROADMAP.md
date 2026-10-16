# Milestones and gates

Delivery branch: `main`. The foundation came from PR #4 at
`c6e0514573e44395c3e0a6505343678e5ad9054f`; recovery/settings came through
PR #5. See HANDOFF.md for merged commits, evidence and remaining work.

| Milestone | Gate | Current status |
| --- | --- | --- |
| M0 baseline | Verify remote state, instructions, feature inventory and reproducible checks | Complete for inspected PR #4 snapshot; production deployment source remains unverified |
| M1 driving/recovery | Start, drive, finish a fare, recover, save settings and reload; audio, feedback and measured profiling | Partial: recovery, save migration and persistent sensitivity/quality implemented; production verification recorded in PLAYTESTS.md |
| M2 connected district | Shared directed road graph, reachable targets, traffic junctions and bounded pedestrians; defined blockage/deadlock outcomes | Not started |
| M3 chapter/progression | Varied non-pursuit objectives, dialogue history, checkpoints, garage/spending and safe migration | Not started; current three-stop story is an earlier prototype |
| M4 pursuit/spectacle | One real pursuit with search/escape/failure/retry/cleanup plus a bounded stunt/prop encounter | Not started |
| M5 presentation/release | Asset/audio quality, full player runs, device evidence, licences, lifecycle and versioned release | Not started |

Next M1 increment: gesture-initialised procedural driving audio with mute/volume
settings and pause/lifecycle behavior. Then add bounded frame-time/render-resource
instrumentation and measure a representative full fare on the owner's M1 and a
named midrange Android. Keep functional CI results separate from frame-rate data.
Tune camera/handling using route playtests before marking M1 complete.

Recovery policy implemented here: free, cancel active jobs without reward,
preserve earned cash/completed jobs, preserve driving/on-foot mode. Select a
collision-clear radial-road pad and door; if all pads are occupied, change nothing.
This deliberately avoids introducing recovery charges before transaction/economy
design. Recovery is an explicit menu action, not an AI teleport system.

Reload policy: wallet, taxi count, courier completion and settings persist.
Active jobs cancel, chapter/vehicle locations reset. Chapter replay still pays
again by the existing policy; no persistent chapter reward ledger is claimed.
Timers continue to use clamped simulated time and stop under phone/pause.

Do not widen into M2 before M1's remaining gates are evidenced. Future spending
requires central validated/idempotent transactions; allowing zero cash alone is
not a complete economy. No purchase or ownership feature is introduced here.
