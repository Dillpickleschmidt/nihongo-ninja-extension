import { Command, Message } from '@project/common';

interface KagomeAnalysisMessage extends Message {
    readonly command: 'kagome-analysis';
    readonly texts: string[];
}

declare global {
    function kagome_tokenize(text: string): any[];
}

let kagomeLoaded = false;
let loadPromise: Promise<void> | null = null;

// Service worker compatible Go runtime initialization
function initGoRuntime() {
    const enosys = () => {
        const err = new Error('not implemented');
        err.code = 'ENOSYS';
        return err;
    };

    // Initialize required globals for Go WASM
    if (!self.fs) {
        let outputBuf = '';
        const encoder = new TextEncoder('utf-8');
        const decoder = new TextDecoder('utf-8');

        self.fs = {
            constants: {
                O_WRONLY: -1,
                O_RDWR: -1,
                O_CREAT: -1,
                O_TRUNC: -1,
                O_APPEND: -1,
                O_EXCL: -1,
                O_DIRECTORY: -1,
            },
            writeSync(fd: number, buf: Uint8Array) {
                outputBuf += decoder.decode(buf);
                const nl = outputBuf.lastIndexOf('\n');
                if (nl != -1) {
                    console.log(outputBuf.substring(0, nl));
                    outputBuf = outputBuf.substring(nl + 1);
                }
                return buf.length;
            },
            write(fd: number, buf: Uint8Array, offset: number, length: number, position: any, callback: Function) {
                if (offset !== 0 || length !== buf.length || position !== null) {
                    callback(enosys());
                    return;
                }
                const n = this.writeSync(fd, buf);
                callback(null, n);
            },
            chmod: (path: string, mode: number, callback: Function) => callback(enosys()),
            chown: (path: string, uid: number, gid: number, callback: Function) => callback(enosys()),
            close: (fd: number, callback: Function) => callback(enosys()),
            fchmod: (fd: number, mode: number, callback: Function) => callback(enosys()),
            fchown: (fd: number, uid: number, gid: number, callback: Function) => callback(enosys()),
            fstat: (fd: number, callback: Function) => callback(enosys()),
            fsync: (fd: number, callback: Function) => callback(null),
            ftruncate: (fd: number, length: number, callback: Function) => callback(enosys()),
            lchown: (path: string, uid: number, gid: number, callback: Function) => callback(enosys()),
            link: (path: string, link: string, callback: Function) => callback(enosys()),
            lstat: (path: string, callback: Function) => callback(enosys()),
            mkdir: (path: string, perm: number, callback: Function) => callback(enosys()),
            open: (path: string, flags: number, mode: number, callback: Function) => callback(enosys()),
            read: (fd: number, buffer: Uint8Array, offset: number, length: number, position: any, callback: Function) =>
                callback(enosys()),
            readdir: (path: string, callback: Function) => callback(enosys()),
            readlink: (path: string, callback: Function) => callback(enosys()),
            rename: (from: string, to: string, callback: Function) => callback(enosys()),
            rmdir: (path: string, callback: Function) => callback(enosys()),
            stat: (path: string, callback: Function) => callback(enosys()),
            symlink: (path: string, link: string, callback: Function) => callback(enosys()),
            truncate: (path: string, length: number, callback: Function) => callback(enosys()),
            unlink: (path: string, callback: Function) => callback(enosys()),
            utimes: (path: string, atime: number, mtime: number, callback: Function) => callback(enosys()),
        };
    }

    if (!self.process) {
        self.process = {
            getuid: () => -1,
            getgid: () => -1,
            geteuid: () => -1,
            getegid: () => -1,
            getgroups: () => {
                throw enosys();
            },
            pid: -1,
            ppid: -1,
            umask: () => {
                throw enosys();
            },
            cwd: () => {
                throw enosys();
            },
            chdir: () => {
                throw enosys();
            },
        };
    }

    if (!self.path) {
        self.path = {
            resolve(...pathSegments: string[]) {
                return pathSegments.join('/');
            },
        };
    }
}

