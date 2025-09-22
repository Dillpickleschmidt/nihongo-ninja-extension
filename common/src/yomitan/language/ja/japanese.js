/*
 * Minimal stubs for Japanese language functions
 * These are only used by Anki formatting, not core dictionary functionality
 */

/**
 * Stub for furigana distribution - returns basic segments
 */
export function distributeFurigana(term: string, reading: string): Array<{text: string, reading: string}> {
    // Simple stub - just return the term and reading as single segments
    return [{text: term, reading: reading}];
}

/**
 * Stub for inflected furigana distribution
 */
export function distributeFuriganaInflected(term: string, reading: string, source: string): Array<{text: string, reading: string}> {
    // Simple stub - just return the term and reading as single segments
    return [{text: term, reading: reading}];
}