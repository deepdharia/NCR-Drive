# NCR Drive original HUD animations

`success.json`, `warning.json`, `transition.json` were authored specifically for
NCR Drive on 20 October 2026. They contain only original geometric paths and
opacity keyframes, no third-party artwork, fonts, images or downloaded templates.
These three assets are dedicated to the public domain under CC0 1.0:
https://creativecommons.org/publicdomain/zero/1.0/

The installed `@lottiefiles/dotlottie-web` runtime and bundled WASM are distributed
under the package's MIT license (see bundled DOTLOTTIE-LICENSE.txt).
The runtime is lazy imported; Vite bundles its WASM locally. No CDN is required.
Continuous speed/route/control presentation uses lightweight SVG/CSS instead.
