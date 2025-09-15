import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import { createRoot } from 'react-dom/client';
import { HttpFetcher } from '@project/common';
import WebsiteApp from './components/WebsiteApp';
import { loadKagomeWasm } from './kagome-loader';

const fetcher = new HttpFetcher();

// Load kagome WASM for Japanese text analysis
loadKagomeWasm().catch(console.error);

createRoot(document.querySelector('#root')!).render(
    <WebsiteApp
        origin={location.pathname}
        logoUrl={`${location.pathname === '/' ? '' : location.pathname}/background-colored.png`}
        fetcher={fetcher}
    />
);
