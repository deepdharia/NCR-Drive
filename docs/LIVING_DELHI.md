# Living Delhi

Market Lane is an original, fictional 250 m street west of CP, from (−130, 0) to (−380, 0). Follow the gold exploration route. The NCR road network and metre scale are unchanged. The lane is flat, with flush pavement/crossing transitions supported by the current grounding physics.

Park beside Neem Chai, exit with F, walk to the counter and press F. Order, inspect the fictional UPI price and confirm. A successful durable save delivers the cup and deducts money together. Cancel is free; blocked storage refuses the purchase. No real banking, QR transaction, external payment URL or financial details exist.

Walk to a free bench and press F to sit; a carried drink is consumed after sitting. F stands. Gali Baithak shares neighborhood information. Nimbu Corner sells juice and offers one sealed-fruit-crate delivery to Delhi Cold Store at the west end. Stop a car in the goods bay, then open DelhiOS and confirm the cold-store receipt to earn ₹650 and one trust point, once. The receipt is a follow-up to the goods handover; cancellation/recovery before confirmation pays nothing. Saving failure keeps the receipt pending and allows an explicit retry by the bay. Drinks are optional, with no hunger/thirst requirement. Active jobs do not resume after reload. Recovery cancels active goods/story/courier jobs without payout.

Only the right-hand driver door is an entry point in this milestone; blocked doors refuse entry safely. Companion seat metadata remains intact on driver transfer. The south-side parked compact has an adult driver. Use the marked crossing, approach its accessible right-hand door and press F. A 1.1 s non-graphic sequence reserves the vehicle, opens its door and rechecks clearance before transferring control. Its driver leaves and retreats; nearby adults react. Any ordinary traffic/motor-pool vehicle uses the same protocol. Cars must be below 2 km/h to enter, and below 15 km/h to exit. Taken cars keep their session identity and cannot recycle. Car positions/ownership are session state, not persisted vehicle collections. Pause, phone or focus loss cancels uncommitted transfers; no AI/player dual control.

People use one licensed articulated adult base, original clothing palettes and authored clips. These are stylized adults, not photorealistic scanned or motion-captured characters. Ten market adults and at most one displaced actor per ordinary car are created; queues/seats have exclusive owners and bounded timeouts. All market routines use the north pavement; the zebra crossing is available to the player. Full pedestrian city navigation and police pursuit remain future work.

Sound is original synthetic WebAudio ambience, engine response and restrained tire/brake noise. It starts after Explore, is spatially attenuated and suspends under menus/background. Mute/volume save with the existing settings. This is a restrained first sound pass, not recorded Delhi conversations or a complete vehicle sample library.

Verification commands: `npm test`, `npm run lint`, `npm run build`, `npm run test:production`, `npm run test:living`, `npm run test:regional-wiring`, `npm run test:visual`. Browser scripts require Playwright/Chromium; see README. Ordinary-input production evidence and controlled placement evidence are recorded separately in `test-results/` and CI artifacts. Physical M1/phone performance must be measured on those devices.

## Parks & Shopping (NCR Parks and Shopping Streets)

Four destination clusters, all reached by driving (no teleport/menu travel). Open DelhiOS (Tab) → **Parks & Shopping** → Route to a usable arrival point (parking or gate, never a building centre). The DelhiOS map draws each place as a category-coloured diamond.

| Cluster | Arrival | What is there |
| --- | --- | --- |
| Corridor garden stop | (−912, 812) | Garden loop, benches, Highway Blooms (flowers ₹120, flower-order pickup) + Halwai Corner (sweets ₹90), parking |
| Gurgaon shopping boulevard | (−2100, 1845) | The Souled Store, H&M, Zara (browse-only — wardrobe deferred), FNP (flowers ₹150, flower-order dropoff), Brew & Crumb café (cake ₹140), plaza benches, parking |
| Noida sector park + market | (3200, 250) | Park loop + fountain + exercise, park board (starts the circuit), Aggarwal Sweets (sweets ₹90), Crumb & Co. bakery (cake ₹130, cake-order pickup), Campus Wear (browse-only), parking via the car gap |
| Yamuna scenic pull-off | (1200, −270) | Viewpoint pad, railing, photo marker, bench, parking |

**Shopping.** Walk to a shop counter, press F. Shops with an item sell it (flowers/sweets/cake, cap 9 each, fictional Delhi Wallet only, same atomic pay-once flow as chai/juice). Fashion/streetwear shops are browse-only: no wardrobe purchase exists yet, and the modal says so plainly.

**Goods delivery jobs.** Accept a prepared order at a cluster shop (Supply button in the shop modal, or the DelhiOS Goods card), drive the car to the destination counter (within 4 m, ≤2 km/h — the same driving-receipt rule as the Nimbu supply job), then open DelhiOS and confirm the handover. Flower order: garden flowers → Gurgaon FNP, ₹400. Cake order: Noida bakery → garden sweets, ₹500. One reward per job, recorded in `goodsDone`; accepting again after completion is refused, cancelling before confirmation pays nothing, recovery cancels without payout. Active jobs are session state and do not survive reload.

**Park circuit.** Walk to the Noida park board, press F to start, walk the four checkpoints (within 3 m each), return to the board. Records `parkCircuit` once; no money.

**Photo stop.** Walk to the Yamuna photo marker, press F. The HUD hides and the camera frames the river view. Exit via the button or Esc — records `photoViewpoint` once. Discovery only: no image is saved.

**Storefront names.** The labels in `ClusterData.ts` (H&M, Zara, The Souled Store, FNP, Aggarwal Sweets, local cake/bakery) are editable data-driven labels with original procedural signage — no scraped logos, photos, or real-branch claims. Set `USE_FICTIONAL_NAMES = true` in `ClusterData.ts` to swap every label to its fictional alternative. The `fictional` field on each shop carries the alternative.

**People.** Each cluster has its own `LocalPopulation` (config-driven, same bounded queue/seat/drink/leave + danger-reaction state machine as the market). Garden 3 walkers, Gurgaon 5, Noida 5, Yamuna 2. Vendors stand at their counters; walkers queue, order, sit, drink, leave.

Verification: `npm test` (includes `tests/parks-shopping.test.ts`), `npm run test:parks-shopping` (short keyboard drive, DOM clicks for shops/jobs/circuit/photo, disclosed car placement for the goods receipt + player teleport for on-foot checks; multi-km browser drives are impractical on this VM's SwiftShader — regional-drive itself crawls at ~6 m/s here — so routes are covered by logic tests).
