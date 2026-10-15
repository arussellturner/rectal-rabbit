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
`.../rectal-rabbit/russells-branch/`). Deploying `russells-branch` also
updates the main address above. Deploy runs the tests first and stops if any
fail. It takes GitHub a minute or so to update after a deploy.

This repo is a copy of `turnerm5/rectal-rabbit` (that one is the `upstream`
remote; `origin` is `arussellturner/rectal-rabbit`).

### Handy URL flags

- `?play` skips the title screen; `?level=4` jumps straight to level 4.
- `?calm` turns off the snow leopards, for exploring the level.
- `?at=100` starts the rabbit at tile column 100 (drops in from the sky).
- `?tune` opens a slider panel for jump height, speed, gravity, coyote time,
  bite time, poop speed, and so on. Changes apply live and are remembered in
  your browser. Use **Copy values** and paste them into
  `src/entities/tuning.ts` to keep them for good.
- `?debug` shows physics hitboxes plus a speed and position readout.
- Combine them: `http://localhost:5173/?play&calm&debug`

## Levels

| # | Level | World | What's special |
|---|---|---|---|
| 1 | Snowy Ridge | Snow | Learn the ropes |
| 2 | Whispering Woods | Forest | A winding river, crate towers, falling leaves |
| 3 | Dune Sea | Desert | Quicksand pools, sandstone mesas, blowing sand |
| 4 | Vine Temple | Jungle | Swamps, vine bridges, temple ruins |
| 5 | Crystal Caverns | Ice cave | A rock ceiling overhead, icy pools, crystals |
| 6 | Volcano Peak | Volcano | Lava everywhere and the fastest leopards |

Finish a level to unlock the next. On the title screen, press left / right to
pick any level you've unlocked (saved in your browser). Water, quicksand and
lava (`~`) cost a heart if you fall in, and snow leopards that fall in are gone.

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

### Playing on a phone or tablet

Open the game on your phone and on-screen controls appear: a d-pad on the
left, **JUMP**, **EAT/DIG**, **POOP** and **BOMB** on the right, and pause
(**II**) in the corner. Turn the phone sideways for the biggest view; held
upright, the game sits at the top with the buttons underneath. Tap the screen
to start, and tap the arrows by the level name to pick a level. Add the page
to your home screen to play full screen. (`?touch` shows the touch controls
on a computer, for testing.)

### Controller Setup

Press **Select** on your controller (or **C** on the keyboard) on the title
screen or the pause screen. Then:

1. **Button letters:** pick which letters are printed on your buttons (Xbox /
   8BitDo, Nintendo or PlayStation) with left / right, so the on-screen
   prompts match. An 8BitDo Ultimate 2C over Bluetooth often says it's a
   Switch Pro Controller, so choose **XBOX / 8BITDO** for it.
2. **Change a button:** click a control (or move to it with the d-pad and
   press any button), then press the controller button you want for it. If
   that button was already doing something, the two swap.
3. **Reset buttons** puts everything back. Settings are saved in your browser
   for each controller.

| Action | Keyboard | Phone / tablet | 8BitDo Ultimate 2C / Xbox | PS5 controller |
|---|---|---|---|---|
| Move | ← → | D-pad | Left stick / D-pad | Left stick / D-pad |
| Jump (hold for higher) | Space | JUMP | A | ✕ |
| Drop through a log bridge | ↓ + Space | ↓ + JUMP | ↓ + A | ↓ + ✕ |
| Eat (hold, on grass) | F | EAT/DIG | X | □ |
| Dig (on a dirt pile) | ↓ or F | ↓ or EAT/DIG | ↓ or X | ↓ or □ |
| Poop (out the back) | D | POOP | RB / RT | R1 / R2 |
| …high lob | hold ↑ + D | ↑ + POOP | stick ↑ + RB | stick ↑ + R1 |
| …drop straight down | in the air, ↓ + D | in the air, ↓ + POOP | in the air, ↓ + RB | in the air, ↓ + R1 |
| Poop bomb (costs 5) | S | BOMB | B or LB | ○ or L1 |
| Pause + help | P (or Esc) | II (top right) | Start | Options |
| Controller Setup | C | | Select | Create |

Bindings live in `src/input/bindings.ts`.

### Using an 8BitDo Ultimate 2C

1. Connect it (2.4G dongle, USB-C cable, or Bluetooth) and use **Chrome or
   Edge**.
2. **Press any button once the page is open.** Browsers hide controllers from
   a page until then. The title screen then shows a **button check**: each
   button lights up when you press it.
3. If the letters on screen don't match the buttons (e.g. it says **Y** for
   eat when your button says **X**), the computer thinks it's a different
   kind of controller, which often happens over Bluetooth. Open **Controller
   Setup** (Select) and set **Button letters** to **XBOX / 8BITDO**. You can
   change any button there too.

### Using a PS5 controller

1. Pair the DualSense over Bluetooth: hold **Create + PS** until the light
   bar flashes, then pick "DualSense Wireless Controller" in your computer's
   Bluetooth settings. A USB-C cable also works.
2. Use **Chrome or Edge**. They report the DualSense with the standard button
   layout. Firefox's mapping can be scrambled.
3. **Press any button once the page is open.**

The top-right of the screen shows which controller the game sees.

## Editing the level

Each level is drawn in text in its own file in `src/data/levels/` (the list
and order is in `src/data/levels/index.ts`), one 32-tile-wide screen at a
time. Each world's look (colors, trees, weather) is in `src/data/themes.ts`. Each letter is a tile:

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
| `~` | Water, quicksand or lava, depending on the world |

Burrow layouts live in `src/data/levels/burrows.ts` and are shared between levels, one screen each, with `d` for packed dirt,
`S` stone, `=` root ledges, `c` carrots, `R` where you drop in, and `E` at
the end of a row for the exit tunnel. The first `D` leads into the first
burrow, which comes out at the first `O`, and so on.

The rabbit jumps about 4 tiles high and 6 across. `npm test` checks every
level for mistakes: it works out where the rabbit can jump to and fails if
home (or a checkpoint, dirt pile, or burrow exit) can't be reached.

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
├── art/                  All the 8-bit level art, drawn in code (shared + per world)
├── input/                Keyboard + gamepad → actions ("jump", "shoot", …)
│   └── padConfig.ts      Controller button setup, saved per controller
├── level/LevelMap.ts     Turns a text level (and its burrows) into tiles and physics boxes
├── level/reachability.ts Can the rabbit get there? (used by the tests)
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
│   ├── ControllerSetupScene.ts  Remap buttons, pick button letters
│   └── buttonChips.ts    The [A] JUMP style button prompts
├── data/
│   ├── levels/           Every level, drawn in text, plus the shared burrows
│   ├── themes.ts         Each world's colors, scenery and weather
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
- [x] **6. More levels.** Forest, desert, jungle, ice cave and volcano, with level select
- [x] **Controller Setup.** Remap any button, pick the button letters
- [ ] **7. Polish.** Sounds, saving progress
