import React, { useState, useEffect } from 'react';
import Popover from '@mui/material/Popover';
import IconButton from '@mui/material/IconButton';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '../theme';
import { KagomeToken } from '../src/model';
import { getLanguageFromText } from '../src/yomitan/language/text-utilities';
import './material.css';
import './display.css';
import './YomitanPopup.css';
import './yomitan-structured-content.css';

// Yomitan's exact glossary data types (based on their TypeScript definitions)
type TermGlossaryString = string;

type TermGlossaryText = {
    type: 'text';
    text: string;
};

type TermGlossaryImage = {
    type: 'image';
    path: string;
    width?: number;
    height?: number;
    preferredWidth?: number;
    preferredHeight?: number;
    description?: string;
    pixelated?: boolean;
};

type TermGlossaryStructuredContent = {
    type: 'structured-content';
    content: any; // Can be string, object, or array - complex structure
};

type TermGlossaryDeinflection = [uninflected: string, inflectionRuleChain: string[]];

type TermGlossaryContent = TermGlossaryString | TermGlossaryText | TermGlossaryImage | TermGlossaryStructuredContent;

type TermGlossary = TermGlossaryContent | TermGlossaryDeinflection;

export interface YomitanTermEntry {
    expression: string;
    reading: string;
    definitionTags: string[];
    rules: string[];
    score: number;
    glossary: TermGlossary[];
    sequence: number;
    termTags: string[];
    dictionary: string;
    styles?: string; // Dictionary-specific CSS styles
    dictionaryMetadata?: {
        title: string;
        version: string;
        author?: string;
        url?: string;
        description?: string;
    };
}

// CSS Scoping Utilities (matching Yomitan's implementation exactly)
const addScopeToCss = (css: string, scopeSelector: string): string => {
    return scopeSelector + ' {' + css + '\n}';
};

const addDictionaryScopeToCss = (css: string, dictionaryTitle: string): string => {
    const escapedTitle = dictionaryTitle.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return addScopeToCss(css, `[data-dictionary="${escapedTitle}"]`);
};

// Whitelist of surface forms that should stay as-is (not converted to base form)
const SURFACE_FORM_WHITELIST = new Set(['たら']);

interface SubtitleTokenPopupProps {
    open: boolean;
    anchorEl: HTMLElement | null;
    token: KagomeToken | null;
    onClose: () => void;
    themeType?: string;
    onLookupYomitan?: (term: string) => Promise<YomitanTermEntry[]>;
    subtitle?: any;
    onMine?: (subtitle: any, word?: string, definition?: string, reserved?: undefined, text?: string) => void;
}

// Group entries by (expression, reading) pairs
const groupByVocabularySense = (entries: YomitanTermEntry[]): YomitanTermEntry[][] => {
    const groups = new Map<string, YomitanTermEntry[]>();

    for (const entry of entries) {
        const key = `${entry.expression}:${entry.reading}`;
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(entry);
    }

    return Array.from(groups.values());
};

// surface form if whitelisted, otherwise base form
const getDisplayForm = (token: KagomeToken): string => {
    return SURFACE_FORM_WHITELIST.has(token.surface) ? token.surface : token.base_form;
};

/**
 * Extract English meanings from the first sense of a Jitendex glossary
 * Looks for the first ul with data.content === "glossary" and extracts li text
 * Returns empty string if not found or not from Jitendex
 */
const extractJitendexMeanings = (entries: YomitanTermEntry[]): string => {
    // Only look at Jitendex entries
    const jitendexEntry = entries.find((e) => e.dictionary && e.dictionary.includes('Jitendex'));
    if (!jitendexEntry) {
        return '';
    }

    const meanings = extractMeaningsFromGlossary(jitendexEntry.glossary);
    return meanings.join('; ');
};

const extractMeaningsFromGlossary = (glossary: any[]): string[] => {
    if (!glossary || !Array.isArray(glossary)) {
        return [];
    }

    for (const item of glossary) {
        if (item?.type === 'structured-content' && item?.content) {
            const found = extractMeaningsFromContent(item.content);
            if (found.length > 0) {
                return found;
            }
        } else if (item?.content) {
            const found = extractMeaningsFromContent(item.content);
            if (found.length > 0) {
                return found;
            }
        }
    }

    return [];
};

