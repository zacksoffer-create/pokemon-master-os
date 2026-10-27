import '@fontsource/chakra-petch/latin-500.css';
import '@fontsource/chakra-petch/latin-600.css';
import '@fontsource/chakra-petch/latin-700.css';
import './app/styles.css';
import { render } from 'preact';
import { App } from './app/App';
import { registerServiceWorker } from './app/pwa';

if (/[?&]debug\b/.test(location.search)) sessionStorage.setItem('pf-debug', '1');
render(<App />, document.getElementById('app')!);
registerServiceWorker();
