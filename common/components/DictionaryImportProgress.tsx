import React from 'react';
import { makeStyles } from '@mui/styles';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';

const useStyles = makeStyles({
    container: {
        marginTop: 24,
        padding: 16,
        backgroundColor: 'rgba(25, 103, 210, 0.08)',
        borderRadius: 4,
        border: '1px solid rgba(25, 103, 210, 0.2)',
    },
    labels: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    info: {
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    status: {
        marginLeft: 8,
        minWidth: 45,
        textAlign: 'right',
    },
    progressBar: {
        height: 6,
        borderRadius: 3,
    },
});

export interface DictionaryImportProgressProps {
    visible: boolean;
    stepInfo: string;
    percentage: number;
}

const DictionaryImportProgress: React.FC<DictionaryImportProgressProps> = ({
    visible,
    stepInfo,
    percentage,
}) => {
    const classes = useStyles();

    if (!visible) {
        return null;
    }

    return (
        <Box className={classes.container}>
            <Box className={classes.labels}>
                <Typography variant="body2" className={classes.info}>
                    {stepInfo}
                </Typography>
                <Typography variant="body2" className={classes.status}>
                    {Math.round(percentage)}%
                </Typography>
            </Box>
            <LinearProgress
                variant="determinate"
                value={percentage}
                classes={{ root: classes.progressBar }}
            />
        </Box>
    );
};

export default DictionaryImportProgress;
