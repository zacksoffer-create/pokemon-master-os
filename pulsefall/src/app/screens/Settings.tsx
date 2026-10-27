import { useEffect, useState } from 'preact/hooks';
import { TIMING_PROFILES } from '../../core/engine/timing';
import { requestPersistence } from '../../core/import/importer';
import { approachForSpeed } from '../../core/render/renderer';
import { THEMES } from '../../core/render/themes';
import { BackupError, library } from '../../core/storage/library';
import { APP_VERSION, DEFAULT_SETTINGS, type NoteStyleId, type Settings as S, type ThemeId, type TimingProfileId } from '../../core/types';
import { Button, Segmented, Slider, Stepper, Toggle, TopBar, confirmDialog } from '../components/ui';
import { navigate } from '../router';
import { settingsStore, updateSettings, useSettings, sanitize } from '../state/settings';
import { toast } from '../state/toast';

function mb(bytes: number): string {
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : `${(bytes / 1e6).toFixed(1)} MB`;
}

export function downloadJson(name: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function pickJson(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    input.onchange = async () => {
      const f = input.files?.[0];
      input.remove();
      if (!f) return;
      try {
        resolve(JSON.parse(await f.text()));
      } catch {
        reject(new BackupError('That file is not valid JSON.'));
      }
    };
    input.addEventListener('cancel', () => input.remove());
    // iOS Safari only reliably fires `change` for inputs that are in the document.
    document.body.appendChild(input);
    input.click();
  });
}

