# SMALL FILES — full content (read-only extracts)

Provenance: content returned by Drive `read_file_content`. Where a Google-Sheets read only *samples* rows, the full data was taken from the file's CSV twin or from an identical Veekun table, as noted per section.

---
## 1. Breeding_Requirements (Google Sheet) — 1ocJLSAdun15vfYqQuouq75kpUhPQ6T1aH5YfsvDAVE8
Created 2025-12-16T00:29:44Z, modified 00:29:46Z, 1,024 B. Tab "Breeding_Requirements", A1:G2. **Complete:**
| rule_id | move_name | applies_base_pokemon_id | min_game_name | required_item_name | ack_required | requirement_text |
|---|---|---|---|---|---|---|
| 1 | Volt Tackle | 172 | Emerald | Light Ball | TRUE | Requires Light Ball on a parent when breeding (Emerald+). |

CSV twin `Breeding_Requirements.csv` 1E3opKW3NIowRiawKLVgGp0eKXjsu4a70 (00:29:31Z, 205 B), complete:
```
rule_id,move_name,applies_base_pokemon_id,min_game_name,required_item_name,ack_required,requirement_text
1,Volt Tackle,172,Emerald,Light Ball,True,Requires Light Ball on a parent when breeding (Emerald+).
```
(The sheet stores TRUE as a boolean; the CSV has "True".) The later Option-2 schema (v2/v3 and BreedingLab_Option2_Tabs.xlsx) restates it as: `base_pokemon_id 172 | move_name Volt Tackle | requirement_type HOLD_ITEM | required_item_name Light Ball | notes "Parent must hold Light Ball to produce Volt Tackle (HGSS)."`

## 2. Canon_Builds_Template.xlsx — 1RZA5-yP0f3zGXa7Roc2aPkRsV6DJ2BB6
Uploaded 2025-12-17T21:44:47Z (mtime 21:44:23Z), 6,713 B. **Complete** (one tab "Canon Builds", header row only):
```
Pokémon,Nickname,Game,Version Group,Build Status,Nature,Ability,Gender,Shiny,Move 1,Move 2,Move 3,Move 4,Primary Move,Defining Move,Held Item,EV Spread,IV Notes,Final Level
```
(19 columns. This is the schema of the Dec-17/Dec-19 Canon Builds tabs. The Jan-2026 version inserts "Poke Ball Type, Encounter Location, Encounter Level" before Final Level.)

## 3. Canon_Breeding_Stock_Template.xlsx — 190CK2WIltEo_TyzqTzrE0EIRoPuGK5bj
Uploaded 2025-12-17T21:51:25Z, modified 21:53:50Z, 11,354 B. **Complete** (one tab "Canon Breeding Stock", header row only):
```
Base Species,Egg Move,Starting Moveset,Source Species,Game / Version Group,Method Notes,Canon Status,Notes
```
NOTE: in the v2/v3 spreadsheets the tab header reads `Base Species | Egg Move | Source Species | Beginning Moveset | Game / Version Group | Method Notes | Canon Status | Notes`. The column order differs and "Starting" became "Beginning". No file contains any Canon Breeding Stock data rows.

## 4. BreedingLab_Option2_Tabs.xlsx — 1aVBR8Fb3vmPsA-oT69LpRs3y2mg4_lDT
Uploaded 2025-12-16T21:41:09Z (mtime 21:40:51Z), 6,858 B. **Complete** (flattened text exactly as the reader returned it; tab names in bold):
- **Breeding_Lab:** `Breeding Lab (Option 2: Max Egg-Move Bundles),,,,,` / `Game,,,version_group_id,(auto),` / `Target Pokémon,,,base_pokemon_id,(auto),` / `Required Egg Move,,,max bundle size,(auto),` / `Outputs,,,,,` / `bundle_id,bundle_size,egg_moves_in_bundle,best_donor_pokemon,donor_egg_group_overlap,special_requirements`
- **Pokemon_Egg_Groups_Clean:** `species_id,egg_group_id,egg_group_name,example_pokemon_id,example_pokemon_name,,egg_group_id,egg_group_name` / `"(paste pokemon_egg_groups.csv here: species_id, egg_group_id)",,,,,,"(paste egg_groups.csv here: id, identifier)",`
- **Breeding_Requirements:** `base_pokemon_id,move_name,requirement_type,required_item_name,notes` / `172,Volt Tackle,HOLD_ITEM,Light Ball,Parent must hold Light Ball to produce Volt Tackle (HGSS).`

## 5. Breeding_Lab_New_Tabs.xlsx — 1l6QWAXeKaNZwwgmGfGwfJsVhhzOKOpM6
Uploaded 2025-12-16T18:59:08Z, modified 19:28:01Z, 146,859 B. The reader returned ~86 K characters; the **full flattened text is saved verbatim** in `SMALL_FILES_appendix_Breeding_Lab_New_Tabs.txt` (same folder). Tabs, in order:
| Tab | Header | Extent |
|---|---|---|
| Pokemon_Egg_Groups | species_id,egg_group_id,default_pokemon_id | 1,154 rows, species 1–898 (identical data to §7 below) |
| Egg_Groups | egg_group_id,egg_group_code,egg_group_name | 15 rows (1 monster … 15 no-eggs) |
| Pokemon_Species_Veekun | id,identifier,generation_id,evolves_from_species_id,evolution_chain_id,color_id,shape_id,habitat_id,gender_rate,capture_rate,base_happiness,is_baby,hatch_counter,has_gender_differences,growth_rate_id,forms_switchable,is_legendary,is_mythical,order,conquest_order | 898 rows (1 bulbasaur … 898 calyrex) |
| Genders | id,identifier | 1 female, 2 male, 3 genderless |
| Breeding_Requirements | rule_id,move_name,applies_base_pokemon_id,min_game_name,required_item_name,ack_required,requirement_text | 1 row (Volt Tackle, identical to §1) |
| Items_Master | item_id,item_name | items 1 Master Ball … 1658 Reins of Unity |
| Breeding_Lab | (template) | see verbatim below |

