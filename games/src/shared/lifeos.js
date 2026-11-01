// LIFE OS bridge: lets a game run inside the LIFE OS phone app and hand its score back to the story.
// Opened on its own (a file, an artifact, Google Drive), the game behaves exactly as before: LifeOS.embedded is false.
//
//   LifeOS.embedded                 true when running inside LIFE OS (in an iframe, with ?embed=1)
//   LifeOS.onStart(cfg => ...)      called once with the round's config (see below)
//   LifeOS.finish({score, max, summary, stats})   the round is over: score out of max (any units), a short summary
//   LifeOS.quit()                   the player backed out
//
// config: { play: what to launch ("menu" = let the player pick a mode, "clutch" = a short pressure round, or a game-specific
//           mode name), skill 0-100 (the character's skill), difficulty 0-100, mode ("free" | "clutch"), seed, me, them,
//           college (true in college), opponent, label }
const LifeOS = (() => {
  const qs = new URLSearchParams(location.search);
  const embedded = window.parent !== window && qs.get('embed') === '1';
  const config = { play: qs.get('play') || 'menu', skill: +(qs.get('skill') || 55), difficulty: +(qs.get('difficulty') || 50),
                   mode: qs.get('mode') || 'free', me: qs.get('me') || 'You', seed: +(qs.get('seed') || 0), college: qs.get('college') === '1' };
  let started = false, cb = null, done = false;
  const fire = () => { if (!started && cb) { started = true; cb(config); } };
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'lifeos:init') { Object.assign(config, e.data.config || {}); fire(); }
  });
  const post = (event, data) => { if (embedded) parent.postMessage(Object.assign({ type: 'lifeos:minigame', event }, data || {}), '*'); };
  return {
    embedded, config,
    onStart(f) { cb = f; if (!embedded) return; post('ready'); setTimeout(fire, 2500); },
    finish(result) { if (done) return; done = true; post('finish', { result }); },
    quit() { post('quit'); },
  };
})();