// Complete Go WASM Runtime Class (adapted from official wasm_exec.js)
class Go {
    argv: string[];
    env: Record<string, string>;
    exit: (code: number) => void;
    _exitPromise: Promise<void>;
    _resolveExitPromise: () => void;
    _pendingEvent: any;
    _scheduledTimeouts: Map<number, any>;
    _nextCallbackTimeoutID: number;
    importObject: any;
    _inst: WebAssembly.Instance;
    mem: DataView;
    _values: any[];
    _goRefCounts: number[];
    _ids: Map<any, number>;
    _idPool: number[];
    exited: boolean;

    constructor() {
        this.argv = ['js'];
        this.env = {};
        this.exit = (code: number) => {
            if (code !== 0) {
                console.warn('exit code:', code);
            }
        };
        this._exitPromise = new Promise((resolve) => {
            this._resolveExitPromise = resolve;
        });
        this._pendingEvent = null;
        this._scheduledTimeouts = new Map();
        this._nextCallbackTimeoutID = 1;

        const encoder = new TextEncoder('utf-8');
        const decoder = new TextDecoder('utf-8');

        const setInt64 = (addr: number, v: number) => {
            this.mem.setUint32(addr + 0, v, true);
            this.mem.setUint32(addr + 4, Math.floor(v / 4294967296), true);
        };

        const setInt32 = (addr: number, v: number) => {
            this.mem.setUint32(addr + 0, v, true);
        };

        const getInt64 = (addr: number) => {
            const low = this.mem.getUint32(addr + 0, true);
            const high = this.mem.getInt32(addr + 4, true);
            return low + high * 4294967296;
        };

        const loadValue = (addr: number) => {
            const f = this.mem.getFloat64(addr, true);
            if (f === 0) {
                return undefined;
            }
            if (!isNaN(f)) {
                return f;
            }

            const id = this.mem.getUint32(addr, true);
            return this._values[id];
        };

        const storeValue = (addr: number, v: any) => {
            const nanHead = 0x7ff80000;

            if (typeof v === 'number' && v !== 0) {
                if (isNaN(v)) {
                    this.mem.setUint32(addr + 4, nanHead, true);
                    this.mem.setUint32(addr, 0, true);
                    return;
                }
                this.mem.setFloat64(addr, v, true);
                return;
            }

            if (v === undefined) {
                this.mem.setFloat64(addr, 0, true);
                return;
            }

            let id = this._ids.get(v);
            if (id === undefined) {
                id = this._idPool.pop();
                if (id === undefined) {
                    id = this._values.length;
                }
                this._values[id] = v;
                this._goRefCounts[id] = 0;
                this._ids.set(v, id);
            }
            this._goRefCounts[id]++;
            let typeFlag = 0;
            switch (typeof v) {
                case 'object':
                    if (v !== null) {
                        typeFlag = 1;
                    }
                    break;
                case 'string':
                    typeFlag = 2;
                    break;
                case 'symbol':
                    typeFlag = 3;
                    break;
                case 'function':
                    typeFlag = 4;
                    break;
            }
            this.mem.setUint32(addr + 4, nanHead | typeFlag, true);
            this.mem.setUint32(addr, id, true);
        };

        const loadSlice = (addr: number) => {
            const array = getInt64(addr + 0);
            const len = getInt64(addr + 8);
            return new Uint8Array(this._inst.exports.mem.buffer, array, len);
        };

        const loadSliceOfValues = (addr: number) => {
            const array = getInt64(addr + 0);
            const len = getInt64(addr + 8);
            const a = new Array(len);
            for (let i = 0; i < len; i++) {
                a[i] = loadValue(array + i * 8);
            }
            return a;
        };

        const loadString = (addr: number) => {
            const saddr = getInt64(addr + 0);
            const len = getInt64(addr + 8);
            return decoder.decode(new DataView(this._inst.exports.mem.buffer, saddr, len));
        };

        const testCallExport = (a: any, b: any) => {
            this._inst.exports.testExport0();
            return this._inst.exports.testExport(a, b);
        };

        const timeOrigin = Date.now() - performance.now();
        this.importObject = {
            _gotest: {
                add: (a: number, b: number) => a + b,
                callExport: testCallExport,
            },
            gojs: {
                // func wasmExit(code int32)
                'runtime.wasmExit': (sp: number) => {
                    sp >>>= 0;
                    const code = this.mem.getInt32(sp + 8, true);
                    this.exited = true;
                    delete this._inst;
                    delete this._values;
                    delete this._goRefCounts;
                    delete this._ids;
                    delete this._idPool;
                    this.exit(code);
                },

                // func wasmWrite(fd uintptr, p unsafe.Pointer, n int32)
                'runtime.wasmWrite': (sp: number) => {
                    sp >>>= 0;
                    const fd = getInt64(sp + 8);
                    const p = getInt64(sp + 16);
                    const n = this.mem.getInt32(sp + 24, true);
                    self.fs.writeSync(fd, new Uint8Array(this._inst.exports.mem.buffer, p, n));
                },

                // func resetMemoryDataView()
                'runtime.resetMemoryDataView': (sp: number) => {
                    sp >>>= 0;
                    this.mem = new DataView(this._inst.exports.mem.buffer);
                },

                // func nanotime1() int64
                'runtime.nanotime1': (sp: number) => {
                    sp >>>= 0;
                    setInt64(sp + 8, (timeOrigin + performance.now()) * 1000000);
                },

                // func walltime() (sec int64, nsec int32)
                'runtime.walltime': (sp: number) => {
                    sp >>>= 0;
                    const msec = new Date().getTime();
                    setInt64(sp + 8, msec / 1000);
                    this.mem.setInt32(sp + 16, (msec % 1000) * 1000000, true);
                },

                // func scheduleTimeoutEvent(delay int64) int32
                'runtime.scheduleTimeoutEvent': (sp: number) => {
                    sp >>>= 0;
                    const id = this._nextCallbackTimeoutID;
                    this._nextCallbackTimeoutID++;
                    this._scheduledTimeouts.set(
                        id,
                        setTimeout(
                            () => {
                                this._resume();
                                while (this._scheduledTimeouts.has(id)) {
                                    // for some reason Go failed to register the timeout event, log and try again
                                    // (temporary workaround for https://github.com/golang/go/issues/28975)
                                    console.warn('scheduleTimeoutEvent: missed timeout event');
                                    this._resume();
                                }
                            },
                            getInt64(sp + 8)
                        )
                    );
                    this.mem.setInt32(sp + 16, id, true);
                },

                // func clearTimeoutEvent(id int32)
                'runtime.clearTimeoutEvent': (sp: number) => {
                    sp >>>= 0;
                    const id = this.mem.getInt32(sp + 8, true);
                    clearTimeout(this._scheduledTimeouts.get(id));
                    this._scheduledTimeouts.delete(id);
                },

                // func getRandomData(r []byte)
                'runtime.getRandomData': (sp: number) => {
                    sp >>>= 0;
                    crypto.getRandomValues(loadSlice(sp + 8));
                },

                // func finalizeRef(v ref)
                'syscall/js.finalizeRef': (sp: number) => {
                    sp >>>= 0;
                    const id = this.mem.getUint32(sp + 8, true);
                    this._goRefCounts[id]--;
                    if (this._goRefCounts[id] === 0) {
                        const v = this._values[id];
                        this._values[id] = null;
                        this._ids.delete(v);
                        this._idPool.push(id);
                    }
                },

                // func stringVal(value string) ref
                'syscall/js.stringVal': (sp: number) => {
                    sp >>>= 0;
                    storeValue(sp + 24, loadString(sp + 8));
                },

                // func valueGet(v ref, p string) ref
                'syscall/js.valueGet': (sp: number) => {
                    sp >>>= 0;
                    const result = Reflect.get(loadValue(sp + 8), loadString(sp + 16));
                    sp = this._inst.exports.getsp() >>> 0; // see comment above
                    storeValue(sp + 32, result);
                },

                // func valueSet(v ref, p string, x ref)
                'syscall/js.valueSet': (sp: number) => {
                    sp >>>= 0;
                    Reflect.set(loadValue(sp + 8), loadString(sp + 16), loadValue(sp + 32));
                },

                // func valueDelete(v ref, p string)
                'syscall/js.valueDelete': (sp: number) => {
                    sp >>>= 0;
                    Reflect.deleteProperty(loadValue(sp + 8), loadString(sp + 16));
                },

                // func valueIndex(v ref, i int) ref
                'syscall/js.valueIndex': (sp: number) => {
                    sp >>>= 0;
                    storeValue(sp + 24, Reflect.get(loadValue(sp + 8), getInt64(sp + 16)));
                },

                // valueSetIndex(v ref, i int, x ref)
                'syscall/js.valueSetIndex': (sp: number) => {
                    sp >>>= 0;
                    Reflect.set(loadValue(sp + 8), getInt64(sp + 16), loadValue(sp + 24));
                },

                // func valueCall(v ref, m string, args []ref) (ref, bool)
                'syscall/js.valueCall': (sp: number) => {
                    sp >>>= 0;
                    try {
                        const v = loadValue(sp + 8);
                        const m = Reflect.get(v, loadString(sp + 16));
                        const args = loadSliceOfValues(sp + 32);
                        const result = Reflect.apply(m, v, args);
                        sp = this._inst.exports.getsp() >>> 0; // see comment above
                        storeValue(sp + 56, result);
                        this.mem.setUint8(sp + 64, 1);
                    } catch (err) {
                        sp = this._inst.exports.getsp() >>> 0; // see comment above
                        storeValue(sp + 56, err);
                        this.mem.setUint8(sp + 64, 0);
                    }
                },

                // func valueInvoke(v ref, args []ref) (ref, bool)
                'syscall/js.valueInvoke': (sp: number) => {
                    sp >>>= 0;
                    try {
                        const v = loadValue(sp + 8);
                        const args = loadSliceOfValues(sp + 16);
                        const result = Reflect.apply(v, undefined, args);
                        sp = this._inst.exports.getsp() >>> 0; // see comment above
                        storeValue(sp + 40, result);
                        this.mem.setUint8(sp + 48, 1);
                    } catch (err) {
                        sp = this._inst.exports.getsp() >>> 0; // see comment above
                        storeValue(sp + 40, err);
                        this.mem.setUint8(sp + 48, 0);
                    }
                },

                // func valueNew(v ref, args []ref) (ref, bool)
                'syscall/js.valueNew': (sp: number) => {
                    sp >>>= 0;
                    try {
                        const v = loadValue(sp + 8);
                        const args = loadSliceOfValues(sp + 16);
                        const result = Reflect.construct(v, args);
                        sp = this._inst.exports.getsp() >>> 0; // see comment above
                        storeValue(sp + 40, result);
                        this.mem.setUint8(sp + 48, 1);
                    } catch (err) {
                        sp = this._inst.exports.getsp() >>> 0; // see comment above
                        storeValue(sp + 40, err);
                        this.mem.setUint8(sp + 48, 0);
                    }
                },

                // func valueLength(v ref) int
                'syscall/js.valueLength': (sp: number) => {
                    sp >>>= 0;
                    setInt64(sp + 16, parseInt(loadValue(sp + 8).length));
                },

                // valuePrepareString(v ref) (ref, int)
                'syscall/js.valuePrepareString': (sp: number) => {
                    sp >>>= 0;
                    const str = encoder.encode(String(loadValue(sp + 8)));
                    storeValue(sp + 16, str);
                    setInt64(sp + 24, str.length);
                },

                // valueLoadString(v ref, b []byte)
                'syscall/js.valueLoadString': (sp: number) => {
                    sp >>>= 0;
                    const str = loadValue(sp + 8);
                    loadSlice(sp + 16).set(str);
                },

                // func valueInstanceOf(v ref, t ref) bool
                'syscall/js.valueInstanceOf': (sp: number) => {
                    sp >>>= 0;
                    this.mem.setUint8(sp + 24, loadValue(sp + 8) instanceof loadValue(sp + 16) ? 1 : 0);
                },

                // func copyBytesToGo(dst []byte, src ref) (int, bool)
                'syscall/js.copyBytesToGo': (sp: number) => {
                    sp >>>= 0;
                    const dst = loadSlice(sp + 8);
                    const src = loadValue(sp + 32);
                    if (!(src instanceof Uint8Array || src instanceof Uint8ClampedArray)) {
                        this.mem.setUint8(sp + 48, 0);
                        return;
                    }
                    const toCopy = src.subarray(0, dst.length);
                    dst.set(toCopy);
                    setInt64(sp + 40, toCopy.length);
                    this.mem.setUint8(sp + 48, 1);
                },

                // func copyBytesToJS(dst ref, src []byte) (int, bool)
                'syscall/js.copyBytesToJS': (sp: number) => {
                    sp >>>= 0;
                    const dst = loadValue(sp + 8);
                    const src = loadSlice(sp + 16);
                    if (!(dst instanceof Uint8Array || dst instanceof Uint8ClampedArray)) {
                        this.mem.setUint8(sp + 48, 0);
                        return;
                    }
                    const toCopy = src.subarray(0, dst.length);
                    dst.set(toCopy);
                    setInt64(sp + 40, toCopy.length);
                    this.mem.setUint8(sp + 48, 1);
                },

                debug: (value: any) => {
                    console.log(value);
                },
            },
        };
    }