Breeding_Lab tab verbatim: `Breeding Lab (Template),,,,` / `Inputs,,,,` / `Field,,Notes,,` / `version_group_id,,Numeric ID used by your engine,,` / `target,,Base form or any evo; tool resolves to base,,` / `required_egg_move,,Must be an egg move for the target line,,` / `Outputs (generated later),,,,` / `bundle_size,egg_move_bundle,donor_species,donor_pokemon_example,notes` / `(This sheet is an overlay template. No engine references yet.),,,,`

## 6. Pokemon_Species_Core_Gen1_4 — 1mi4Gv7GH6atpz97CBuP91oOaepyyaHP5lBYQipYXN0c (+ CSV 19dwiJDZxkXLxLq1blMzbGHcygx-jd5QH)
Sheet created 2025-12-15T19:27:27Z / modified 19:27:46Z, 7,106 B; tab "Pokemon_Species", A1:F494. The sheet read sampled only species 1–249. The CSV twin (11,383 B) was read in full (493 rows); it stores evolves_from_species_id as floats ("1.0"). The block below gives all 493 rows in the sheet's integer form. **Provenance:** generated by script from the identical Veekun `Pokemon_Species_Veekun` table in Breeding_Lab_New_Tabs.xlsx (fields id, identifier, generation_id, evolves_from_species_id, evolution_chain_id, is_baby; ids ≤ 493). Cross-checked against the CSV read: row count 493 = 493; spot-checked rows 106, 113, 183, 226, 315, 358, 490, 493 all match; and the sheet's visible rows 1–249 match.
Notable data facts: babies are flagged is_baby = 1 (172 Pichu, 173 Cleffa, 174 Igglybuff, 175 Togepi, 236 Tyrogue, 238 Smoochum, 239 Elekid, 240 Magby, 298 Azurill, 360 Wynaut, 406 Budew, 433 Chingling, 438 Bonsly, 439 Mime Jr, 440 Happiny, 446 Munchlax, 447 **Riolu**, 458 Mantyke). Chain roots therefore resolve to these babies (e.g. 25 Pikachu ← 172, 448 Lucario ← 447).
```
species_id,species_key,introduced_gen,evolves_from_species_id,evolution_chain_id,is_baby
1,bulbasaur,1,,1,0
2,ivysaur,1,1,1,0
3,venusaur,1,2,1,0
4,charmander,1,,2,0
5,charmeleon,1,4,2,0
6,charizard,1,5,2,0
7,squirtle,1,,3,0
8,wartortle,1,7,3,0
9,blastoise,1,8,3,0
10,caterpie,1,,4,0
11,metapod,1,10,4,0
12,butterfree,1,11,4,0
13,weedle,1,,5,0
14,kakuna,1,13,5,0
15,beedrill,1,14,5,0
16,pidgey,1,,6,0
17,pidgeotto,1,16,6,0
18,pidgeot,1,17,6,0
19,rattata,1,,7,0
20,raticate,1,19,7,0
21,spearow,1,,8,0
22,fearow,1,21,8,0
23,ekans,1,,9,0
24,arbok,1,23,9,0
25,pikachu,1,172,10,0
26,raichu,1,25,10,0
27,sandshrew,1,,11,0
28,sandslash,1,27,11,0
29,nidoran-f,1,,12,0
30,nidorina,1,29,12,0
31,nidoqueen,1,30,12,0
32,nidoran-m,1,,13,0
33,nidorino,1,32,13,0
34,nidoking,1,33,13,0
35,clefairy,1,173,14,0
36,clefable,1,35,14,0
37,vulpix,1,,15,0
38,ninetales,1,37,15,0
39,jigglypuff,1,174,16,0
40,wigglytuff,1,39,16,0
41,zubat,1,,17,0
42,golbat,1,41,17,0
43,oddish,1,,18,0
44,gloom,1,43,18,0
45,vileplume,1,44,18,0
46,paras,1,,19,0
47,parasect,1,46,19,0
48,venonat,1,,20,0
49,venomoth,1,48,20,0
50,diglett,1,,21,0
51,dugtrio,1,50,21,0
52,meowth,1,,22,0
53,persian,1,52,22,0
54,psyduck,1,,23,0
55,golduck,1,54,23,0
56,mankey,1,,24,0
57,primeape,1,56,24,0
58,growlithe,1,,25,0
59,arcanine,1,58,25,0
60,poliwag,1,,26,0
61,poliwhirl,1,60,26,0
62,poliwrath,1,61,26,0
63,abra,1,,27,0
64,kadabra,1,63,27,0
65,alakazam,1,64,27,0
66,machop,1,,28,0
67,machoke,1,66,28,0
68,machamp,1,67,28,0
69,bellsprout,1,,29,0
70,weepinbell,1,69,29,0
71,victreebel,1,70,29,0
72,tentacool,1,,30,0
73,tentacruel,1,72,30,0
74,geodude,1,,31,0
75,graveler,1,74,31,0
76,golem,1,75,31,0
77,ponyta,1,,32,0
78,rapidash,1,77,32,0
79,slowpoke,1,,33,0
80,slowbro,1,79,33,0
81,magnemite,1,,34,0
82,magneton,1,81,34,0
83,farfetchd,1,,35,0
84,doduo,1,,36,0
85,dodrio,1,84,36,0
86,seel,1,,37,0
87,dewgong,1,86,37,0
88,grimer,1,,38,0
89,muk,1,88,38,0
90,shellder,1,,39,0
91,cloyster,1,90,39,0
92,gastly,1,,40,0
93,haunter,1,92,40,0
94,gengar,1,93,40,0
95,onix,1,,41,0
96,drowzee,1,,42,0
97,hypno,1,96,42,0
98,krabby,1,,43,0
99,kingler,1,98,43,0
100,voltorb,1,,44,0
101,electrode,1,100,44,0
102,exeggcute,1,,45,0
103,exeggutor,1,102,45,0
104,cubone,1,,46,0
105,marowak,1,104,46,0
106,hitmonlee,1,236,47,0
107,hitmonchan,1,236,47,0
108,lickitung,1,,48,0
109,koffing,1,,49,0
110,weezing,1,109,49,0
111,rhyhorn,1,,50,0
112,rhydon,1,111,50,0
113,chansey,1,440,51,0
114,tangela,1,,52,0
115,kangaskhan,1,,53,0
116,horsea,1,,54,0
117,seadra,1,116,54,0
118,goldeen,1,,55,0
119,seaking,1,118,55,0
120,staryu,1,,56,0
121,starmie,1,120,56,0
122,mr-mime,1,439,57,0
123,scyther,1,,58,0
124,jynx,1,238,59,0
125,electabuzz,1,239,60,0
126,magmar,1,240,61,0
127,pinsir,1,,62,0
128,tauros,1,,63,0
129,magikarp,1,,64,0
130,gyarados,1,129,64,0
131,lapras,1,,65,0
132,ditto,1,,66,0
133,eevee,1,,67,0
134,vaporeon,1,133,67,0
135,jolteon,1,133,67,0
136,flareon,1,133,67,0
137,porygon,1,,68,0
138,omanyte,1,,69,0
139,omastar,1,138,69,0
140,kabuto,1,,70,0
141,kabutops,1,140,70,0
142,aerodactyl,1,,71,0
143,snorlax,1,446,72,0
144,articuno,1,,73,0
145,zapdos,1,,74,0
146,moltres,1,,75,0
147,dratini,1,,76,0
148,dragonair,1,147,76,0
149,dragonite,1,148,76,0
150,mewtwo,1,,77,0
151,mew,1,,78,0
152,chikorita,2,,79,0
153,bayleef,2,152,79,0
154,meganium,2,153,79,0
155,cyndaquil,2,,80,0
156,quilava,2,155,80,0
157,typhlosion,2,156,80,0
158,totodile,2,,81,0
159,croconaw,2,158,81,0
160,feraligatr,2,159,81,0
161,sentret,2,,82,0
162,furret,2,161,82,0
163,hoothoot,2,,83,0
164,noctowl,2,163,83,0
165,ledyba,2,,84,0
166,ledian,2,165,84,0
167,spinarak,2,,85,0
168,ariados,2,167,85,0
169,crobat,2,42,17,0
170,chinchou,2,,86,0
171,lanturn,2,170,86,0
172,pichu,2,,10,1
173,cleffa,2,,14,1
174,igglybuff,2,,16,1
175,togepi,2,,87,1
176,togetic,2,175,87,0
177,natu,2,,88,0
178,xatu,2,177,88,0
179,mareep,2,,89,0
180,flaaffy,2,179,89,0
181,ampharos,2,180,89,0
182,bellossom,2,44,18,0
183,marill,2,298,90,0
184,azumarill,2,183,90,0
185,sudowoodo,2,438,91,0
186,politoed,2,61,26,0
187,hoppip,2,,92,0
188,skiploom,2,187,92,0
189,jumpluff,2,188,92,0
190,aipom,2,,93,0
191,sunkern,2,,94,0
192,sunflora,2,191,94,0
193,yanma,2,,95,0
194,wooper,2,,96,0
195,quagsire,2,194,96,0
196,espeon,2,133,67,0
197,umbreon,2,133,67,0
198,murkrow,2,,97,0
199,slowking,2,79,33,0
200,misdreavus,2,,98,0
201,unown,2,,99,0
202,wobbuffet,2,360,100,0
203,girafarig,2,,101,0
204,pineco,2,,102,0
205,forretress,2,204,102,0
206,dunsparce,2,,103,0
207,gligar,2,,104,0
208,steelix,2,95,41,0
209,snubbull,2,,105,0
210,granbull,2,209,105,0
211,qwilfish,2,,106,0
212,scizor,2,123,58,0
213,shuckle,2,,107,0
214,heracross,2,,108,0
215,sneasel,2,,109,0
216,teddiursa,2,,110,0
217,ursaring,2,216,110,0
218,slugma,2,,111,0
219,magcargo,2,218,111,0
220,swinub,2,,112,0
221,piloswine,2,220,112,0
222,corsola,2,,113,0
223,remoraid,2,,114,0
224,octillery,2,223,114,0
225,delibird,2,,115,0
226,mantine,2,458,116,0
227,skarmory,2,,117,0
228,houndour,2,,118,0
229,houndoom,2,228,118,0
230,kingdra,2,117,54,0
231,phanpy,2,,119,0
232,donphan,2,231,119,0
233,porygon2,2,137,68,0
234,stantler,2,,120,0
235,smeargle,2,,121,0
236,tyrogue,2,,47,1
237,hitmontop,2,236,47,0
238,smoochum,2,,59,1
239,elekid,2,,60,1
240,magby,2,,61,1
241,miltank,2,,122,0
242,blissey,2,113,51,0
243,raikou,2,,123,0
244,entei,2,,124,0
245,suicune,2,,125,0
246,larvitar,2,,126,0
247,pupitar,2,246,126,0
248,tyranitar,2,247,126,0
249,lugia,2,,127,0
250,ho-oh,2,,128,0
251,celebi,2,,129,0
252,treecko,3,,130,0
253,grovyle,3,252,130,0
254,sceptile,3,253,130,0
255,torchic,3,,131,0
256,combusken,3,255,131,0
257,blaziken,3,256,131,0
258,mudkip,3,,132,0
259,marshtomp,3,258,132,0
260,swampert,3,259,132,0
261,poochyena,3,,133,0
262,mightyena,3,261,133,0
263,zigzagoon,3,,134,0
264,linoone,3,263,134,0
265,wurmple,3,,135,0
266,silcoon,3,265,135,0
267,beautifly,3,266,135,0
268,cascoon,3,265,135,0
269,dustox,3,268,135,0
270,lotad,3,,136,0
271,lombre,3,270,136,0
272,ludicolo,3,271,136,0
273,seedot,3,,137,0
274,nuzleaf,3,273,137,0
275,shiftry,3,274,137,0
276,taillow,3,,138,0
277,swellow,3,276,138,0
278,wingull,3,,139,0
279,pelipper,3,278,139,0
280,ralts,3,,140,0
281,kirlia,3,280,140,0
282,gardevoir,3,281,140,0
283,surskit,3,,141,0
284,masquerain,3,283,141,0
285,shroomish,3,,142,0
286,breloom,3,285,142,0
287,slakoth,3,,143,0
288,vigoroth,3,287,143,0
289,slaking,3,288,143,0
290,nincada,3,,144,0
291,ninjask,3,290,144,0
292,shedinja,3,290,144,0
293,whismur,3,,145,0
294,loudred,3,293,145,0
295,exploud,3,294,145,0
296,makuhita,3,,146,0
297,hariyama,3,296,146,0
298,azurill,3,,90,1
299,nosepass,3,,147,0
300,skitty,3,,148,0
301,delcatty,3,300,148,0
302,sableye,3,,149,0
303,mawile,3,,150,0
304,aron,3,,151,0
305,lairon,3,304,151,0
306,aggron,3,305,151,0
307,meditite,3,,152,0
308,medicham,3,307,152,0
309,electrike,3,,153,0
310,manectric,3,309,153,0
311,plusle,3,,154,0
312,minun,3,,155,0
313,volbeat,3,,156,0
314,illumise,3,,157,0
315,roselia,3,406,158,0
316,gulpin,3,,159,0
317,swalot,3,316,159,0
318,carvanha,3,,160,0
319,sharpedo,3,318,160,0
320,wailmer,3,,161,0
321,wailord,3,320,161,0
322,numel,3,,162,0
323,camerupt,3,322,162,0
324,torkoal,3,,163,0
325,spoink,3,,164,0
326,grumpig,3,325,164,0
327,spinda,3,,165,0
328,trapinch,3,,166,0
329,vibrava,3,328,166,0
330,flygon,3,329,166,0
331,cacnea,3,,167,0
332,cacturne,3,331,167,0
333,swablu,3,,168,0
334,altaria,3,333,168,0
335,zangoose,3,,169,0
336,seviper,3,,170,0
337,lunatone,3,,171,0
338,solrock,3,,172,0
339,barboach,3,,173,0
340,whiscash,3,339,173,0
341,corphish,3,,174,0
342,crawdaunt,3,341,174,0
343,baltoy,3,,175,0
344,claydol,3,343,175,0
345,lileep,3,,176,0
346,cradily,3,345,176,0
347,anorith,3,,177,0
348,armaldo,3,347,177,0
349,feebas,3,,178,0
350,milotic,3,349,178,0
351,castform,3,,179,0
352,kecleon,3,,180,0
353,shuppet,3,,181,0
354,banette,3,353,181,0
355,duskull,3,,182,0
356,dusclops,3,355,182,0
357,tropius,3,,183,0
358,chimecho,3,433,184,0
359,absol,3,,185,0
360,wynaut,3,,100,1
361,snorunt,3,,186,0
362,glalie,3,361,186,0
363,spheal,3,,187,0
364,sealeo,3,363,187,0
365,walrein,3,364,187,0
366,clamperl,3,,188,0
367,huntail,3,366,188,0
368,gorebyss,3,366,188,0
369,relicanth,3,,189,0
370,luvdisc,3,,190,0
371,bagon,3,,191,0
372,shelgon,3,371,191,0
373,salamence,3,372,191,0
374,beldum,3,,192,0
375,metang,3,374,192,0
376,metagross,3,375,192,0
377,regirock,3,,193,0
378,regice,3,,194,0
379,registeel,3,,195,0
380,latias,3,,196,0
381,latios,3,,197,0
382,kyogre,3,,198,0
383,groudon,3,,199,0
384,rayquaza,3,,200,0
385,jirachi,3,,201,0
386,deoxys,3,,202,0
387,turtwig,4,,203,0
388,grotle,4,387,203,0
389,torterra,4,388,203,0
390,chimchar,4,,204,0
391,monferno,4,390,204,0
392,infernape,4,391,204,0
393,piplup,4,,205,0
394,prinplup,4,393,205,0
395,empoleon,4,394,205,0
396,starly,4,,206,0
397,staravia,4,396,206,0
398,staraptor,4,397,206,0
399,bidoof,4,,207,0
400,bibarel,4,399,207,0
401,kricketot,4,,208,0
402,kricketune,4,401,208,0
403,shinx,4,,209,0
404,luxio,4,403,209,0
405,luxray,4,404,209,0
406,budew,4,,158,1
407,roserade,4,315,158,0
408,cranidos,4,,211,0
409,rampardos,4,408,211,0
410,shieldon,4,,212,0
411,bastiodon,4,410,212,0
412,burmy,4,,213,0
413,wormadam,4,412,213,0
414,mothim,4,412,213,0
415,combee,4,,214,0
416,vespiquen,4,415,214,0
417,pachirisu,4,,215,0
418,buizel,4,,216,0
419,floatzel,4,418,216,0
420,cherubi,4,,217,0
421,cherrim,4,420,217,0
422,shellos,4,,218,0
423,gastrodon,4,422,218,0
424,ambipom,4,190,93,0
425,drifloon,4,,219,0
426,drifblim,4,425,219,0
427,buneary,4,,220,0
428,lopunny,4,427,220,0
429,mismagius,4,200,98,0
430,honchkrow,4,198,97,0
431,glameow,4,,221,0
432,purugly,4,431,221,0
433,chingling,4,,184,1
434,stunky,4,,223,0
435,skuntank,4,434,223,0
436,bronzor,4,,224,0
437,bronzong,4,436,224,0
438,bonsly,4,,91,1
439,mime-jr,4,,57,1
440,happiny,4,,51,1
441,chatot,4,,228,0
442,spiritomb,4,,229,0
443,gible,4,,230,0
444,gabite,4,443,230,0
445,garchomp,4,444,230,0
446,munchlax,4,,72,1
447,riolu,4,,232,1
448,lucario,4,447,232,0
449,hippopotas,4,,233,0
450,hippowdon,4,449,233,0
451,skorupi,4,,234,0
452,drapion,4,451,234,0
453,croagunk,4,,235,0
454,toxicroak,4,453,235,0
455,carnivine,4,,236,0
456,finneon,4,,237,0
457,lumineon,4,456,237,0
458,mantyke,4,,116,1
459,snover,4,,239,0
460,abomasnow,4,459,239,0
461,weavile,4,215,109,0
462,magnezone,4,82,34,0
463,lickilicky,4,108,48,0
464,rhyperior,4,112,50,0
465,tangrowth,4,114,52,0
466,electivire,4,125,60,0
467,magmortar,4,126,61,0
468,togekiss,4,176,87,0
469,yanmega,4,193,95,0
470,leafeon,4,133,67,0
471,glaceon,4,133,67,0
472,gliscor,4,207,104,0
473,mamoswine,4,221,112,0
474,porygon-z,4,233,68,0
475,gallade,4,281,140,0
476,probopass,4,299,147,0
477,dusknoir,4,356,182,0
478,froslass,4,361,186,0
479,rotom,4,,240,0
480,uxie,4,,241,0
481,mesprit,4,,242,0
482,azelf,4,,243,0
483,dialga,4,,244,0
484,palkia,4,,245,0
485,heatran,4,,246,0
486,regigigas,4,,247,0
487,giratina,4,,248,0
488,cresselia,4,,249,0
489,phione,4,,250,0
490,manaphy,4,,250,0
491,darkrai,4,,252,0
492,shaymin,4,,253,0
493,arceus,4,,254,0
```

