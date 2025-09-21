import React, { useState, useEffect } from 'react';
import Popover from '@mui/material/Popover';
import Paper from '@mui/material/Paper';
import VolumeUpRounded from '@mui/icons-material/VolumeUpRounded';
import VolumeDownRounded from '@mui/icons-material/VolumeDownRounded';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
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
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentWordIndex, setCurrentWordIndex] = useState(0);

    useEffect(() => {
        if (token) {
            setIsLoading(true);
            setJotobaData(null);
            setCurrentWordIndex(0);

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
            setIsPlaying(true);
            const audio = new Audio(`https://jotoba.de${audioPath}`);
            audio.addEventListener('ended', () => setIsPlaying(false));
            audio.play().catch((error) => {
                console.error('Failed to play audio:', error);
                setIsPlaying(false);
            });
        }
    };

    const renderJotobaWords = (words: JotobaWord[]) => {
        if (!words.length) return null;

        const currentWord = words[currentWordIndex] || words[0];
        const allMeanings = currentWord.senses.flatMap(sense => sense.glosses);

        return (
            <>
                <div style={{ marginTop: '12px', fontSize: '1.1rem' }}>
                    <div>
                        {allMeanings.slice(0, 3).map((meaning, meaningIndex) => (
                            <div key={meaningIndex} style={{ marginBottom: '4px' }}>
                                • {meaning}
                            </div>
                        ))}
                    </div>

                    {currentWord.pitch && currentWord.pitch.length > 0 && (
                        <div style={{ marginTop: '8px', fontSize: '1rem', color: '#666' }}>
                            Pitch: {currentWord.pitch.map((p) => p.part).join('')}
                        </div>
                    )}
                </div>

                {words.length > 1 && (
                    <div style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setCurrentWordIndex(Math.max(0, currentWordIndex - 1));
                            }}
                            disabled={currentWordIndex === 0}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: currentWordIndex === 0 ? 'default' : 'pointer',
                                opacity: currentWordIndex === 0 ? 0.3 : 1,
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                color: 'inherit'
                            }}
                            title="Previous definition"
                        >
                            <ChevronLeftRounded sx={{ fontSize: '1.5rem' }} />
                        </button>
                        <span style={{ fontSize: '0.9rem', color: '#666' }}>
                            {currentWordIndex + 1}/{words.length}
                        </span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setCurrentWordIndex(Math.min(words.length - 1, currentWordIndex + 1));
                            }}
                            disabled={currentWordIndex >= words.length - 1}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: currentWordIndex >= words.length - 1 ? 'default' : 'pointer',
                                opacity: currentWordIndex >= words.length - 1 ? 0.3 : 1,
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                color: 'inherit'
                            }}
                            title="Next definition"
                        >
                            <ChevronRightRounded sx={{ fontSize: '1.5rem' }} />
                        </button>
                    </div>
                )}
            </>
        );
    };

    const renderJotobaNames = (names: JotobaName[]) => {
        if (!names.length) return null;

        const firstName = names[0];
        return (
            <div style={{ marginTop: '12px', fontSize: '1.1rem' }}>
                {firstName.transcription && (
                    <div>Transcription: {firstName.transcription}</div>
                )}
                <div style={{ color: '#666' }}>Type: {firstName.name_type.join(', ')}</div>
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
                        width: 400,
                        height: 250,
                        padding: 2,
                        overflow: 'auto',
                    }}
                >
                    {token ? (
                        <div style={{ fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif', position: 'relative', height: '100%' }}>
                            <h2 style={{ display: 'inline', fontSize: '1.75rem', margin: 0 }}>
                                {currentWordIndex === 0
                                    ? token.surface_form
                                    : (jotobaData?.words && jotobaData.words[currentWordIndex]
                                        ? (jotobaData.words[currentWordIndex].reading.kanji || jotobaData.words[currentWordIndex].reading.kana)
                                        : token.surface_form)}
                            </h2>
                            <span style={{ color: '#666', marginLeft: '8px', fontSize: '1.25rem' }}>
                                ({currentWordIndex === 0
                                    ? token.pronunciation
                                    : (jotobaData?.words && jotobaData.words[currentWordIndex]
                                        ? jotobaData.words[currentWordIndex].reading.kana
                                        : token.pronunciation)})
                            </span>
                            <div style={{ fontSize: '1rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '16px', display: 'flex', alignItems: 'center' }}>
                                    {jotobaData?.words && jotobaData.words[currentWordIndex]?.audio && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                playAudio(jotobaData.words[currentWordIndex].audio);
                                            }}
                                            style={{
                                                border: 'none',
                                                background: 'transparent',
                                                cursor: 'pointer',
                                                padding: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'inherit'
                                            }}
                                            title="Play audio"
                                        >
                                            {isPlaying ? (
                                                <VolumeUpRounded sx={{ fontSize: '1.2rem' }} />
                                            ) : (
                                                <VolumeDownRounded sx={{ fontSize: '1.2rem' }} />
                                            )}
                                        </button>
                                    )}
                                </div>
                                {currentWordIndex === 0 && <span>{token.pos.split(',').filter(p => p !== '*').join(', ')}</span>}
                            </div>

                            {isLoading && (
                                <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '1rem' }}>
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
