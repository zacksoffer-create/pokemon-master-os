# The whole system against each league

*Written by `node cli/league.mjs`. Each of your Gen 4 teams on its optimized spreads (D-072) against every member of its league on 85 EVs, all at Lv 100, trainer agents on both sides with each opponent's identity read from the Trainer Library. Mirrored pairs: every seed is played from both sides.*

| Team | League | Won | 95% interval | Weakest | D-072: 85 each → optimized | McNemar p | HP margin gained (95%) | Time |
|---|---|---|---|---|---|---|---|---|
| heartgold | heartgold-league | 418/440 (95%) | 93–97% | bruno-rematch 22/40 | 197/220 → 209/220 | 0.004181 | +0.091 [0.052, 0.13] | 19 s |
| soulsilver | heartgold-league | 385/440 (88%) | 84–90% | lance-rematch 8/40, lance 25/40, red 35/40 | 163/220 → 193/220 | < 0.0001 | +0.161 [0.113, 0.208] | 16 s |
| platinum | platinum-league | 391/400 (98%) | 96–99% | — | 178/200 → 196/200 | 0.000121 | +0.092 [0.045, 0.139] | 12 s |

## Per opponent

### heartgold

| Opponent | Won | Turns | Pokémon left when won | D-072 wins: 85 each / optimized (of 20) |
|---|---|---|---|---|
| Bruno · Elite Four · first battle | 40/40 | 16.2 | 4.5 | 19 / 20 |
| Karen · Elite Four · first battle | 40/40 | 10.7 | 5.9 | 20 / 20 |
| Koga · Elite Four · first battle | 40/40 | 14.8 | 5.3 | 20 / 20 |
| Will · Elite Four · first battle | 40/40 | 13.8 | 6.0 | 20 / 20 |
| Champion Lance (HeartGold) | 40/40 | 18.1 | 4.7 | 20 / 19 |
| Bruno · Elite Four · rematch | 22/40 | 15.0 | 2.7 | 1 / 10 |
| Karen · Elite Four · rematch | 40/40 | 17.1 | 4.7 | 19 / 20 |
| Koga · Elite Four · rematch | 40/40 | 12.9 | 5.0 | 20 / 20 |
| Will · Elite Four · rematch | 40/40 | 16.1 | 5.6 | 20 / 20 |
| Lance · Champion · rematch | 37/40 | 18.2 | 4.4 | 18 / 20 |
| Red on Mt. Silver (HeartGold) | 39/40 | 18.4 | 4.7 | 20 / 20 |

Fingerprint df98da11a5d444b3 · node v22.22.0 · Intel(R) Xeon(R) Processor @ 2.10GHz · linux · 2026-10-25

### soulsilver

| Opponent | Won | Turns | Pokémon left when won | D-072 wins: 85 each / optimized (of 20) |
|---|---|---|---|---|
| Bruno · Elite Four · first battle | 40/40 | 12.5 | 5.4 | 20 / 20 |
| Karen · Elite Four · first battle | 40/40 | 16.3 | 5.2 | 16 / 20 |
| Koga · Elite Four · first battle | 40/40 | 19.6 | 5.8 | 20 / 20 |
| Will · Elite Four · first battle | 40/40 | 14.5 | 5.7 | 20 / 20 |
| Champion Lance (HeartGold) | 25/40 | 18.2 | 2.9 | 3 / 14 |
| Bruno · Elite Four · rematch | 37/40 | 20.6 | 4.2 | 16 / 20 |
| Karen · Elite Four · rematch | 40/40 | 18.2 | 5.0 | 17 / 20 |
| Koga · Elite Four · rematch | 40/40 | 19.7 | 5.7 | 20 / 19 |
| Will · Elite Four · rematch | 40/40 | 20.2 | 4.7 | 20 / 20 |
| Lance · Champion · rematch | 8/40 | 23.9 | 2.3 | 0 / 2 |
| Red on Mt. Silver (HeartGold) | 35/40 | 22.4 | 3.1 | 11 / 18 |

Fingerprint 174c7644c7ccd656 · node v22.22.0 · Intel(R) Xeon(R) Processor @ 2.10GHz · linux · 2026-10-25

### platinum

| Opponent | Won | Turns | Pokémon left when won | D-072 wins: 85 each / optimized (of 20) |
|---|---|---|---|---|
| Aaron · Elite Four · first battle | 40/40 | 13.7 | 4.4 | 20 / 20 |
| Bertha · Elite Four · first battle | 38/40 | 14.1 | 3.0 | 19 / 20 |
| Flint · Elite Four · first battle | 40/40 | 7.1 | 5.1 | 20 / 20 |
| Lucian · Elite Four · first battle | 40/40 | 11.7 | 5.3 | 17 / 20 |
| Champion Cynthia (Platinum) | 39/40 | 18.2 | 3.8 | 13 / 18 |
| Aaron · Elite Four · rematch | 40/40 | 13.3 | 4.5 | 20 / 20 |
| Bertha · Elite Four · rematch | 37/40 | 14.4 | 2.9 | 19 / 20 |
| Flint · Elite Four · rematch | 40/40 | 7.2 | 5.1 | 20 / 20 |
| Lucian · Elite Four · rematch | 40/40 | 12.3 | 5.3 | 18 / 19 |
| Cynthia · Champion · rematch | 37/40 | 19.9 | 3.7 | 12 / 19 |

Fingerprint 69a5e4413a8b1a44 · node v22.22.0 · Intel(R) Xeon(R) Processor @ 2.10GHz · linux · 2026-10-25