## 7. Pokemon_Egg_Groups_Clean — 1RUTpEYRp-_DSw7omSRJICNdN4NUMaO_UfRfpOtVdDEM (+ CSV 1K01CIzEVIMxfIg3n2oXulGxlMr4yCvwf)
Sheet created 2025-12-16T00:22:59Z / modified 00:23:02Z, 6,629 B; tab "Pokemon_Egg_Groups_Clean", A1:C1155 (header species_id, egg_group_id, default_pokemon_id). The sheet read sampled only species 1–194. The CSV twin (11,637 B) was read in full: 1,154 rows covering **species 1–898**, not just Gen 1–4 despite the "Clean" name.
In **every** row default_pokemon_id = species_id, so the table is given compactly below as `species:egg_group_ids`. **Provenance:** generated by script from the identical `Pokemon_Egg_Groups` tab of Breeding_Lab_New_Tabs.xlsx (1,154 rows, species 1–898; the default = species assertion passed for all rows). Cross-checked against the CSV read: 24 species spot-checked (1, 25, 30, 83, 132, 172, 222, 223, 292, 351, 360, 439, 447, 448, 494, 531, 594, 702, 703, 777, 865, 870, 885, 898), all match.
Egg-group key (Egg_Groups_Master 14kXF572CgkBSz5re5U6WA74VSFbGKjvEDnKh9WRA1XQ, complete): 1 monster/Monster, 2 water1/Water1, 3 bug/Bug, 4 flying/Flying, 5 ground/Ground (= Field), 6 fairy/Fairy, 7 plant/Plant (= Grass), 8 humanshape/Humanshape, 9 water3/Water3, 10 mineral/Mineral, 11 indeterminate/Indeterminate (= Amorphous), 12 water2/Water2, 13 ditto/Ditto, 14 dragon/Dragon, 15 no-eggs/No Eggs (Undiscovered).
```
1:1,7 2:1,7 3:1,7 4:1,14 5:1,14 6:1,14 7:1,2 8:1,2 9:1,2 10:3 11:3 12:3 13:3 14:3 15:3 16:4 17:4 18:4 19:5 20:5
21:4 22:4 23:5,14 24:5,14 25:5,6 26:5,6 27:5 28:5 29:1,5 30:15 31:15 32:1,5 33:1,5 34:1,5 35:6 36:6 37:5 38:5 39:6 40:6
41:4 42:4 43:7 44:7 45:7 46:3,7 47:3,7 48:3 49:3 50:5 51:5 52:5 53:5 54:2,5 55:2,5 56:5 57:5 58:5 59:5 60:2
61:2 62:2 63:8 64:8 65:8 66:8 67:8 68:8 69:7 70:7 71:7 72:9 73:9 74:10 75:10 76:10 77:5 78:5 79:1,2 80:1,2
81:10 82:10 83:4,5 84:4 85:4 86:2,5 87:2,5 88:11 89:11 90:9 91:9 92:11 93:11 94:11 95:10 96:8 97:8 98:9 99:9 100:10
101:10 102:7 103:7 104:1 105:1 106:8 107:8 108:1 109:11 110:11 111:1,5 112:1,5 113:6 114:7 115:1 116:2,14 117:2,14 118:12 119:12 120:9
121:9 122:8 123:3 124:8 125:8 126:8 127:3 128:5 129:12,14 130:12,14 131:1,2 132:13 133:5 134:5 135:5 136:5 137:10 138:2,9 139:2,9 140:2,9
141:2,9 142:4 143:1 144:15 145:15 146:15 147:2,14 148:2,14 149:2,14 150:15 151:15 152:1,7 153:1,7 154:1,7 155:5 156:5 157:5 158:1,2 159:1,2 160:1,2
161:5 162:5 163:4 164:4 165:3 166:3 167:3 168:3 169:4 170:12 171:12 172:15 173:15 174:15 175:15 176:4,6 177:4 178:4 179:1,5 180:1,5
181:1,5 182:7 183:2,6 184:2,6 185:10 186:2 187:6,7 188:6,7 189:6,7 190:5 191:7 192:7 193:3 194:2,5 195:2,5 196:5 197:5 198:4 199:1,2 200:11
201:15 202:11 203:5 204:3 205:3 206:5 207:3 208:10 209:5,6 210:5,6 211:12 212:3 213:3 214:3 215:5 216:5 217:5 218:11 219:11 220:5
221:5 222:2,9 223:2,12 224:2,12 225:2,5 226:2 227:4 228:5 229:5 230:2,14 231:5 232:5 233:10 234:5 235:5 236:15 237:8 238:15 239:15 240:15
241:5 242:6 243:15 244:15 245:15 246:1 247:1 248:1 249:15 250:15 251:15 252:1,14 253:1,14 254:1,14 255:5 256:5 257:5 258:1,2 259:1,2 260:1,2
261:5 262:5 263:5 264:5 265:3 266:3 267:3 268:3 269:3 270:2,7 271:2,7 272:2,7 273:5,7 274:5,7 275:5,7 276:4 277:4 278:2,4 279:2,4 280:8,11
281:8,11 282:8,11 283:2,3 284:2,3 285:6,7 286:6,7 287:5 288:5 289:5 290:3 291:3 292:10 293:1,5 294:1,5 295:1,5 296:8 297:8 298:15 299:10 300:5,6
301:5,6 302:8 303:5,6 304:1 305:1 306:1 307:8 308:8 309:5 310:5 311:6 312:6 313:3,8 314:3,8 315:6,7 316:11 317:11 318:12 319:12 320:5,12
321:5,12 322:5 323:5 324:5 325:5 326:5 327:5,8 328:3,14 329:3,14 330:3,14 331:7,8 332:7,8 333:4,14 334:4,14 335:5 336:5,14 337:10 338:10 339:12 340:12
341:2,9 342:2,9 343:10 344:10 345:9 346:9 347:9 348:9 349:2,14 350:2,14 351:6,11 352:5 353:11 354:11 355:11 356:11 357:1,7 358:11 359:5 360:15
361:6,10 362:6,10 363:2,5 364:2,5 365:2,5 366:2 367:2 368:2 369:2,12 370:12 371:14 372:14 373:14 374:10 375:10 376:10 377:15 378:15 379:15 380:15
381:15 382:15 383:15 384:15 385:15 386:15 387:1,7 388:1,7 389:1,7 390:5,8 391:5,8 392:5,8 393:2,5 394:2,5 395:2,5 396:4 397:4 398:4 399:2,5 400:2,5
401:3 402:3 403:5 404:5 405:5 406:15 407:6,7 408:1 409:1 410:1 411:1 412:3 413:3 414:3 415:3 416:3 417:5,6 418:2,5 419:2,5 420:6,7
421:6,7 422:2,11 423:2,11 424:5 425:11 426:11 427:5,8 428:5,8 429:11 430:4 431:5 432:5 433:15 434:5 435:5 436:10 437:10 438:15 439:15 440:15
441:4 442:11 443:1,14 444:1,14 445:1,14 446:15 447:15 448:5,8 449:5 450:5 451:3,9 452:3,9 453:8 454:8 455:7 456:12 457:12 458:15 459:1,7 460:1,7
461:5 462:10 463:1 464:1,5 465:7 466:8 467:8 468:4,6 469:3 470:5 471:5 472:3 473:5 474:10 475:8,11 476:10 477:11 478:6,10 479:11 480:15
481:15 482:15 483:15 484:15 485:15 486:15 487:15 488:15 489:2,6 490:2,6 491:15 492:15 493:15 494:15 495:5,7 496:5,7 497:5,7 498:5 499:5 500:5
501:5 502:5 503:5 504:5 505:5 506:5 507:5 508:5 509:5 510:5 511:5 512:5 513:5 514:5 515:5 516:5 517:5 518:5 519:4 520:4
521:4 522:5 523:5 524:10 525:10 526:10 527:4,5 528:4,5 529:5 530:5 531:6 532:8 533:8 534:8 535:2 536:2 537:2 538:8 539:8 540:3
541:3 542:3 543:3 544:3 545:3 546:6,7 547:6,7 548:7 549:7 550:12 551:5 552:5 553:5 554:5 555:5 556:7 557:3,10 558:3,10 559:5,14 560:5,14
561:4 562:10,11 563:10,11 564:2,9 565:2,9 566:4,9 567:4,9 568:10 569:10 570:5 571:5 572:5 573:5 574:8 575:8 576:8 577:11 578:11 579:11 580:2,4
581:2,4 582:10 583:10 584:10 585:5 586:5 587:5 588:3 589:3 590:7 591:7 592:11 593:11 594:2,12 595:3 596:3 597:7,10 598:7,10 599:10 600:10
601:10 602:11 603:11 604:11 605:8 606:8 607:11 608:11 609:11 610:1,14 611:1,14 612:1,14 613:5 614:5 615:10 616:3 617:3 618:2,11 619:5,8 620:5,8
621:1,14 622:10 623:10 624:8 625:8 626:5 627:4 628:4 629:4 630:4 631:5 632:3 633:14 634:14 635:14 636:3 637:3 638:15 639:15 640:15
641:15 642:15 643:15 644:15 645:15 646:15 647:15 648:15 649:15 650:5 651:5 652:5 653:5 654:5 655:5 656:2 657:2 658:2 659:5 660:5
661:4 662:4 663:4 664:3 665:3 666:3 667:5 668:5 669:6 670:6 671:6 672:5 673:5 674:5,8 675:5,8 676:5 677:5 678:5 679:10 680:10
681:10 682:6 683:6 684:6 685:6 686:2,12 687:2,12 688:9 689:9 690:2,14 691:2,14 692:2,9 693:2,9 694:1,14 695:1,14 696:1,14 697:1,14 698:1 699:1 700:5
701:4,8 702:5,6 703:6,10 704:14 705:14 706:14 707:10 708:7,11 709:7,11 710:11 711:11 712:1,10 713:1,10 714:4,14 715:4,14 716:15 717:15 718:15 719:15 720:15
721:15 722:4 723:4 724:4 725:5 726:5 727:5 728:2,5 729:2,5 730:2,5 731:4 732:4 733:4 734:5 735:5 736:3 737:3 738:3 739:9 740:9
741:4 742:3,6 743:3,6 744:5 745:5 746:12 747:2 748:2 749:5 750:5 751:2,3 752:2,3 753:7 754:7 755:7 756:7 757:1,14 758:1,14 759:5 760:5
761:7 762:7 763:7 764:7 765:5 766:5 767:3,9 768:3,9 769:11 770:11 771:2 772:15 773:15 774:10 775:5 776:1,14 777:5,6 778:11 779:12 780:1,14
781:10 782:14 783:14 784:14 785:15 786:15 787:15 788:15 789:15 790:15 791:15 792:15 793:15 794:15 795:15 796:15 797:15 798:15 799:15 800:15
801:15 802:15 803:15 804:15 805:15 806:15 807:15 808:15 809:15 810:5,7 811:5,7 812:5,7 813:5,8 814:5,8 815:5,8 816:2,5 817:2,5 818:2,5 819:5 820:5
821:4 822:4 823:4 824:3 825:3 826:3 827:5 828:5 829:7 830:7 831:5 832:5 833:1,2 834:1,2 835:5 836:5 837:10 838:10 839:10 840:7,14
841:7,14 842:7,14 843:5,14 844:5,14 845:2,4 846:12 847:12 848:15 849:8 850:3 851:3 852:2,8 853:2,8 854:10,11 855:10,11 856:6 857:6 858:6 859:6,8 860:6,8
861:6,8 862:5 863:5 864:2,9 865:4,5 866:8 867:10,11 868:6,11 869:6,11 870:6,10 871:2,11 872:3 873:3 874:10 875:2,5 876:6 877:5,6 878:5,10 879:5,10 880:15
881:15 882:15 883:15 884:10,14 885:11,14 886:11,14 887:11,14 888:15 889:15 890:15 891:15 892:15 893:15 894:15 895:15 896:15 897:15 898:15
```

