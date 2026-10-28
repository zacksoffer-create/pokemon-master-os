import { Sheet } from './ui';

/** Step-by-step: getting songs from Google Drive (or any cloud folder) into Pulsefall on iPhone. */
export function DriveHelpSteps() {
  return (
    <div class="drive-help">
      <ol>
        <li>
          On your computer, put the songs (MP3, M4A or MP4) in a Google Drive folder. Real files only: Google Docs and shortcuts can't be imported.
        </li>
        <li>
          On your iPhone, install the <b>Google Drive</b> app, open it once and sign in with the same account.
        </li>
        <li>
          Open the <b>Files</b> app → <b>Browse</b> → <b>⋯</b> (top right) → <b>Edit</b> → turn on <b>Google Drive</b> → <b>Done</b>.
        </li>
        <li>
          In Pulsefall tap <b>Import</b> → <b>Choose Files</b> → <b>Browse</b> → <b>Google Drive</b> → your folder. Tap <b>Select</b> to pick several, then <b>Open</b>.
        </li>
      </ol>
      <p class="row-hint">
        Google Drive missing under Browse? Steps 2 and 3 add it. Picking does nothing? Drive downloads the file first, so you need a connection. Once imported, songs play offline.
      </p>
    </div>
  );
}

export function DriveHelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Songs on Google Drive">
      <DriveHelpSteps />
    </Sheet>
  );
}
