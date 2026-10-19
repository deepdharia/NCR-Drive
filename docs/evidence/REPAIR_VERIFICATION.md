# NCR Drive repair verification

19 October 2026 (Asia/Kolkata). Review PR: https://github.com/deepdharia/NCR-Drive/pull/10
Repair branch: `repair/ncr-assets-deliveries`, based on remote parks/shopping
`f2909345045d428280fcdc23e8d29972d83356c6`. Remote main at inspection was
`546fff3`; it was not substituted for the newer parks/shopping source.
Runtime repair checkpoint: `bb65c992b881ef5f19253bd467061386d9d0900f`.
Expanded browser-test checkpoint: `fcfc2a2`. Later verification corrections and
this delivery record do not change the game bundle. Exact final head: PR/Git log.

## Reproduction

A fresh locked install on the original parks branch reproduced 67/68 tests:
`people.test.ts` failed ENOENT for `public/assets/people/delhi-adult.glb`.
The production build nevertheless passed and omitted that asset. A direct
Neighborhood reproduction completed flower-order for ₹400, returned goods state
`done`, and rejected cake-order in the same session.

## Implemented checks and evidence (checkpoint)

| Boundary | Actual result |
| --- | --- |
| Fresh committed-source installation | PASS, `npm ci --ignore-scripts --prefer-offline`; no Blender invocation or asset copy |
| Current logic | PASS, 75/75, no skipped tests |
| Strict typing | PASS, `npm run lint` |
| Production build | PASS, includes new packaged-model parse gate; existing vendor chunk warning remains |
| Licensed model | Pinned source SHA256 verified; unchanged Blender 4.3.2 preparation script; committed 1,632,396-byte runtime with 21 clips |
| Original animation checks | PASS: human scale, sole offset, seated feet, drinking grip, driver steering reach, triangle budget, license |
| Shipped-dist repair browser | PASS at first checkpoint: shop purchase, both goods orders in both sequences, duplicate clicks, cancellation, failed receipt save, reload persistence, park/photo save failure/retry/idempotency, missing/corrupt startup and successful retry; no unexpected browser/asset errors |
| Map waypoint browser | PASS: set, move, clear, arrival clear; no errors |
| Six-scene visual benchmark | PASS: all shots and no browser/asset errors; controlled placement/software rendering |
| Fresh-dist expanded production gate | In progress at this checkpoint: same flows plus player/NPC mixer advance, takeover, recovery, touch/focus and routing |
| Retained parks browser | In progress; earlier repeated F toggles during slow entry corrected to wait for real transitions |
| Ordinary-input production smoke | Original local attempt timed out on foot approach; CI core group passed at bb65c99. Local obstacle-detour controller retry in progress |

The fresh-source run and original runtime repair produce the same game bundle
`index-6i1p_EI8.js` and character SHA256
`150b3a8c45c74f4a154ddc32405acc8d1d347ce60bbc2aeedf0d84f31e715fab`.

## Scope and publication

The repair harness uses the **unmodified shipped JavaScript**. CDP pauses at its
constructor to expose the instance; controlled shop/door/dropoff/circuit placement
and quota injection prove wiring and atomic persistence, not an entire regional
drive. Both delivery orders and ordinary payment/phone buttons are exercised.
The retained ordinary-input production courier smoke uses no debug access or
actor placement. Parks and visual scripts disclose their own controlled placement.
No M1/Android FPS, physical-device test, human playtest or live-preview test occurred.

CI builds dist once and shares it across four independent browser groups. Existing
core/living/regional/visual checks remain; parks-shopping, map-waypoint,
visual-benchmark and repair-production are now invoked. Each script has a
15-minute deadline and retains stdout/stderr; existing JSON/screenshots plus group
exit/deadline records are uploaded even on failure. Browser dev scripts use their
Vite servers; production/living/repair use preview against shipped dist. No test
assertion was removed or skipped. Final workflow uses PR events plus main pushes
to avoid duplicate expensive runs for the repair branch.

First repair CI: https://github.com/deepdharia/NCR-Drive/actions/runs/39288968015
At checkpoint: logic-build and core browser group passed; other groups still run.
Final head must be checked independently; earlier green jobs are not a final-head
CI claim.

The branch is pushed and draft PR #10 is open, targeting the parks/shopping branch
(PR #9). No force-push, merge, production promotion or protection modification.
GitHub's Vercel status for fcfc2a2 is success and links deployment
https://vercel.com/deep-07f0/ncr-drive/5jbFuSu3v1ypEdq3rB4cbpZRFCBh .
Project and deployment metadata inspection both returned scoped HTTP 403, and no
Vercel CLI is installed. Thus the actually served commit and live gameplay remain
unverified; the mutable branch URL is not evidence of source identity.
