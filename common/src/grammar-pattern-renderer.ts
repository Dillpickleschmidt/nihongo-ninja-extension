import { GrammarMatch, KagomeToken } from './model';

export interface LayeredGrammarPattern extends GrammarMatch {
    layer: number;
    patternId: string;
}

// Builds bidirectional index of pattern-token overlaps
function buildPatternTokenIndex<T extends GrammarMatch>(patterns: T[], tokens: KagomeToken[]) {
    const patternToTokens = new Map<number, Set<number>>();
    const tokenToPatterns = new Map<number, T[]>();

    for (let patternIdx = 0; patternIdx < patterns.length; patternIdx++) {
        const pattern = patterns[patternIdx];
        const tokenSet = new Set<number>();

        for (let tokenIdx = 0; tokenIdx < tokens.length; tokenIdx++) {
            const token = tokens[tokenIdx];
            if (pattern.start_char < token.end && pattern.end_char > token.start) {
                tokenSet.add(tokenIdx);

                if (!tokenToPatterns.has(tokenIdx)) {
                    tokenToPatterns.set(tokenIdx, []);
                }
                tokenToPatterns.get(tokenIdx)!.push(pattern);
            }
        }

        patternToTokens.set(patternIdx, tokenSet);
    }

    return { patternToTokens, tokenToPatterns };
}

// Filters out patterns completely contained within higher-confidence patterns
function selectBestPatterns(matches: GrammarMatch[]): GrammarMatch[] {
    if (!matches || matches.length === 0) {
        return [];
    }

    // Sort by confidence descending (highest confidence first)
    const sorted = [...matches].sort((a, b) => b.confidence - a.confidence);
    const selected: GrammarMatch[] = [];

    for (const match of sorted) {
        // Skip if completely contained in a higher-confidence match
        const isRedundant = selected.some(
            (s) => s.start_char <= match.start_char && s.end_char >= match.end_char && s.confidence > match.confidence
        );

        if (!isRedundant) {
            selected.push(match);
        }
    }

    return selected;
}

// Combines tokens covered by conjugation patterns into single tokens (e.g., 拝み + たかっ + た → 拝みたかった)
export function combineConjugationTokens(
    text: string,
    tokens: KagomeToken[],
    grammarMatches: GrammarMatch[]
): KagomeToken[] {
    // Filter to Conjugation patterns only
    const conjugationMatches = grammarMatches.filter((m) => m.category === 'Conjugation');

    // Select best (non-redundant) conjugation patterns
    const bestConjugations = selectBestPatterns(conjugationMatches);

    // Sort by start_char for single-pass algorithm
    const conjugationPatterns = bestConjugations.sort((a, b) => a.start_char - b.start_char);

    if (conjugationPatterns.length === 0) {
        return tokens;
    }

    const result: KagomeToken[] = [];
    let patternIndex = 0;
    let tokenIndex = 0;

    while (tokenIndex < tokens.length) {
        const token = tokens[tokenIndex];

        // Skip patterns that end before this token
        while (patternIndex < conjugationPatterns.length && conjugationPatterns[patternIndex].end_char <= token.start) {
            patternIndex++;
        }

        // Check if current token overlaps with current pattern
        const pattern = conjugationPatterns[patternIndex];

        if (!pattern || token.end <= pattern.start_char) {
            // No overlap - add token as-is
            result.push(token);
            tokenIndex++;
            continue;
        }

        // Token overlaps with pattern - handle overlap
        if (token.start < pattern.start_char && token.end > pattern.start_char) {
            // Token starts before pattern - split it
            const beforeText = text.substring(token.start, pattern.start_char);
            result.push({
                ...token,
                end: pattern.start_char,
                surface: beforeText,
                // Reading/pronunciation proportionally split (approximate)
                reading: token.reading.substring(
                    0,
                    Math.floor((token.reading.length * beforeText.length) / token.surface.length)
                ),
                pronunciation: token.pronunciation.substring(
                    0,
                    Math.floor((token.pronunciation.length * beforeText.length) / token.surface.length)
                ),
            });
        }

        // Find all tokens fully or partially contained in this pattern
        const containedTokens: KagomeToken[] = [];
        let patternEndTokenIndex = tokenIndex;

        while (patternEndTokenIndex < tokens.length && tokens[patternEndTokenIndex].start < pattern.end_char) {
            const t = tokens[patternEndTokenIndex];

            if (t.start >= pattern.start_char && t.end <= pattern.end_char) {
                // Fully contained
                containedTokens.push(t);
            } else if (t.start < pattern.end_char && t.end > pattern.end_char) {
                // Partially extends past pattern end - add contained part
                const containedPart = text.substring(Math.max(t.start, pattern.start_char), pattern.end_char);
                containedTokens.push({
                    ...t,
                    start: Math.max(t.start, pattern.start_char),
                    end: pattern.end_char,
                    surface: containedPart,
                    reading: t.reading.substring(
                        0,
                        Math.floor((t.reading.length * containedPart.length) / t.surface.length)
                    ),
                    pronunciation: t.pronunciation.substring(
                        0,
                        Math.floor((t.pronunciation.length * containedPart.length) / t.surface.length)
                    ),
                });
            } else if (t.start >= pattern.start_char) {
                // Fully contained
                containedTokens.push(t);
            }

            patternEndTokenIndex++;
        }

        // Create combined token from pattern range
        if (containedTokens.length > 0) {
            const combinedSurface = text.substring(pattern.start_char, pattern.end_char);
            const firstToken = containedTokens[0];

            // Prefer verb POS if any token in the group is a verb (e.g., 勉強します)
            // This ensures suru-verbs show as verbs, not nouns
            const verbToken = containedTokens.find((t) => t.pos[0] === '動詞');
            const referenceToken = verbToken || firstToken;

            result.push({
                id: firstToken.id,
                start: pattern.start_char,
                end: pattern.end_char,
                surface: combinedSurface,
                class: firstToken.class,
                pos: referenceToken.pos,
                base_form: referenceToken.base_form,
                reading: firstToken.reading,
                pronunciation: firstToken.pronunciation,
                features: firstToken.features,
            });
        }

        // Handle token that extends past pattern end
        const lastOverlappingToken = tokens[patternEndTokenIndex - 1];
        if (lastOverlappingToken && lastOverlappingToken.end > pattern.end_char) {
            const afterText = text.substring(pattern.end_char, lastOverlappingToken.end);
            const afterStartRatio =
                (pattern.end_char - lastOverlappingToken.start) / lastOverlappingToken.surface.length;
            result.push({
                ...lastOverlappingToken,
                start: pattern.end_char,
                surface: afterText,
                reading: lastOverlappingToken.reading.substring(
                    Math.ceil(lastOverlappingToken.reading.length * afterStartRatio)
                ),
                pronunciation: lastOverlappingToken.pronunciation.substring(
                    Math.ceil(lastOverlappingToken.pronunciation.length * afterStartRatio)
                ),
            });
        }

        tokenIndex = patternEndTokenIndex;
    }

    return result;
}

