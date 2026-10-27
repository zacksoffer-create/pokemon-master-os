import { DEMO_ID } from '../../core/demo/demoSetup';
import { isIOS } from '../../core/audio/audioEngine';
import { formatDuration } from '../../core/util';
import { Cover, Emblem, Wordmark } from '../components/Art';
import { Icon } from '../components/Icon';
import { Button } from '../components/ui';
import { navigate } from '../router';
import { pickFiles } from '../state/importManager';
import { useSongs } from '../state/libraryHooks';
import { uiSound, useSettings } from '../state/settings';

export function isStandalone(): boolean {
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches)
  );
}

export function Home() {
  const { data: songs } = useSongs();
  const settings = useSettings();
  const userSongs = songs.filter((s) => !s.isDemo);
  const recent = songs
    .filter((s) => s.lastPlayedAt)
    .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
    .slice(0, 8);
  const showInstall = isIOS() && !isStandalone();

  return (
    <div class="screen home">
      <div class="home-hero">
        <div class="hero-emblem">
          <Emblem size={104} />
        </div>
        <Wordmark size={44} />
        <p class="tagline">Your music. Your beat. Tap along.</p>
      </div>

      <div class="home-actions">
        <Button
          variant="primary"
          size="lg"
          icon="play"
          class="play-cta"
          onClick={() => navigate(userSongs.length ? { name: 'library' } : { name: 'song', id: DEMO_ID })}
        >
          Play
        </Button>
        <div class="home-row">
          <Button icon="plus" onClick={() => pickFiles((s) => s.length === 1 && navigate({ name: 'song', id: s[0].id }))}>
            Import song
          </Button>
          <Button icon="library" onClick={() => navigate({ name: 'library' })}>
            Library
          </Button>
        </div>
      </div>

      {showInstall && (
        <button class="notice" onClick={() => navigate({ name: 'help' })}>
          <Icon name="share" />
          <span>
            <b>Add Pulsefall to your Home Screen</b> for full-screen play. Import your songs there — Safari and the Home Screen app keep separate libraries.
          </span>
        </button>
      )}

      {!settings.calibrated && (
        <button class="notice notice-soft" onClick={() => navigate({ name: 'calibrate' })}>
          <Icon name="sync" />
          <span>
            <b>Sync check</b> — 30 seconds of tapping so notes line up perfectly with your headphones or speaker.
          </span>
        </button>
      )}

      {recent.length > 0 && (
        <section class="home-section">
          <h2>Recently played</h2>
          <div class="hscroll">
            {recent.map((s) => (
              <button
                class="mini-card"
                onClick={() => {
                  uiSound();
                  navigate({ name: 'song', id: s.id });
                }}
              >
                <Cover song={s} />
                <span class="mini-title">{s.title}</span>
                <span class="mini-sub">{s.artist}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section class="home-section">
        <h2>Demo track</h2>
        <button
          class="demo-card"
          onClick={() => {
            uiSound();
            navigate({ name: 'song', id: DEMO_ID });
          }}
        >
          <div class="demo-art">
            <Emblem size={44} />
          </div>
          <div class="demo-text">
            <b>Neon Overture</b>
            <span>Original synth-pop · 116 BPM · {formatDuration(72000)}</span>
            <small>Try every note type before importing your own music.</small>
          </div>
          <Icon name="play" />
        </button>
      </section>

      <footer class="home-foot">
        <button class="link" onClick={() => navigate({ name: 'help' })}>
          How it works
        </button>
        <span>·</span>
        <button class="link" onClick={() => navigate({ name: 'calibrate' })}>
          Sync check
        </button>
      </footer>
    </div>
  );
}