    async run(instance: WebAssembly.Instance) {
        if (!(instance instanceof WebAssembly.Instance)) {
            throw new Error('Go.run: WebAssembly.Instance expected');
        }
        this._inst = instance;
        this.mem = new DataView(this._inst.exports.mem.buffer);
        this._values = [
            // JS values that Go currently has references to, indexed by reference id
            NaN,
            0,
            null,
            true,
            false,
            self, // Use self instead of globalThis for service worker
            this,
        ];
        this._goRefCounts = new Array(this._values.length).fill(Infinity); // number of references that Go has to a JS value, indexed by reference id
        this._ids = new Map([
            // mapping from JS values to reference ids
            [0, 1],
            [null, 2],
            [true, 3],
            [false, 4],
            [self, 5], // Use self instead of globalThis
            [this, 6],
        ]);
        this._idPool = []; // unused ids that have been garbage collected
        this.exited = false; // whether the Go program has exited

        // Pass command line arguments and environment variables to WebAssembly by writing them to the linear memory.
        const encoder = new TextEncoder('utf-8');
        let offset = 4096;

        const strPtr = (str: string) => {
            const ptr = offset;
            const bytes = encoder.encode(str + '\0');
            new Uint8Array(this.mem.buffer, offset, bytes.length).set(bytes);
            offset += bytes.length;
            if (offset % 8 !== 0) {
                offset += 8 - (offset % 8);
            }
            return ptr;
        };

        const argc = this.argv.length;

        const argvPtrs: number[] = [];
        this.argv.forEach((arg) => {
            argvPtrs.push(strPtr(arg));
        });
        argvPtrs.push(0);

        const keys = Object.keys(this.env).sort();
        keys.forEach((key) => {
            argvPtrs.push(strPtr(`${key}=${this.env[key]}`));
        });
        argvPtrs.push(0);

        const argv = offset;
        argvPtrs.forEach((ptr) => {
            this.mem.setUint32(offset, ptr, true);
            this.mem.setUint32(offset + 4, 0, true);
            offset += 8;
        });

        // The linker guarantees global data starts from at least wasmMinDataAddr.
        // Keep in sync with cmd/link/internal/ld/data.go:wasmMinDataAddr.
        const wasmMinDataAddr = 4096 + 8192;
        if (offset >= wasmMinDataAddr) {
            throw new Error('total length of command line and environment variables exceeds limit');
        }

        this._inst.exports.run(argc, argv);
        if (this.exited) {
            this._resolveExitPromise();
        }
        await this._exitPromise;
    }

