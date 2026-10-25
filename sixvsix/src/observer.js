// What one side can know: its own player channel of the battle log (Showdown's split messages already hide the
// opponent's exact HP and private details), read into a small public state. Agents decide from this plus their own
// request, never from the battle object, so a trainer only learns an opponent's move, item or ability once it has
// been revealed, and only sees the opponent's bench as it comes in (Gen 4 has no team preview).

const parseCondition = (cond) => {
  // "245/341 par", "64/100", "0 fnt"
  const [hpPart, status] = String(cond).split(' ');
  if (hpPart === '0' || status === 'fnt') return { hp: 0, max: 100, pct: 0, status: 'fnt', fainted: true };
  const [hp, max] = hpPart.split('/').map(Number);
  return { hp, max, pct: max ? Math.round((1000 * hp) / max) / 10 : 0, status: status || '', fainted: false };
};

const sideOf = (ident) => ident.slice(0, 2);                       // "p2a: Garchomp" -> "p2"
const nameOf = (ident) => ident.slice(ident.indexOf(':') + 1).trim(); // -> "Garchomp"

export class SideView {
  constructor(side) {
    this.side = side;                     // 'p1' | 'p2'
    this.foe = side === 'p1' ? 'p2' : 'p1';
    this.turn = 0;
    this.weather = '';
    this.conditions = { p1: {}, p2: {} };   // side conditions: stealthrock, spikes (layers), toxicspikes, reflect...
    this.active = { p1: null, p2: null };  // name of the active Pokémon
    this.mons = { p1: new Map(), p2: new Map() };
    this.teamSize = { p1: 0, p2: 0 };
    this.ended = false;
  }

  mon(side, name) {
    let m = this.mons[side].get(name);
    if (!m) {
      m = { name, species: name, pct: 100, status: '', fainted: false, boosts: {}, moves: new Set(), item: undefined,
            ability: undefined, seen: false };
      this.mons[side].set(name, m);
    }
    return m;
  }

  /** Feed lines from this side's own channel. */
  update(lines) {
    for (const line of lines) {
      if (!line.startsWith('|')) continue;
      const parts = line.slice(1).split('|');
      const cmd = parts[0];
      const tags = parts.filter((p) => p.startsWith('['));
      switch (cmd) {
        case 'turn': this.turn = Number(parts[1]); break;
        case 'teamsize': this.teamSize[parts[1]] = Number(parts[2]); break;
        case 'switch': case 'drag': case 'replace': {
          const side = sideOf(parts[1]);
          const m = this.mon(side, nameOf(parts[1]));
          m.species = parts[2].split(',')[0];
          Object.assign(m, parseCondition(parts[3]), { boosts: {}, seen: true });
          this.active[side] = m.name;
          break;
        }
        case 'detailschange': case '-formechange': {
          const m = this.mon(sideOf(parts[1]), nameOf(parts[1]));
          m.species = parts[2].split(',')[0];
          break;
        }
        case '-damage': case '-heal': case '-sethp': {
          const m = this.mon(sideOf(parts[1]), nameOf(parts[1]));
          const c = parseCondition(parts[2]);
          m.pct = c.pct; m.status = c.status; m.fainted = c.fainted;
          const from = tags.find((t) => t.startsWith('[from] item: '));
          if (from) m.item = from.slice('[from] item: '.length);
          const ab = tags.find((t) => t.startsWith('[from] ability: '));
          if (ab) m.ability = ab.slice('[from] ability: '.length);
          break;
        }
        case 'faint': { const m = this.mon(sideOf(parts[1]), nameOf(parts[1])); m.fainted = true; m.pct = 0; break; }
        case '-status': this.mon(sideOf(parts[1]), nameOf(parts[1])).status = parts[2]; break;
        case '-curestatus': this.mon(sideOf(parts[1]), nameOf(parts[1])).status = ''; break;
        case '-boost': case '-unboost': {
          const m = this.mon(sideOf(parts[1]), nameOf(parts[1]));
          const d = Number(parts[3]) * (cmd === '-boost' ? 1 : -1);
          m.boosts[parts[2]] = Math.max(-6, Math.min(6, (m.boosts[parts[2]] || 0) + d));
          break;
        }
        case '-clearallboost': for (const s of ['p1', 'p2']) for (const m of this.mons[s].values()) m.boosts = {}; break;
        case 'move': {
          const m = this.mon(sideOf(parts[1]), nameOf(parts[1]));
          if (!tags.some((t) => t.startsWith('[from]'))) m.moves.add(parts[2]);
          break;
        }
        case '-item': this.mon(sideOf(parts[1]), nameOf(parts[1])).item = parts[2]; break;
        case '-enditem': this.mon(sideOf(parts[1]), nameOf(parts[1])).item = null; break;
        case '-ability': this.mon(sideOf(parts[1]), nameOf(parts[1])).ability = parts[2]; break;
        case '-weather': this.weather = parts[1] === 'none' ? '' : parts[1]; break;
        case '-sidestart': case '-sideend': {
          const side = parts[1].slice(0, 2);
          const id = parts[2].replace(/^move: /, '').toLowerCase().replace(/[^a-z]/g, '');
          if (cmd === '-sidestart') this.conditions[side][id] = (this.conditions[side][id] || 0) + 1;
          else delete this.conditions[side][id];
          break;
        }
        case 'win': case 'tie': this.ended = true; break;
        default: break;
      }
    }
  }

  /** The opponent's active Pokémon as this side knows it. */
  foeActive() {
    const name = this.active[this.foe];
    return name ? this.mons[this.foe].get(name) : null;
  }

  /** A compact, serialisable snapshot of what this side knew when it decided (stored with each decision). */
  snapshot() {
    const f = this.foeActive();
    return {
      turn: this.turn,
      foe: f ? { species: f.species, pct: f.pct, status: f.status || undefined, boosts: Object.keys(f.boosts).length ? f.boosts : undefined,
                 known_moves: f.moves.size ? [...f.moves] : undefined } : null,
      foe_seen: this.mons[this.foe].size,
      foe_left: this.teamSize[this.foe] - [...this.mons[this.foe].values()].filter((m) => m.fainted).length,
      weather: this.weather || undefined,
    };
  }
}
