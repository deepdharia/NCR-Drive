# NCR Drive · Living Delhi

A browser open-world game: explore Delhi on foot, drive connected fictional NCR roads, meet local shopkeepers and help a neighborhood. Three.js + TypeScript + Vite, static Vercel deployment and local single-player saves.

Market Lane extends west of Connaught Place. Park, exit, visit Neem Chai, buy a drink using fictional game currency, sit and drink, meet the Nimbu Corner vendor, take a stopped civilian car and deliver a fruit crate to the cold store. Gurgaon and Noida remain connected through Delhi, with a flat Yamuna-inspired bridge.

## Run

Node 24 and npm:

```sh
npm ci
npm run dev
npm test
npm run lint
npm run build
npm run preview
```

`dist/` is the shipped static output. Vercel settings are preserved. No account, backend, paid API, real payment or external runtime asset host is required.

## Controls

- WASD: walk / drive; Shift: sprint; Space: jump / brake; S brakes then reverses.
- F: nearby shop, free seat, vehicle door; F again stands or exits. Enter a car below 2 km/h; exit below 15 km/h with clear door space.
- Drag: camera. Tab: DelhiOS map and retained courier/story work. Escape: pause, saved graphics/sensitivity/sound settings and free regional recovery.
- Mobile: joystick plus separate throttle/brake/reverse/interact controls; simultaneous touch steering/throttle supported.

Purchases are optional. Confirmed fictional UPI payments commit money and inventory together; cancel is free. The goods mission pays ₹650 and one trust point once. Original courier, Kabir chapter and Delhi→Gurgaon dispatch remain. Only one job runs at a time. Recovery cancels active jobs without payout. Cars and active jobs do not resume after reload; earned money, settings, cups, completed courier and neighborhood trust do.

The old taxi module, fares, passenger objectives, rewards and onboarding have been removed. Old v1/v2 career payloads migrate under the same storage key; earned money and unrelated progress/settings are retained. Unknown/corrupt saves and backups remain protected. Saves are per browser and site origin; a different preview hostname has separate browser storage.

## Verify

Browser scripts use Playwright. Install a suitable browser in your development environment, then run:

```sh
npm run test:production
npm run test:living
npm run test:regional-wiring
npm run test:visual
npm run test:regional-drive
```

For an existing installation, set `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE_PATH`. Production smoke and Living Delhi use shipped `dist` and ordinary inputs. Regional wiring/art inspection explicitly use controlled placements; those do not establish driven journeys or physical-device FPS. Evidence goes to ignored `test-results/` and CI artifacts.

Read [Living Delhi](docs/LIVING_DELHI.md), [handoff](docs/HANDOFF.md), [world topology](docs/WORLD_MAP.md), [playtests](docs/PLAYTESTS.md), [roadmap](docs/ROADMAP.md) and [asset licenses](docs/ASSET_MANIFEST.md). Quaternius' CC0 adult rig is credited there. All businesses/signage, animations, street props and synthetic sound additions are original. The world is compressed fictional geography, not a surveyed city replica.
