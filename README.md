# NCR Drive

A web driving game set in Delhi, Gurgaon and Haryana, built with React, Three.js and Vite. This update improves the existing game; its missions, garage, save data and vehicle catalog remain in place.

## Run and verify

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
npm test
npm run lint
npm run build
npm run preview -- --host 0.0.0.0
```

Use WASD or arrow keys to drive, C to change camera, R to switch reverse/drive, H for horn and Escape to pause. Drag the steering rim to turn, or drag horizontally across its centre; release to centre the wheel. Hold GAS with another finger, use BRAKE to stop, and select P/R/N/D directly. Wheel-left, wheel-right and arrow layouts work on phones and desktop; brakes override gas. Landscape gives the clearest view. Saves are stored on the current device.

## Visual and gameplay improvements

- Live showroom with a vehicle platform, studio lighting and an unobscured car preview.
- Responsive menu, quieter driving HUD, desktop keyboard hints and mobile safe-area layouts.
- Rounded bodywork, tapered cabins, less saturated city glass, textured facades and properly color-managed asphalt, signs and sky.
- Sky remains visible at every graphics tier. Chase camera snaps to a new spawn and uses frame-rate-independent smoothing.
- GPS shows the active pickup, drop-off or mission destination. Pause and browser focus loss release held controls. Control preferences reach the HUD.
- Production builds include an installable PWA and versioned offline caching. First load requires a network connection; offline play is available after installation of the service worker. Deploy at the domain root over HTTPS. The worker waits until existing tabs close before activating an update.

## Android and iOS

Capacitor configuration is included so the same production build can be packaged for mobile. `com.ncrdrive.game` is a provisional application identifier: choose the final unique identifier before registering store apps.

```sh
npm run build
npx cap add android
npx cap add ios
npx cap sync
npx cap open android
npx cap open ios
```

Android requires Android Studio and its SDK. iOS requires macOS and Xcode. Platform projects are generated on the build machine and are not included in this source upgrade. Native builds bundle the game assets; web service-worker registration is disabled in the native wrapper.

Before release, test on actual low-, mid- and high-end devices, prepare signing and store listings, and audit any analytics, advertising or purchase integrations that are added. This work does not submit or publish a store app.

## Competing with Taxi Car Simulator: EVO

Visual direction reference: [App Store](https://apps.apple.com/us/app/taxi-car-simulator-evo/id1126769121) and [Google Play](https://play.google.com/store/apps/details?id=com.ovilex.taxisim2019).

The reference uses detailed vehicle and environment assets. NCR Drive still uses procedural geometry; the upgrade is not photorealistic parity. The next substantial art investment should be licensed, optimized vehicle meshes and interiors, followed by street-scale architecture, vegetation and animated passengers. Keep Delhi/NCR landmarks and Indian traffic as the game's distinct identity.

Release priorities:

1. Measure frame time and loading on real devices; target sustained 30 FPS on low-end phones and 60 FPS on supported mid/high-end hardware. Reduce distant draw calls with instancing and LOD before adding heavier effects.
2. Validate full pickup/drop-off loops, collision fairness, parking challenges and save persistence with players. Tune progression using completion rate, replay rate and first-session retention.
3. Add authored passenger pickup animations, vehicle audio and more polished car models. Add cloud-backed leaderboards only with validated scores and abuse controls.
4. Run a closed mobile beta, resolve crash and retention issues, then prepare localized store screenshots and listings. Compare actual chart placement by country, category and date after release.

Store rank depends on player retention, reviews, acquisition and release quality. No ranking, multiplayer or online leaderboard is claimed by this update.
