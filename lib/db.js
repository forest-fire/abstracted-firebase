var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as convert from "typed-conversions";
import { SerializedQuery } from "serialized-query";
import { slashNotation } from "./util";
import { Mock, resetDatabase } from "firemock";
import FileDepthExceeded from "./errors/FileDepthExceeded";
import UndefinedAssignment from "./errors/UndefinedAssignment";
export var FirebaseBoolean;
(function (FirebaseBoolean) {
    FirebaseBoolean[FirebaseBoolean["true"] = 1] = "true";
    FirebaseBoolean[FirebaseBoolean["false"] = 0] = "false";
})(FirebaseBoolean || (FirebaseBoolean = {}));
export class RealTimeDB {
    constructor(config = {}) {
        this._waitingForConnection = [];
        this._onConnected = [];
        this._onDisconnected = [];
        this._debugging = false;
        this._mocking = false;
        this._allowMocking = false;
        if (config.mocking) {
            this._mocking = true;
            this._mock = new Mock();
        }
    }
    query(path) {
        return SerializedQuery.path(path);
    }
    ref(path) {
        return this._mocking
            ? this.mock.ref(path)
            : RealTimeDB.connection.ref(path);
    }
    allowMocking() {
        this._allowMocking = true;
    }
    get mock() {
        if (!this._mocking && !this._allowMocking) {
            throw new Error("You can not mock the database without setting mocking in the constructor");
        }
        if (!this._mock) {
            this._mock = new Mock();
            resetDatabase();
        }
        return this._mock;
    }
    resetMockDb() {
        resetDatabase();
    }
    waitForConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            if (RealTimeDB.isConnected) {
                return Promise.resolve();
            }
            return new Promise(resolve => {
                const cb = () => {
                    resolve();
                };
                this._waitingForConnection.push(cb);
            });
        });
    }
    get isConnected() {
        return RealTimeDB.isConnected;
    }
    set(path, value) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ref(path).set(value);
            }
            catch (e) {
                if (e.message.indexOf("path specified exceeds the maximum depth that can be written") !== -1) {
                    console.log("FILE DEPTH EXCEEDED");
                    throw new FileDepthExceeded(e);
                }
                if (e.name === "Error") {
                    e.name = "AbstractedFirebaseSetError";
                }
                if (e.message.indexOf("First argument contains undefined in property") !== -1) {
                    e.name = "FirebaseUndefinedValueAssignment";
                    throw new UndefinedAssignment(e);
                }
                throw e;
            }
        });
    }
    multiPathSet(base) {
        const mps = [];
        const ref = this.ref.bind(this);
        let callback;
        const api = {
            _basePath: base || "/",
            basePath(path) {
                if (path === undefined) {
                    return api._basePath;
                }
                api._basePath = path;
                return api;
            },
            add(pathValue) {
                const exists = new Set(api.paths);
                if (pathValue.path.indexOf("/") === -1) {
                    pathValue.path = "/" + pathValue.path;
                }
                if (exists.has(pathValue.path)) {
                    const e = new Error(`You have attempted to add the path "${pathValue.path}" twice.`);
                    e.code = "duplicate-path";
                    throw e;
                }
                mps.push(pathValue);
                return api;
            },
            get paths() {
                return mps.map(i => i.path);
            },
            get fullPaths() {
                return mps.map(i => [api._basePath, i.path].join("/").replace(/[\/]{2,3}/g, "/"));
            },
            callback(cb) {
                callback = cb;
                return;
            },
            execute() {
                return __awaiter(this, void 0, void 0, function* () {
                    const updateHash = {};
                    const fullyQualifiedPaths = mps.map(i => (Object.assign({}, i, { path: [api._basePath, i.path].join("/").replace(/[\/]{2,3}/g, "/") })));
                    fullyQualifiedPaths.map(item => {
                        updateHash[item.path] = item.value;
                    });
                    return ref()
                        .update(updateHash)
                        .then(() => {
                        if (callback) {
                            callback(null, mps);
                            return;
                        }
                    })
                        .catch((e) => {
                        if (callback) {
                            callback(e, mps);
                        }
                        throw e;
                    });
                });
            }
        };
        return api;
    }
    update(path, value) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ref(path).update(value);
            }
            catch (e) {
                if (e.name === "Error") {
                    e.name = "AbstractedFirebaseUpdateError";
                }
                if (e.message.indexOf("First argument path specified exceeds the maximum depth") !==
                    -1) {
                    e.name = "AbstractedFirebaseUpdateDepthError";
                }
                throw e;
            }
        });
    }
    remove(path, ignoreMissing = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const ref = this.ref(path);
            return ref.remove().catch((e) => {
                if (ignoreMissing && e.message.indexOf("key is not defined") !== -1) {
                    return Promise.resolve();
                }
                this.handleError(e, "remove", `attempt to remove ${path} failed: `);
            });
        });
    }
    getSnapshot(path) {
        return __awaiter(this, void 0, void 0, function* () {
            return typeof path === "string"
                ? this.ref(slashNotation(path)).once("value")
                : path.setDB(this).execute();
        });
    }
    getValue(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const snap = yield this.getSnapshot(path);
            return snap.val();
        });
    }
    getRecord(path, idProp = "id") {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getSnapshot(path).then(snap => {
                let object = snap.val();
                if (typeof object !== "object") {
                    object = { value: snap.val() };
                }
                return Object.assign({}, object, { [idProp]: snap.key });
            });
        });
    }
    getList(path, idProp = "id") {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getSnapshot(path).then(snap => {
                return snap.val() ? convert.snapshotToArray(snap, idProp) : [];
            });
        });
    }
    getSortedList(query, idProp = "id") {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getSnapshot(query).then(snap => {
                return convert.snapshotToArray(snap, idProp);
            });
        });
    }
    push(path, value) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ref(path).push(value);
        });
    }
    exists(path) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getSnapshot(path).then(snap => (snap.val() ? true : false));
        });
    }
    handleError(e, name, message = "") {
        console.error(`Error ${message}:`, e);
        return Promise.reject({
            code: `firebase/${name}`,
            message: message + e.message || e
        });
    }
}
RealTimeDB.isConnected = false;
RealTimeDB.isAuthorized = false;
