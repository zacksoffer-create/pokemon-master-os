# Ball openings, as the games play them (v2.4, A-106)

Zack, 2026-10-26: *"I want all of the ball to have the animation from the game, not a custom one."*

When one of your Pokémon is shown in its portrait (the builder) or on the team's six, it comes out of its ball the way
its own game sends it out in battle. The player is `engine/app/web/31_ballopen.html`. It draws on a canvas over the
portrait and steps at the games' 60 frames a second. Each generation's opening is rebuilt from that game's
disassembly, at the same pinned commits the ball mechanics use (`engine/equipment/acquire.py`, A-30):

| Game | Generation | Source |
|---|---|---|
| FireRed, Emerald | III | pret/pokeemerald `731ad5bf`, with pret/pokefirered `ce6406d8` checked identical |
| HeartGold, SoulSilver | IV | pret/pokeheartgold `69881586` |
| Platinum | IV | pret/pokeplatinum `be36a9db` |
| Crystal | II | pret/pokecrystal `5c877ef5` (Gold and Silver are byte-identical) |

**The game's own pictures are not copied into the project.** The particle sheets and ball sprites are loaded at run
time from the disassemblies on GitHub, pinned to those commits. This is the same way the app loads the Pokémon sprites
(PokeAPI). The player decodes the indexed PNGs itself, so colour 0 is see-through exactly as on the console. If the
pictures can't load (offline, or a blocked network), the same motion still plays, with plain pixels in each frame's
main colour.

**What isn't the game:**
- **The throw is left out.** The portrait starts with the ball already landed:
  - Gen III shows the closed ball for 8 frames, then opens it.
  - Gen IV starts 5 frames before the burst, as the enemy side's ball does.
- **Gen III's white background flash** is drawn as a square the size of the portrait, behind the Pokémon.
- **Gen IV's burst** is shown in a DS-screen-sized window (256×192) around the Pokémon. The DS screen's edges would cut it
  off hard, so the window's outer 28 px fade out instead.
- **The portrait shows the front sprite**, so Gen II and Gen IV use the enemy side's positions: where the poof sits,
  and where the burst and ball start.
- **Gen IV's Pokémon grows from its feet** at a pivot 40 px below its centre. The game shifts this by each species'
  sprite offset, which the app doesn't have.
- **HeartGold and SoulSilver's Apricorn and Sport balls** have no picture file in the disassembly (their sprites are
  inside a packed archive). Their item picture stands in for the ball before the burst. The burst and colour are the
  game's.

## Gen III: FireRed and Emerald

Sources (pokeemerald `731ad5bf`; pokefirered `ce6406d8` has the same code in `src/battle_anim_special.c`, and its
`particles.png` and ball sprites are byte-identical):
- `src/battle_anim_throw.c`:
  - `sBallParticleAnimNums`, `sBallParticleAnimationFuncs`, `sAnims_BallParticles` and `gBallOpenFadeColors`;
  - the `*OpenParticleAnimation` routines and `FanOutBallOpenParticles_Step1`;
  - `LaunchBallFadeMonTask` and `Task_FadeMon_ToNormal`.
- `src/pokeball.c`: `SpriteCB_ReleaseMonFromBall`, `HandleBallAnimEnd` and `sBallAnimSeq1`.
- `src/data.c`: `sAffineAnim_Battler_Emerge`.
- `src/palette.c`: `BeginNormalPaletteFade`, `UpdateNormalPaletteFade` and `BlendPalette`.
- `src/trig.c`: `gSineTable`, which is sine truncated to Q8. The player computes it rather than copying it.
- Pictures:
  - `graphics/battle_anims/sprites/particles.png`: eight 8×8 frames, with the CircleImpact palette embedded.
  - `graphics/balls/<ball>.png`: three 16×16 frames. The Poké Ball's open frame is `graphics/balls/open.png`.

The sequence, frame 0 being the moment the ball opens:
- **The ball** shows its half-open frame for 5 frames, then its open frame for 5, then disappears.
- **The particles** start at the ball's spot, 5 px above it, which is 24 px below the Pokémon's centre.
- **The Pokémon** appears filled with the ball's fade colour (`BlendPalette` at 16/16). It grows from scale 0x28
  (16%) by 0x12 a frame for 12 frames to full size, rising from 16 px below its place by 288/256 px a frame.
