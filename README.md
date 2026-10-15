# Rectal Rabbit

An 8-bit side-scroller. You're a rabbit running home through the
snowy hills, left to right. Snow leopards come charging in from behind: eat
grass to fill up on poop, then fire it back at them to send them rolling away.

Built with **Phaser 4** (Arcade Physics) + **TypeScript** + **Vite**. Runs in
the browser, locally.

## Run it

You need Node.js 22.12 or newer.

```bash
npm install
npm run dev          # open http://localhost:5173
```

Other commands:

| Command | What it does |
|---|---|
| `npm run dev:lan` | Same, but reachable from other devices on your Wi-Fi (e.g. a tablet) |
| `npm test` | Unit tests for movement, input, the level format and the leopards (Vitest) |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the `dist/` build (opening `dist/index.html` directly won't work) |
| `npm run deploy` | Build this branch and publish it to the `gh-pages` branch, in a folder named after the branch (see below) |

### Playing a branch online

**Play it here: https://arussellturner.github.io/rectal-rabbit/**

`npm run deploy` puts a build of the current branch into its own folder on the
`gh-pages` branch, so each branch gets its own address:
`https://arussellturner.github.io/rectal-rabbit/<branch-name>/` (for example
`.../rectal-rabbit/russells-branch/`). The main address above opens
`russells-branch`. It takes GitHub a minute or so to update after a deploy.

This repo is a copy of `turnerm5/rectal-rabbit` (that one is the `upstream`
remote; `origin` is `arussellturner/rectal-rabbit`).

### Handy URL flags

- `?play` skips the title screen.
- `?calm` turns off the snow leopards, for exploring the level.
- `?at=100` starts the rabbit at tile column 100 (drops in from the sky).
- `?tune` opens a slider panel for jump height, speed, gravity, coyote time,
  bite time, poop speed, and so on. Changes apply live and are remembered in
  your browser. Use **Copy values** and paste them into
  `src/entities/tuning.ts` to keep them for good.
- `?debug` shows physics hitboxes plus a speed and position readout.
- Combine them: `http://localhost:5173/?play&calm&debug`

## How to play

- Run right to reach your **home** at the end of the level. The screen only
  scrolls forward.
- **Snow leopards** sneak up from behind. A red **!** flashes at the left edge
  of the screen when one is about to show up. They're a bit slower than you, so
  you can outrun them, but not while you stop to eat. They jump over walls,
  pits, and up onto ledges after you.
- Poop comes out the back, which is right where the leopards are. Hit one
  **once** and it stumbles. Hit it **twice** and it falls over, sees stars,
  and rolls away.
- Each **grass** tuft has 3 bites. Hold Eat on it to chew; every bite is one
  poop. You carry up to 10 (the meter in the top-left). Grass grows back.
- **Carrots in bubbles** float around the level: jump into one to pop it for
  +3 poops.
- **Poop bomb:** once you've saved up **5 poops** (the orange notch on the
  meter), press the bomb button to plop a stinky poop bomb on the ground. When
  a snow leopard runs into it, it explodes: that leopard gets knocked flat, and
  poop sprays everywhere, hitting any other leopards nearby. Up to 3 bombs at a
  time; they fizzle out after a while.
- **Dirt piles:** stand on one and press down (or Eat) to dig into a secret
  burrow. The leopards lose your trail. Grab the carrots (+1 poop each), then
  walk out the **EXIT** tunnel to pop up further along the level.
- You have **3 hearts**. Getting caught or falling into a pit costs one.
  After a pit you restart at the last **checkpoint flag** (or the last place
  you popped out of a burrow).

## Controls

Press **pause** any time for a help screen that lists every control for the
keyboard or controller you're using. The bar along the bottom of the screen
always shows the main ones.

| Action | Keyboard | 8BitDo Ultimate 2C / Xbox | PS5 controller |
|---|---|---|---|
| Move | ← → or A D | Left stick / D-pad | Left stick / D-pad |
| Jump (hold for higher) | Space | A | ✕ |
| Drop through a log bridge | ↓ + Space | ↓ + A | ↓ + ✕ |
| Eat (hold, on grass) | E | X | □ |
| Dig (on a dirt pile) | ↓ or E | ↓ or X | ↓ or □ |
| Poop (out the back) | J or F | RB / RT | R1 / R2 |
| …high lob | hold ↑ + J | stick ↑ + RB | stick ↑ + R1 |
| …drop straight down | in the air, ↓ + J | in the air, ↓ + RB | in the air, ↓ + R1 |
| Poop bomb (costs 5) | K or B | B or LB | ○ or L1 |
| Pause + help | Esc or P | Start | Options |

Bindings live in `src/input/bindings.ts`.

### Using an 8BitDo Ultimate 2C

1. Plug in the 2.4G dongle (or a USB-C cable) and switch the controller on.
   Use its **X-input / PC mode** (the default), not Switch mode. In Switch mode
   the computer thinks it's a Nintendo controller, and the on-screen letters
   would be swapped.
2. Use **Chrome or Edge**.
3. **Press any button once the page is open.** Browsers hide controllers from
   a page until then. The title screen then shows a **button check**: each
   button lights up when you press it, so you can make sure they all work.

The game recognises the 2C by name and shows its letters (A jump, X eat/dig,
RB poop, B bomb). If it reports itself as an Xbox controller instead, that's
fine: the letters are the same.

### Using a PS5 controller

1. Pair the DualSense over Bluetooth: hold **Create + PS** until the light
   bar flashes, then pick "DualSense Wireless Controller" in your computer's
   Bluetooth settings. A USB-C cable also works.
