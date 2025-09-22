import React, { useState, useEffect } from 'react';
import Popover from '@mui/material/Popover';
import Paper from '@mui/material/Paper';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '../theme';
import { KagomeToken } from '../src/model';
import './YomitanPopup.css';


// Import Yomitan's exact format from the service
import { TermDictionaryEntry } from '../../extension/src/services/yomitan-dictionary-service';

interface SubtitleTokenPopupProps {
    open: boolean;
    anchorEl: HTMLElement | null;
    token: KagomeToken | null;
    onClose: () => void;
    themeType?: string;
    onLookupYomitan?: (term: string) => Promise<TermDictionaryEntry[]>;
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
    const [yomitanData, setYomitanData] = useState<TermDictionaryEntry[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);


    useEffect(() => {
        if (token) {
            setIsLoading(true);
            setYomitanData(null);

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

    const containerRef = React.useRef<HTMLDivElement>(null);
    const [displayGenerator, setDisplayGenerator] = useState<any>(null);

    // Initialize Yomitan display generator
    useEffect(() => {
        const initializeDisplay = async () => {
            try {
                const { DisplayContentManager } = await import('../src/yomitan/js/display/display-content-manager');
                const { DisplayGenerator } = await import('../src/yomitan/js/display/display-generator');

                const contentManager = new DisplayContentManager();
                const generator = new DisplayGenerator(contentManager, null);
                await generator.prepare();

                // Set theme on document root for CSS variables
                document.documentElement.setAttribute('data-theme', themeType);

                // Load Yomitan CSS files
                const cssFiles = [
                    '/yomitan/css/material.css',
                    '/yomitan/css/display.css',
                    '/yomitan/css/display-pronunciation.css',
                    '/yomitan/css/structured-content.css'
                ];

                // Check if CSS is already loaded to avoid duplicates
                const existingLinks = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]')).map(
                    link => (link as HTMLLinkElement).href
                );

                for (const file of cssFiles) {
                    const url = chrome.runtime.getURL(file);
                    if (!existingLinks.some(href => href.includes(file))) {
                        const link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.type = 'text/css';
                        link.href = url;
                        document.head.appendChild(link);
                    }
                }

                setDisplayGenerator(generator);
            } catch (error) {
                console.error('Failed to initialize Yomitan display generator:', error);
            }
        };

        initializeDisplay();

        // Cleanup: remove theme attribute when component unmounts
        return () => {
            document.documentElement.removeAttribute('data-theme');
        };
    }, [themeType]);

    // Render Yomitan entries using display generator
    useEffect(() => {
        if (!displayGenerator || !containerRef.current || !yomitanData || yomitanData.length === 0) {
            return;
        }

        try {
            // Clear existing content
            containerRef.current.innerHTML = '';

            // Render all entries using Yomitan's display generator
            yomitanData.forEach((entry, index) => {
                const entryNode = displayGenerator.createTermEntry(entry, []);
                if (entryNode) {
                    containerRef.current!.appendChild(entryNode);
                } else {
                    console.error(`Failed to create entry node for entry ${index}`);
                }
            });
        } catch (error) {
            console.error('Failed to render Yomitan entries:', error);
        }
    }, [displayGenerator, yomitanData]);

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
                        padding: 0,
                        overflow: 'auto',
                    }}
                >
                    {token ? (
                        <div
                            style={{
                                fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                                position: 'relative',
                                height: '100%',
                                fontSize: '14px',
                                lineHeight: '1.43',
                            }}
                        >
                            <div className="entry">

                                {isLoading && (
                                    <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '1rem' }}>
                                        Loading dictionary...
                                    </div>
                                )}

                                {!isLoading && (!yomitanData || yomitanData.length === 0) && (
                                    <div
                                        style={{ marginTop: '16px', textAlign: 'center', color: '#666', fontSize: '1rem' }}
                                    >
                                        No dictionary entries found.
                                        <br />
                                        <span style={{ fontSize: '0.9rem' }}>
                                            Import dictionaries in Settings → Dictionary tab
                                        </span>
                                    </div>
                                )}

                                <div ref={containerRef} className="yomitan-dictionary-display" data-theme={themeType} />
                            </div>
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
