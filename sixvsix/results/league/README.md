# The whole system against each league

*Written by `node cli/league.mjs`. Each of your Gen 4 teams on its optimized spreads (D-072) against every member of its league on 85 EVs, all at Lv 100, trainer agents on both sides with each opponent's identity read from the Trainer Library. Mirrored pairs: every seed is played from both sides.*

| Team | League | Won | 95% interval | Weakest | D-072: 85 each → optimized | McNemar p | HP margin gained (95%) | Time |
|---|---|---|---|---|---|---|---|---|
| heartgold | heartgold-league | 414/440 (94%) | 92–96% | bruno-rematch 14/40 | 197/220 → 210/220 | 0.000244 | +0.108 [0.076, 0.141] | 66 s |
| soulsilver | heartgold-league | 388/440 (88%) | 85–91% | lance-rematch 5/40, lance 29/40 | 169/220 → 188/220 | 0.000157 | +0.142 [0.104, 0.18] | 74 s |
| platinum | platinum-league | 391/400 (98%) | 96–99% | — | 177/200 → 197/200 | < 0.0001 | +0.112 [0.069, 0.155] | 51 s |

## Per opponent

### heartgold

| Opponent | Won | Turns | Pokémon left when won | D-072 wins: 85 each / optimized (of 20) |
|---|---|---|---|---|
| Bruno · Elite Four · first battle | 40/40 | 18.7 | 4.5 | 19 / 20 |
| Karen · Elite Four · first battle | 40/40 | 10.7 | 5.8 | 20 / 20 |
| Koga · Elite Four · first battle | 40/40 | 15.1 | 5.6 | 20 / 20 |
| Will · Elite Four · first battle | 40/40 | 13.0 | 6.0 | 20 / 20 |
| Champion Lance (HeartGold) | 40/40 | 19.3 | 4.7 | 20 / 20 |
| Bruno · Elite Four · rematch | 14/40 | 19.2 | 3.1 | 1 / 10 |
| Karen · Elite Four · rematch | 40/40 | 18.2 | 4.8 | 19 / 20 |
| Koga · Elite Four · rematch | 40/40 | 12.9 | 5.3 | 20 / 20 |
| Will · Elite Four · rematch | 40/40 | 17.1 | 5.5 | 20 / 20 |
| Lance · Champion · rematch | 40/40 | 19.4 | 4.6 | 18 / 20 |
| Red on Mt. Silver (HeartGold) | 40/40 | 23.1 | 4.0 | 20 / 20 |

Fingerprint d7f58a7d664a88ef · node v22.22.0 · Intel(R) Xeon(R) Processor @ 2.10GHz · linux · 2026-10-25

### soulsilver

| Opponent | Won | Turns | Pokémon left when won | D-072 wins: 85 each / optimized (of 20) |
|---|---|---|---|---|
| Bruno · Elite Four · first battle | 40/40 | 14.0 | 5.2 | 20 / 20 |
| Karen · Elite Four · first battle | 39/40 | 18.5 | 4.8 | 18 / 20 |
| Koga · Elite Four · first battle | 40/40 | 16.1 | 5.9 | 20 / 20 |
| Will · Elite Four · first battle | 40/40 | 19.6 | 5.3 | 20 / 20 |
| Champion Lance (HeartGold) | 29/40 | 23.1 | 2.9 | 1 / 9 |
| Bruno · Elite Four · rematch | 39/40 | 19.0 | 4.4 | 15 / 20 |
| Karen · Elite Four · rematch | 40/40 | 20.7 | 5.2 | 20 / 20 |
| Koga · Elite Four · rematch | 40/40 | 23.9 | 4.5 | 20 / 20 |
| Will · Elite Four · rematch | 40/40 | 22.2 | 4.8 | 20 / 20 |
| Lance · Champion · rematch | 5/40 | 22.3 | 2.4 | 0 / 3 |
| Red on Mt. Silver (HeartGold) | 36/40 | 25.7 | 3.0 | 15 / 16 |

Fingerprint 9619028ca477b6c2 · node v22.22.0 · Intel(R) Xeon(R) Processor @ 2.10GHz · linux · 2026-10-25

### platinum

| Opponent | Won | Turns | Pokémon left when won | D-072 wins: 85 each / optimized (of 20) |
|---|---|---|---|---|
| Aaron · Elite Four · first battle | 40/40 | 11.3 | 4.9 | 20 / 20 |
| Bertha · Elite Four · first battle | 38/40 | 14.9 | 3.2 | 20 / 19 |
| Flint · Elite Four · first battle | 40/40 | 7.6 | 5.3 | 20 / 20 |
| Lucian · Elite Four · first battle | 40/40 | 14.5 | 5.0 | 17 / 20 |
| Champion Cynthia (Platinum) | 40/40 | 18.2 | 4.2 | 10 / 19 |
| Aaron · Elite Four · rematch | 40/40 | 12.7 | 4.8 | 20 / 20 |
| Bertha · Elite Four · rematch | 37/40 | 14.6 | 3.2 | 18 / 20 |
| Flint · Elite Four · rematch | 40/40 | 7.5 | 5.1 | 20 / 20 |
| Lucian · Elite Four · rematch | 40/40 | 14.4 | 5.3 | 20 / 19 |
| Cynthia · Champion · rematch | 36/40 | 18.8 | 4.1 | 12 / 20 |

Fingerprint 808a40da5cfe1bb3 · node v22.22.0 · Intel(R) Xeon(R) Processor @ 2.10GHz · linux · 2026-10-25