2. Use **Chrome or Edge**. They report the DualSense with the standard button
   layout. Firefox's mapping can be scrambled.
3. **Press any button once the page is open.**

The top-right of the screen shows which controller the game sees.

## Editing the level

The level is drawn in text in `src/data/level1.ts`, one 32-tile-wide screen
at a time. Each letter is a tile:

| Letter | Tile |
|---|---|
| `#` | Frozen ground (snow on top is added automatically) |
| `S` | Stone ledge |
| `X` | Ice block |
| `=` | Log bridge: jump up through it, ↓ + jump to drop down |
| `g` | Grass to eat |
| `c` | Carrot (in a bubble above ground; loose in a burrow) |
| `D` | Dirt pile: dig into a burrow |
| `O` | Hole where you pop out of a burrow |
| `R` | Where the rabbit starts |
| `F` | Checkpoint flag |
| `H` | Home (the finish) |

Burrows are drawn underneath, one screen each, with `d` for packed dirt,
`S` stone, `=` root ledges, `c` carrots, `R` where you drop in, and `E` at
the end of a row for the exit tunnel. The first `D` leads into the first
burrow, which comes out at the first `O`, and so on.

The rabbit jumps about 4 tiles high and 6 across. `npm test` checks the level
for mistakes, like a pit too wide to jump or a dirt pile without a burrow.

## Art

All the level art (frozen ground, stone, ice, burrow dirt, trees, mountains,
carrot bubbles, the poop bomb, hearts…) is drawn in code as chunky NES-style
pixels in `src/art/pixelTextures.ts`. One art pixel is 3×3 screen pixels, and
a tile is 16×16 art pixels.

The rabbit and snow leopard come from the drawings in `art/source/`.
`tools/extract_sprites.py` cuts out each frame, removes the white background,
shrinks it to the same chunky pixel size, and saves sprite strips into
`public/sprites/`. If you change the drawings, run it again:

```bash
python3 -m venv .venv && .venv/bin/pip install pillow numpy scipy
.venv/bin/python tools/extract_sprites.py
```

Which frames make up which animation (run, jump, poop, getting hit, falling
down, rolling away) is listed in `src/data/spriteSheets.ts`.

## Project layout

```
src/
├── main.ts               Phaser game setup; reads input once per frame
├── config.ts             Screen size, pixel/tile size, URL flags
├── art/pixelTextures.ts  All the 8-bit level art, drawn in code
├── input/                Keyboard + gamepad → actions ("jump", "shoot", …)
├── level/LevelMap.ts     Turns a text level (and its burrows) into tiles and physics boxes
├── ai/
│   ├── ChaserBrain.ts    Snow leopard: chase, jump, stagger, fall, roll away
│   └── PredatorBrain.ts  Stealth fox from step 3 (patrol / ? / ! / chase); not in level 1
├── entities/
│   ├── Rabbit.ts         The player: movement, eating, shooting, animation
│   ├── SnowLeopard.ts    A snow leopard: body, sprite, dizzy stars, "!" warning
│   ├── RabbitMotor.ts    Movement rules: accel, coyote time, jump buffer…
│   ├── CarrotPickup.ts   Carrots: in bubbles above ground, loose in burrows
│   ├── PoopBomb.ts       The poop bomb sitting on the ground
│   ├── Checkpoint.ts     Flagpole
│   ├── GrassPatch.ts     A tuft of grass that shrinks and regrows
│   ├── PoopPellets.ts    Flying/landed poop pellets
│   └── tuning.ts         All the movement and poop numbers
├── systems/
│   ├── LeopardSpawner.ts When leopards show up (more, more often, later on)
│   ├── PoopAmmo.ts       How many poops you're carrying
│   └── GrassState.ts     Bites left + regrowth timer
├── scenes/               Boot → Title → Level (+ Hud, Pause/help, End on top)
│   └── buttonChips.ts    The [A] JUMP style button prompts
├── data/
│   ├── level1.ts         World 1-1, drawn in text
│   ├── chasers.ts        Snow leopard speeds and timings (just data)
│   ├── spriteSheets.ts   Sprite sheet frame sizes and animations
│   └── predators.ts      Fox senses and timings (for stealth levels later)
└── debug/tuningPanel.ts  The ?tune slider panel
```

Logic that doesn't need Phaser (`RabbitMotor`, `ChaserBrain`, `LevelMap`,
`systems/`, `ActionState`, `gamepadMath`) is kept separate so it can be unit
tested. Adding a new chaser is mostly copying `SNOW_LEOPARD` in
`src/data/chasers.ts` and changing the numbers.

## Roadmap

- [x] **1. The rabbit hops.** Keyboard + controller, jumping feels good
- [x] **2. Eat and poop.** Grass patches, ammo counter, poop that flies in an arc
- [x] **3. One fox on flat ground.** Vision cone, detection meter, ? and !, chase and give up
- [x] **3½. 8-bit side-scroller.** Real rabbit and snow leopard sprites, World 1-1,
      leopards chase from behind, hearts, checkpoints, home
- [x] **Poop bomb.** Save 5 poops, drop the bomb, KA-POOP chain reactions
- [x] **Burrows and carrot bubbles.** Dig into dirt piles, collect carrots, pop up further along
- [ ] **4. The fox follows you up platforms.** Nav graph + A* with jump edges
- [ ] **6. More levels.**
- [ ] **7. Polish.** Sounds, saving progress
- [ ] **8. Jungle and desert worlds**
