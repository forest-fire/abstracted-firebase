(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "common-types", "typed-conversions", "serialized-query", "./util", "./errors/FileDepthExceeded", "./errors/UndefinedAssignment", "./WatcherEventWrapper"], factory);
    }
})(function (require, exports) {
    "use strict";
    var __syncRequire = typeof module === "object" && typeof module.exports === "object";
    Object.defineProperty(exports, "__esModule", { value: true });
    // tslint:disable:no-implicit-dependencies
    const common_types_1 = require("common-types");
    const convert = require("typed-conversions");
    const serialized_query_1 = require("serialized-query");
    const util_1 = require("./util");
    const FileDepthExceeded_1 = require("./errors/FileDepthExceeded");
    const UndefinedAssignment_1 = require("./errors/UndefinedAssignment");
    const WatcherEventWrapper_1 = require("./WatcherEventWrapper");
    /** time by which the dynamically loaded mock library should be loaded */
    exports.MOCK_LOADING_TIMEOUT = 2000;
    class RealTimeDB {
        constructor() {
            /** how many miliseconds before the attempt to connect to DB is timed out */
            this.CONNECTION_TIMEOUT = 5000;
            this._isConnected = false;
            this._mockLoadingState = "not-applicable";
            this._waitingForConnection = [];
            this._debugging = false;
            this._mocking = false;
            this._allowMocking = false;
        }
        initialize(config = {}) {
            if (config.mocking) {
                this._mocking = true;
                this.getFireMock();
            }
            else {
                this._mocking = false;
                this.connectToFirebase(config).then(() => this.listenForConnectionStatus());
            }
        }
        /**
         * watch
         *
         * Watch for firebase events based on a DB path or Query
         *
         * @param target a database path or a SerializedQuery
         * @param events an event type or an array of event types (e.g., "value", "child_added")
         * @param cb the callback function to call when event triggered
         */
        watch(target, events, cb) {
            if (!Array.isArray(events)) {
                events = [events];
            }
            try {
                events.map(evt => {
                    const dispatch = WatcherEventWrapper_1.WatcherEventWrapper({
                        eventType: evt,
                        targetType: "path"
                    })(cb);
                    if (typeof target === "string") {
                        this.ref(util_1.slashNotation(target)).on(evt, dispatch);
                    }
                    else {
                        target
                            .setDB(this)
                            .deserialize()
                            .on(evt, dispatch);
                    }
                });
            }
            catch (e) {
                e.name = e.code.includes("abstracted-firebase") ? "AbstractedFirebase" : e.code;
                e.code = "abstracted-firebase/watch";
                throw e;
            }
        }
        unWatch(events, cb) {
            try {
                if (!Array.isArray(events)) {
                    events = [events];
                }
                if (!events) {
                    this.ref().off();
                    return;
                }
                events.map(evt => {
                    if (cb) {
                        this.ref().off(evt, cb);
                    }
                    else {
                        this.ref().off(evt);
                    }
                });
            }
            catch (e) {
                e.name = e.code.includes("abstracted-firebase") ? "AbstractedFirebase" : e.code;
                e.code = "abstracted-firebase/unWatch";
                throw e;
            }
        }
        /**
         * Get a Firebase SerializedQuery reference
         *
         * @param path path for query
         */
        query(path) {
            return serialized_query_1.SerializedQuery.path(path);
        }
        /** Get a DB reference for a given path in Firebase */
        ref(path = "/") {
            return this._mocking ? this.mock.ref(path) : this._database.ref(path);
        }
        get isMockDb() {
            return this._mocking;
        }
        get mock() {
            if (!this._mocking && !this._allowMocking) {
                const e = new Error("You can not mock the database without setting mocking in the constructor");
                e.name = "AbstractedFirebase::NotAllowed";
                throw e;
            }
            if (this._mockLoadingState === "loading") {
                const e = new Error(`Loading the mock library is an asynchronous task; typically it takes very little time but it is currently in process. You can listen to "waitForConnection()" to ensure the mock library is ready.`);
                e.name = "AbstractedFirebase::AsyncError";
                throw e;
            }
            if (!this._mock) {
                const e = new Error(`Attempting to use mock getter but _mock is not set!`);
                e.name = "AbstractedFirebase::NotAllowed";
                throw e;
            }
            return this._mock;
        }
        /**
         * Provides a promise-based way of waiting for the connection to be
         * established before resolving
         */
        async waitForConnection() {
            if (this._mocking) {
                // MOCKING
                if (this._mockLoadingState === "loaded") {
                    return;
                }
                const timeout = new Date().getTime() + exports.MOCK_LOADING_TIMEOUT;
                while (this._mockLoadingState === "loading" && new Date().getTime() < timeout) {
                    await common_types_1.wait(1);
                }
                return;
            }
            else {
                // NON-MOCKING
                if (this._isConnected) {
                    return;
                }
                const connectionEvent = async () => {
                    this._eventManager.once("connection", (state) => {
                        if (state) {
                            return;
                        }
                        else {
                            throw Error(`While waiting for connection received a disconnect message`);
                        }
                    });
                };
                const timeout = async () => {
                    await common_types_1.wait(this.CONNECTION_TIMEOUT);
                    throw common_types_1.createError("abstracted-firebase/connection-timeout", `The database didn't connect after the allocated period of ${this.CONNECTION_TIMEOUT}ms`);
                };
                await Promise.race([connectionEvent, timeout]);
                this._isConnected = true;
                return this;
            }
        }
        get isConnected() {
            return this._isConnected;
        }
        /** set a "value" in the database at a given path */
        async set(path, value) {
            try {
                return this.ref(path).set(value);
            }
            catch (e) {
                if (e.message.indexOf("path specified exceeds the maximum depth that can be written") !== -1) {
                    console.log("FILE DEPTH EXCEEDED");
                    throw new FileDepthExceeded_1.FileDepthExceeded(e);
                }
                if (e.name === "Error") {
                    e.name = "AbstractedFirebaseSetError";
                }
                if (e.message.indexOf("First argument includes undefined in property") !== -1) {
                    e.name = "FirebaseUndefinedValueAssignment";
                    throw new UndefinedAssignment_1.UndefinedAssignment(e);
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
            const makeFullPath = (path, basePath) => {
                return [basePath, path].join("/").replace(/[\/]{2,3}/g, "/");
            };
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
                    if (api.paths.includes(pathValue.path)) {
                        const message = `You have attempted to add the path "${pathValue.path}" twice to a MultiPathSet operation [ value: ${pathValue.value} ]. For context the payload in the multi-path-set was already: ${JSON.stringify(api.payload, null, 2)}`;
                        const e = new Error(message);
                        e.name = "DuplicatePath";
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
                get payload() {
                    return mps.map(i => {
                        i.path = [api._basePath, i.path].join("/").replace(/[\/]{2,3}/g, "/");
                        return i;
                    });
                },
                findPathItem(path) {
                    let result = "unknown";
                    api.payload.map(i => {
                        if (i.path === path) {
                            result = i.value;
                        }
                    });
                    return result;
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
                const result = await this.ref(path).update(value);
                return result;
            }
            catch (e) {
                e.name =
                    !e.code || e.code.includes("abstracted-firebase") ? "AbstractedFirebase" : e.code;
                e.code = "abstracted-firebase/update";
                if (e.message.indexOf("First argument path specified exceeds the maximum depth") !==
                    -1) {
                    e.name = "AbstractedFirebaseUpdateDepthError";
                }
                throw e;
            }
        }
        async remove(path, ignoreMissing = false) {
            const ref = this.ref(path);
            try {
                const result = await ref.remove();
                return result;
            }
            catch (e) {
                e.name =
                    !e.code || e.code.includes("abstracted-firebase") ? "AbstractedFirebase" : e.code;
                e.code = "abstracted-firebase/remove";
                if (ignoreMissing && e.message.indexOf("key is not defined") !== -1) {
                    return;
                }
                throw e;
            }
        }
        /** returns the firebase snapshot at a given path in the database */
        async getSnapshot(path) {
            try {
                const response = (await typeof path) === "string"
                    ? this.ref(util_1.slashNotation(path)).once("value")
                    : path.setDB(this).execute();
                return response;
            }
            catch (e) {
                e.name =
                    !e.code || e.code.includes("abstracted-firebase") ? "AbstractedFirebase" : e.code;
                e.code = "abstracted-firebase/getSnapshot";
                throw e;
            }
        }
        /** returns the JS value at a given path in the database */
        async getValue(path) {
            try {
                const snap = await this.getSnapshot(path);
                return snap.val();
            }
            catch (e) {
                e.name =
                    !e.code || e.code.includes("abstracted-firebase") ? "AbstractedFirebase" : e.code;
                e.code = "abstracted-firebase/getValue";
                throw e;
            }
        }
        /**
         * Gets a snapshot from a given path in the DB
         * and converts it to a JS object where the snapshot's key
         * is included as part of the record (as 'id' by default)
         */
        async getRecord(path, idProp = "id") {
            try {
                const snap = await this.getSnapshot(path);
                let object = snap.val();
                if (typeof object !== "object") {
                    object = { value: snap.val() };
                }
                return Object.assign({}, object, { [idProp]: snap.key });
            }
            catch (e) {
                e.name =
                    !e.code || e.code.includes("abstracted-firebase") ? "AbstractedFirebase" : e.code;
                e.code = "abstracted-firebase/getRecord";
                throw e;
            }
        }
        /**
         * Get a list of a given type
         *
         * @param path the path in the database to
         * @param idProp
         */
        async getList(path, idProp = "id") {
            try {
                const snap = await this.getSnapshot(path);
                return snap.val() ? convert.snapshotToArray(snap, idProp) : [];
            }
            catch (e) {
                e.name =
                    !e.code || e.code.includes("abstracted-firebase") ? "AbstractedFirebase" : e.code;
                e.code = "abstracted-firebase/getList";
                throw e;
            }
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
            try {
                this.ref(path).push(value);
            }
            catch (e) {
                e.name =
                    !e.code || e.code.includes("abstracted-firebase") ? "AbstractedFirebase" : e.code;
                e.code = "abstracted-firebase/push";
                throw e;
            }
        }
        /** validates the existance of a path in the database */
        async exists(path) {
            return this.getSnapshot(path).then(snap => (snap.val() ? true : false));
        }
        async getFireMock() {
            try {
                this._mockLoadingState = "loading";
                // tslint:disable-next-line:no-implicit-dependencies
                const FireMock = await (__syncRequire ? Promise.resolve().then(() => require("firemock")) : new Promise((resolve_1, reject_1) => { require(["firemock"], resolve_1, reject_1); }));
                this._mockLoadingState = "loaded";
                this._mock = new FireMock.Mock();
                this._isConnected = true;
                this._mocking = true;
            }
            catch (e) {
                console.error(`There was an error asynchronously loading Firemock library.`);
                if (e.stack) {
                    console.log(`The stack trace was:\n`, e.stack);
                }
                throw e;
            }
        }
    }
    exports.RealTimeDB = RealTimeDB;
});
