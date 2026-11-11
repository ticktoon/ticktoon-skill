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

The authoring model is deliberately narrow: one storyboard file, one compile chain, one synchronous render path. The storyboard is the only authored file; recipes provide the production rules, blocks provide reusable layouts, and the kit provides drawing vocabulary.

<!--
Demo: drop a short GIF/WebP in assets/readme/ and uncomment.

**Demo** — storyboard to preview to MP4:

![Ticktoon Skill demo](assets/readme/demo.gif)
-->

```text
user request
   ↓
SKILL.md ── selects a recipe, reads its brief / demo
   ↓
storyboard.json                  ← the only file the agent writes
   ├─ scene.code                 whole-frame canvas content
   └─ elements[]                 parameterized blocks
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
| Recipe spec | `recipes/<id>/` | `recipe.json`, `brief.md`, demo, and for code recipes `visual.md` / `examples/` | one selected recipe |
| Runtime reference | `references/` | API manual for `scene.code` and public kit | one page when needed |
| Content | `<project>/storyboard.json` | this film's scenes, narration, captions, assets, code | **writes** |

Below the authoring layers sit the implementation layers: `platform/kit/` (public kit and caption styles), `platform/blocks/` (scene blocks), the six-stage compiler in `platform/compile/`, the quality pipeline in `platform/inspect/`, and the Ticktoon engine.

Three units carry everything:

| Unit | Where | It owns | It does not own |
|---|---|---|---|
| **recipe** | `recipes/` | the rules for one kind of film: `blocks`, `fonts`, `rules`, `captions`, `audio`, `verify` | content, narrative, drawing |
| **block** | `platform/blocks/` | an exhaustible, parameterized layout or visual unit | topic enums, story structure |
| **kit** | `platform/kit/` | reusable drawing vocabulary: text, pen, mark, board, camera, transition, captions, news background | composition, subject matter |

`recipe.json`'s top-level `fonts` is the machine contract shared by the compiler and QA: font roles only, with no `style` wrapper. Colors come from kit defaults or hex written directly in code scenes; backgrounds are painted by code scenes or blocks. It carries no sizes, line heights, layouts, or motion; those belong to code scenes or block-local metadata. All values are static and traceable.

Compilation is deterministic: the same storyboard and inputs produce the same `composition.json`, which `tt det` verifies. Progressive disclosure is part of the design too: `SKILL.md` routes, a recipe's `brief.md` and demo are the only documents read before writing, and `references/` are consulted one page at a time.

## What it can do

Recipes cover explainers, stories, fast cuts, breaking news, and real footage. A recipe either carries content in a whole-frame `scene.code` or is a parameterized `scene.*` layout. `tt recipe list` is the authoritative, always-current shelf; the table below is the set bundled with this repo.

| Recipe | Picture | Content path | Best for |
|---|---|---|---|
| `whiteboard-explainer` | Whiteboard / blackboard, strokes growing in | `scene.code` | mechanisms, science, step-by-step explanation |
| `blackboard-lesson` | Green board and chalk, written at lesson pace | `scene.code` | derivations, lectures, classroom rhythm |
| `ink-painting` | Ink lines, washes, and large negative space | `scene.code` | Eastern aesthetics, poetry, culture |
| `illustrated-story` | Paper collage, cut-out lettering | `scene.code` | short stories, observations, essays |
| `flash-cut` | Hard cuts, oversized type, one sentence per scene | `scene.code` | punchy opinions, conclusions, promo beats |
| `crayon-guide` | Warm paper, crayon hatching, hand-drawn labels | `scene.crayon` | recipes, checklists, kids' explainers |
| `shadow-play` | Backlit screen, articulated silhouettes | `scene.shadow` | fables, folk tales, gesture-led scenes |
| `news-broadcast` | Fixed vertical news card: blue radial background, world map, flowing lines | `scene.news` | breaking-news cards, title / body / source |
| `footage-cut` | Full-frame real footage with short overlay lines | `scene.footage` | Pexels or local footage montage |

Also included:

- **Scene code with an injected kit** — `TT.text`, `TT.pen`, `TT.mark`, `TT.board`, `TT.geom`, `TT.transition`, `TT.flash`, `TT.chart`, `TT.newsBg`, and more. The compiler injects only the members the scene actually uses.
- **7 caption styles + `none`** — band, plain, card, karaoke, collage, handnote, vertical, with per-character timing and subject avoidance.
- **Narration and sound** — zero-key edge-tts by default, optional Volc TTS, BGM/SFX with ducking and fades.
- **Stock footage** — Pexels search, download, attribution, caching, and bundled fallback.
- **Preview and review** — read-only preview, stills, probe receipts, and per-frame pen annotations accumulated into a send list; sending writes the whole batch with screenshots into `<project>/annotations/` and closes the preview, read back with `tt annotations`.
- **Quality gates** — `tt qa` with an empty-ink must-check, recipe `verify` / `forbid`, and a 12-cell contact sheet; `tt det` for compile determinism.
- **Direct MP4** — H.264 + AAC through WebCodecs and Mediabunny; no external FFmpeg executable.
- **Formats** — 1920×1080@30 and 1080×1920@30.

<!--
Case images: put screenshots or GIFs in assets/readme/, then uncomment and adjust this block.

![Whiteboard explainer](assets/readme/whiteboard-explainer.png)
![Crayon guide](assets/readme/crayon-guide.png)
![News broadcast](assets/readme/news-broadcast.png)
-->

## How to use

Requirements: Node.js 18+ (22 LTS recommended), Chrome 120+, and a Chrome-compatible WebGL2 environment.

```bash
git clone https://github.com/ticktoon/ticktoon-skill
cd ticktoon-skill
npm install
node scripts/doctor.mjs
```

`doctor` checks Node, the Ticktoon engine artifacts, npm dependencies, Chrome, WebGL2, and optional TTS/asset providers. If it reports missing `deps`, run `npm install` in the skill directory; Playwright only drives the locally installed Chrome (≥120) and does not download its own browsers. On a headless server, set `DH_VIDEO_WEBGL=swiftshader`.

The default path needs no API keys: edge-tts plus bundled demo assets. Optional Volc TTS and Pexels upgrades are configured with `node scripts/auth.mjs set <KEY> <value>`; credentials are read from environment variables or `~/.dh-video/credentials.json` and never stored in a storyboard or project.

### From an agent

Place this repository, or the clean distribution produced by `tt pack`, in your agent's skills directory (for Claude Code, something like `~/.claude/skills/ticktoon`), with [`SKILL.md`](SKILL.md) at its root. The agent selects a recipe from `recipes/`, reads its brief and demo, then writes and compiles a storyboard.

Example request:

> Make a 30-second whiteboard explainer on compound interest. Keep it to one narration track and use the default band captions.

### From the CLI

```bash
node platform/cli.mjs new demo --recipe whiteboard-explainer   # scaffold a project
node platform/cli.mjs build --dir demo                          # fast compile (estimated timing, no voice)
node platform/cli.mjs stills 0.6 3.1 9.4 --dir demo             # stills + layout receipts
node platform/cli.mjs preview --dir demo --port 5123            # read-only preview
node platform/cli.mjs annotations --dir demo                    # read the batch sent from the preview
node platform/cli.mjs qa --dir demo                             # must-gate + 12-cell contact sheet
node platform/cli.mjs det --twice --dir demo                    # compile-determinism check
node platform/cli.mjs build --dir demo --tts edge               # recompile with real narration
node scripts/render.mjs demo/out/composition.json -o demo/video.mp4
```

`tt` refers to `node platform/cli.mjs` (or `npm run tt --`). `storyboard.json` is the only file you write. Everything under `out/` is a build product; do not hand-edit it. Run `build` again after changes and the preview refreshes automatically. Export MP4 only when it is explicitly wanted; a build without `--tts` has no narration track.

Useful commands:

| Command | Purpose |
|---|---|
| `tt recipe list / show <id> / audit` | list recipes, inspect one contract, audit all demos |
| `tt block list` | list blocks with their contracts |
| `tt annotations [--all] [--ack [id]]` | read annotation batches sent from the preview (latest unacked by default); `--ack` marks the batch handled |
| `tt ci [--deep]` | full regression: audit + double-build determinism; `--deep` runs QA for every recipe |
| `tt ci --baseline [--write]` | compare demo compile fingerprints; refresh the baseline after review |
| `tt pack [dir]` | build a clean distribution (Skill + engine dist) |

## Folder structure

```text
ticktoon-skill/
├── SKILL.md                     # agent entry: routing, loop, red lines
├── recipes/                     # bundled recipes: rules, briefs, demos, examples
│   ├── whiteboard-explainer/
│   │   ├── recipe.json          # blocks / fonts / rules / captions / audio / verify
│   │   ├── brief.md             # when to use, when not, visual numbers
│   │   ├── demo.storyboard.json
│   │   ├── visual.md            # code-recipe visual physics
│   │   └── examples/*.js
│   └── ...
├── references/                  # runtime API manual: storyboard, scene code, kit
├── platform/
│   ├── compile/                 # schema → resolve → plan → emit → check → assemble
│   ├── inspect/                 # stills, probe, qa, verify, det
│   ├── project/                 # new, build, audit
│   ├── kit/                     # public kit namespaces + caption styles
│   ├── blocks/                  # scene blocks + _lab demos
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
