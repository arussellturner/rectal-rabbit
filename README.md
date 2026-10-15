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
  gravity, coyote time, and so on. Changes apply live and are remembered in
  your browser. Use **Copy values** and paste them into
  `src/entities/tuning.ts` to keep them for good.
- `http://localhost:5173/?debug` shows physics hitboxes plus a speed and
  "on ground" readout.
- Combine them: `?tune&debug`

## Controls

| Action | Keyboard | PS5 controller | Xbox |
|---|---|---|---|
| Move | ← → or A D | Left stick / D-pad | Left stick / D-pad |
| Jump (hold for higher) | Space, W or ↑ | ✕ | A |
| Drop through a wooden platform | ↓ + Space | ↓ + ✕ | ↓ + A |
| Pause | Esc or P | Options | Menu |
| *Eat (step 2)* | *E* | *□* | *X* |
| *Shoot poop (step 2)* | *J or F* | *R1 / R2* | *RB / RT* |
| *Drop poop bomb (step 5)* | *K or B* | *○* | *B* |

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
├── entities/
│   ├── Rabbit.ts         The player (hitbox + art + squash/stretch)
│   ├── RabbitMotor.ts    Movement rules: accel, coyote time, jump buffer…
│   └── tuning.ts         All the movement numbers
├── scenes/               Boot → Title → Level (+ Hud, Pause on top)
├── data/greyboxLevel.ts  Prototype level layout (Tiled maps come in step 6)
└── debug/tuningPanel.ts  The ?tune slider panel
```

Logic that doesn't need Phaser (`RabbitMotor`, `ActionState`, `gamepadMath`)
is kept separate so it can be unit tested. The predator AI in steps 3–4 will
follow the same pattern (`src/ai/`).

## Roadmap

- [x] **1. The rabbit hops.** Gray-box level, keyboard + controller, jumping feels good
- [ ] **2. Eat and poop.** Grass patches, ammo counter, poop that flies in an arc
- [ ] **3. One fox on flat ground.** Vision cone, detection meter, ? and !, chase and give up
- [ ] **4. The fox follows you up platforms.** Nav graph + A* with jump edges
- [ ] **5. Poop bomb.** Fill the meter, drop the trap, the fox gets stuck
- [ ] **6. First real level.** Built in Tiled, snow tileset, exit burrow
- [ ] **7. Polish.** Title screen, sounds, HUD, saving progress
- [ ] **8. Jungle and desert worlds**
