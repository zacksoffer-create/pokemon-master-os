import { Icon } from '../components/Icon';
import { TopBar } from '../components/ui';
import { isStandalone } from './Home';

export function Help() {
  return (
    <div class="screen help">
      <TopBar title="Help" backTo={{ name: 'home' }} />
      <article class="prose">
        <section>
          <h2>How it works</h2>
          <ol>
            <li>
              <b>Import a song</b> — an MP3 or M4A from your Files app, or a video (MP4/MOV) from Files or your Photo Library; Pulsefall keeps just its sound.
            </li>
            <li>
              <b>Pulsefall listens to it</b> on your device: it finds the beat, the hits, the quiet and loud sections, and the long notes.
            </li>
            <li>
              <b>Four charts are built automatically</b> — Relaxed, Classic Groove, Full Rhythm and Advanced. Repeated sections get repeated patterns, choruses get busier than verses.
            </li>
            <li>
              <b>Play.</b> Tap notes as they cross the glowing line, keep your finger down on holds, flick the gold arrow notes. Letting go of a hold early costs a few points but never your combo.
            </li>
            <li>
              <b>Play just part of a song</b> with the <b>Part</b> button: tap a section (or drag the edges) to play only that stretch, or keep it as the song's start and end for every play. During a song, <b>Skip</b> jumps past long intros and quiet gaps.
            </li>
          </ol>
          <p>Nothing is uploaded. Your music never leaves your device.</p>
        </section>

        <section>
          <h2>Install on iPhone</h2>
          {isStandalone() ? (
            <p>
              <Icon name="check" size={16} /> You're running the installed app.
            </p>
          ) : (
            <ol>
              <li>Open Pulsefall in <b>Safari</b>.</li>
              <li>
                Tap the <b>Share</b> button <Icon name="share" size={16} /> at the bottom of the screen.
              </li>
              <li>
                Scroll down and choose <b>Add to Home Screen</b>, then <b>Add</b>.
              </li>
              <li>Open Pulsefall from its new icon. It runs full-screen and works offline.</li>
            </ol>
          )}
          <p class="callout">
            <b>Import your songs inside the installed app.</b> iOS keeps the Home Screen app's storage separate from Safari's, so songs imported in a Safari tab won't appear there (and vice versa). A backup file can move charts and scores between them.
          </p>
        </section>

        <section>
          <h2>Audio files</h2>
          <ul>
            <li>
              <b>Works best:</b> MP3, M4A/AAC (e.g. iTunes purchases, files you converted yourself), WAV, and MP4/MOV videos (only the sound is kept, so they take little space).
            </li>
            <li>
              <b>Usually works:</b> FLAC; Ogg/Opus on iOS 17 and later; Apple Lossless depends on the browser.
            </li>
            <li>
              <b>Can't work:</b> songs from Apple Music, Spotify or other subscriptions — they're copy-protected (DRM) and can't be decoded by any app.
            </li>
            <li>Songs up to 20 minutes. Most songs take a few seconds to analyze.</li>
          </ul>
        </section>

        <section>
          <h2>Getting the timing right</h2>
          <p>
            If notes feel early or late, run the <b>Sync check</b> from Settings. It takes about 30 seconds. Re-run it when you switch between the phone speaker and Bluetooth headphones — Bluetooth adds a lot of delay.
          </p>
          <p>The default timing is forgiving on purpose. You can tighten it in Settings → Timing windows.</p>
        </section>

        <section>
          <h2>Editing charts</h2>
          <p>
            Open a song, tap <Icon name="more" size={16} /> → <b>Edit chart</b>. Your edit is saved as a separate version — the automatic chart is always kept, and rebuilding automatic charts never touches your edits.
          </p>
          <p>On a laptop the editor has keyboard shortcuts: Space play/pause, 1–4 add a note in a lane at the playhead, Delete removes the selection, Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z redo.</p>
        </section>

        <section>
          <h2>Keeping your library</h2>
          <p>
            Songs live in this browser's storage on this device. Installed Home Screen apps are protected from automatic cleanup, but it's still smart to <b>export a backup</b> now and then (Settings → Export backup). Backups contain charts, edits, scores and settings — not the audio. After restoring, re-import the same files and they relink automatically.
          </p>
        </section>

        <section>
          <h2>Playing on a computer</h2>
          <p>
            Keyboard: <kbd>F</kbd> <kbd>Space</kbd> <kbd>J</kbd> for three lanes (or <kbd>←</kbd> <kbd>↓</kbd> <kbd>→</kbd>), <kbd>D</kbd> <kbd>F</kbd> <kbd>J</kbd> <kbd>K</kbd> for four. Hold Shift with a lane key to flick a swipe note.
          </p>
        </section>
      </article>
    </div>
  );
}