## 8. Other small project files (metadata/snippets only — not in the requested list)
- **Egg_Groups_Master** sheet 14kXF572CgkBSz5re5U6WA74VSFbGKjvEDnKh9WRA1XQ (2025-12-16T00:21:39Z) and CSV 104g60IY6Wt8YJKJF5cvz59VNPrBBLqSO: complete content = the 15-row key in §7 (columns egg_group_id, egg_group_code, egg_group_name).
- **Items_Master** sheet 1_AnoAxvXExg48mmEbtFqs7mgzByg60BWf_AR5ETmygA (00:24:00Z, 13,698 B), CSV 1Rlkktf2KsIC23hL4-fN6XaeUWsad-j_H (24,627 B): item_id,item_name; snippet: 1 Master Ball, 2 Ultra Ball, 3 Great Ball, 4 Poké Ball … 73 Blue Shard …. The same list appears as v1's Items_Master tab (A1:B1608) and in the appendix (to item 1658).
- **version_groups.csv** 1Y7h297TnhD9b9G9OWICwQ3F5l4d6oLbd (440 B, complete per snippet): id,identifier,generation_id,order — 1 red-blue,1,1; 2 yellow,1,2; 3 gold-silver,2,3; 4 crystal,2,4; 5 ruby-sapphire,3,5; 6 emerald,3,6; 7 firered-leafgreen,3,9; 8 diamond-pearl,4,10; 9 platinum,4,11; 10 heartgold-soulsilver,4,12; 11 black-white,5,13; 12 colosseum,3,7; 13 xd,3,8; 14 black-2-white-2,5,14; 15 x-y,6,15; 16 omega-ruby-alpha-sapphire,6,16; 17 sun-moon,7,17; 18 ultra-sun-ultra-moon,7,18; 19 lets-go-pikachu-lets-go-eevee,7,19; 20 sword-shield,8,20.