- **The background** (BG palettes 1–3) fades to white, 2 steps every 2 frames (the fade alternates BG and OBJ
  palettes), about 18 frames. It then fades back.
- **As the background starts back**, the Pokémon's colours return in 17 `BlendPalette` steps (16 → 0), one a frame.

Each ball:

| Ball | Particles | Routine | Count | Path (angle 0–255 a frame; radius x, y a frame) | Life | Fade colour (RGB555) |
|---|---|---|---|---|---|---|
| Poké | spinning streak (frames 0,1,2,0 flipped,2,1) | own | 16, one a frame, 8 directions twice | straight out, radius +2 | 25 | 31,22,30 |
| Great | spinning streak | own | 2 waves of 8, 9 frames apart | +8; +2, +2 | 50 | 16,23,30 |
| Safari | spinning streak | Safari | 8 | +4; +1, +1 | 50 | 23,30,20 |
| Ultra | sparkle (frame 7) | Ultra | 10, 25 apart | +5; +1, +1 | 50 | 31,31,15 |
| Master | star (frame 3) | own | 2 × 8 | +8; one set +2,+1, the other +1,+2 | 50 | 23,20,28 |
| Net | bubble (frame 4) | Safari's | 8 | +4; +1, +1 | 50 | 21,31,25 |
| Dive | bubble (frame 4) | own | 8 | +10; +1, +2 | 50 | 12,25,30 |
| Nest | heart (frame 5) | Ultra's | 10 | +5; +1, +1 | 50 | 30,27,10 |
| Repeat | sparkle (frame 7) | own | 12, 21 apart | +6; x = sin(a)·r, y = cos(a)·sin(a)·r | 50 | 31,24,16 |
| Timer | sparkle (frame 7) | own | 8 | +10; +2, +1 | 50 | 29,30,30 |
| Luxury | twinkle (frames 6,7, 4 each) | Great's | 2 waves of 8 | +8; +2, +2 | 50 | 31,17,10 |
| Premier | twinkle (frames 6,7) | own | 8 | +10; x = sin(a)·r, y = cos(a)·sin(a & 63)·r | 50 | 31,9,10 |

A ball that doesn't exist in Gen III (an Apricorn ball, Dusk, Heal, Quick, Cherish) can't be on a FireRed or Emerald
Pokémon. If one is recorded anyway, the Poké Ball's opening plays, and the canvas is marked `data-fell`.

## Gen II: Crystal

Sources (pokecrystal `5c877ef5`; pokegold is byte-identical for all of this):
- `data/moves/animations.asm`: `BattleAnim_SendOutMon` `.Normal` and `.Shiny`.
- `data/battle_anims/objects.asm`, `framesets.asm` and `oam.asm`: the poof object (`BATTLE_ANIM_OBJ_BALL_POOF`),
  its frameset and its sprite layouts.
- `engine/battle_anims/bg_effects.asm`: `BATTLE_BG_EFFECT_ENTER_MON` and its square tables.
- `gfx/battle_anims/battle_anims.pal`: the GRAY and YELLOW palettes.
- `data/battle_anims/ball_colors.asm`: the ball colours, which are used for the thrown ball only.
- Pictures: `gfx/battle_anims/smoke.png` (12 tiles) and `gfx/battle_anims/speed.png` (the shiny sparkles). These are
  2-bit grey PNGs, where white is colour 0.

**No ball appears when a Pokémon is sent out in Gen II, and the opening is the same for every ball.** The Pokémon's data
has no ball field, and the send-out is played with only "normal" or "shiny". The sequence (60 frames a second):
- **The poof:** a grey smoke puff sits at the Pokémon's feet. It shows frames A, B, C and D for 4 frames each, then goes.
  Each frame is a 16×16 quarter mirrored four ways; D is C with each quarter pushed 4 px out.
- **The picture** is re-drawn from its own 8×8 tiles in growing boxes, each bottom-aligned and centred. It isn't
  scaled; each step picks tiles from the full picture:
  - at frame 5, a 3×3 box of columns and rows 0, 3 and 6;
  - at frame 9, a 5×5 box of 0, 1, 3, 5 and 6;
  - at frame 13, all of the 7×7.
- **The opening ends** at frame 38.
- **A shiny then plays `.Shiny`**, starting about 8 frames later:
  - the colours invert for frames 5–9;
  - 8 yellow sparkles appear one every 5 frames in a 16 px ring, each living 20 frames;
  - the sparkles' palette lightens on a 6-frame cycle.

