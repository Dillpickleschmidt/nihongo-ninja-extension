import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { KagomeToken } from './model';
import SubtitleTokenPopup from '../components/SubtitleTokenPopup';

export class SubtitleTokenPopupManager {
    private container: HTMLDivElement | null = null;
    private root: Root | null = null;
    private isOpen: boolean = false;
    private anchorEl: HTMLElement | null = null;
    private token: KagomeToken | null = null;
    private activeElement: HTMLElement | null = null;

    initialize() {
        // Create popup container
        this.container = document.createElement('div');
        this.container.id = 'asbplayer-subtitle-popup-container';
        this.container.style.position = 'fixed';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.pointerEvents = 'none';
        document.body.appendChild(this.container);

        // Create React root
        this.root = createRoot(this.container);

        // Set up click event delegation
        document.addEventListener('click', this.handleTokenClick);
    }

    private handleTokenClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement;

        if (target && target.classList.contains('asbplayer-kagome-token')) {
            const tokenData = target.getAttribute('data-token');
            if (tokenData) {
                try {
                    const token: KagomeToken = JSON.parse(tokenData.replace(/&quot;/g, '"'));
                    // Skip tokens with part of speech starting with "記号" (symbols)
                    if (token.pos.startsWith('記号')) {
                        return;
                    }

                    // If clicking the same token that's currently active, close the popup
                    if (this.isOpen && this.activeElement === target) {
                        this.hidePopup();
                        return;
                    }

                    this.showPopup(target, token);
                } catch (error) {
                    console.error('Failed to parse token data:', error);
                }
            }
        } else if (this.isOpen && !target.closest('.MuiPopover-paper')) {
            // Click outside popup content when open - close it
            event.preventDefault();
            this.hidePopup();
        }
    };

    private showPopup(anchorEl: HTMLElement, token: KagomeToken) {
        // Remove active class from previous element
        if (this.activeElement) {
            this.activeElement.classList.remove('asbplayer-kagome-token-active');
        }

        // Set new active element and add active class
        this.activeElement = anchorEl;
        this.activeElement.classList.add('asbplayer-kagome-token-active');

        this.anchorEl = anchorEl;
        this.token = token;
        this.isOpen = true;
        this.render();
    }

    private hidePopup() {
        // Remove active class when closing popup
        if (this.activeElement) {
            this.activeElement.classList.remove('asbplayer-kagome-token-active');
            this.activeElement = null;
        }

        this.isOpen = false;
        this.anchorEl = null;
        this.token = null;
        this.render();
    }

    private render() {
        if (this.root) {
            this.root.render(
                React.createElement(SubtitleTokenPopup, {
                    open: this.isOpen,
                    anchorEl: this.anchorEl,
                    token: this.token,
                    onClose: () => this.hidePopup(),
                })
            );
        }
    }

    dispose() {
        // Clean up active class
        if (this.activeElement) {
            this.activeElement.classList.remove('asbplayer-kagome-token-active');
            this.activeElement = null;
        }

        document.removeEventListener('click', this.handleTokenClick);
        if (this.root) {
            this.root.unmount();
            this.root = null;
        }
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
            this.container = null;
        }
    }
}