const extractMeaningsFromContent = (content: any): string[] => {
    if (!content) {
        return [];
    }

    if (Array.isArray(content)) {
        for (const item of content) {
            const found = extractMeaningsFromContent(item);
            if (found.length > 0) {
                return found;
            }
        }
        return [];
    }

    if (typeof content === 'object') {
        if (content.tag === 'ul' && content.data?.content === 'glossary' && content.content) {
            // Extract text from li children
            const meanings: string[] = [];
            const liElements = Array.isArray(content.content) ? content.content : [content.content];

            for (const liElement of liElements) {
                if (liElement?.tag === 'li') {
                    const text = extractTextFromElement(liElement.content);
                    if (text) {
                        meanings.push(text);
                    }
                }
            }

            if (meanings.length > 0) {
                return meanings;
            }
        }

        if (content.content) {
            const found = extractMeaningsFromContent(content.content);
            if (found.length > 0) {
                return found;
            }
        }
    }

    return [];
};

/**
 * Extract plain text from element content (recursively)
 */
const extractTextFromElement = (content: any): string => {
    if (typeof content === 'string') {
        return content;
    }

    if (Array.isArray(content)) {
        return content
            .map((item) => extractTextFromElement(item))
            .filter((text) => text.length > 0)
            .join(' ');
    }

    if (typeof content === 'object' && content !== null) {
        if (content.text) {
            return content.text;
        }
        if (content.content) {
            return extractTextFromElement(content.content);
        }
    }

    return '';
};

