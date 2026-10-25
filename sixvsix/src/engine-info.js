// What this simulator is, as every job and result records it. test/contract.test.mjs fails if ENGINE.version stops
// matching the installed @pkmn/sim, so a result can never claim an engine it didn't run on.

export const CONTRACT_VERSION = '0.1.0';

export const ENGINE = {
  name: '@pkmn/sim',
  version: '0.10.11',
  upstream: 'Pokémon Showdown simulator, packaged by pkmn (github.com/pkmn/ps)',
};

/** The simulator id the 6v6 seam's result shape asks for: "showdown-sim@<version>". */
export const ENGINE_ID = `showdown-sim@${ENGINE.version}`;

export const SIMULATOR = { name: 'blackthorn-sixvsix', version: '0.1.0' };
