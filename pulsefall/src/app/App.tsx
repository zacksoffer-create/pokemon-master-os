import { lazy, Suspense } from 'preact/compat';
import { useEffect } from 'preact/hooks';
import { Icon } from './components/Icon';
import { ImportSheet } from './components/ImportSheet';
import { Toasts } from './components/Toasts';
import { ConfirmHost } from './components/ui';
import { navigate, useRoute, type Route } from './router';
import { Calibrate } from './screens/Calibrate';
import { Game } from './screens/Game';
import { Help } from './screens/Help';
import { Home } from './screens/Home';
import { Library } from './screens/Library';
import { Settings } from './screens/Settings';
import { SongDetail } from './screens/SongDetail';
import { updateStore } from './pwa';
import { importStore, reopenImports } from './state/importManager';
import { uiSound, useSettings } from './state/settings';
import { useStore } from './state/store';

const Editor = lazy(() => import('./screens/Editor').then((m) => ({ default: m.Editor })));

function TabBar({ route }: { route: Route }) {
  const imports = useStore(importStore);
  const busy = imports.items.some((i) => i.status === 'working' || i.status === 'queued');
  const tab = (name: 'home' | 'library' | 'settings', icon: 'home' | 'library' | 'settings', label: string) => (
    <button
      class={route.name === name ? 'on' : ''}
      aria-current={route.name === name ? 'page' : undefined}
      onClick={() => {
        uiSound();
        if (route.name !== name) navigate({ name });
      }}
    >
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
  return (
    <nav class="tabbar" aria-label="Main">
      {tab('home', 'home', 'Home')}
      {tab('library', 'library', 'Library')}
      {busy && !imports.open && (
        <button class="importing" onClick={reopenImports}>
          <span class="spinner small" />
          <span>Importing</span>
        </button>
      )}
      {tab('settings', 'settings', 'Settings')}
    </nav>
  );
}

function UpdateBanner() {
  const apply = useStore(updateStore);
  if (!apply) return null;
  return (
    <div class="update-banner" role="status">
      <span>A new version of Pulsefall is ready.</span>
      <button onClick={apply}>Update</button>
    </div>
  );
}

export function App() {
  const route = useRoute();
  const settings = useSettings();
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);
  useEffect(() => {
    if (route.name !== 'play') window.scrollTo(0, 0);
  }, [route.name, (route as { id?: string }).id]);

  let screen;
  switch (route.name) {
    case 'home':
      screen = <Home />;
      break;
    case 'library':
      screen = <Library />;
      break;
    case 'song':
      screen = <SongDetail id={route.id} key={route.id} />;
      break;
    case 'play':
      screen = <Game id={route.id} key={route.id} />;
      break;
    case 'edit':
      screen = (
        <Suspense fallback={<div class="screen center"><div class="spinner" /></div>}>
          <Editor id={route.id} style={route.style} key={`${route.id}:${route.style}`} />
        </Suspense>
      );
      break;
    case 'settings':
      screen = <Settings />;
      break;
    case 'calibrate':
      screen = <Calibrate />;
      break;
    case 'help':
      screen = <Help />;
      break;
  }
  const showTabs = route.name === 'home' || route.name === 'library' || route.name === 'settings';
  return (
    <div class={`app route-${route.name}`}>
      <div class="bg-orbs" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <main class={showTabs ? 'with-tabs' : ''}>{screen}</main>
      {showTabs && <TabBar route={route} />}
      {route.name !== 'play' && <ImportSheet />}
      {route.name !== 'play' && route.name !== 'edit' && <UpdateBanner />}
      <ConfirmHost />
      <Toasts />
    </div>
  );
}