const SubtitleTokenPopup: React.FC<SubtitleTokenPopupProps> = ({
    open,
    anchorEl,
    token,
    onClose,
    themeType = 'dark',
    onLookupYomitan,
    subtitle,
    onMine,
}) => {
    const theme = createTheme(themeType as 'dark' | 'light');
    const [yomitanData, setYomitanData] = useState<YomitanTermEntry[] | null>(null);
    const [groupedEntries, setGroupedEntries] = useState<YomitanTermEntry[][]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentGroupIndex, setCurrentGroupIndex] = useState(0);

    // Set theme for CSS variable inheritance (matching Yomitan's ThemeController)
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const updateTheme = () => {
            const isDark = mediaQuery.matches;
            const theme = isDark ? 'dark' : 'light';

            // Set all data attributes that Yomitan's CSS expects
            document.documentElement.dataset.theme = theme;
            document.documentElement.dataset.browserTheme = theme;
            document.documentElement.dataset.siteTheme = theme; // Simplified - use browser theme
            document.documentElement.dataset.outerTheme = theme;
        };

        mediaQuery.addEventListener('change', updateTheme);
        updateTheme(); // Initial call

        return () => mediaQuery.removeEventListener('change', updateTheme);
    }, []);

    // Helper function to convert schema data object to React data attributes
    const convertDataToAttributes = (data: any) => {
        const attrs: { [key: string]: string } = {};
        if (data && typeof data === 'object' && data !== null) {
            Object.entries(data).forEach(([key, value]) => {
                // Capitalize first letter and add 'sc' prefix, following Yomitan's pattern
                const scKey = key.length > 0 ? `sc${key[0].toUpperCase()}${key.substring(1)}` : 'sc';
                // Convert camelCase to kebab-case for HTML data attributes
                const htmlKey = `data-${scKey.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                attrs[htmlKey] = String(value);
            });
        }
        return attrs;
    };

    // Schema-exact structured content renderer
    const renderStructuredContent = (content: any): React.ReactNode => {
        if (!content) return null;

        // Handle string
        if (typeof content === 'string') {
            return content;
        }

        // Handle array
        if (Array.isArray(content)) {
            return content.map((item, index) => (
                <React.Fragment key={index}>{renderStructuredContent(item)}</React.Fragment>
            ));
        }

        // Handle structured content object
        if (typeof content === 'object') {
            // Structured content wrapper
            if (content.type === 'structured-content') {
                return renderStructuredContent(content.content);
            }

            // DOM element
            if (content.tag) {
                const { tag, content: innerContent, title, lang, data } = content;

                // Language detection
                let detectedLanguage = lang;
                if (!detectedLanguage && typeof innerContent === 'string') {
                    detectedLanguage = getLanguageFromText(innerContent, null);
                }

                // Generate CSS class and data attributes
                const className = `gloss-sc-${tag}`;
                const dataAttributes = convertDataToAttributes(data);

                // Comprehensive structured content element support based on schema
                switch (tag) {
                    case 'br':
                        return <br className={className} {...dataAttributes} />;

                    // Container elements with language support
                    case 'div':
                        return (
                            <div
                                className={className}
                                {...dataAttributes}
                                {...(detectedLanguage && { lang: detectedLanguage })}
                            >
                                {renderStructuredContent(innerContent)}
                            </div>
                        );
                    case 'span':
                        return (
                            <span
                                className={className}
                                {...dataAttributes}
                                title={title}
                                {...(detectedLanguage && { lang: detectedLanguage })}
                            >
                                {renderStructuredContent(innerContent)}
                            </span>
                        );

                    // Ruby annotation support (furigana)
                    case 'ruby':
                        return (
                            <ruby className={className} {...dataAttributes}>
                                {renderStructuredContent(innerContent)}
                            </ruby>
                        );
                    case 'rt':
                        return (
                            <rt className={className} {...dataAttributes}>
                                {renderStructuredContent(innerContent)}
                            </rt>
                        );
                    case 'rp':
                        return (
                            <rp className={className} {...dataAttributes}>
                                {renderStructuredContent(innerContent)}
                            </rp>
                        );

                    // Table elements with enhanced support
                    case 'table':
                        // Yomitan wraps tables in a container with special class
                        const tableElement = (
                            <table className={className} {...dataAttributes}>
                                {Array.isArray(innerContent) &&
                                innerContent.length > 0 &&
                                innerContent[0]?.tag === 'tr' ? (
                                    <tbody>{renderStructuredContent(innerContent)}</tbody>
                                ) : (
                                    renderStructuredContent(innerContent)
                                )}
                            </table>
                        );
                        return <div className="gloss-sc-table-container">{tableElement}</div>;
                    case 'tbody':
                        return (
                            <tbody className={className} {...dataAttributes}>
                                {renderStructuredContent(innerContent)}
                            </tbody>
                        );
                    case 'thead':
                        return (
                            <thead className={className} {...dataAttributes}>
                                {renderStructuredContent(innerContent)}
                            </thead>
                        );
                    case 'tfoot':
                        return (
                            <tfoot className={className} {...dataAttributes}>
                                {renderStructuredContent(innerContent)}
                            </tfoot>
                        );
                    case 'tr':
                        return (
                            <tr className={className} {...dataAttributes}>
                                {renderStructuredContent(innerContent)}
                            </tr>
                        );
                    case 'td':
                        const { colSpan, rowSpan } = content;
                        return (
                            <td
                                className={className}
                                {...dataAttributes}
                                {...(colSpan && { colSpan })}
                                {...(rowSpan && { rowSpan })}
                            >
                                {renderStructuredContent(innerContent)}
                            </td>
                        );
                    case 'th':
                        const { colSpan: thColSpan, rowSpan: thRowSpan } = content;
                        return (
                            <th
                                className={className}
                                {...dataAttributes}
                                {...(thColSpan && { colSpan: thColSpan })}
                                {...(thRowSpan && { rowSpan: thRowSpan })}
                            >
                                {renderStructuredContent(innerContent)}
                            </th>
                        );

                    // List elements
                    case 'ol':
                        return (
                            <ol className={className} {...dataAttributes}>
                                {renderStructuredContent(innerContent)}
                            </ol>
                        );
                    case 'ul':
                        return (
                            <ul className={className} {...dataAttributes}>
                                {renderStructuredContent(innerContent)}
                            </ul>
                        );
                    case 'li':
                        return (
                            <li className={className} {...dataAttributes}>
                                {renderStructuredContent(innerContent)}
                            </li>
                        );

                    // Collapsible content support
                    case 'details':
                        const { open } = content;
                        return (
                            <details className={className} {...dataAttributes} {...(open && { open })}>
                                {renderStructuredContent(innerContent)}
                            </details>
                        );
                    case 'summary':
                        return (
                            <summary className={className} {...dataAttributes}>
                                {renderStructuredContent(innerContent)}
                            </summary>
                        );

                    // Link support
                    case 'a':
                        const { href } = content;

                        return (
                            <a
                                className={className}
                                {...dataAttributes}
                                href={href}
                                {...(!href?.startsWith('?') && { target: '_blank', rel: 'noopener noreferrer' })}
                            >
                                {renderStructuredContent(innerContent)}
                            </a>
                        );

                    // Image support
                    case 'img':
                        const { path, alt, width, height } = content;

                        return (
                            <img
                                className={className}
                                {...dataAttributes}
                                src={path}
                                alt={alt || title || ''}
                                {...(width && { width })}
                                {...(height && { height })}
                            />
                        );

                    default:
                        // Unknown tag - just render the content
                        return renderStructuredContent(innerContent);
                }
            }

            // Text object format
            if (content.type === 'text') {
                return content.text;
            }

            // Object with content property
            if (content.content) {
                return renderStructuredContent(content.content);
            }
        }

        return null;
    };

    useEffect(() => {
        if (token) {
            setIsLoading(true);
            setYomitanData(null);
            setGroupedEntries([]);
            setCurrentGroupIndex(0);

            // Yomitan lookup
            if (onLookupYomitan) {
                onLookupYomitan(getDisplayForm(token))
                    .then((yomitanResult) => {
                        setYomitanData(yomitanResult);
                        // Group entries by (expression, reading)
                        const groups = groupByVocabularySense(yomitanResult);
                        setGroupedEntries(groups);
                    })
                    .catch((error) => {
                        console.error('Yomitan lookup failed:', error);
                        setYomitanData([]);
                        setGroupedEntries([]);
                    })
                    .finally(() => {
                        setIsLoading(false);
                    });
            } else {
                setIsLoading(false);
                setYomitanData([]);
                setGroupedEntries([]);
            }
        }
    }, [token, onLookupYomitan]);

    // Yomitan content utilities
    const GlossaryUtils = {
        // Single function to determine entry type
        getEntryType: (entry: TermGlossary): 'string' | 'text' | 'image' | 'structured-content' | 'deinflection' => {
            if (typeof entry === 'string') return 'string';
            if (Array.isArray(entry)) return 'deinflection';
            if (typeof entry === 'object' && entry !== null && 'type' in entry) {
                return entry.type as 'text' | 'image' | 'structured-content';
            }
            return 'string'; // fallback
        },

        // Type-safe filtering to exclude deinflections
        filterContent: (entries: TermGlossary[]): TermGlossaryContent[] =>
            entries.filter((entry) => GlossaryUtils.getEntryType(entry) !== 'deinflection') as TermGlossaryContent[],
    };

    // Schema-exact glossary content normalization (3 formats only)
    const normalizeGlossaryContent = (glossary: any): any[] => {
        if (!glossary) return [];

        const glossaryArray = Array.isArray(glossary) ? glossary : [glossary];

        return glossaryArray.map((item) => {
            // Schema format 1: Simple string
            if (typeof item === 'string') {
                return item;
            }

            // Schema format 2: Text object { type: "text", text: "..." }
            if (item?.type === 'text') {
                return item.text;
            }

            // Schema format 3: Structured content { type: "structured-content", content: [...] }
            if (item?.type === 'structured-content') {
                return item; // Pass through for renderStructuredContent
            }

            // Direct structured content (no wrapper)
            if (item?.tag || Array.isArray(item)) {
                return item;
            }

            // Fallback to string
            return String(item);
        });
    };

    // Create Yomitan-style dictionary tag with metadata tooltip
    const createDictionaryTag = (entry: YomitanTermEntry) => {
        const metadata = entry.dictionaryMetadata;
        const tooltipLines: string[] = [];

        if (metadata) {
            tooltipLines.push(metadata.title);
            if (metadata.author) {
                tooltipLines.push(`Author: ${metadata.author}`);
            }
            if (metadata.description) {
                tooltipLines.push(`Description: ${metadata.description}`);
            }
            if (metadata.version) {
                tooltipLines.push(`Version: ${metadata.version}`);
            }
        }

        const tooltip = tooltipLines.length > 0 ? tooltipLines.join('\n') : entry.dictionary;

        return (
            <span className="tag" data-category="dictionary" title={tooltip}>
                <span className="tag-label">
                    <span className="tag-label-content">{entry.dictionary}</span>
                </span>
            </span>
        );
    };

    const renderYomitanEntries = (group: YomitanTermEntry[]) => {
        if (!group.length) return null;

        return (
            <div className="yomitan-glossary">
                {/* Render each dictionary's entry in the group */}
                {group.map((entry, entryIndex) => {
                    const normalizedGlossary = normalizeGlossaryContent(entry.glossary);
                    const definitions = GlossaryUtils.filterContent(normalizedGlossary);

                    // Generate scoped CSS for this dictionary
                    const dictionaryCss = entry.styles || '';
                    const scopedCss = dictionaryCss ? addDictionaryScopeToCss(dictionaryCss, entry.dictionary) : '';

                    return (
                        <div key={entryIndex} style={{ marginBottom: entryIndex < group.length - 1 ? '16px' : '0' }}>
                            {scopedCss && <style dangerouslySetInnerHTML={{ __html: scopedCss }} />}
                            <div data-dictionary={entry.dictionary}>
                                {/* Dictionary tag */}
                                <div className="tag-list" style={{ marginBottom: '8px' }}>
                                    {createDictionaryTag(entry)}
                                </div>

                                {/* Definitions */}
                                <div className="definition-list-container">
                                    <ul className="gloss-list">
                                        {definitions.map((meaning, meaningIndex) => (
                                            <li key={meaningIndex} className="gloss-item">
                                                <span className="gloss-separator"></span>
                                                <span className="gloss-content structured-content">
                                                    {renderStructuredContent(meaning)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Term tags */}
                                {entry.termTags && entry.termTags.length > 0 && (
                                    <div className="tag-list" style={{ marginTop: '8px' }}>
                                        {entry.termTags
                                            .split(' ')
                                            .filter((tag) => tag.trim())
                                            .map((tag, i) => (
                                                <span key={i} className="tag">
                                                    {tag}
                                                </span>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Pagination controls */}
                {groupedEntries.length > 1 && (
                    <div
                        style={{
                            position: 'sticky',
                            bottom: '8px',
                            right: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '4px',
                            marginTop: '8px',
                        }}
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setCurrentGroupIndex(Math.max(0, currentGroupIndex - 1));
                            }}
                            disabled={currentGroupIndex === 0}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: currentGroupIndex === 0 ? 'default' : 'pointer',
                                opacity: currentGroupIndex === 0 ? 0.3 : 1,
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                color: 'inherit',
                            }}
                            title="Previous group"
                        >
                            <ChevronLeftRounded sx={{ fontSize: '1.5rem' }} />
                        </button>
                        <span style={{ fontSize: '0.9rem', color: '#666' }}>
                            {currentGroupIndex + 1}/{groupedEntries.length}
                        </span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setCurrentGroupIndex(Math.min(groupedEntries.length - 1, currentGroupIndex + 1));
                            }}
                            disabled={currentGroupIndex >= groupedEntries.length - 1}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: currentGroupIndex >= groupedEntries.length - 1 ? 'default' : 'pointer',
                                opacity: currentGroupIndex >= groupedEntries.length - 1 ? 0.3 : 1,
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                color: 'inherit',
                            }}
                            title="Next group"
                        >
                            <ChevronRightRounded sx={{ fontSize: '1.5rem' }} />
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <ThemeProvider theme={theme}>
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={onClose}
                // disableScrollLock={true}
                slotProps={{
                    root: {
                        'aria-hidden': false,
                    },
                    paper: {
                        sx: {
                            width: 450,
                            height: 300,
                            padding: 0,
                            overflow: 'auto',
                            ...(themeType === 'dark' && {
                                backgroundColor: 'rgba(18, 18, 18, 0.92) !important',
                                backgroundImage: 'none !important',
                                backdropFilter: 'blur(12px)',
                            }),
                        },
                    },
                }}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                }}
                sx={{
                    zIndex: 2147483648,
                    pointerEvents: 'none',
                    '& .MuiPopover-paper': {
                        pointerEvents: 'auto',
                    },
                }}
            >
                {token ? (
                    <div
                        style={{
                            fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                            position: 'relative',
                            height: '100%',
                            fontSize: 'var(--font-size)',
                            lineHeight: 'var(--line-height)',
                        }}
                    >
                        {/* Mining button */}
                        {subtitle && onMine && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    zIndex: 10,
                                    display: 'flex',
                                    alignItems: 'center',
                                }}
                            >
                                <span style={{ fontSize: '0.9rem', color: theme.palette.text.secondary }}>Add ➤</span>
                                <IconButton
                                    onClick={() => {
                                        // Extract definition from first sense of Jitendex if available
                                        const definition =
                                            groupedEntries.length > 0 && currentGroupIndex < groupedEntries.length
                                                ? extractJitendexMeanings(groupedEntries[currentGroupIndex])
                                                : '';

                                        // Replace all occurrences of the base form with "（　）" for cloze deletion
                                        let replacedText = subtitle.text;
                                        if (token && subtitle) {
                                            const subtitleIndex = subtitle.index;
                                            const allTokens = window.kagomeTokensBySubtitle?.get(subtitleIndex);
                                            if (allTokens && token.base_form) {
                                                const positions = allTokens
                                                    .filter((t) => t.base_form === token.base_form)
                                                    .map((t) => ({ start: t.start, end: t.end }))
                                                    .sort((a, b) => b.start - a.start); // Sort descending to avoid offset drift

                                                for (const { start, end } of positions) {
                                                    replacedText =
                                                        replacedText.substring(0, start) +
                                                        '（　）' +
                                                        replacedText.substring(end);
                                                }
                                            }
                                        }

                                        onMine(subtitle, token?.base_form, definition, undefined, replacedText);
                                        onClose();
                                    }}
                                    sx={{
                                        color: theme.palette.text.secondary,
                                        '&:hover': {
                                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                        },
                                    }}
                                    title="Add to Anki"
                                >
                                    <NoteAddIcon fontSize="small" />
                                </IconButton>
                            </div>
                        )}

                        <div className="entry">
                            <div className="headword-list">
                                <span className="headword-term">
                                    {groupedEntries.length > 0 && currentGroupIndex < groupedEntries.length
                                        ? groupedEntries[currentGroupIndex][0].expression
                                        : getDisplayForm(token)}
                                </span>
                                <span className="headword-reading">
                                    {groupedEntries.length > 0 && currentGroupIndex < groupedEntries.length
                                        ? groupedEntries[currentGroupIndex][0].reading
                                        : token.pronunciation}
                                </span>
                            </div>
                            <div className="tag-list">
                                <span className="tag">{token.pos.filter((p) => p !== '*').join(', ')}</span>
                            </div>

                            {isLoading && (
                                <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '1rem' }}>
                                    Loading dictionary...
                                </div>
                            )}

                            {groupedEntries.length > 0 && currentGroupIndex < groupedEntries.length ? (
                                renderYomitanEntries(groupedEntries[currentGroupIndex])
                            ) : !isLoading ? (
                                <div
                                    style={{
                                        marginTop: '16px',
                                        textAlign: 'center',
                                        color: '#666',
                                        fontSize: '1rem',
                                    }}
                                >
                                    No dictionary entries found.
                                    <br />
                                    <span style={{ fontSize: '0.9rem' }}>
                                        Import dictionaries in Settings → Dictionary tab
                                    </span>
                                </div>
                            ) : null}
                        </div>
                    </div>
                ) : (
                    <div>No token data available</div>
                )}
            </Popover>
        </ThemeProvider>
    );
};

export default SubtitleTokenPopup;
