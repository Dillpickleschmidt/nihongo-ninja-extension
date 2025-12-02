import init, { analyze, analyze_batch, init as grammarInit } from '../../../public/grammar/grammar_wasm';

let grammarLoaded = false;
let loadPromise: Promise<void> | null = null;

/**
 * Loads and initializes the grammar WASM module
 * @returns Promise that resolves when WASM is loaded
 */
export async function loadGrammarWasm(): Promise<void> {
    if (grammarLoaded) return;

    if (loadPromise) {
        return loadPromise;
    }

    loadPromise = (async () => {
        try {
            console.log('[Grammar Background] Loading WASM...');
            const browserAPI = (self as any).browser || (self as any).chrome;
            const wasmUrl = browserAPI.runtime.getURL('grammar/grammar_wasm_bg.wasm');

            console.log('[Grammar Background] Initializing WASM module...');
            await init({ module_or_path: wasmUrl });

            console.log('[Grammar Background] Calling grammar init...');
            grammarInit();

            grammarLoaded = true;
            console.log('[Grammar Background] Grammar WASM loaded successfully');
        } catch (error) {
            console.error('[Grammar Background] Failed to load Grammar WASM:', error);
            loadPromise = null; // Reset to allow retry
            throw error;
        }
    })();

    return loadPromise;
}

/**
 * Re-export grammar analysis functions for easy access
 */
export { analyze, analyze_batch };