## 9. Metadata only (contents NOT read, per instructions)
| File | ID | Uploaded (UTC) | Size |
|---|---|---|---|
| pokemon_moves.csv | 1Mt1CwZkwO-7SsR9A6oZe4egLKoPhglvR | 2025-12-15T06:20:57Z (mtime 06:19:01Z) | 8,298,079 |
| pokemon_evolution.csv | 17kqEQyBZBQbjlmKfRxlB6j1n2e4sxmkf | 2025-12-15T06:20:54Z (mtime 06:19:32Z) | 14,500 |
| pokemon_move_methods.csv | 1k73i3zaxJZ3SHnxHUi-Mdi6lxZ-v1wRq | 2025-12-15T06:20:54Z (mtime 06:19:11Z) | 178 |
| pokemon_species.csv | 1lmA9LXmKFvHEoPt5qIePla8uaTcN0dWH | 2025-12-15T06:20:54Z (mtime 06:18:36Z) | 49,667 |
| pokemon.csv | 1X6DFuRvuvoVGxul9aH-U1fpumn-znd6J | 2025-12-15T06:20:54Z (mtime 06:18:20Z) | 37,295 |
| moves.csv | 1U4JLJlODFD9yWyuKJnshDkg73Ns0VA8v | 2025-12-15T06:20:54Z (mtime 06:18:49Z) | 38,162 |
| Pokemon_Species_Core_Gen1_4.csv | 19dwiJDZxkXLxLq1blMzbGHcygx-jd5QH | 2025-12-15T19:27:04Z (mtime 19:25:57Z) | 11,383 (read in full; see §6) |
| Pokemon_Egg_Groups_Clean.csv | 1K01CIzEVIMxfIg3n2oXulGxlMr4yCvwf | 2025-12-16T00:21:17Z (mtime 00:20:45Z) | 11,637 (read in full; see §7) |
| Breeding_Requirements.csv | 1E3opKW3NIowRiawKLVgGp0eKXjsu4a70 | 2025-12-16T00:29:31Z (mtime 00:29:22Z) | 205 (read; see §1) |
| Pokemon_Roster_Template_BuildStep2_GSheetsVisible.xlsx | 1LE48iGney2unNsviY7OR7HatLEVkMxGX | 2025-12-15T16:29:42Z (mtime 16:23:11Z) | 16,110,373 |
