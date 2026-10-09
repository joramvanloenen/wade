# Wade

An endless, quiet walk through clear shallows. Dependency-free WebGL 2 and vanilla JavaScript. No assets, API keys, package installation or build step required.

## Play

Choose **Step into the shallows**. Press and hold the scene; slide upward to increase your target speed, downward to slow, and sideways to turn. Release to stop gently. Stay still and the fish gradually approach and orbit your feet. Water audio starts when you step in; mute it with the speaker button. The view button switches between looking down at your feet and the original follow camera.

Keyboard: W/Up walks and increases speed, S/Down slows, A/D or Left/Right turns. Release the keys or press Space to stop. Settings include viewpoint, water depth, rendering quality and touch-guide visibility. Adaptive mode reduces pixel density and simulation resolution when frames take too long. Hidden tabs suspend simulation and sound.

## Run and host

Serve this folder with any static HTTP server, for example `python -m http.server 8000`, then open http://localhost:8000. WebGL 2 is required.

For GitHub Pages, select **Settings → Pages → Deploy from a branch → main → / (root)**. The `.nojekyll` file keeps this a plain static site. Any static host will work.

## How it works

- **Procedural gait:** world-space stance feet stay planted. Swing feet follow eased arcs, stride and cadence change with speed, and two-link leg IK places knees. Arms, body lean and bob blend with movement. Steps finish as the player stops. No animation clips.
- **GPU shallow-water approximation:** two ping-pong textures store height and vertical velocity. A fixed 60 Hz, five-point finite-difference wave solver uses depth-dependent wave speed, damping and absorbing edges. A Courant limit keeps updates stable. Localized, approximately volume-balanced displacement forces are applied at moving feet and at each shin’s intersection with the surface. Surface normals and sand caustics sample the field. Foot contacts give short displacement impulses. A color/depth scene target supports screen-space refraction; a generated woodland/sky atlas reflects through those normals. Ankle waterlines, individual toes, warm sand and varied pebble shading make the close view readable.
- **Mobile budget:** touch-device grid is 160 × 160; lower-power mode is 128 × 128, high detail is 256 × 256. Half-float RG textures are preferred, with 16-bit signed values packed into RGBA8 as a fallback. Fish use one instanced draw, environment geometry is batched, and pixel density is capped.
- **Endless world:** water and its simulation window follow the player; deterministic world-cell plants are streamed nearby. Coordinates are periodically rebased while total distance and world coordinates persist. Distant fish are recycled.
- **Fish:** individuals have varied curiosity, cruise speeds and tail motion. Moving nearby causes flight with fading fear memory. At rest, curious fish approach and circle a foot; separation and foot avoidance prevent overlap.

This is a linear shallow-water wave approximation, not a complete fluid solver: no full fluid advection, exact displaced volumes, a geometry-based reflection pass. Refraction samples the rendered scene; reflection uses a generated environment map. Plants do not block the player. No saved progression or backend.

## Wading audio

Each leg has a continuous filtered-water drag layer driven by its movement and immersion, with stereo positioning. Lifting, entering and planting schedule different noise envelopes and short resonant bubble transients. Sound strength and tone vary with speed and depth, then settle to silence. A compressor controls peaks. These are synthesized effects, not recorded samples.

## Checks

`node --check app.js` checks syntax. `node tests/smoke.cjs` exercises controls, speed blending, steering, fish response, stance locking, camera switching, footstep audio and silence at rest, and 200+ meters of travel including origin rebasing. GPU-validation inputs are recorded in ignored `tests/.output/`.

On Linux with Mesa/EGL, NumPy and Pillow installed, `python tests/native-gl.py` compiles all GLSL ES shaders; `python tests/render-native.py tests/.output/water-trace.json` replays rendering in native GLES, checks GL errors, renders a scene and verifies a finite, nonzero, stable water field. These checks passed during creation. Browser UI and physical mobile-device performance still require device testing.

`window.Wade.state` exposes read-only diagnostic snapshots for tuning.
