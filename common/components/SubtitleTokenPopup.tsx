import React, { useState, useEffect } from 'react';
import Popover from '@mui/material/Popover';
import Paper from '@mui/material/Paper';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '../theme';
import { KagomeToken } from '../src/model';

export interface YomitanTermEntry {
    expression: string;
    reading: string;
    definitionTags: string;
    rules: string;
    score: number;
    glossary: (string | any)[];
    sequence: number;
    termTags: string;
    dictionary: string;
}

interface SubtitleTokenPopupProps {
    open: boolean;
    anchorEl: HTMLElement | null;
    token: KagomeToken | null;
    onClose: () => void;
    themeType?: string;
    onLookupYomitan?: (term: string) => Promise<YomitanTermEntry[]>;
}

const SubtitleTokenPopup: React.FC<SubtitleTokenPopupProps> = ({
    open,
    anchorEl,
    token,
    onClose,
    themeType = 'dark',
    onLookupYomitan,
}) => {
    const theme = createTheme(themeType as 'dark' | 'light');
    const [yomitanData, setYomitanData] = useState<YomitanTermEntry[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [currentDictionaryIndex, setCurrentDictionaryIndex] = useState(0);

    // Simple recursive renderer for Yomitan's structured content
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
            // If it has a type and content property (structured content wrapper)
            if (content.type === 'structured-content' && content.content) {
                return renderStructuredContent(content.content);
            }

            // If it has a tag property (DOM element)
            if (content.tag) {
                const { tag, content: innerContent, title } = content;

                // For simplicity, just render the content with basic elements
                switch (tag) {
                    case 'br':
                        return <br />;
                    case 'div':
                        return <div>{renderStructuredContent(innerContent)}</div>;
                    case 'span':
                        return <span title={title}>{renderStructuredContent(innerContent)}</span>;
                    case 'table':
                        // Check if innerContent is an array and first item is a tr
                        // If so, wrap in tbody for proper HTML structure
                        if (Array.isArray(innerContent) && innerContent.length > 0 && innerContent[0]?.tag === 'tr') {
                            return (
                                <table>
                                    <tbody>{renderStructuredContent(innerContent)}</tbody>
                                </table>
                            );
                        }
                        return <table>{renderStructuredContent(innerContent)}</table>;
                    case 'tbody':
                        return <tbody>{renderStructuredContent(innerContent)}</tbody>;
                    case 'thead':
                        return <thead>{renderStructuredContent(innerContent)}</thead>;
                    case 'tfoot':
                        return <tfoot>{renderStructuredContent(innerContent)}</tfoot>;
                    case 'tr':
                        return <tr>{renderStructuredContent(innerContent)}</tr>;
                    case 'td':
                        return <td>{renderStructuredContent(innerContent)}</td>;
                    case 'th':
                        return <th>{renderStructuredContent(innerContent)}</th>;
                    case 'ul':
                        return <ul>{renderStructuredContent(innerContent)}</ul>;
                    case 'li':
                        return <li>{renderStructuredContent(innerContent)}</li>;
                    default:
                        // For unknown tags, just render the content
                        return renderStructuredContent(innerContent);
                }
            }

            // If it's just an object, try to render its content property
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
            setCurrentDictionaryIndex(0);

            // Yomitan lookup
            if (onLookupYomitan) {
                onLookupYomitan(token.surface_form)
                    .then((yomitanResult) => {
                        setYomitanData(yomitanResult);
                    })
                    .catch((error) => {
                        console.error('Yomitan lookup failed:', error);
                        setYomitanData([]);
                    })
                    .finally(() => {
                        setIsLoading(false);
                    });
            } else {
                setIsLoading(false);
                setYomitanData([]);
            }
        }
    }, [token, onLookupYomitan]);

    const renderYomitanEntries = (entries: YomitanTermEntry[]) => {
        if (!entries.length) return null;

        const currentEntry = entries[currentDictionaryIndex] || entries[0];
        const meanings = Array.isArray(currentEntry.glossary) ? currentEntry.glossary : [currentEntry.glossary];

        return (
            <>
                <div style={{ marginTop: '12px', fontSize: '1.1rem' }}>
                    <div style={{ marginBottom: '8px', fontSize: '0.9rem', color: '#007acc', fontWeight: 'bold' }}>
                        📚 {currentEntry.dictionary}
                    </div>
                    <div>
                        {meanings.map((meaning, meaningIndex) => (
                            <div key={meaningIndex} style={{ marginBottom: '4px' }}>
                                • {renderStructuredContent(meaning)}
                            </div>
                        ))}
                    </div>

                    {currentEntry.termTags && currentEntry.termTags.length > 0 && (
                        <div style={{ marginTop: '8px', fontSize: '0.9rem', color: '#666' }}>
                            Tags: {currentEntry.termTags}
                        </div>
                    )}
                </div>

                {entries.length > 1 && (
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '8px',
                            right: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                        }}
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setCurrentDictionaryIndex(Math.max(0, currentDictionaryIndex - 1));
                            }}
                            disabled={currentDictionaryIndex === 0}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: currentDictionaryIndex === 0 ? 'default' : 'pointer',
                                opacity: currentDictionaryIndex === 0 ? 0.3 : 1,
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                color: 'inherit',
                            }}
                            title="Previous entry"
                        >
                            <ChevronLeftRounded sx={{ fontSize: '1.5rem' }} />
                        </button>
                        <span style={{ fontSize: '0.9rem', color: '#666' }}>
                            {currentDictionaryIndex + 1}/{entries.length}
                        </span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setCurrentDictionaryIndex(Math.min(entries.length - 1, currentDictionaryIndex + 1));
                            }}
                            disabled={currentDictionaryIndex >= entries.length - 1}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: currentDictionaryIndex >= entries.length - 1 ? 'default' : 'pointer',
                                opacity: currentDictionaryIndex >= entries.length - 1 ? 0.3 : 1,
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                color: 'inherit',
                            }}
                            title="Next entry"
                        >
                            <ChevronRightRounded sx={{ fontSize: '1.5rem' }} />
                        </button>
                    </div>
                )}
            </>
        );
    };

    return (
        <ThemeProvider theme={theme}>
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={onClose}
                slotProps={{
                    root: {
                        'aria-hidden': false,
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
                <Paper
                    sx={{
                        width: 400,
                        height: 250,
                        padding: 2,
                        overflow: 'auto',
                    }}
                >
                    {token ? (
                        <div
                            style={{
                                fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                                position: 'relative',
                                height: '100%',
                            }}
                        >
                            <h2 style={{ display: 'inline', fontSize: '1.75rem', margin: 0 }}>
                                {yomitanData && yomitanData.length > 0 && currentDictionaryIndex < yomitanData.length
                                    ? yomitanData[currentDictionaryIndex].expression
                                    : token.surface_form}
                            </h2>
                            <span style={{ color: '#666', marginLeft: '8px', fontSize: '1.25rem' }}>
                                (
                                {yomitanData && yomitanData.length > 0 && currentDictionaryIndex < yomitanData.length
                                    ? yomitanData[currentDictionaryIndex].reading
                                    : token.pronunciation}
                                )
                            </span>
                            <div
                                style={{
                                    fontSize: '1rem',
                                    marginTop: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                }}
                            >
                                <span>
                                    {token.pos
                                        .split(',')
                                        .filter((p) => p !== '*')
                                        .join(', ')}
                                </span>
                            </div>

                            {isLoading && (
                                <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '1rem' }}>
                                    Loading dictionary...
                                </div>
                            )}

                            {yomitanData && yomitanData.length > 0 ? (
                                renderYomitanEntries(yomitanData)
                            ) : !isLoading ? (
                                <div
                                    style={{ marginTop: '16px', textAlign: 'center', color: '#666', fontSize: '1rem' }}
                                >
                                    No dictionary entries found.
                                    <br />
                                    <span style={{ fontSize: '0.9rem' }}>
                                        Import dictionaries in Settings → Dictionary tab
                                    </span>
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <div>No token data available</div>
                    )}
                </Paper>
            </Popover>
        </ThemeProvider>
    );
};

export default SubtitleTokenPopup;
