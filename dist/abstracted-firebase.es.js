import { wait } from 'common-types';
import { Parallel } from 'wait-in-parallel';
import { snapshotToArray } from 'typed-conversions';
import { SerializedQuery } from 'serialized-query';
export { rtdb } from 'firebase-api-surface';

function slashNotation(path) {
    return path.substr(0, 5) === ".info"
        ? path.substr(0, 5) + path.substring(5).replace(/\./g, "/")
        : path.replace(/\./g, "/");
}
function _getFirebaseType(context, kind) {
    if (!this.app) {
        const e = new Error(`You must first connect before using the ${kind}() API`);
        e.name = "NotAllowed";
        throw e;
    }
    const property = `_${kind}`;
    if (!context[property]) {
        context[property] = this.app.storage();
    }
    return context[property];
}

class FileDepthExceeded extends Error {
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

const WatcherEventWrapper = (context) => (handler) => {
    return (snapshot, previousChildKey) => {
        const event = {
            key: snapshot.key,
            value: snapshot.val()
        };
        if (previousChildKey) {
            event.previousChildKey = previousChildKey;
        }
        const fullEvent = Object.assign({}, event, context);
        return handler(fullEvent);
    };
};

// tslint:disable:no-implicit-dependencies
var FirebaseBoolean;
(function (FirebaseBoolean) {
    FirebaseBoolean[FirebaseBoolean["true"] = 1] = "true";
    FirebaseBoolean[FirebaseBoolean["false"] = 0] = "false";
})(FirebaseBoolean || (FirebaseBoolean = {}));
/** time by which the dynamically loaded mock library should be loaded */
const MOCK_LOADING_TIMEOUT = 2000;
class RealTimeDB {
    constructor() {
        /** how many miliseconds before the attempt to connect to DB is timed out */
        this.CONNECTION_TIMEOUT = 5000;
        this._isConnected = false;
        this._mockLoadingState = "not-applicable";
        this._waitingForConnection = [];
        this._onConnected = [];
        this._onDisconnected = [];
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
        events.map(evt => {
            const dispatch = WatcherEventWrapper({
                eventType: evt,
                targetType: "path"
            })(cb);
            if (typeof target === "string") {
                this.ref(slashNotation(target)).on(evt, dispatch);
            }
            else {
                target
                    .setDB(this)
                    .deserialize()
                    .on(evt, dispatch);
            }
        });
    }
    unWatch(events, cb) {
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
    /**
     * Get a Firebase SerializedQuery reference
     *
     * @param path path for query
     */
    query(path) {
        return SerializedQuery.path(path);
    }
    /** Get a DB reference for a given path in Firebase */
    ref(path = "/") {
        return this._mocking
            ? this.mock.ref(path)
            : this._database.ref(path);
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
    async waitForConnection() {
        if (this._mocking) {
            // MOCKING
            if (this._mockLoadingState === "loaded") {
                return;
            }
            const timeout = new Date().getTime() + MOCK_LOADING_TIMEOUT;
            while (this._mockLoadingState === "loading" && new Date().getTime() < timeout) {
                await wait(1);
            }
            return;
        }
        else {
            // NON-MOCKING
            if (this.isConnected) {
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
            const p = new Parallel();
            p.add("connection", connectionEvent, this.CONNECTION_TIMEOUT);
            await p.isDone();
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
                    const e = new Error(`You have attempted to add the path "${pathValue.path}" twice to a MultiPathSet operation.`);
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
            get payload() {
                return mps.map(i => {
                    i.path = [api._basePath, i.path].join("/").replace(/[\/]{2,3}/g, "/");
                    return i;
                });
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
            return snap.val() ? snapshotToArray(snap, idProp) : [];
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
            return snapshotToArray(snap, idProp);
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
            this._mockLoadingState = "loading";
            // tslint:disable-next-line:no-implicit-dependencies
            const FireMock = await import("firemock");
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

export { RealTimeDB, FirebaseBoolean, FileDepthExceeded, UndefinedAssignment, _getFirebaseType };
//# sourceMappingURL=abstracted-firebase.es.js.map
