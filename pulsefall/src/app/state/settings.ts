import { audio } from '../../core/audio/audioEngine';
import { DEFAULT_SETTINGS, type Settings } from '../../core/types';
import { Store, useStore } from './store';

const KEY = 'pulsefall.settings.v1';

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitize({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
  } catch {
    /* storage blocked or corrupt: use defaults */
  }
  return { ...DEFAULT_SETTINGS };
}

/** Keep every value in range, whatever was stored (or restored from a backup). */
export function sanitize(s: Settings): Settings {
  const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  const D = DEFAULT_SETTINGS;
  return {
    ...s,
    noteSpeed: num(s.noteSpeed, 1, 10, D.noteSpeed),
    musicVolume: num(s.musicVolume, 0, 1, D.musicVolume),
    sfxVolume: num(s.sfxVolume, 0, 1, D.sfxVolume),
    uiVolume: num(s.uiVolume, 0, 1, D.uiVolume),
    audioOffsetMs: Math.round(num(s.audioOffsetMs, -300, 500, 0)),
    inputOffsetMs: Math.round(num(s.inputOffsetMs, -300, 500, 0)),
    visualOffsetMs: Math.round(num(s.visualOffsetMs, -300, 300, 0)),
    highwayWidth: num(s.highwayWidth, 0.7, 1, D.highwayWidth),
    advancedLanes: s.advancedLanes === 4 ? 4 : 3,
    timingProfile: ['comfortable', 'standard', 'strict'].includes(s.timingProfile) ? s.timingProfile : D.timingProfile,
    theme: ['neon', 'sunset', 'aurora', 'contrast'].includes(s.theme) ? s.theme : D.theme,
    noteStyle: s.noteStyle === 'shapes' ? 'shapes' : 'orbs',
    hitSound: ['tick', 'snap', 'off'].includes(s.hitSound) ? s.hitSound : D.hitSound,
    lastStyle: ['relaxed', 'classic', 'full', 'advanced'].includes(s.lastStyle) ? s.lastStyle : D.lastStyle,
  };
}

export const settingsStore = new Store<Settings>(load());

settingsStore.subscribe((s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
  audio.setVolumes({ music: s.musicVolume, sfx: s.sfxVolume, ui: s.uiVolume });
});
audio.setVolumes({ music: settingsStore.get().musicVolume, sfx: settingsStore.get().sfxVolume, ui: settingsStore.get().uiVolume });

export function updateSettings(patch: Partial<Settings>): void {
  settingsStore.set(sanitize({ ...settingsStore.get(), ...patch }));
}

export function useSettings(): Settings {
  return useStore(settingsStore);
}

/** UI click sound, respecting the UI volume. */
export function uiSound(name: 'ui' | 'back' = 'ui'): void {
  if (settingsStore.get().uiVolume > 0) audio.play(name, { bus: 'ui' });
}
