<div align="center">

# Ticktoon Skill

<p><strong>Agent authoring layer for Ticktoon. Storyboard in, MP4 out.</strong></p>

<p>
    <a href="https://nodejs.org/"><img alt="Node.js 18+" src="https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white"></a>
    <a href="https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API"><img alt="Protocol v1.0" src="https://img.shields.io/badge/Protocol-v1.0-08A9E6?style=flat-square"></a>
    <a href="https://www.google.com/chrome/"><img alt="Chrome 120+" src="https://img.shields.io/badge/Chrome-120%2B-263238?style=flat-square&logo=googlechrome&logoColor=white"></a>
    <a href="https://github.com/ticktoon/ticktoon-skill/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/ticktoon/ticktoon-skill?style=flat-square&logo=github&label=Stars"></a>
</p>

<p><strong>English</strong> · <a href="README.zh-CN.md">简体中文</a></p>
</div>

**Ticktoon Skill is the authoring layer for [Ticktoon](https://github.com/ticktoon/ticktoon).**

An LLM writes one `storyboard.json`. The platform compiles it into protocol v1.0 `composition.json`; the engine renders every frame synchronously with `tick(t)`; Chrome exports an ordinary MP4.

The authoring model is deliberately narrow: one storyboard file, one compile chain, one synchronous render path. The storyboard is the only authored file; recipes provide the production rules, a params recipe carries its own fixed template, and the kit provides drawing vocabulary.

<!--
Demo: drop a short GIF/WebP in assets/readme/ and uncomment.

**Demo** — storyboard to preview to MP4:

![Ticktoon Skill demo](assets/readme/demo.gif)
-->

```text
user request
   ↓
SKILL.md ── selects a recipe, reads its recipe.md / skeleton
   ↓
storyboard.json                  ← the only file the agent writes
   ├─ scene.code                 code recipe: whole-frame canvas content
   └─ scene.params               params recipe: fields for the recipe template
   ↓
schema → resolve → plan → emit → check → assemble
   ↓
composition.json
   ↓
ticktoon tick(t)                 one synchronous render path
   ├─ read-only preview / pen annotations
   ├─ stills / probe / qa / det
   └─ WebCodecs + Mediabunny → MP4 (H.264 + AAC)
```

## Architecture

The runtime has four layers, deliberately small:

| Layer | Lives in | Responsibility | The agent reads it |
|---|---|---|---|
| Operating contract | `SKILL.md` | routing, authoring loop, red lines, delivery checks | every task |
| Recipe spec | `recipes/<id>/` | `recipe.json`, `recipe.md`, `skeleton.storyboard.json`; code recipes add `ref-shots/`, params recipes add `template.js` | one selected recipe |
| Runtime reference | `references/` | API manual for `scene.code` and public kit | one page when needed |
| Content | `<project>/storyboard.json` | this film's scenes, narration, captions, assets, code, params | **writes** |

Below the authoring layers sit the implementation layers: `platform/kit/` (public kit and caption styles), the six-stage compiler in `platform/compile/`, the quality pipeline in `platform/inspect/`, and the Ticktoon engine.

Two units carry everything:

| Unit | Where | It owns | It does not own |
|---|---|---|---|
| **recipe** | `recipes/` | the rules for one kind of film: `mode`, `rules`, `captions`, `audio`; a params recipe also owns `template` (`draw / params / resources / needs / defaultSfx / sfxTrack / motion / inkless`) | content, narrative, drawing |
| **kit** | `platform/kit/` | reusable drawing vocabulary: text, pen, mark, board, camera, transition, captions, news background | composition, subject matter |

A recipe is either `mode: "code"` (scenes write `scene.code` against the public kit) or `mode: "params"` (scenes write `scene.params`, and the recipe's own `template.js` draws a fixed full-frame layout). The two modes never mix inside one recipe. Fonts are not owned by recipes: the font library lives in `assets/fonts/manifest.json`, where every key carries a `desc`. Code scenes declare selected keys in `scene.resources` (`{"type":"font","name":"sans-400"}`); params templates hardcode keys and declare them in `template.resources`. The compiler fills `src` from the manifest. Colors come from kit defaults or hex written directly in code scenes; backgrounds are painted by code scenes or templates. It carries no sizes, line heights, layouts, or motion; those belong to code scenes or template-local metadata. All values are static and traceable.

Compilation is deterministic: the same storyboard and inputs produce the same `composition.json`, which `tt det` verifies. Progressive disclosure is part of the design too: `SKILL.md` routes; a recipe's `recipe.md` and `skeleton.storyboard.json` are read after the recipe is selected, code recipes then read one or two `ref-shots/`, and `references/` are consulted one page at a time.

## What it can do

Recipes cover explainers, stories, fast cuts, breaking news, data races, and real footage. A recipe either carries content in a whole-frame `scene.code` or is a fixed template driven by `scene.params`. `tt recipe list` is the authoritative, always-current shelf; the table below is the set bundled with this repo.

| Recipe | Picture | Content path | Best for |
|---|---|---|---|
| `whiteboard-explainer` | Whiteboard / blackboard, strokes growing in | `scene.code` | mechanisms, science, step-by-step explanation |
| `blackboard-lesson` | Green board and chalk, written at lesson pace | `scene.code` | derivations, lectures, classroom rhythm |
| `illustrated-story` | Paper collage, cut-out lettering | `scene.code` | short stories, observations, essays |
| `flash-cut` | Hard cuts, oversized type, one sentence per scene | `scene.code` | punchy opinions, conclusions, promo beats |
| `flat-motion` | Saturated flat shapes, rounded characters and icons, elastic morphs | `scene.code` | product, brand, app-feature and light-explainer MG |
| `crayon-guide` | Warm paper, crayon hatching, people and hand-drawn diagrams | `scene.code` | tutorials, cultural ideas, comparisons, kids' explainers |
| `shadow-play` | Backlit screen, articulated silhouettes, scene-specific props | `scene.code` | fables, folk tales, historical vignettes |
| `news-broadcast` | Fixed vertical news card: blue radial background, world map, flowing lines | `scene.params` | breaking-news cards, title / body / source |
| `bar-race` | Dark vertical race chart, slanted title, animated year and reflection | `scene.params` | 2–18 entities racing from start values to end values |
| `footage` | Full-frame real footage with short overlay lines | `scene.params` | Pexels or local footage montage |

Also included:

- **Scene code with an injected kit** — `TT.text`, `TT.pen`, `TT.mark`, `TT.board`, `TT.geom`, `TT.chart`, `TT.newsBg`, and more. The compiler injects only the members each scene uses; transition boundaries separately receive `TT.transition` in a generated dual-frame scene.
- **6 caption styles + `none`** — plain, perchar, karaoke, collage, vertical, tornpaper, with per-character timing and subject avoidance.
- **Narration and sound** — zero-key edge-tts by default, optional Volc TTS, BGM/SFX with ducking and fades.
- **Stock footage** — Pexels search, download, attribution, and caching. Missing keys or failed downloads stop explicitly; local videos need no Pexels key.
- **Preview and review** — read-only preview, stills, probe receipts, and per-frame pen annotations. Sending immediately hands the batch to the agent; after revision and rebuild, a fresh preview starts the next round.
- **Quality gates** — `tt qa` with render-error and empty-ink must-checks plus a 12-cell contact sheet; `tt det` for compile determinism.
- **Direct MP4** — H.264 + AAC through WebCodecs and Mediabunny; no external FFmpeg executable.
- **Formats** — 1920×1080@30 and 1080×1920@30.

<!--
Case images: put screenshots or GIFs in assets/readme/, then uncomment and adjust this section.

![Whiteboard explainer](assets/readme/whiteboard-explainer.png)
![Crayon guide](assets/readme/crayon-guide.png)
![News broadcast](assets/readme/news-broadcast.png)
-->

## Dual-frame transitions: real boundary compositing

A transition is not an exit overlay on scene A followed by an entrance from black on scene B. The compiler emits a dedicated transition `code scene` that draws both neighboring scenes into offscreen canvases and composites the two complete frames. In `push-left / push-up`, the pictures stay joined as they move; `wipe-left / wipe-up` reveals B directly over A; `iris` opens directly onto B. None requires a mechanical black gap.

The storyboard only selects a fixed preset on the outgoing scene:

```json
{ "id": "s01", "duration": 4, "transition": "push-up", "code": "/* complete scene A */" }
```

The 10 fixed presets cover crossfade, left/up wipes and pushes, zoom, glitch, and iris, plus the GL Transitions–inspired `squares-wire` and `morph`. Direction is part of the complete preset name rather than a separate knob; there are no in/out, center, or duration parameters. Pattern transitions still use deterministic Canvas paths and slices, without WebGL or pixel readback. Dual-frame transitions apply to `scene.code` boundaries. Text already painted into a scene is simply part of the whole frame—there is no special caption compositor.

The visual timeline is `(A-D/2) + T(D) + (B-D/2)`, so total duration is unchanged. Narration, SFX, BGM, and SRT retain the original A/B logical timeline rather than following the generated visual nodes. See the [transition protocol](references/transition.md).

## QA: one browser session, captured frames, receipts, and contact sheet

`tt qa` is not a loop of screenshots. It builds once, opens a single local Chrome session over CDP, samples 24–30 frames across the film, and asks the engine's own capture path for each frame:

```text
pause → seek(t) → await video.settle(t) → synchronous tick(t) redraw → PNG
```

Frame readiness is decided by the engine, not by a fixed sleep. A fast machine does not wait idly; a slow machine or a heavy video does not sample a black or stale frame before the video has settled.

The same in-page callback computes a 32×18 luminance probe and paints the frame into the 12-cell contact sheet. The frame's real receipts (ink boxes / text / captions) are read right after the capture. The sheet is composed in the page—no second render pass and no shipping N PNGs back to Node just to tile them.

Sampling is scene-aware: every scene gets at least one frame; a single frame sits at 55% of the scene, multiple frames spread from 18% to 82%, avoiding entrances and exits. The contact sheet takes the first frame at 6% and the last at 94%. The sheet is visual evidence, not a scorecard.

The machine gate is deliberately light: `RENDER_PAGE_ERROR` and `QA_INK_EMPTY` (a scene unit executed but left no visible ink). Safe areas, collisions, text overlap, caption bands, contrast, and hold time are not scored—the contact sheet and a human / agent judge those. Reports contain only issues that actually fired; demoted checks are not kept around.

**Why it is fast** (local measurement, 27-frame flash-cut, including build):

| | Old Playwright path | Now |
|---|---|---|
| Browser start | 2.57s | 0.51s |
| Per-frame wait | 2 RAF + 140ms fixed sleep | engine `video.settle(t)` |
| Fixed wait, 27 frames | 4.2–4.7s | 0 |
| Full `tt qa` | — | 4.1s |
| npm dependency | playwright + core: ~4.1MB download / ~18.7MB on disk, Node ≥20 | reuses existing `ws`, Node ≥18 |

At 60–120Hz the old path's fixed waits alone were 4.2–4.7s—comparable to the current whole QA run. In the earlier 9-recipe `tt ci --deep` benchmark, browser startup alone saved about 18s; the full run was 42.2s locally. QA, stills, snapshot, and render share the same local-Chrome CDP driver, so there is no extra automation framework layer to install.

## Live preview and annotations: from review to revision

`tt preview --dir my-video` starts or reuses one global persistent preview server. Switching projects retargets the existing server without opening another port or viewer. The page watches composition changes and refreshes itself. Annotations are saved, and exports are requested through chat without stopping the server.

When something looks wrong, draw on the frame and leave a note in the bottom annotation dock:

1. Click **画笔圈注** (pen annotation); the preview pauses at the current frame, and you can circle or mark the problem area with the pen.
2. Write the description and click **完成圈注** (finish annotation). It enters the in-page send list. You can jump to another timestamp, add more, or remove a draft.
3. Click **发送圈注** (send annotations). The whole batch is POSTed to the local preview server and written to `<project>/annotations/<batch>/`. Each item carries the description, time, matching scene clip, and three PNGs: the original frame, the ink-only layer, and the composed annotated frame.
4. Sending shows a two-second translucent notice and saves the batch. When the user asks for revisions, the agent acknowledges the count and per-item summary, then reads and fixes the images; the preview refreshes after the rebuild. `tt annotations` can also read the latest unhandled batch at any time.
5. Edit `storyboard.json` → `tt build` → `tt preview` again. When done, `tt annotations --dir my-video --ack <batch-id>` marks the batch handled.

The loop is closed: the agent no longer has to guess which frame or scene unit the user means. The annotation and screenshot are the locating evidence. `annotations/` holds user input, is not written to `out/`, and survives rebuilds. The single source of truth stays the storyboard; no second runtime or visual editor is introduced.

> The preview uses real TTS tracks from the first build and plays picture, narration, and BGM together. Export reads the same composition without rebuilding audio.

## How to use

Requirements: Node.js 18+ (22 LTS recommended), Chrome 120+, and a Chrome-compatible WebGL2 environment.

```bash
git clone https://github.com/ticktoon/ticktoon-skill
cd ticktoon-skill
node scripts/doctor.mjs --install
```

`doctor --install` checks Node, the Ticktoon engine artifacts, npm dependencies, Chrome, WebGL2, and optional TTS/asset providers. The engine is loaded from the npm package `ticktoon@1.0.2` under `node_modules/ticktoon/dist`; no sibling engine checkout or copied `ticktoon-dist` is required. It runs npm install only when `ticktoon`, `ws`, or `msedge-tts` is missing, then continues the checks in the same command; existing dependencies leave npm untouched. The skill drives the locally installed Chrome (≥120) directly over CDP and does not download its own browser. On a headless server, set `DH_VIDEO_WEBGL=swiftshader`. When `chrome-headless-shell` is selected without an explicit WebGL setting, SwiftShader is enabled automatically to avoid WebCodecs texture-readback failures on some Windows systems.

Narration providers are selected internally: Volc TTS when its credentials are complete, otherwise zero-key Edge TTS. No provider flag is needed in the authoring workflow. Optional Volc TTS and Pexels upgrades are configured with `node scripts/auth.mjs set <KEY> <value>`; credentials are read from environment variables or `~/.dh-video/credentials.json` and never stored in a storyboard or project.

### From an agent

Place this repository, or the clean distribution produced by `tt pack`, in your agent's skills directory (for Claude Code, something like `~/.claude/skills/ticktoon`), with [`SKILL.md`](SKILL.md) at its root. The agent selects a recipe from `recipes/`, reads its `recipe.md` and skeleton, then writes and compiles a storyboard. Code recipes also read `ref-shots/`.

Example request:

> Make a 30-second whiteboard explainer on compound interest. Keep it to one narration track and use the default perchar captions.

### From the CLI

```bash
node platform/cli.mjs new my-video --recipe whiteboard-explainer   # scaffold a project
node platform/cli.mjs build --dir my-video                          # compile with real audio tracks
node platform/cli.mjs stills 0.6 3.1 9.4 --dir my-video             # stills + layout receipts
node platform/cli.mjs preview --dir my-video --port 5123            # read-only preview
node platform/cli.mjs annotations --dir my-video                    # read the batch sent from the preview
node platform/cli.mjs qa --dir my-video                             # must-gate + 12-cell contact sheet
node platform/cli.mjs det --twice --dir my-video                    # compile-determinism check
node scripts/render.mjs my-video/out/composition.json -o my-video/video.mp4
```

`tt` refers to `node platform/cli.mjs` (or `npm run tt --`). `storyboard.json` is the only file you write. Everything under `out/` is a build product; do not hand-edit it. Run `build` again after changes and the preview refreshes automatically. Export MP4 only when it is explicitly wanted, with no second preview-confirmation gate. If the storyboard is unchanged and narration already exists, render directly; rebuilds reuse cached TTS for identical text and voices. Rendering defaults to 1× output, with `--render-scale 2` available for supersampling.

Useful commands:

| Command | Purpose |
|---|---|
| `tt recipe list / show <id> / audit` | list recipes, inspect one contract (mode / template), audit all skeletons and ref-shot sets |
| `tt annotations [--wait] [--all] [--ack [id]]` | read annotation batches; `--wait` waits for the next batch, `--ack` marks it handled |
| `tt lab [--recipe <id>] [--port N]` | launch the ref-shot and Kit labs with real builds and engine previews; edit and rerun without writing back |
| `tt ci [--deep]` | full regression: audit + double-build determinism; `--deep` runs QA for every recipe |
| `tt ci --baseline [--write]` | compare skeleton / ref-shot-set compile fingerprints; refresh the baseline after review |
| `tt pack [dir]` | build a clean distribution (Skill + engine dist) |

### Ref-shot and Kit labs

```bash
# Node
node platform/cli.mjs lab --port 5199

# npm (lab is a subcommand; note the space after --)
npm run tt -- lab --port 5199
```

Then open:

- `http://127.0.0.1:5199/`: the recipe's `ref-shots/` lab.
- `http://127.0.0.1:5199/kit`: Kit Lab for shared drawing primitives and transitions.

Without `--port`, the default is 5125.

## Folder structure

```text
ticktoon-skill/
├── SKILL.md                     # agent entry: routing, loop, red lines
├── recipes/                     # bundled recipes: rules, docs, skeletons, ref-shots
│   ├── whiteboard-explainer/
│   │   ├── recipe.json          # mode / rules / captions / audio
│   │   ├── recipe.md            # how to write the content + how to draw the frame
│   │   ├── skeleton.storyboard.json
│   │   └── ref-shots/*.js
│   ├── news-broadcast/
│   │   ├── recipe.json          # mode: params + template contract
│   │   ├── template.js         # fixed full-frame template: draw(g, p)
│   │   ├── recipe.md
│   │   └── skeleton.storyboard.json
│   └── ...
├── references/                  # runtime API manual: storyboard, scene code, kit
├── platform/
│   ├── compile/                 # schema → resolve → plan → emit → check → assemble
│   ├── inspect/                 # stills, probe, qa, det
│   ├── project/                 # new, build, audit, ref-shots
│   ├── kit/                     # public kit namespaces + caption styles
│   └── preview/                 # read-only preview + pen annotation
├── scripts/                     # render, doctor, auth, snapshot, pack
├── assets/                      # fonts, BGM, SFX, demo media, README images
├── docs/                        # human/developer docs (not runtime input)
└── output/                      # build products (gitignored)
```

## Details

- Agent entry: [`SKILL.md`](SKILL.md)
- Runtime reference index: [`references/README.md`](references/README.md)
- Current architecture (Chinese): [`docs/ARCHITECTURE.zh-CN.md`](docs/ARCHITECTURE.zh-CN.md)
- Visual description dictionary, Chinese (human reference): [`docs/style-dictionary.md`](docs/style-dictionary.md)
- Audio chain notes (Chinese): [`docs/AUDIO.md`](docs/AUDIO.md)
- Pexels pipeline notes (Chinese): [`docs/PEXELS-PIPELINE.md`](docs/PEXELS-PIPELINE.md)
- Engine, protocol, and scene API: [`ticktoon`](https://github.com/ticktoon/ticktoon)

## License

The Ticktoon engine is Apache-2.0. The Skill's code, fonts, music, stock media, and migrated material need a separate license and attribution review before public release; see the engine's [`NOTICE`](https://github.com/ticktoon/ticktoon/blob/main/NOTICE).
