# DOC: Apps Script project "Untitled project" (the visible engine script)

- **File ID:** 1ZnAgBDXzd1eP2EP_027u0pFPzo8E3-gaJ4-G-fqWh_rpruDnGmH2v-97
- **MIME:** application/vnd.google-apps.script — owner zacksoffer@yahoo.com — **no parentId** in Drive metadata
- **Created:** 2025-12-15T16:33:42Z — **Modified:** 2025-12-15T19:29:45Z
- **How obtained:** read-only export via `download_file_content` (exportMimeType `application/vnd.google-apps.script+json`); `read_file_content` refuses this MIME type. Nothing was modified. Base64 export decoded to JSON with 2 files: `appsscript` (manifest) and `Code` (server_js, 18,252 chars, 495 lines). The decoded JSON parsed without errors.
- **Which spreadsheet is it attached to? (inference):** it was created 37 seconds after the Google Sheet `Pokemon_Roster_Template_BuildStep2_GSheetsVisible` (1y6QZcM5..., created 16:33:05Z). That sheet's README says "If dropdowns do not appear after import, run the provided Apps Script to apply them". The code calls `SpreadsheetApp.getActiveSpreadsheet()`, which only works in a script attached to (bound to) a spreadsheet. So it is very probably the script bound to BuildStep2, frozen at its Dec 15 19:29Z state. Every later copy of that sheet (the LOCKED ENGINE backups, v1, v2, v3 ...) would carry its **own copy** of the bound script with a different project ID. Drive search lists **no other** Pokémon script projects (the only other script is "Ballpark Passport", 2026-09, unrelated). So any later script edits (for example in "Pokemon Master - Script Working Properly") are **not visible** to this audit.

## Manifest (verbatim)
```json
{
  "timeZone": "America/New_York",
  "dependencies": {
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
```

## What the script does (summary, from reading the code)
It is a **"formula installer"**. Every function is run **by hand from the script editor**. There is **no `onEdit`/`onOpen` trigger, no custom menu and no custom function**. Each function writes **data-validation dropdowns** and **FILTER/SORT/UNIQUE formulas** into the sheet. From then on the sheet's own formulas do the live work.

| Function | What it writes |
|---|---|
| `applyRosterDropdowns()` | Game dropdown on `ROSTER - Template!B2` from `Game_Map!A2:A`; Pokémon dropdowns on B11:B16 and B21:B26 from `Pokemon_Master!E2:E`; move dropdowns on G–J for rows 11–16 and 21–26, each row pointing at its own column of `MoveLists` (A..L). |
| `fixMovesAndAddAbilities()` | B3 = `=IFERROR(VALUE(VLOOKUP($B$2,Game_Map!$A$2:$C$20,2,FALSE)),"")` (version group id). MoveLists A2:L2 = SORT(UNIQUE(FILTER(Pokemon_Moves_Display!F, A=pokemon_id in C{r}, C=B3))). Creates or clears **AbilityLists** with headers "Abilities for row {r}" and FILTER formulas over `Pokemon_Abilities_Display!D`. Ability dropdowns on column F. Re-applies the move dropdowns. |
| `getSheetAny(ss,names)` | Helper that finds a sheet by name while ignoring hyphen/en-dash/em-dash and spacing differences ("ROSTER – Template" vs "ROSTER - Template"; see the 1zmX6 Untitled sheet, which used an en dash). |
| `addEggMovesFromPreEvoLine()` | Needs a sheet **`Evolution_Master`, which does not exist in any audited file**, so it would throw "Missing required sheets". It would build `Prevo_Map` (pokemon_id → ancestor ids; no file has this tab either) and MoveLists formulas using array braces `{...;...}`. **Dead or abandoned path.** |
| `addEggMovesViaSpeciesBase()` | Rebuilds **`Species_Base_Pokemon`** as species_id → *minimum pokemon_id of the same species*. That is effectively an identity map (1→1, 2→2 ...), which matches the identity data seen in every file. MoveLists gets brace formulas: own moves plus "Egg" moves of the *same species* (so pre-evolution egg moves are still missed). |
| `rebuildMoveListsNoBraces()` | MoveLists = moves where (pokemon_id = C{r}) OR (pokemon_id = M{r} AND method = "Egg"), filtered to version group B3. Has no braces, to avoid the array-literal errors. |
| `rebuildBasePokemonIdColumn()` | Rebuilds Species_Base_Pokemon; writes `ROSTER!M10` header "base_pokemon_id" and M{r} formulas = VLOOKUP(species of C{r}, Species_Base_Pokemon). |
| `rebuildEggMovesUsingPokemonSpecies()` | **The final egg-move engine.** It builds **`Base_Species_Map`** by walking `Pokemon_Species.evolves_from_species_id` down to the root of the evolution chain. For example, 157 Typhlosion → 155 Cyndaquil, and 25 Pikachu → **172 Pichu**, the baby form. That matches the `base_pokemon_id` values 155/172/4/238/158 seen in the rosters. M{r} = pokemon_id of the root species. MoveLists = own moves in the version group, plus Egg moves of the root form in the version group. |

