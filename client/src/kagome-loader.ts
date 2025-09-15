// Kagome WASM loader for client
declare global {
    interface Window {
        kagome_tokenize?: (text: string) => any[];
        Go?: any;
    }
}

let kagomeLoaded = false;
let loadPromise: Promise<void> | null = null;

export async function loadKagomeWasm() {
    if (kagomeLoaded) return;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
        try {
            console.log('[Kagome Client] Loading Go WASM runtime...');

            // Load the official Go WASM support script
            // Get base URL from current location or use default
            const base = window.location.pathname.includes('/asbplayer') ? '/asbplayer/' : '/';
            const goScriptUrl = `${base}kagome/wasm_exec.js`;
            await loadScript(goScriptUrl);

            console.log('[Kagome Client] Loading WASM...');
            const wasmUrl = `${base}kagome/kagome.wasm`;
            const wasmResponse = await fetch(wasmUrl);

            if (!wasmResponse.ok) {
                throw new Error(`Failed to fetch WASM: ${wasmResponse.status}`);
            }

            const wasmBytes = await wasmResponse.arrayBuffer();

            // Use the official Go class from wasm_exec.js
            const go = new (window as any).Go();

            // Simple compatibility fixes for version mismatches
            if (go.importObject.go) {
                // WASM expects 'gojs' but newer wasm_exec.js uses 'go'
                go.importObject.gojs = go.importObject.go;

                // WASM expects 'walltime' but newer wasm_exec.js has 'walltime1'
                if (go.importObject.gojs['runtime.walltime1'] && !go.importObject.gojs['runtime.walltime']) {
                    go.importObject.gojs['runtime.walltime'] = go.importObject.gojs['runtime.walltime1'];
                }
            }

            const result = await WebAssembly.instantiate(wasmBytes, go.importObject);

            console.log('[Kagome Client] Running Go program...');
            await go.run(result.instance);

            kagomeLoaded = true;
            console.log('[Kagome Client] Kagome WASM loaded successfully');

            // Test it
            if (typeof (window as any).kagome_tokenize === 'function') {
                console.log('[Kagome Client] kagome_tokenize function is available');
            }
        } catch (error) {
            console.error('[Kagome Client] Failed to load Kagome WASM:', error);
            // Don't throw - let the app continue without kagome
        }
    })();

    return loadPromise;
}

function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

