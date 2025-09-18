import React, { useState, useEffect } from 'react';
import Popover from '@mui/material/Popover';
import Paper from '@mui/material/Paper';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '../theme';
import { KagomeToken } from '../src/model';
import { JotobaApiService, JotobaWord, JotobaName } from '../src/jotoba-api';

interface SubtitleTokenPopupProps {
    open: boolean;
    anchorEl: HTMLElement | null;
    token: KagomeToken | null;
    onClose: () => void;
    themeType?: string;
}

const SubtitleTokenPopup: React.FC<SubtitleTokenPopupProps> = ({
    open,
    anchorEl,
    token,
    onClose,
    themeType = 'dark',
}) => {
    const theme = createTheme(themeType as 'dark' | 'light');
    const [jotobaData, setJotobaData] = useState<{ words?: JotobaWord[]; names?: JotobaName[] } | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (token) {
            setIsLoading(true);
            setJotobaData(null);

            JotobaApiService.searchBasedOnToken(token.surface_form, token.pos)
                .then((data) => {
                    setJotobaData(data);
                })
                .catch((error) => {
                    console.error('Failed to fetch Jotoba data:', error);
                    setJotobaData(null);
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, [token]);

    const playAudio = (audioPath: string) => {
        if (audioPath) {
            const audio = new Audio(`https://jotoba.de${audioPath}`);
            audio.play().catch((error) => {
                console.error('Failed to play audio:', error);
            });
        }
    };

    const renderJotobaWords = (words: JotobaWord[]) => {
        if (!words.length) return null;

        const firstWord = words[0];
        const allMeanings = firstWord.senses.flatMap(sense => sense.glosses);

        return (
            <div>
                {firstWord.audio && (
                    <button
                        onClick={() => playAudio(firstWord.audio)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                    >
                        🔊
                    </button>
                )}

                <div>
                    {allMeanings.slice(0, 5).map((meaning, meaningIndex) => (
                        <div key={meaningIndex}>
                            • {meaning}
                        </div>
                    ))}
                </div>

                {firstWord.pitch && firstWord.pitch.length > 0 && (
                    <div>
                        Pitch: {firstWord.pitch.map((p) => p.part).join('')}
                    </div>
                )}
            </div>
        );
    };

    const renderJotobaNames = (names: JotobaName[]) => {
        if (!names.length) return null;

        const firstName = names[0];
        return (
            <div>
                {firstName.transcription && (
                    <div>Transcription: {firstName.transcription}</div>
                )}
                <div>Type: {firstName.name_type.join(', ')}</div>
            </div>
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
                        width: 450,
                        height: 400,
                        padding: 2,
                        overflow: 'auto',
                    }}
                >
                    {token ? (
                        <div>
                            <h2>{token.surface_form}</h2>
                            <div style={{ color: '#666' }}>
                                Part of Speech: {token.pos}
                            </div>
                            <div style={{ color: '#666' }}>
                                Pronunciation: {token.pronunciation}
                            </div>

                            {isLoading && (
                                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                    Loading...
                                </div>
                            )}

                            {jotobaData?.words && renderJotobaWords(jotobaData.words)}
                            {jotobaData?.names && renderJotobaNames(jotobaData.names)}
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