export function Settings() {
  const s = useSettings();
  const set = (p: Partial<S>) => updateSettings(p);
  const [storage, setStorage] = useState<{ usage?: number; quota?: number; persisted?: boolean; songs?: number; audio?: number } | null>(null);

  async function refreshStorage() {
    const est = await navigator.storage?.estimate?.().catch(() => undefined);
    const persisted = await navigator.storage?.persisted?.().catch(() => undefined);
    const songs = await library.listSongs().catch(() => []);
    const sizes = await library.audioSizes().catch(() => new Map<string, number>());
    let audio = 0;
    for (const v of sizes.values()) audio += v;
    setStorage({ usage: est?.usage, quota: est?.quota, persisted, songs: songs.filter((x) => !x.isDemo).length, audio });
  }
  useEffect(() => {
    void refreshStorage();
  }, []);

  const approach = approachForSpeed(s.noteSpeed);

  return (
    <div class="screen settings">
      <TopBar title="Settings" backTo={{ name: 'home' }} />

      <section class="group">
        <h2>Gameplay</h2>
        <Slider
          label="Note speed"
          value={s.noteSpeed}
          min={1}
          max={10}
          onChange={(v) => set({ noteSpeed: v })}
          format={(v) => `${v}`}
          hint={`Notes are on screen for ${(approach / 1000).toFixed(2)} s before you hit them.`}
        />
        <div class="row">
          <span class="row-text">
            <span class="row-label">Timing windows</span>
            <span class="row-hint">{TIMING_PROFILES[s.timingProfile].description}</span>
          </span>
        </div>
        <Segmented<TimingProfileId>
          label="Timing windows"
          value={s.timingProfile}
          onChange={(v) => set({ timingProfile: v })}
          options={(['comfortable', 'standard', 'strict'] as const).map((id) => ({ value: id, label: TIMING_PROFILES[id].label }))}
        />
        <Toggle label="Swipe assist" hint="A plain tap also counts on swipe notes." checked={s.swipeAssist} onChange={(v) => set({ swipeAssist: v })} />
        <Toggle label="Show early / late" hint="Small hint under each judgment." checked={s.showTimingIndicator} onChange={(v) => set({ showTimingIndicator: v })} />
        <div class="row">
          <span class="row-text">
            <span class="row-label">Advanced style lanes</span>
            <span class="row-hint">Applies to newly built charts.</span>
          </span>
          <Segmented<number> value={s.advancedLanes} onChange={(v) => set({ advancedLanes: v === 4 ? 4 : 3 })} options={[{ value: 3, label: '3' }, { value: 4, label: '4' }]} />
        </div>
      </section>

      <section class="group">
        <h2>Sound</h2>
        <Slider label="Music" value={Math.round(s.musicVolume * 100)} min={0} max={100} format={(v) => `${v}%`} onChange={(v) => set({ musicVolume: v / 100 })} />
        <Slider label="Hit sounds" value={Math.round(s.sfxVolume * 100)} min={0} max={100} format={(v) => `${v}%`} onChange={(v) => set({ sfxVolume: v / 100 })} />
        <Slider label="Menu sounds" value={Math.round(s.uiVolume * 100)} min={0} max={100} format={(v) => `${v}%`} onChange={(v) => set({ uiVolume: v / 100 })} />
        <div class="row">
          <span class="row-label">Hit sound</span>
          <Segmented value={s.hitSound} onChange={(v) => set({ hitSound: v })} options={[{ value: 'tick', label: 'Tick' }, { value: 'snap', label: 'Snap' }, { value: 'off', label: 'Off' }]} />
        </div>
      </section>

      <section class="group">
        <h2>Sync</h2>
        <p class="group-hint">If notes feel consistently early or late, run the sync check. Bluetooth headphones usually need it.</p>
        <Button variant="primary" icon="sync" onClick={() => navigate({ name: 'calibrate' })}>
          Run sync check
        </Button>
        <Stepper label="Audio offset" hint="Raise if the music sounds late compared to the notes." value={s.audioOffsetMs} onChange={(v) => set({ audioOffsetMs: v })} />
        <Stepper label="Input offset" hint="Raise if your taps register late." value={s.inputOffsetMs} onChange={(v) => set({ inputOffsetMs: v })} />
        <Stepper label="Visual offset" hint="Draw notes slightly later (+) or earlier (−)." value={s.visualOffsetMs} min={-300} max={300} onChange={(v) => set({ visualOffsetMs: v })} />
      </section>

      <section class="group">
        <h2>Look</h2>
        <div class="themes">
          {(Object.keys(THEMES) as ThemeId[]).map((id) => (
            <button class={`theme-swatch ${s.theme === id ? 'on' : ''}`} onClick={() => set({ theme: id })} aria-pressed={s.theme === id}>
              <span class="swatch" style={{ background: `linear-gradient(135deg, ${THEMES[id].lanes.join(', ')})` }} />
              {THEMES[id].label}
            </button>
          ))}
        </div>
        <div class="row">
          <span class="row-text">
            <span class="row-label">Notes</span>
            <span class="row-hint">Shapes give each lane its own outline (easier to tell apart).</span>
          </span>
          <Segmented<NoteStyleId> value={s.noteStyle} onChange={(v) => set({ noteStyle: v })} options={[{ value: 'orbs', label: 'Orbs' }, { value: 'shapes', label: 'Shapes' }]} />
        </div>
        <Toggle label="3D highway" checked={s.perspective} onChange={(v) => set({ perspective: v })} />
        <Toggle label="Music-reactive lights" checked={s.musicReactive} onChange={(v) => set({ musicReactive: v })} />
        <Toggle label="Reduced effects" hint="Fewer particles and flashes." checked={s.reducedEffects} onChange={(v) => set({ reducedEffects: v })} />
        <Slider label="Highway width" value={Math.round(s.highwayWidth * 100)} min={70} max={100} format={(v) => `${v}%`} onChange={(v) => set({ highwayWidth: v / 100 })} />
        <Toggle label="Show frame rate" checked={s.showFps} onChange={(v) => set({ showFps: v })} />
      </section>

      <section class="group">
        <h2>Library & storage</h2>
        {storage && (
          <p class="group-hint">
            {storage.songs ?? 0} imported song{storage.songs === 1 ? '' : 's'} · audio {mb(storage.audio ?? 0)}
            {storage.usage !== undefined && storage.quota ? ` · ${mb(storage.usage)} used of ${mb(storage.quota)} available` : ''}
            <br />
            {storage.persisted ? 'Storage is protected from automatic cleanup.' : 'The browser may clear storage if the device runs low on space — keep a backup.'}
          </p>
        )}
        {storage && !storage.persisted && (
          <Button
            size="sm"
            onClick={async () => {
              const ok = await requestPersistence();
              toast(ok ? 'Storage protected' : 'The browser declined (installing to the Home Screen helps).', ok ? 'success' : 'info');
              void refreshStorage();
            }}
          >
            Protect storage
          </Button>
        )}
        <div class="button-row">
          <Button
            icon="download"
            onClick={async () => {
              try {
                const data = await library.exportBackup(settingsStore.get());
                downloadJson(`pulsefall-backup-${new Date().toISOString().slice(0, 10)}.json`, data);
                toast(`Backup saved (${data.songs.length} songs, charts and scores — audio not included)`, 'success', 4500);
              } catch (e) {
                toast((e as Error).message, 'error');
              }
            }}
          >
            Export backup
          </Button>
          <Button
            icon="upload"
            onClick={async () => {
              try {
                const data = await pickJson();
                const r = await library.importBackup(data);
                if (r.settings) {
                  const restore = await confirmDialog({ title: 'Restore settings too?', body: 'The backup includes sync offsets and preferences.', confirm: 'Restore settings' });
                  if (restore) settingsStore.set(sanitize({ ...DEFAULT_SETTINGS, ...r.settings }));
                }
                toast(`Restored ${r.songs} songs and ${r.charts} charts. Re-import audio files to play them.`, 'success', 5000);
                void refreshStorage();
              } catch (e) {
                toast((e as Error).message, 'error', 5000);
              }
            }}
          >
            Restore backup
          </Button>
        </div>
      </section>

      <section class="group">
        <h2>About</h2>
        <p class="group-hint">
          Pulsefall {APP_VERSION}. Everything runs on this device — no accounts, no uploads, no tracking. Songs you import stay in this browser's storage.
        </p>
        <div class="button-row">
          <Button size="sm" onClick={() => navigate({ name: 'help' })}>
            Help & install guide
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              if (await confirmDialog({ title: 'Reset settings?', body: 'Sync offsets and preferences go back to defaults. Your library is not touched.', confirm: 'Reset' })) {
                settingsStore.set({ ...DEFAULT_SETTINGS });
              }
            }}
          >
            Reset settings
          </Button>
        </div>
      </section>
    </div>
  );
}