**What the script does NOT do:** it does not compute `pokemon_id` (col C), types (D/E), `Illegal?` (K, ✅/⚠️), `Reason` (L), `prep_special_move` / `prep_non_default_ability` (N/O), `Nature` (P), `Preparation Summary` (Q), or anything in the Breeding Lab. Those must come from in-sheet formulas, or from later versions of the bound script in the copies. Neither is visible: Drive reads return cell **values**, not formulas.

**Design limits visible in the code (fact from code):**
- Everything is hard-coded to one tab, **"ROSTER - Template"** (or a dash variant), and to rows **11–16 and 21–26**. MoveLists and AbilityLists hold **one column per roster row, shared by the whole workbook**. Extra roster tabs (e.g. "ROSTER - HeartGold" / "ROSTER - Crystal" / "ROSTER - FireRed" in "PKMN: Working Additional Roster Sheets") cannot each get their own move lists.
- Because the root form is the *baby* (Pichu 172, Riolu 447, Smoochum 238 ...), the move lists are right for egg moves (Veekun stores egg moves on the baby). But any **egg-group** logic keyed on `base_pokemon_id` (the Breeding Lab) would see the baby's "No Eggs" group. See the Breeding Lab findings in LINEAGE_INVENTORY.md.
- Timezone in the manifest: America/New_York (Zack's local time = UTC−5 in December).

## Full source — `Code.gs` (verbatim, decoded)
```javascript

function applyRosterDropdowns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const roster = ss.getSheetByName("ROSTER - Template");
  const gameMap = ss.getSheetByName("Game_Map");
  const pokemonMaster = ss.getSheetByName("Pokemon_Master");
  const moveLists = ss.getSheetByName("MoveLists");

  if (!roster || !gameMap || !pokemonMaster || !moveLists) {
    throw new Error("Missing required sheets. Expected: ROSTER - Template, Game_Map, Pokemon_Master, MoveLists");
  }

  // --- Game dropdown (B2) ---
  const gameRange = gameMap.getRange("A2:A");
  roster.getRange("B2").setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInRange(gameRange, true)
      .setAllowInvalid(false)
      .build()
  );

  // --- Pokémon dropdowns (B11:B16, B21:B26) ---
  const pokemonRange = pokemonMaster.getRange("E2:E"); // pokemon_name column
  const pokemonRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(pokemonRange, true)
    .setAllowInvalid(false)
    .build();

  roster.getRange("B11:B16").setDataValidation(pokemonRule);
  roster.getRange("B21:B26").setDataValidation(pokemonRule);

  // --- Move dropdowns per roster row (G-J) using MoveLists columns A-L ---
  const rosterRows = [11,12,13,14,15,16,21,22,23,24,25,26];
  const moveCols = ["G","H","I","J"];

  rosterRows.forEach((row, i) => {
    const listCol = i + 1; // MoveLists A=1 ... L=12
    const listRange = moveLists.getRange(2, listCol, moveLists.getMaxRows() - 1, 1);

    const moveRule = SpreadsheetApp.newDataValidation()
      .requireValueInRange(listRange, true)
      .setAllowInvalid(false)
      .build();

    moveCols.forEach(col => roster.getRange(`${col}${row}`).setDataValidation(moveRule));
  });
}
function fixMovesAndAddAbilities() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const roster = ss.getSheetByName("ROSTER - Template");
  const moveLists = ss.getSheetByName("MoveLists");
  const pmDisplay = ss.getSheetByName("Pokemon_Moves_Display");
  const paDisplay = ss.getSheetByName("Pokemon_Abilities_Display");
  if (!roster || !moveLists || !pmDisplay || !paDisplay) {
    throw new Error("Missing required sheets.");
  }

  // Force Version Group ID numeric in B3
  roster.getRange("B3").setFormula('=IFERROR(VALUE(VLOOKUP($B$2,Game_Map!$A$2:$C$20,2,FALSE)),"")');

  // Roster rows in order
  const rows = [11,12,13,14,15,16,21,22,23,24,25,26];

  // Rewrite MoveLists A2:L2 with IFERROR-wrapped formulas
  rows.forEach((r, i) => {
    const col = i + 1; // A=1 ... L=12
    const formula =
      `=IF('ROSTER - Template'!$C${r}="","",` +
      `IFERROR(SORT(UNIQUE(FILTER(Pokemon_Moves_Display!$F$2:$F,` +
      `Pokemon_Moves_Display!$A$2:$A='ROSTER - Template'!$C${r},` +
      `Pokemon_Moves_Display!$C$2:$C='ROSTER - Template'!$B$3` +
      `))),""))`;
    moveLists.getRange(2, col).setFormula(formula);
  });

  // Create AbilityLists if missing
  let abilityLists = ss.getSheetByName("AbilityLists");
  if (!abilityLists) {
    abilityLists = ss.insertSheet("AbilityLists");
  } else {
    abilityLists.clear();
  }

  // Headers
  rows.forEach((r, i) => abilityLists.getRange(1, i+1).setValue(`Abilities for row ${r}`));

  // Formulas for AbilityLists A2:L2 (ability_name is column D in Pokemon_Abilities_Display)
  rows.forEach((r, i) => {
    const col = i + 1;
    const formula =
      `=IF('ROSTER - Template'!$C${r}="","",` +
      `IFERROR(SORT(UNIQUE(FILTER(Pokemon_Abilities_Display!$D$2:$D,` +
      `Pokemon_Abilities_Display!$A$2:$A='ROSTER - Template'!$C${r}` +
      `))),""))`;
    abilityLists.getRange(2, col).setFormula(formula);
  });

  // Apply ability dropdowns (column F) per row, using AbilityLists columns A-L
  rows.forEach((r, i) => {
    const listCol = i + 1;
    const range = abilityLists.getRange(2, listCol, abilityLists.getMaxRows() - 1, 1);
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInRange(range, true)
      .setAllowInvalid(false)
      .build();
    roster.getRange(`F${r}`).setDataValidation(rule);
  });

  // Re-apply move dropdowns too (G-J), now that MoveLists formulas are safe
  const moveCols = ["G","H","I","J"];
  rows.forEach((r, i) => {
    const listCol = i + 1;
    const range = moveLists.getRange(2, listCol, moveLists.getMaxRows() - 1, 1);
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInRange(range, true)
      .setAllowInvalid(false)
      .build();
    moveCols.forEach(col => roster.getRange(`${col}${r}`).setDataValidation(rule));
  });
}
function getSheetAny(ss, names) {
  for (const n of names) {
    const sh = ss.getSheetByName(n);
    if (sh) return sh;
  }
  // fallback: try loose match (ignores hyphen/en-dash differences and extra spaces)
  const normalize = (s) => s.toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  const want = new Set(names.map(normalize));
  for (const sh of ss.getSheets()) {
    if (want.has(normalize(sh.getName()))) return sh;
  }
  return null;
}
function addEggMovesFromPreEvoLine() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const roster = getSheetAny(ss, ["ROSTER - Template", "ROSTER – Template", "ROSTER — Template"]);
  const moveLists = getSheetAny(ss, ["MoveLists", "Move Lists"]);
  const pokemonMaster = getSheetAny(ss, ["Pokemon_Master", "Pokémon_Master", "Pokemon Master"]);
  const evolutionMaster = getSheetAny(ss, ["Evolution_Master", "Evolution Master"]);
  const pmd = getSheetAny(ss, ["Pokemon_Moves_Display", "Pokémon_Moves_Display", "Pokemon Moves Display"]);

  const missing = [];
  if (!roster) missing.push("ROSTER - Template");
  if (!moveLists) missing.push("MoveLists");
  if (!pokemonMaster) missing.push("Pokemon_Master");
  if (!evolutionMaster) missing.push("Evolution_Master");
  if (!pmd) missing.push("Pokemon_Moves_Display");

  if (missing.length) {
    throw new Error("Missing required sheets (by name). Missing: " + missing.join(", ") +
      ". Check tab names at bottom of the file.");
  }

  // --- Build species -> prevo species map from Evolution_Master ---
  const evoVals = evolutionMaster.getDataRange().getValues();
  const evoH = evoVals.shift();
  const idxSpecies = evoH.indexOf("species_id");
  const idxFrom = evoH.indexOf("evolves_from_species_id");

  if (idxSpecies === -1 || idxFrom === -1) {
    throw new Error("Evolution_Master is missing required columns: species_id, evolves_from_species_id");
  }

  const prevoOf = new Map(); // species_id -> evolves_from_species_id
  evoVals.forEach(r => {
    const s = r[idxSpecies];
    const f = r[idxFrom];
    if (s && f) prevoOf.set(String(s), String(f));
  });

  // --- pokemon_id -> species_id map from Pokemon_Master ---
  const pmVals = pokemonMaster.getDataRange().getValues();
  const pmH = pmVals.shift();
  const idxPid = pmH.indexOf("pokemon_id");
  const idxSid = pmH.indexOf("species_id");

  if (idxPid === -1 || idxSid === -1) {
    throw new Error("Pokemon_Master is missing required columns: pokemon_id, species_id");
  }

  const pidToSid = new Map();
  const sidToAnyPid = new Map();
  pmVals.forEach(r => {
    const pid = r[idxPid];
    const sid = r[idxSid];
    if (pid && sid) {
      pidToSid.set(String(pid), String(sid));
      if (!sidToAnyPid.has(String(sid))) sidToAnyPid.set(String(sid), String(pid));
    }
  });

  // --- Create / rebuild Prevo_Map sheet ---
  let prevoMap = ss.getSheetByName("Prevo_Map");
  if (!prevoMap) prevoMap = ss.insertSheet("Prevo_Map");
  prevoMap.clear();
  prevoMap.getRange(1, 1, 1, 2).setValues([["pokemon_id", "ancestor_pokemon_id"]]);

  const out = [];
  pidToSid.forEach((sid, pid) => {
    let curSid = sid;
    const seen = new Set();
    while (curSid && !seen.has(curSid)) {
      seen.add(curSid);
      const ancPid = sidToAnyPid.get(curSid);
      if (ancPid) out.push([pid, ancPid]);
      curSid = prevoOf.get(curSid);
    }
  });

  if (out.length) prevoMap.getRange(2, 1, out.length, 2).setValues(out);

  // --- Update MoveLists formulas to include egg moves from ancestors ---
  const rows = [11,12,13,14,15,16,21,22,23,24,25,26];

  rows.forEach((r, i) => {
    const col = i + 1; // A-L
    const formula =
      `=IF('${roster.getName()}'!$C${r}="","",` +
      `IFERROR(SORT(UNIQUE({` +
        `FILTER(Pokemon_Moves_Display!$F$2:$F,` +
          `Pokemon_Moves_Display!$A$2:$A='${roster.getName()}'!$C${r},` +
          `VALUE(Pokemon_Moves_Display!$C$2:$C)=VALUE('${roster.getName()}'!$B$3)` +
        `);` +
        `FILTER(Pokemon_Moves_Display!$F$2:$F,` +
          `ISNUMBER(MATCH(Pokemon_Moves_Display!$A$2:$A,` +
            `FILTER(Prevo_Map!$B$2:$B, Prevo_Map!$A$2:$A='${roster.getName()}'!$C${r}),0)),` +
          `VALUE(Pokemon_Moves_Display!$C$2:$C)=VALUE('${roster.getName()}'!$B$3),` +
          `Pokemon_Moves_Display!$G$2:$G="Egg"` +
        `)` +
      `}))),""))`;

    moveLists.getRange(2, col).setFormula(formula);
  });
}
function addEggMovesViaSpeciesBase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const roster = ss.getSheetByName("ROSTER - Template") || ss.getSheetByName("ROSTER – Template");
  const moveLists = ss.getSheetByName("MoveLists");
  const pokemonMaster = ss.getSheetByName("Pokemon_Master");

  if (!roster || !moveLists || !pokemonMaster) {
    throw new Error("Missing required sheets: ROSTER - Template, MoveLists, Pokemon_Master");
  }

  // Build Species_Base_Pokemon: species_id -> min pokemon_id
  let sb = ss.getSheetByName("Species_Base_Pokemon");
  if (!sb) sb = ss.insertSheet("Species_Base_Pokemon");
  sb.clear();
  sb.getRange(1,1,1,2).setValues([["species_id","base_pokemon_id"]]);

  const pmVals = pokemonMaster.getDataRange().getValues();
  const h = pmVals.shift();
  const idxPid = h.indexOf("pokemon_id");
  const idxSid = h.indexOf("species_id");

  if (idxPid === -1 || idxSid === -1) {
    throw new Error("Pokemon_Master must include columns: pokemon_id, species_id");
  }

  const minBySpecies = new Map();
  pmVals.forEach(r => {
    const pid = r[idxPid];
    const sid = r[idxSid];
    if (!pid || !sid) return;
    const key = String(sid);
    const cur = minBySpecies.get(key);
    if (cur === undefined || Number(pid) < cur) minBySpecies.set(key, Number(pid));
  });

  const out = Array.from(minBySpecies.entries()).map(([sid, pid]) => [sid, pid]);
  out.sort((a,b) => a[0]-b[0]);
  if (out.length) sb.getRange(2,1,out.length,2).setValues(out);

  // Update MoveLists formulas: include egg moves from base_pokemon_id (same species)
  const rows = [11,12,13,14,15,16,21,22,23,24,25,26];

  rows.forEach((r, i) => {
    const col = i + 1; // A-L
    const formula =
      `=IF('${roster.getName()}'!$C${r}="","",` +
      `IFERROR(SORT(UNIQUE({` +
        // 1) moves for exact pokemon_id + game
        `FILTER(Pokemon_Moves_Display!$F$2:$F,` +
          `Pokemon_Moves_Display!$A$2:$A='${roster.getName()}'!$C${r},` +
          `VALUE(Pokemon_Moves_Display!$C$2:$C)=VALUE('${roster.getName()}'!$B$3)` +
        `);` +
        // 2) egg moves for base_pokemon_id of this species + game
        `FILTER(Pokemon_Moves_Display!$F$2:$F,` +
          `Pokemon_Moves_Display!$A$2:$A=INDEX(Species_Base_Pokemon!$B$2:$B,` +
            `MATCH(INDEX(Pokemon_Master!$C$2:$C, MATCH('${roster.getName()}'!$C${r}, Pokemon_Master!$A$2:$A, 0)),` +
                 `Species_Base_Pokemon!$A$2:$A, 0)` +
          `),` +
          `VALUE(Pokemon_Moves_Display!$C$2:$C)=VALUE('${roster.getName()}'!$B$3),` +
          `Pokemon_Moves_Display!$G$2:$G="Egg"` +
        `)` +
      `}))),""))`;

    moveLists.getRange(2, col).setFormula(formula);
  });
}
function rebuildMoveListsNoBraces() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const roster =
    ss.getSheetByName("ROSTER - Template") ||
    ss.getSheetByName("ROSTER – Template") ||
    ss.getSheetByName("ROSTER — Template");

  const moveLists = ss.getSheetByName("MoveLists");
  if (!roster || !moveLists) throw new Error("Missing roster or MoveLists tab.");

  const rows = [11,12,13,14,15,16,21,22,23,24,25,26];

  // This formula includes:
  // - all moves for selected pokemon_id
  // - OR egg moves for base_pokemon_id (column M)
  // and always matches the team version_group_id (B3)
  rows.forEach((r, i) => {
    const col = i + 1; // A-L
    const f =
      `=IF('${roster.getName()}'!$C${r}="","",` +
      `IFERROR(` +
        `SORT(UNIQUE(` +
          `FILTER(Pokemon_Moves_Display!$F$2:$F,` +
            `(` +
              `(Pokemon_Moves_Display!$A$2:$A='${roster.getName()}'!$C${r})` +
              `+` +
              `((Pokemon_Moves_Display!$A$2:$A='${roster.getName()}'!$M${r})*(Pokemon_Moves_Display!$G$2:$G="Egg"))` +
            `)>0,` +
            `VALUE(Pokemon_Moves_Display!$C$2:$C)=VALUE('${roster.getName()}'!$B$3)` +
          `)` +
        `))` +
      `,""))`;

    moveLists.getRange(2, col).setFormula(f);
  });
}
function rebuildBasePokemonIdColumn() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const roster =
    ss.getSheetByName("ROSTER - Template") ||
    ss.getSheetByName("ROSTER – Template") ||
    ss.getSheetByName("ROSTER — Template");
  const pokemonMaster = ss.getSheetByName("Pokemon_Master");
  if (!roster || !pokemonMaster) throw new Error("Missing roster or Pokemon_Master");

  // Build Species_Base_Pokemon
  let sb = ss.getSheetByName("Species_Base_Pokemon");
  if (!sb) sb = ss.insertSheet("Species_Base_Pokemon");
  sb.clear();
  sb.getRange(1,1,1,2).setValues([["species_id","base_pokemon_id"]]);

  const pm = pokemonMaster.getDataRange().getValues();
  const h = pm.shift();
  const pidIdx = h.indexOf("pokemon_id");
  const sidIdx = h.indexOf("species_id");
  const minBySpecies = new Map();
  pm.forEach(r => {
    const pid = r[pidIdx], sid = r[sidIdx];
    if (!pid || !sid) return;
    const key = String(sid);
    const cur = minBySpecies.get(key);
    const n = Number(pid);
    if (cur === undefined || n < cur) minBySpecies.set(key, n);
  });
  const out = Array.from(minBySpecies.entries()).map(([sid, pid]) => [sid, pid]);
  if (out.length) sb.getRange(2,1,out.length,2).setValues(out);

  // Put base_pokemon_id formulas into column M
  roster.getRange("M10").setValue("base_pokemon_id");
  const rows = [11,12,13,14,15,16,21,22,23,24,25,26];
  rows.forEach(r => {
    roster.getRange(`M${r}`).setFormula(
      `=IF($C${r}="","",IFERROR(VLOOKUP(` +
      `INDEX(Pokemon_Master!$C$2:$C, MATCH($C${r}, Pokemon_Master!$A$2:$A, 0)),` +
      `Species_Base_Pokemon!$A$2:$B, 2, FALSE` +
      `),""))`
    );
  });
}
function rebuildEggMovesUsingPokemonSpecies() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const roster =
    ss.getSheetByName("ROSTER - Template") ||
    ss.getSheetByName("ROSTER – Template") ||
    ss.getSheetByName("ROSTER — Template");

  const moveLists = ss.getSheetByName("MoveLists");
  const pokemonMaster = ss.getSheetByName("Pokemon_Master");
  const pokemonSpecies = ss.getSheetByName("Pokemon_Species");

  if (!roster || !moveLists || !pokemonMaster || !pokemonSpecies) {
    throw new Error("Missing required sheets: ROSTER template, MoveLists, Pokemon_Master, Pokemon_Species");
  }

  // --- Build species_id -> evolves_from_species_id map ---
  const ps = pokemonSpecies.getDataRange().getValues();
  const psh = ps.shift();
  const sidIdx = psh.indexOf("species_id");
  const fromIdx = psh.indexOf("evolves_from_species_id");

  if (sidIdx === -1 || fromIdx === -1) {
    throw new Error("Pokemon_Species must have columns: species_id, evolves_from_species_id");
  }

  const evolvesFrom = new Map();
  ps.forEach(r => {
    const sid = r[sidIdx];
    const from = r[fromIdx];
    if (sid) evolvesFrom.set(String(sid), from ? String(from) : "");
  });

  // --- Build pokemon_id -> species_id map (from Pokemon_Master) ---
  const pm = pokemonMaster.getDataRange().getValues();
  const pmh = pm.shift();
  const pidIdx = pmh.indexOf("pokemon_id");
  const spIdx = pmh.indexOf("species_id");

  const pidToSid = new Map();
  const sidToPid = new Map();
  pm.forEach(r => {
    const pid = r[pidIdx];
    const sid = r[spIdx];
    if (pid && sid) {
      pidToSid.set(String(pid), String(sid));
      sidToPid.set(String(sid), String(pid));
    }
  });

  // --- Compute base_species_id for each species_id by walking evolves_from_species_id ---
  let baseMap = ss.getSheetByName("Base_Species_Map");
  if (!baseMap) baseMap = ss.insertSheet("Base_Species_Map");
  baseMap.clear();
  baseMap.getRange(1,1,1,2).setValues([["species_id","base_species_id"]]);

  const allSpecies = Array.from(evolvesFrom.keys());
  const out = [];
  allSpecies.forEach(sid => {
    let cur = sid;
    const seen = new Set();
    while (cur && evolvesFrom.get(cur) && !seen.has(cur)) {
      seen.add(cur);
      cur = evolvesFrom.get(cur);
    }
    const baseSid = cur || sid;
    out.push([Number(sid), Number(baseSid)]);
  });
  out.sort((a,b)=>a[0]-b[0]);
  baseMap.getRange(2,1,out.length,2).setValues(out);

  // --- Add base_pokemon_id helper column M on roster ---
  roster.getRange("M10").setValue("base_pokemon_id");
  const rows = [11,12,13,14,15,16,21,22,23,24,25,26];

  rows.forEach(r => {
    // base species = lookup species_id of selected pokemon, then lookup base_species_id, then map to pokemon_id
    roster.getRange(`M${r}`).setFormula(
      `=IF($C${r}="","",IFERROR(` +
        `VLOOKUP(` +
          `VLOOKUP(` +
            `INDEX(Pokemon_Master!$C$2:$C, MATCH($C${r}, Pokemon_Master!$A$2:$A, 0)),` +
            `Base_Species_Map!$A$2:$B,2,FALSE` +
          `),` +
          `{Pokemon_Master!$C$2:$C, Pokemon_Master!$A$2:$A},2,FALSE` +
        `)` +
      `,""))`
    );
  });

  // --- Rebuild MoveLists with OR logic (no braces) ---
  rows.forEach((r, i) => {
    const col = i + 1;
    const f =
      `=IF('${roster.getName()}'!$C${r}="","",` +
      `IFERROR(SORT(UNIQUE(FILTER(Pokemon_Moves_Display!$F$2:$F,` +
        `(` +
          `(Pokemon_Moves_Display!$A$2:$A='${roster.getName()}'!$C${r})` +
          `+` +
          `((Pokemon_Moves_Display!$A$2:$A='${roster.getName()}'!$M${r})*(Pokemon_Moves_Display!$G$2:$G="Egg"))` +
        `)>0,` +
        `VALUE(Pokemon_Moves_Display!$C$2:$C)=VALUE('${roster.getName()}'!$B$3)` +
      `))),""))`;

    moveLists.getRange(2, col).setFormula(f);
  });
}



```
