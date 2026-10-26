/* Save: progress lives in this browser right away, and also in the artifact's
   private per-player store when the page runs on claude.ai, so a save made on
   the phone shows up on the laptop. Either half can be missing; the game never waits on it. */
const SaveStore = (() => {
  function create(key, defaults) {
    let state = null, remote = null, pending = false, writing = false, timer = null;
    const listeners = [];

    function readLocal() {
      try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
    }
    function writeLocal() {
      try { localStorage.setItem(key, JSON.stringify(state)); } catch (_) {}
    }
    function merge(base, saved) {
      if (!saved || typeof saved !== 'object') return base;
      const out = Array.isArray(base) ? saved : Object.assign({}, base);
      if (Array.isArray(base)) return out;
      for (const k of Object.keys(saved)) {
        const b = base[k], s = saved[k];
        out[k] = (b && s && typeof b === 'object' && typeof s === 'object' && !Array.isArray(b)) ? merge(b, s) : s;
      }
      return out;
    }

    async function connectRemote() {
      const c = window.claude;
      if (!c || typeof c.use !== 'function') return;
      try {
        const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
        if (!db || !user) return;
        const uid = await user.id();
        if (!uid) return;
        remote = db.doc('data/users/' + uid + '/save');
        const snap = await remote.get();
        if (snap.exists) {
          const data = snap.data();
          const blob = data && typeof data.json === 'string' ? JSON.parse(data.json) : null;
          if (blob && (blob.savedAt || 0) > (state.savedAt || 0)) {
            state = merge(defaults(), blob);
            writeLocal();
            listeners.forEach(fn => fn(state, 'remote'));
          } else if ((state.savedAt || 0) > ((blob && blob.savedAt) || 0)) {
            flush();
          }
        }
      } catch (_) { remote = null; }
    }

    async function flush() {
      if (!remote) return;
      if (writing) { pending = true; return; }
      writing = true; pending = false;
      try { await remote.set({ json: JSON.stringify(state), savedAt: state.savedAt || 0 }); }
      catch (e) { if (e && (e.code === 'invalid_argument' || e.code === 'revoked' || e.code === 'not_granted')) remote = null; }
      writing = false;
      if (pending) flush();
    }

    function load() {
      state = merge(defaults(), readLocal());
      connectRemote();
      return state;
    }
    function save() {
      if (!state) return;
      state.savedAt = Date.now();
      writeLocal();
      clearTimeout(timer);
      timer = setTimeout(flush, 1200);
    }
    function reset() { state = defaults(); save(); return state; }
    function onRemote(fn) { listeners.push(fn); }
    return { load, save, reset, onRemote, get state() { return state; }, set state(s) { state = s; } };
  }
  return { create };
})();
