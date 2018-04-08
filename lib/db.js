"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const convert = require("typed-conversions");
const serialized_query_1 = require("serialized-query");
const util_1 = require("./util");
const firemock_1 = require("firemock");
const FileDepthExceeded_1 = require("./errors/FileDepthExceeded");
const UndefinedAssignment_1 = require("./errors/UndefinedAssignment");
var FirebaseBoolean;
(function (FirebaseBoolean) {
    FirebaseBoolean[FirebaseBoolean["true"] = 1] = "true";
    FirebaseBoolean[FirebaseBoolean["false"] = 0] = "false";
})(FirebaseBoolean = exports.FirebaseBoolean || (exports.FirebaseBoolean = {}));
class RealTimeDB {
    constructor(config = {}) {
        this._waitingForConnection = [];
        this._onConnected = [];
        this._onDisconnected = [];
        this._debugging = false;
        this._mocking = false;
        this._allowMocking = false;
        if (config.mocking) {
            this._mocking = true;
            this._mock = new firemock_1.Mock();
        }
    }
    query(path) {
        return serialized_query_1.SerializedQuery.path(path);
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
            this._mock = new firemock_1.Mock();
            firemock_1.resetDatabase();
        }
        return this._mock;
    }
    resetMockDb() {
        firemock_1.resetDatabase();
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
                    throw new FileDepthExceeded_1.default(e);
                }
                if (e.name === "Error") {
                    e.name = "AbstractedFirebaseSetError";
                }
                if (e.message.indexOf("First argument contains undefined in property") !== -1) {
                    e.name = "FirebaseUndefinedValueAssignment";
                    throw new UndefinedAssignment_1.default(e);
                }
                throw e;
            }
        });
    }
    multiPathSet() {
        const mps = [];
        const ref = this.ref.bind(this);
        let callback;
        const api = {
            basePath: "/",
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
            callback(cb) {
                callback = cb;
                return;
            },
            execute() {
                return __awaiter(this, void 0, void 0, function* () {
                    const updateHash = {};
                    mps.map(item => {
                        updateHash[item.path] = item.value;
                    });
                    return ref(api.basePath)
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
                if (e.message.indexOf("First argument path specified exceeds the maximum depth") !== -1) {
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
                ? this.ref(util_1.slashNotation(path)).once("value")
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
exports.RealTimeDB = RealTimeDB;