    _resume() {
        if (this.exited) {
            throw new Error('Go program has already exited');
        }
        this._inst.exports.resume();
        if (this.exited) {
            this._resolveExitPromise();
        }
    }

    _makeFuncWrapper(id: number) {
        const go = this;
        return function () {
            const event = { id: id, this: this, args: arguments };
            go._pendingEvent = event;
            go._resume();
            return event.result;
        };
    }
}

async function loadKagomeWasm() {
    if (kagomeLoaded) return;

    if (loadPromise) {
        return loadPromise;
    }

    loadPromise = (async () => {
        try {
            console.log('[Kagome Background] Initializing Go runtime...');
            initGoRuntime();

            console.log('[Kagome Background] Loading WASM...');
            const browserAPI = (self as any).browser || (self as any).chrome;
            const wasmUrl = browserAPI.runtime.getURL('kagome/kagome.wasm');
            const wasmResponse = await fetch(wasmUrl);
            const wasmBytes = await wasmResponse.arrayBuffer();

            console.log('[Kagome Background] Instantiating WASM...');
            const go = new Go();
            const result = await WebAssembly.instantiate(wasmBytes, go.importObject);

            console.log('[Kagome Background] Running Go program...');
            go.run(result.instance);

            kagomeLoaded = true;
            console.log('[Kagome Background] Kagome WASM loaded successfully');
        } catch (error) {
            console.error('[Kagome Background] Failed to load Kagome WASM:', error);
            throw error;
        }
    })();

    return loadPromise;
}