// Filters redundant patterns and assigns layers for stacked underlines
export function selectAndLayerGrammarPatterns(matches: GrammarMatch[], tokens: KagomeToken[], subtitleIndex: number): LayeredGrammarPattern[] {
    if (matches.length === 0 || tokens.length === 0) {
        return [];
    }

    // Filter to Construction patterns only (Conjugation patterns are used only for token combining)
    const constructionMatches = matches.filter((m) => m.category === 'Construction');

    if (constructionMatches.length === 0) {
        return [];
    }

    // Build pattern-token overlap index
    const { patternToTokens } = buildPatternTokenIndex(constructionMatches, tokens);

    // Filter patterns: remove those whose token-set is completely contained in a higher-confidence pattern
    const selectedPatterns: GrammarMatch[] = [];
    const sortedByConfidence = [...constructionMatches]
        .map((m, idx) => ({ pattern: m, originalIdx: idx }))
        .sort((a, b) => b.pattern.confidence - a.pattern.confidence);

    for (const { pattern, originalIdx } of sortedByConfidence) {
        const patternTokens = patternToTokens.get(originalIdx)!;

        // Check if this pattern's token-set is contained in any higher-confidence selected pattern
        const isRedundant = selectedPatterns.some((selected) => {
            const selectedIdx = constructionMatches.indexOf(selected);
            const selectedTokens = patternToTokens.get(selectedIdx)!;

            // Check if patternTokens ⊆ selectedTokens
            if (patternTokens.size > selectedTokens.size) return false;

            for (const tokenIdx of patternTokens) {
                if (!selectedTokens.has(tokenIdx)) return false;
            }

            return true; // All tokens in patternTokens are in selectedTokens
        });

        if (!isRedundant) {
            selectedPatterns.push(pattern);
        }
    }

    // Apply layering to selected patterns and compute pattern IDs
    const layered: LayeredGrammarPattern[] = [];
    for (const match of selectedPatterns) {
        // Find overlapping patterns to determine layer
        const overlapping = layered.filter((s) => !(match.end_char <= s.start_char || match.start_char >= s.end_char));

        // Assign to the next available layer
        const layer = overlapping.length > 0 ? Math.max(...overlapping.map((s) => s.layer)) + 1 : 0;

        // Pre-compute pattern ID for hover highlighting
        const patternId = `${subtitleIndex}-${match.start_char}-${match.end_char}-${match.pattern_name}`;

        layered.push({ ...match, layer, patternId });
    }

    return layered;
}

// Builds HTML with token spans and grammar pattern underlines
export function buildGrammarEnhancedHTML(
    text: string,
    tokens: KagomeToken[],
    grammarPatterns: LayeredGrammarPattern[],
    subtitleIndex: number
): string {
    // Build pattern-token overlap index
    const { tokenToPatterns: patternsByToken } = buildPatternTokenIndex(grammarPatterns, tokens);

    const htmlSegments: string[] = [];
    let lastPos = 0;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        // Add any text before this token (spaces, etc.)
        if (token.start > lastPos) {
            htmlSegments.push(text.substring(lastPos, token.start));
        }

        const overlappingPatterns = patternsByToken.get(i) || [];
        const tokenClassName = token.pos[0] === '記号' ? '' : 'asbplayer-kagome-token';

        if (tokenClassName) {
            // Build grammar underline divs for this token
            const grammarDivs = overlappingPatterns
                .map((p) => {
                    return `<div class="grammar-underline grammar-layer-${p.layer}" data-pattern="${p.pattern_name}" data-pattern-id="${p.patternId}" title="${p.pattern_name} (${p.confidence})"></div>`;
                })
                .join('');

            htmlSegments.push(
                `<span class="${tokenClassName}" data-subtitle-index="${subtitleIndex}" data-token-index="${i}">${token.surface}${grammarDivs}</span>`
            );
        } else {
            htmlSegments.push(token.surface);
        }

        lastPos = token.end;
    }

    // Add remaining text
    if (lastPos < text.length) {
        htmlSegments.push(text.substring(lastPos));
    }

    return htmlSegments.join('');
}
