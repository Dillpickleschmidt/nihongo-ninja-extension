/*
 * Minimal language detection utility
 * Extracted from original Yomitan for nihongo-ninja-extension
 */

/**
 * Basic Japanese character detection
 * @param {string} text
 * @returns {boolean}
 */
function isStringPartiallyJapanese(text) {
    // Check for Hiragana (U+3040-U+309F), Katakana (U+30A0-U+30FF), and Kanji (U+4E00-U+9FAF)
    return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
}

/**
 * Basic Chinese character detection
 * @param {string} text
 * @returns {boolean}
 */
function isStringPartiallyChinese(text) {
    // Check for CJK unified ideographs (Kanji/Hanzi overlap)
    return /[\u4E00-\u9FAF]/.test(text);
}

/**
 * Returns the language that the string might be by using some heuristic checks.
 * Values returned are ISO codes. `null` is returned if no language can be determined.
 * @param {string} text
 * @param {?string} language
 * @returns {?string}
 */
export function getLanguageFromText(text, language) {
    const partiallyJapanese = isStringPartiallyJapanese(text);
    const partiallyChinese = isStringPartiallyChinese(text);
    if (!['zh', 'yue'].includes(language ?? '')) {
        if (partiallyJapanese) { return 'ja'; }
        if (partiallyChinese) { return 'zh'; }
    }
    return language;
}