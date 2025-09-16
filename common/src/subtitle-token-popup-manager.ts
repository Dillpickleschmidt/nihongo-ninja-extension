import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { KagomeToken } from './model';
import SubtitleTokenPopup from '../components/SubtitleTokenPopup';
import { SettingsProvider } from '../settings';
import { ExtensionSettingsStorage } from '../../extension/src/services/extension-settings-storage';

export class SubtitleTokenPopupManager {
    private container: HTMLDivElement | null = null;
    private root: Root | null = null;
    private isOpen: boolean = false;
    private anchorEl: HTMLElement | null = null;
    private token: KagomeToken | null = null;
    private hoveredElement: HTMLElement | null = null;
    private shiftPressed: boolean = false;
    private clearTokenTimeout: number | null = null;
    private settings: SettingsProvider;

    initialize() {
        this.settings = new SettingsProvider(new ExtensionSettingsStorage());
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

        // Set up keyboard and hover tracking
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
        document.addEventListener('mouseover', this.handleMouseOver);
        document.addEventListener('mouseout', this.handleMouseOut);
    }

    private handleTokenClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement;

        if (target && target.classList.contains('asbplayer-kagome-token')) {
            this.tryShowPopup(target);
        } else if (this.isOpen && !target.closest('.MuiPopover-paper')) {
            // Click outside popup content when open - close it
            event.preventDefault();
            this.hidePopup();
        }
    };

    private handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Shift' && !this.shiftPressed) {
            this.shiftPressed = true;

            if (this.hoveredElement?.classList.contains('asbplayer-kagome-token')) {
                this.tryShowPopup(this.hoveredElement);
            } else if (this.isOpen) {
                this.hidePopup();
            }
        }
    };

    private handleKeyUp = (event: KeyboardEvent) => {
        if (event.key === 'Shift') {
            this.shiftPressed = false;
        }
    };

    private handleMouseOver = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (target?.classList.contains('asbplayer-kagome-token')) {
            this.hoveredElement = target;
        }
    };

    private handleMouseOut = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (target?.classList.contains('asbplayer-kagome-token')) {
            this.hoveredElement = null;
        }
    };

    private tryShowPopup(element: HTMLElement) {
        const tokenData = element.getAttribute('data-token');
        if (!tokenData) return;

        try {
            const token: KagomeToken = JSON.parse(tokenData.replace(/&quot;/g, '"'));

            // Skip tokens with part of speech starting with "記号" (symbols)
            if (token.pos.startsWith('記号')) {
                return;
            }

            // If targeting the same token that's currently active, close the popup
            if (this.isOpen && this.anchorEl === element) {
                this.hidePopup();
                return;
            }

            this.showPopup(element, token);
        } catch (error) {
            console.error('Failed to parse token data:', error);
        }
    }

    private showPopup(anchorEl: HTMLElement, token: KagomeToken) {
        // Cancel any pending token clear timeout since we're showing new content
        if (this.clearTokenTimeout) {
            clearTimeout(this.clearTokenTimeout);
            this.clearTokenTimeout = null;
        }

        // Remove active class from previous element
        if (this.anchorEl) {
            this.anchorEl.classList.remove('asbplayer-kagome-token-active');
        }

        // Set new active element and add active class
        this.anchorEl = anchorEl;
        this.anchorEl.classList.add('asbplayer-kagome-token-active');

        this.token = token;
        this.isOpen = true;
        this.render();
    }

    private hidePopup() {
        // Remove active class when closing popup
        if (this.anchorEl) {
            this.anchorEl.classList.remove('asbplayer-kagome-token-active');
        }

        this.isOpen = false;
        this.anchorEl = null;

        // Delay clearing token data to let the close animation complete
        this.clearTokenTimeout = window.setTimeout(() => {
            this.token = null;
            this.render();
        }, 300);

        // Render immediately to hide the popup, but keep token data for animation
        this.render();
    }

    private async render() {
        if (this.root) {
            let themeType = 'dark';
            try {
                themeType = await this.settings.getSingle('themeType');
            } catch (error) {
                // Keep default 'dark'
            }

            this.root.render(
                React.createElement(SubtitleTokenPopup, {
                    open: this.isOpen,
                    anchorEl: this.anchorEl,
                    token: this.token,
                    onClose: () => this.hidePopup(),
                    themeType,
                })
            );
        }
    }

    dispose() {
        // Clean up active class
        if (this.anchorEl) {
            this.anchorEl.classList.remove('asbplayer-kagome-token-active');
        }

        // Clean up any pending timeout
        if (this.clearTokenTimeout) {
            clearTimeout(this.clearTokenTimeout);
            this.clearTokenTimeout = null;
        }

        document.removeEventListener('click', this.handleTokenClick);
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        document.removeEventListener('mouseover', this.handleMouseOver);
        document.removeEventListener('mouseout', this.handleMouseOut);
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
