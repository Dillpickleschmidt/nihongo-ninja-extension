/*
 * Minimal stub for EventListenerCollection
 */

export class EventListenerCollection {
    constructor() {
        this._listeners = [];
    }

    addEventListener(target, type, listener, options) {
        target.addEventListener(type, listener, options);
        this._listeners.push({ target, type, listener, options });
    }

    removeAllEventListeners() {
        for (const { target, type, listener, options } of this._listeners) {
            target.removeEventListener(type, listener, options);
        }
        this._listeners = [];
    }

    on(target, type, listener, options) {
        this.addEventListener(target, type, listener, options);
    }
}