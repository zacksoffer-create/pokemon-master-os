# Ball openings, as the games play them (v2.4, A-106)

Zack, 2026-10-26: *"I want all of the ball to have the animation from the game, not a custom one."*

When one of your Pokémon is shown in its portrait (the builder) or on the team's six, it comes out of its ball the way
its own game sends it out in battle. The player is `engine/app/web/31_ballopen.html`. It draws on a canvas over the
portrait and steps at the games' 60 frames a second. Each generation's opening is rebuilt from that game's
disassembly, at the same pinned commits the ball mechanics use (`engine/equipment/acquire.py`, A-30):

| Game | Generation | Source |
|---|---|---|
| FireRed, Emerald | III | pret/pokeemerald `731ad5bf`, with pret/pokefirered `ce6406d8` checked identical |
| HeartGold, SoulSilver, Platinum | IV | see the Gen IV section |
| Crystal | II | see the Gen II section |

**The game's own pictures are not copied into the project.** The particle sheets and ball sprites are loaded at run
time from the disassemblies on GitHub, pinned to those commits. This is the same way the app loads the Pokémon sprites
(PokeAPI). The player decodes the indexed PNGs itself, so colour 0 is see-through exactly as on the console. If the
pictures can't load (offline, or a blocked network), the same motion still plays, with plain pixels in each frame's
main colour.

**What isn't the game.** Two differences:
- The throw arc is left out. The portrait starts with the closed ball for 8 frames, then opens it.
- The battle background's white flash is drawn as a square behind the Pokémon, the size of the portrait.

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
