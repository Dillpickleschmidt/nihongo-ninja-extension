import React from 'react';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import { KagomeToken } from '../src/model';

interface SubtitleTokenPopupProps {
    open: boolean;
    anchorEl: HTMLElement | null;
    token: KagomeToken | null;
    onClose: () => void;
}

const SubtitleTokenPopup: React.FC<SubtitleTokenPopupProps> = ({ open, anchorEl, token, onClose }) => {
    return (
        <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{
                vertical: 'top',
                horizontal: 'center',
            }}
            transformOrigin={{
                vertical: 'bottom',
                horizontal: 'center',
            }}
        >
            <Paper
                sx={{
                    width: 400,
                    height: 300,
                    padding: 2,
                }}
            >
                {token ? (
                    <div>
                        <Typography variant="h6" gutterBottom>
                            {token.surface_form}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Reading: {token.reading}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Base Form: {token.base_form}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Part of Speech: {token.pos}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Pronunciation: {token.pronunciation}
                        </Typography>
                    </div>
                ) : (
                    <Typography>No token data available</Typography>
                )}
            </Paper>
        </Popover>
    );
};

export default SubtitleTokenPopup;

