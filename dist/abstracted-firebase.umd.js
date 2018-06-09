(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('typed-conversions'), require('serialized-query'), require('firebase-api-surface')) :
    typeof define === 'function' && define.amd ? define(['exports', 'typed-conversions', 'serialized-query', 'firebase-api-surface'], factory) :
    (factory((global['abstracted-firebase'] = {}),global.convert,global.serializedQuery,global.firebaseApiSurface));
}(this, (function (exports,convert,serializedQuery,firebaseApiSurface) { 'use strict';

    class FirebaseDepthExceeded extends Error {
        constructor(e) {
            super(e.message);
            this.stack = e.stack;
            if (e.name === "Error") {
                e.name = "AbstractedFirebase";
            }
        }
    }

    class UndefinedAssignment extends Error {
        constructor(e) {
            super(e.message);
            this.stack = e.stack;
            if (e.name === "Error") {
                e.name = "AbstractedFirebase";
            }
        }
    }

    function slashNotation(path) {
        return path.substr(0, 5) === ".info"
            ? path.substr(0, 5) + path.substring(5).replace(/\./g, "/")
            : path.replace(/\./g, "/");
    }

    (function (FirebaseBoolean) {
        FirebaseBoolean[FirebaseBoolean["true"] = 1] = "true";
        FirebaseBoolean[FirebaseBoolean["false"] = 0] = "false";
    })(exports.FirebaseBoolean || (exports.FirebaseBoolean = {}));
    class RealTimeDB {
        constructor(config = {}) {
            this._waitingForConnection = [];
            this._onConnected = [];
            this._onDisconnected = [];
            this._debugging = false;
            this._mocking = false;
            this._allowMocking = false;
            if (config.mocking) {
                this.getFireMock();
            }
        }
        query(path) {
            return serializedQuery.SerializedQuery.path(path);
        }
        /** Get a DB reference for a given path in Firebase */
        ref(path) {
            return this._mocking
                ? this.mock.ref(path)
                : RealTimeDB.connection.ref(path);
        }
        /**
         * Typically mocking functionality is disabled if mocking is not on
         * but there are cases -- particular in testing against a real DB --
         * where the mock functionality is still useful for building a base state.
         */
        allowMocking() {
            this._allowMocking = true;
        }
        get mock() {
            if (!this._mocking && !this._allowMocking) {
                throw new Error("You can not mock the database without setting mocking in the constructor");
            }
            // if (!this._mock) {
            //   this._mock = new Mock();
            //   this._resetMockDb();
            // }
            return this._mock;
        }
        /** clears all "connections" and state from the database */
        resetMockDb() {
            this._resetMockDb();
        }
        async waitForConnection() {
            if (RealTimeDB.isConnected) {
                return Promise.resolve();
            }
            return new Promise(resolve => {
                const cb = () => {
                    resolve();
                };
                this._waitingForConnection.push(cb);
            });
        }
        get isConnected() {
            return RealTimeDB.isConnected;
        }
        /** set a "value" in the database at a given path */
        async set(path, value) {
            try {
                return this.ref(path).set(value);
            }
            catch (e) {
                if (e.message.indexOf("path specified exceeds the maximum depth that can be written") !== -1) {
                    console.log("FILE DEPTH EXCEEDED");
                    throw new FirebaseDepthExceeded(e);
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
        }
        /**
         * Equivalent to Firebase's traditional "multi-path updates" which are
         * in behaviour are really "multi-path SETs". Calling this function provides
         * access to simplified API for adding and executing this operation.
         *
         * @param paths an array of path and value updates
         */
        multiPathSet(base) {
            const mps = [];
            const ref = this.ref.bind(this);
            let callback;
            const api = {
                /** The base reference path which all paths will be relative to */
                _basePath: base || "/",
                // a fluent API setter/getter for _basePath
                basePath(path) {
                    if (path === undefined) {
                        return api._basePath;
                    }
                    api._basePath = path;
                    return api;
                },
                /** Add in a new path and value to be included in the operation */
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
                /** the relative paths from the base which will be updated upon execution */
                get paths() {
                    return mps.map(i => i.path);
                },
                /** the absolute paths (including the base offset) which will be updated upon execution */
                get fullPaths() {
                    return mps.map(i => [api._basePath, i.path].join("/").replace(/[\/]{2,3}/g, "/"));
                },
                /** receive a call back on conclusion of the firebase operation */
                callback(cb) {
                    callback = cb;
                    return;
                },
                async execute() {
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
                }
            };
            return api;
        }
        async update(path, value) {
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
        }
        async remove(path, ignoreMissing = false) {
            const ref = this.ref(path);
            return ref.remove().catch((e) => {
                if (ignoreMissing && e.message.indexOf("key is not defined") !== -1) {
                    return Promise.resolve();
                }
                this.handleError(e, "remove", `attempt to remove ${path} failed: `);
            });
        }
        /** returns the firebase snapshot at a given path in the database */
        async getSnapshot(path) {
            return typeof path === "string"
                ? this.ref(slashNotation(path)).once("value")
                : path.setDB(this).execute();
        }
        /** returns the JS value at a given path in the database */
        async getValue(path) {
            const snap = await this.getSnapshot(path);
            return snap.val();
        }
        /**
         * Gets a snapshot from a given path in the DB
         * and converts it to a JS object where the snapshot's key
         * is included as part of the record (as 'id' by default)
         */
        async getRecord(path, idProp = "id") {
            return this.getSnapshot(path).then(snap => {
                let object = snap.val();
                if (typeof object !== "object") {
                    object = { value: snap.val() };
                }
                return Object.assign({}, object, { [idProp]: snap.key });
            });
        }
        /**
         * Get a list of a given type
         *
         * @param path the path in the database to
         * @param idProp
         */
        async getList(path, idProp = "id") {
            return this.getSnapshot(path).then(snap => {
                return snap.val() ? convert.snapshotToArray(snap, idProp) : [];
            });
        }
        /**
         * getSortedList() will return the sorting order that was defined in the Firebase
         * Query. This _can_ be useful but often the sort orders
         * really intended for the server only (so that filteration
         * is done on the right set of data before sending to client).
         *
         * @param query Firebase "query ref"
         * @param idProp what property name should the Firebase key be converted to (default is "id")
         */
        async getSortedList(query, idProp = "id") {
            return this.getSnapshot(query).then(snap => {
                return convert.snapshotToArray(snap, idProp);
            });
        }
        /**
         * Pushes a value (typically a hash) under a given path in the
         * database but allowing Firebase to insert a unique "push key"
         * to ensure the value is placed into a Dictionary/Hash structure
         * of the form of "/{path}/{pushkey}/{value}"
         */
        async push(path, value) {
            this.ref(path).push(value);
        }
        /** validates the existance of a path in the database */
        async exists(path) {
            return this.getSnapshot(path).then(snap => (snap.val() ? true : false));
        }
        handleError(e, name, message = "") {
            console.error(`Error ${message}:`, e);
            return Promise.reject({
                code: `firebase/${name}`,
                message: message + e.message || e
            });
        }
        async getFireMock() {
            try {
                const FireMock = await import("firemock");
                this._mock = new FireMock.Mock();
                this._mock.db.resetDatabase();
                this._mocking = true;
                return FireMock;
            }
            catch (e) {
                console.error(`There was an error asynchronously loading Firemock library`, e);
                this._mocking = false;
            }
        }
    }
    RealTimeDB.isConnected = false;
    RealTimeDB.isAuthorized = false;

    exports.rtdb = firebaseApiSurface.rtdb;
    exports.FileDepthExceeded = FirebaseDepthExceeded;
    exports.UndefinedAssignment = UndefinedAssignment;
    exports.RealTimeDB = RealTimeDB;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
