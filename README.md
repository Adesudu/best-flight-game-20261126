[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Adesudu/best-flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Adesudu/best-flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

# Ridgeline Run

A bush-plane flight game for the [make.fun best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057).

Fly a little red bush plane down a mountain valley at dawn: thread glowing
sky rings, mind your fuel, and put her down on the far runway. Three sorties
with different goals — Ring Run, Valley Courier and Fuel Run — all rendered
as a pseudo-3D chase view over a seeded valley, with a lit HUD (speed,
altitude, heading, fuel, throttle, attitude indicator) and procedural
WebAudio engine sound.

## Play

Serve `game/` with any static server and open it in desktop Chrome:

```sh
node serve.ts
# then open http://localhost:8080
```

No build step, no network request: every file the game loads sits under
`game/`.

### Controls

- Steer: `←` `→` or `A` / `D` (mouse steers too)
- Climb / descend: `↑` `↓` or `W` / `S` (mouse up / down)
- Boost: `Shift` — burns fuel faster
- Brake: `Space`
- Pause: `P` — Mute: `M` — Restart: `R`

### Missions

1. **Ring Run** — fly through 12 sky rings before the valley ends.
2. **Valley Courier** — carry the mail to the far strip and land on it.
3. **Fuel Run** — a long valley and a thirsty engine; green rings are fuel.

## Layout

- `game/index.html` — the page; `game/src/main.js` boots the game.
- `game/src/config.js` — every tunable number (physics, missions, palette).
- `game/src/random.js` — the seeded generator behind the course.
- `game/src/terrain.js` — the valley: segments, river, runway, rings.
- `game/src/plane.js` — the aircraft: physics, fuel, lives, collisions.
- `game/src/render.js` — the pseudo-3D chase view, the plane sprite, the HUD.
- `game/src/input.js` — keyboard and mouse.
- `game/src/audio.js` — procedural WebAudio sound (no audio files).
- `game/src/game.js` — screens, missions, scoring, results.
- `game/src/shots.js` — deterministic screenshot staging (`?shot=start|play|land|end`).
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with the vendored make.fun library.
- `screenshots/` — four real renders of the game, the first the cover.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).
