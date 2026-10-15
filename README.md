# Rectal Rabbit

A side-scrolling stealth/escape game. You're a rabbit: eat grass, poop at
predators, set poop-bomb traps, and get home through snow, jungle and desert.

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
| `npm test` | Unit tests for movement and input logic (Vitest) |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the `dist/` build (opening `dist/index.html` directly won't work) |

### Handy URL flags

- `http://localhost:5173/?tune` opens a slider panel for jump height, speed,
  gravity, coyote time, bite time, poop speed, and so on. Changes apply live and are remembered in
  your browser. Use **Copy values** and paste them into
  `src/entities/tuning.ts` to keep them for good.
- `http://localhost:5173/?debug` shows physics hitboxes plus a speed and
  "on ground" readout.
- `http://localhost:5173/?nocones` hides the foxes' vision cones (harder!).
- Combine them: `?tune&debug`

## Controls

| Action | Keyboard | PS5 controller | Xbox |
|---|---|---|---|
| Move | ← → or A D | Left stick / D-pad | Left stick / D-pad |
| Jump (hold for higher) | Space | ✕ | A |
| Drop through a wooden platform | ↓ + Space | ↓ + ✕ | ↓ + A |
| Eat (hold, standing on grass) | E | □ | X |
| Poop (out the back) | tap J or F | tap R1 / R2 | tap RB / RT |
| SUPER POOP | hold J, let go to fire | hold R1 / R2 | hold RB / RT |
| Cancel a SUPER POOP charge | Space (jumps too) or L | ✕ (jumps too) or L1 / L2 | A (jumps too) or LB / LT |
| …high lob | hold ↑ + J | stick ↑ + R1 | stick ↑ + RB |
| …drop straight down | in the air, ↓ + J | in the air, ↓ + R1 | in the air, ↓ + RB |
| Pause | Esc or P | Options | Menu |
| *Drop poop bomb (step 5)* | *K or B* | *○* | *B* |

### How eating and pooping work

- Each grass patch has 3 bites. Hold Eat on it to chew; every bite is one poop.
- You carry up to 10 poops (the meter in the top-left). A full rabbit can't eat.
- Nibbled grass grows back one bite every 5 seconds.
- Poop comes out the back, which is where chasing predators will be. Hit the
  bullseye targets to practice: three hits knocks one over.
- Untick `shootBackwards` in the `?tune` panel if you'd rather fire forward.

### SUPER POOP

- **Hold** the poop button to charge. The rabbit plants its feet, and a glow
  over the meter shows how many poops the shot will use (one more every 0.2 s).
- **Let go** to fire one big poop. Bigger = stuns longer and knocks foxes back.
- With a **full meter (10)**, charge all the way (the meter goes rainbow and
  says TORRENT!) and let go: a torrent of diarrhea, plus a giant SUPER POOP!
- **Jump** to cancel (and leap away), or **L / L1** to cancel on the spot.
  Cancelling costs nothing.

### Foxes (and how not to get eaten)

Foxes patrol their stretch of ground and graze. Each one has a **vision cone**
(the see-through wedge in front of it) and a **detection meter**:

| Above its head | What it means | What it does |
|---|---|---|
| nothing | Hasn't noticed you | Wanders and grazes |
| yellow **?** + meter | Noticed something | Stops, turns, creeps over to look. If the meter empties, it forgets you |
| red **!** | Spotted you | Freezes for a moment: **run!** Then chases |
| orange **?** | Lost you | Goes to where it last saw you and looks around, then gives up |
| ⭐ stars | Pooped on | Stunned for a couple of seconds. Then it's angry |

Tips:
- The meter fills faster the closer you are, and slower if you **stand still**.
- Walls block its view. It can't see behind itself…
- …but it can **hear** you chewing grass and running, even through walls.
- You're faster than a fox. Jump up onto a wooden platform and it can't
  reach you (until step 4). It waits below for a bit, then gives up.
- Get caught and you're back at the start.

Bindings live in `src/input/bindings.ts`.

### Using a PS5 controller

1. Pair the DualSense over Bluetooth: hold **Create + PS** until the light
   bar flashes, then pick "DualSense Wireless Controller" in your computer's
   Bluetooth settings. A USB-C cable also works.
2. Use **Chrome or Edge**. They report the DualSense with the standard button
   layout. Firefox's mapping can be scrambled.
3. **Press any button once the page is open.** Browsers hide controllers from
   a page until then; the title screen asks for this.

The top-left of the screen shows which controller the game sees.

## Project layout

```
src/
├── main.ts               Phaser game setup; reads input once per frame
├── config.ts             Screen size, ?debug / ?tune flags
├── input/                Keyboard + gamepad → actions ("jump", "shoot", …)
│   ├── bindings.ts       Which keys/buttons do what
│   ├── InputManager.ts   The one place game code reads input from
│   ├── KeyboardSource.ts
│   ├── GamepadSource.ts  Browser Gamepad API, deadzone, rumble
│   └── ActionState.ts    "just pressed" / "just released" tracking
├── ai/                   Predator brains, no Phaser (unit tested)
│   ├── PredatorBrain.ts  The patrol / ? / ! / chase / search / stunned state machine
│   ├── perception.ts     Vision cone, line of sight, hearing
│   └── geometry.ts       Line-vs-box test used for line of sight
├── entities/
│   ├── Predator.ts       A fox in the level: body, art, cone, ?/! marker
│   ├── Rabbit.ts         The player: movement, eating, shooting, squash/stretch
│   ├── RabbitMotor.ts    Movement rules: accel, coyote time, jump buffer…
│   ├── poopLaunch.ts     Which way and how fast a poop flies
│   ├── GrassPatch.ts     A tuft of grass that shrinks and regrows
│   ├── PoopPellets.ts    Flying/landed poop pellets
│   ├── PracticeTarget.ts Bullseyes to aim at
│   └── tuning.ts         All the movement and poop numbers
├── systems/
│   ├── PoopAmmo.ts       How many poops you're carrying
│   ├── PoopCharge.ts     Tap vs hold, SUPER POOP charge, torrent, cancel
│   └── GrassState.ts     Bites left + regrowth timer
├── scenes/               Boot → Title → Level (+ Hud, Pause on top)
├── data/
│   ├── greyboxLevel.ts   Prototype level layout (Tiled maps come in step 6)
│   └── predators.ts      Each species' senses, speeds and timings (just data)
└── debug/tuningPanel.ts  The ?tune slider panel
```

Logic that doesn't need Phaser (`RabbitMotor`, `poopLaunch`, `systems/`, `ActionState`, `gamepadMath`)
is kept separate so it can be unit tested, and so is the predator AI (`src/ai/`).
Adding a new animal is mostly copying `FOX` in `src/data/predators.ts` and
changing the numbers.

## Roadmap

- [x] **1. The rabbit hops.** Gray-box level, keyboard + controller, jumping feels good
- [x] **2. Eat and poop.** Grass patches, ammo counter, poop that flies in an arc
- [x] **3. One fox on flat ground.** Vision cone, detection meter, ? and !, chase and give up
- [ ] **4. The fox follows you up platforms.** Nav graph + A* with jump edges
- [ ] **5. Poop bomb.** Fill the meter, drop the trap, the fox gets stuck
- [ ] **6. First real level.** Built in Tiled, snow tileset, exit burrow
- [ ] **7. Polish.** Title screen, sounds, HUD, saving progress
- [ ] **8. Jungle and desert worlds**
