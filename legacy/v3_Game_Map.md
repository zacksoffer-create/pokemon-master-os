# v3 tab extract: Game_Map

- Source: "Pokemon Master Spreadsheet v3" (`1SE6GsKSrQJlv8uGd9bFZH670e1YTQeLZasKn0W9lPek`)
- Detected range: `A1:C8`
- Coverage: COMPLETE (all 8 rows). Taken from the MAX_ALLOWED metadata snippet and cross-checked against the first 7 rows from read_file_content.

| game_label | version_group_id | version_group_name |
|---|---|---|
| Crystal | 4 | crystal |
| FireRed | 7 | firered-leafgreen |
| LeafGreen | 7 | firered-leafgreen |
| Emerald | 6 | emerald |
| Platinum | 9 | platinum |
| HeartGold | 10 | heartgold-soulsilver |
| SoulSilver | 10 | heartgold-soulsilver |

Raw CSV exactly as returned:
```
game_label,version_group_id,version_group_name
Crystal,4,crystal
FireRed,7,firered-leafgreen
LeafGreen,7,firered-leafgreen
Emerald,6,emerald
Platinum,9,platinum
HeartGold,10,heartgold-soulsilver
SoulSilver,10,heartgold-soulsilver
```

## Observations
- Every ID and identifier matches the PokeAPI `version_groups.csv` scheme: 4 = crystal, 6 = emerald, 7 = firered-leafgreen, 9 = platinum, 10 = heartgold-soulsilver. None of the IDs are odd.
- Gold/Silver (3), Ruby/Sapphire (5) and Diamond/Pearl (8) are not mapped. Neither is any version group above 10. Pokemon_Moves_Display, however, contains version groups 1-20.
- Canon Builds' "Game" column uses labels that are not in this map: "Crystal (RIVAL)", "HeartGold (Danny)", and others. Any lookup on those rows would fail.
