import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { Trans, useTranslation } from 'react-i18next';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import CssBaseline from '@mui/material/CssBaseline';
import Paper from '@mui/material/Paper';
import { useI18n } from '../hooks/use-i18n';
import { createTheme } from '@project/common/theme';
import { makeStyles } from '@mui/styles';
import CenteredGridContainer from './CenteredGridContainer';
import CenteredGridItem from './CenteredGridItem';
import React, { useEffect, useState } from 'react';
import Tutorial from './Tutorial';

const useStyles = makeStyles({
    container: {
        scrollSnapType: 'y mandatory',
        width: '100dvw',
        height: '100dvh',
        overflowY: 'scroll',
    },
    child: {
        scrollSnapAlign: 'center',
        width: '100dvw',
        height: '100dvh',
    },
    welcomeContainer: {
        position: 'relative',
    },
    blurredBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `url(${browser.runtime.getURL('/assets/tutorial_bg.png')})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        filter: 'blur(16px)',
        opacity: 0.4,
        zIndex: 0,
        pointerEvents: 'none',
    },
    gradientOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(to bottom, transparent 0%, rgba(18, 18, 18, 1) 100%)',
        zIndex: 0.5,
        pointerEvents: 'none',
    },
    welcomeContent: {
        position: 'relative',
        zIndex: 1,
    },
});

const WelcomeMessage: React.FC<{ className: string; containerRef: HTMLDivElement | null }> = ({
    className,
    containerRef,
}) => {
    const { t } = useTranslation();
    const classes = useStyles();

    const handleGetStarted = () => {
        if (containerRef) {
            containerRef.scrollTo({ top: containerRef.scrollHeight, behavior: 'smooth' });
        }
    };

    return (
        <CenteredGridContainer className={`${className} ${classes.welcomeContainer}`} direction="column">
            <div className={classes.blurredBackground} />
            <div className={classes.gradientOverlay} />
            <div className={classes.welcomeContent}>
                <CenteredGridItem>
                    <img style={{ width: 75 }} src={browser.runtime.getURL('/icon/image.png')} />
                </CenteredGridItem>
                <CenteredGridItem>
                    <Typography variant="h5">{t('ftue.welcome')}</Typography>
                </CenteredGridItem>
                <CenteredGridItem>
                    <Typography variant="h6">
                        <Trans
                            i18nKey="ftue.welcomeBody2"
                            components={[
                                <Link
                                    key={0}
                                    color="primary"
                                    target="_blank"
                                    rel="noreferrer"
                                    href={'https://docs.asbplayer.dev/docs/intro/'}
                                >
                                    user guide
                                </Link>,
                            ]}
                        />
                    </Typography>
                </CenteredGridItem>
                <CenteredGridItem sx={{ marginTop: 2 }}>
                    <Button variant="contained" color="primary" size="large" onClick={handleGetStarted}>
                        Get Started
                    </Button>
                </CenteredGridItem>
            </div>
        </CenteredGridContainer>
    );
};

const useLangParam = () => {
    const [lang, setLang] = useState<string>();
    useEffect(() => setLang(new URLSearchParams(window.location.search).get('lang') ?? undefined), []);
    return lang;
};

const FtueUi = () => {
    const theme = createTheme('dark');
    const langParam = useLangParam();
    const { initialized: i18Initialized } = useI18n({ language: langParam ?? browser.i18n.getUILanguage() });
    const classes = useStyles();
    const [showTutorial, setShowTutorial] = useState<boolean>(false);
    const [hideWelcomePanel, setHideWelcomePanel] = useState<boolean>(false);
    const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);

    const handleContainerRef = (elm: HTMLDivElement | null) => {
        if (!elm) {
            return;
        }

        setContainerRef(elm);

        elm.onscrollend = () => {
            if (elm.scrollTop > (window.innerHeight * 3) / 4) {
                setHideWelcomePanel(true);
                setShowTutorial(true);
            }
        };
    };

    if (!i18Initialized) {
        return null;
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Paper ref={handleContainerRef} className={classes.container} square>
                {!hideWelcomePanel && <WelcomeMessage className={classes.child} containerRef={containerRef} />}
                <Tutorial show={showTutorial} className={classes.child} />
            </Paper>
        </ThemeProvider>
    );
};

export default FtueUi;
