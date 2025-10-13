/* tslint:disable */
/* eslint-disable */

/**
 * Kagome token from morphological analysis (CLI-compatible format)
 */
export interface KagomeToken {
    id: number;
    start: number;
    end: number;
    surface: string;
    class: string;
    pos: string[];
    base_form: string;
    reading: string;
    pronunciation: string;
    features: string[];
}

/**
 * Grammar pattern match result
 */
export interface GrammarMatch {
    pattern_name: string;
    confidence: number;
    start_char: number;
    end_char: number;
    category: 'Construction' | 'Conjugation';
    conjugation_pattern: string;
}

/**
 * Initialize the WASM module (sets panic hook for better error messages)
 */
export function init(): void;

/**
 * Analyze batch of subtitles, returns array of match arrays
 * @param token_arrays - Array of token arrays (one per subtitle)
 * @returns Array of grammar match arrays (one per subtitle)
 */
export function analyze_batch(token_arrays: KagomeToken[][]): GrammarMatch[][];

/**
 * Analyze single subtitle's tokens
 * @param tokens - Array of tokens for one subtitle
 * @returns Array of grammar matches
 */
export function analyze_single(tokens: KagomeToken[]): GrammarMatch[];

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or a precompiled `WebAssembly.Module`.
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 */
export default function __wbg_init(
    module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>
): Promise<InitOutput>;