## Gen IV: Platinum, HeartGold and SoulSilver

Each ball's opening is a NitroParticle (SPL) effect with 3–5 emitters, stored in one `.spa` file per ball.

**Where the files are:**
- **Platinum:** `res/graphics/battle/particles/pokeballs/open_<ball>_ball.spa`, one per ball.
- **HeartGold and SoulSilver:** members of the archive `files/a/0/9/5`.
  - Members 1–16 match Platinum's field for field.
  - Members 17–24, the seven Apricorn balls and the Sport Ball, are byte-identical copies of the Poké Ball's.
  - The Park Ball's ID is past the end of the game's table, so it falls back to the Poké Ball's too.

**How the player reads them.** It fetches the file (or the archive, once) and parses it as the game does:
`lib/spl/include/spl_resource.h` and `spl_texture.h`. The textures are white alpha masks (A5I3, A3I5), except the Dive
Ball's shaded bubble.

**How it runs them.** The emitters run as the game's particle library runs them, at the game's 30 frames a second:
- `lib/spl/src/spl_manager.c`: start delay, update and end;
- `spl_emitter.c`: emission interval, the update order, air resistance `(n + 384) / 512` and children;
- `spl_emit.c`: emission shapes, speed, scale, life and the colour pick;
- `spl_anim.c`: the scale, colour and alpha curves on the 0–255 life rate;
- `spl_behavior.c`: spin;
- `spl_random.h`: the game's own random-number generator. The seed is fixed, since the game seeds it elsewhere.

**How it draws them** (`spl_draw.c`):
- Each particle is a quad from −1 to 1 in its own units, at 24 px per world unit.
- Billboards turn by the particle's angle. Directional billboards stretch along the particle's velocity, by the file's
  `dbbScale`. The Cherish Ball's polygon turns about the vertical axis.
- Textures are tiled and mirrored as their flags say, and coloured by the particle (the DS's modulate mode).
- Blending is ordinary alpha, not additive.
- Emitters are drawn last-created first, with each emitter's children before or after its particles as the file says.

**The send-out around it** (`src/battle/battle_display.c`, `src/pokemon_sprite.c`):
- **The ball** sits closed, then starts sequence 1 of `res/graphics/battle/ball_throws/shared_anim.json`. From that
  sequence's frame 5 it fades to white, 2/16 a frame up to 14/16, and it's gone by frame 20. The ball pictures are
  `res/graphics/battle/ball_throws/<ball>_ball.png`.
- **The burst and the Pokémon start together**, at the ball's frame 5.
- **The Pokémon** appears at scale 0 as a silhouette in the ball's colour (`sFadeColors`), then grows by 1/8 a frame
  from its feet to full size at frame 8.
- **From frame 9 its own colours come back**, 1/16 every 2 frames, so it's back to normal around frame 41.
- **The burst starts 37 px below and 1 px right of the sprite's centre.** That's the enemy slot's offset from the
  battler's position (`ov12_02236520`).

**Tint colours (RGB555):**

| Ball | Colour | Ball | Colour |
|---|---|---|---|
| Master | 23,20,28 | Timer | 29,30,30 |
| Ultra | 31,31,15 | Luxury | 31,17,10 |
| Great | 16,23,30 | Premier | 31,9,10 |
| Poké | 31,22,30 | Dusk | 14,14,17 |
| Safari | 23,30,20 | Heal | 31,24,28 |
| Net | 21,31,25 | Quick | 17,26,31 |
| Dive | 12,25,30 | Cherish | 30,8,5 |
| Nest | 30,27,10 | Apricorn and Sport (HGSS) | as the Poké Ball |
| Repeat | 31,24,16 | Park | 31,31,31 |

The Park Ball's colour is read past the end of the table:
- In HeartGold and SoulSilver that reads white.
- In Platinum the value can't be known from the source, so white is used there too.

**Checked in the browser.** The number of particles alive at the peak matches what the files hold:

| Ball | Peak |
|---|---|
| Poké, Love, Fast, Park, Great, Dive, Dusk | 29 |
| Master | 44 |
| Timer | 42 |
| Nest | 38 |
| Quick | 33 |
| Cherish | 32 |
| Net | 30 |
| Heal | 19 |

`engine/app/test_teamflow.mjs` checks one opening from each generation.