export default class KagomeAnalysisHandler {
    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'kagome-analysis';
    }

    handle(
        command: Command<Message>,
        sender: any, // Compatible with both chrome.runtime.MessageSender and browser.runtime.MessageSender
        sendResponse: (response: any) => void
    ): boolean {
        const kagomeMessage = command.message as KagomeAnalysisMessage;

        console.log('[Kagome Background] Batch analyzing', kagomeMessage.texts.length, 'texts');

        Promise.all(
            kagomeMessage.texts.map((text) =>
                this.analyzeText(text).catch((error) => {
                    console.warn('[Kagome Background] Failed to analyze:', text, error);
                    return [];
                })
            )
        )
            .then((results) => {
                const response = {
                    results: results.map((tokens, index) => ({
                        text: kagomeMessage.texts[index],
                        tokens,
                    })),
                };
                console.log('[Kagome Background] Batch analysis complete:', results.length, 'results');
                sendResponse(response);
            })
            .catch((error) => {
                console.error('[Kagome Background] Batch analysis failed:', error);
                sendResponse({ results: [] });
            });

        return true;
    }

    private async analyzeText(text: string): Promise<any[]> {
        // Check if text contains Japanese characters
        if (!/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) {
            console.warn('[Kagome Background] No Japanese characters detected, skipping analysis');
            return [];
        }

        await loadKagomeWasm();

        // Call the Kagome tokenize function
        if (typeof self.kagome_tokenize === 'function') {
            const tokens = self.kagome_tokenize(text);
            return tokens || [];
        } else {
            throw new Error('kagome_tokenize function not available');
        }
    }
}
