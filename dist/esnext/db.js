// tslint:disable:no-implicit-dependencies
import { wait, createError } from "common-types";
import * as convert from "typed-conversions";
import { SerializedQuery } from "serialized-query";
import { slashNotation } from "./util";
import { FileDepthExceeded } from "./errors/FileDepthExceeded";
import { UndefinedAssignment } from "./errors/UndefinedAssignment";
import { WatcherEventWrapper } from "./WatcherEventWrapper";
import { handleError } from "./handleError";
import { PermissionDenied } from "./errors";
import { AbstractedProxyError } from "./errors/AbstractedProxyError";
/** time by which the dynamically loaded mock library should be loaded */
export const MOCK_LOADING_TIMEOUT = 2000;
export class RealTimeDB {
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
        return SerializedQuery.path(path);
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
            const e = new Error(`Attempting to reference mock() on DB but _mock is not set [ mocking: ${this._mocking} ]!`);
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
            await this.getFireMock();
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
                await wait(this.CONNECTION_TIMEOUT);
                throw createError("abstracted-firebase/connection-timeout", `The database didn't connect after the allocated period of ${this.CONNECTION_TIMEOUT}ms`);
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
        // return new Promise((resolve, reject))
        try {
            const results = await this.ref(path).set(value);
        }
        catch (e) {
            if (e.code === "PERMISSION_DENIED") {
                throw new PermissionDenied(e, `The attempt to set a value at path "${path}" failed due to incorrect permissions.`);
            }
            if (e.message.indexOf("path specified exceeds the maximum depth that can be written") !== -1) {
                throw new FileDepthExceeded(e);
            }
            if (e.message.indexOf("First argument includes undefined in property") !== -1) {
                e.name = "FirebaseUndefinedValueAssignment";
                throw new UndefinedAssignment(e);
            }
            throw new AbstractedProxyError(e, "unknown", JSON.stringify({ path, value }));
        }
    }
    /**
     * **multiPathSet**
     *
     * Equivalent to Firebase's traditional "multi-path updates" which are
     * in behaviour are really "multi-path SETs". Calling this function provides
     * access to simplified API for adding and executing this operation.
     *
     * What's important to understand is that the structure of this request
     * is an array of name/values where the _name_ is a path in the database
     * and the _value_ is what is to be **set** there. By grouping these together
     * you not only receive performance benefits but also they are treated as
     * a "transaction" where either _all_ or _none_ of the updates will take
     * place.
     *
     * @param base you can state a _base_ path which all subsequent paths will be
     * based off of. This is often useful when making a series of changes to a
     * part of the Firebase datamodel. In particular, if you are using **FireModel**
     * then operations which effect a single "model" will leverage this **base**
     * property
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
            get paths() {
                return mps.map(i => i.path);
            },
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
            callback(cb) {
                callback = cb;
                return api;
            },
            async execute() {
                const updateHash = {};
                const fullyQualifiedPaths = mps.map(i => (Object.assign({}, i, { path: [api._basePath, i.path].join("/").replace(/[\/]{2,3}/g, "/") })));
                fullyQualifiedPaths.map(item => {
                    updateHash[item.path] = item.value;
                });
                try {
                    await ref().update(updateHash);
                    if (callback) {
                        callback(null, mps);
                    }
                    // resolve();
                }
                catch (e) {
                    if (callback) {
                        callback(e, mps);
                    }
                    const err = createError(`abstracted-firebase/mps-failure`, `While attempting to execute a multi-path-set operation there was a failure: ${e.message}`);
                    err.name = "AbstractedFirebase::mps-failure";
                    err.stack = e.stack;
                    // reject(err);
                }
                // });
            }
        };
        return api;
    }
    /**
     * **update**
     *
     * Update the database at a given path. Note that this operation is
     * **non-destructive**, so assuming that the value you are passing in
     * a POJO/object then the properties sent in will be updated but if
     * properties that exist in the DB, but not in the value passed in,
     * then these properties will _not_ be changed.
     */
    async update(path, value) {
        try {
            const result = await this.ref(path).update(value);
        }
        catch (e) {
            if (e.code === "PERMISSION_DENIED") {
                const e = createError("abstracted-firebase/PERMISSION_DENIED", `The attempt to update a value at path "${path}" failed due to incorrect permissions.`);
                e.name = "PERMISSION_DENIED";
                throw e;
            }
            else {
                handleError(e, "update", { path, value });
            }
        }
    }
    /**
     * **remove**
     *
     * Removes a path from the database. By default if you attempt to
     * remove a path in the database which _didn't_ exist it will throw
     * a `abstracted-firebase/remove` error. If you'd prefer for this
     * error to be ignored than you can pass in **true** to the `ignoreMissing`
     * parameter.
     */
    async remove(path, ignoreMissing = false) {
        const ref = this.ref(path);
        try {
            const result = await ref.remove();
            return result;
        }
        catch (e) {
            e.name =
                !e.code || e.code.includes("abstracted-firebase") ? "AbstractedFirebase" : e.code;
            e.code = "abstracted-firebase/remove" + e.code ? `/${e.code}` : "";
            if (ignoreMissing && e.message.indexOf("key is not defined") !== -1) {
                return;
            }
            throw e;
        }
    }
    /**
     * **getSnapshot**
     *
     * returns the Firebase snapshot at a given path in the database
     */
    async getSnapshot(path) {
        try {
            const response = (await typeof path) === "string"
                ? this.ref(slashNotation(path)).once("value")
                : path.setDB(this).execute();
            return response;
        }
        catch (e) {
            e.name =
                !e.code || e.code.includes("abstracted-firebase") ? "AbstractedFirebase" : e.code;
            e.code = "abstracted-firebase/getSnapshot" + e.code ? `/${e.code}` : "";
            throw e;
        }
    }
    /**
     * **getValue**
     *
     * Returns the JS value at a given path in the database. This method is a
     * typescript _generic_ which defaults to `any` but you can set the type to
     * whatever value you expect at that path in the database.
     */
    async getValue(path) {
        try {
            const snap = await this.getSnapshot(path);
            return snap.val();
        }
        catch (e) {
            e.name =
                !e.code || e.code.includes("abstracted-firebase") ? "AbstractedFirebase" : e.code;
            e.code = "abstracted-firebase/getValue" + e.code ? `/${e.code}` : "";
            throw e;
        }
    }
    /**
     * **getRecord**
     *
     * Gets a snapshot from a given path in the Firebase DB
     * and converts it to a JS object where the snapshot's key
     * is included as part of the record (as `id` by default)
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
            e.code = "abstracted-firebase/getRecord" + e.code ? `/${e.code}` : "";
            throw e;
        }
    }
    /**
     * **getList**
     *
     * Get a list of a given type (defaults to _any_). Assumes that the
     * "key" for the record is the `id` property but that can be changed
     * with the optional `idProp` parameter.
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
            e.code = "abstracted-firebase/getList" + e.code ? `/${e.code}` : "";
            throw e;
        }
    }
    /**
     * **getSortedList**
     *
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
     * **push**
     *
     * Pushes a value (typically a hash) under a given path in the
     * database but allowing Firebase to insert a unique "push key"
     * to ensure the value is placed into a Dictionary/Hash structure
     * of the form of `/{path}/{pushkey}/{value}`
     *
     * Note, the pushkey will be generated on the Firebase side and
     * Firebase keys are guarenteed to be unique and embedded into the
     * UUID is precise time-based information so you _can_ count on
     * the keys to have a natural time based sort order.
     */
    async push(path, value) {
        try {
            this.ref(path).push(value);
        }
        catch (e) {
            e.name =
                !e.code || e.code.includes("abstracted-firebase") ? "AbstractedFirebase" : e.code;
            e.code = "abstracted-firebase/push" + e.code ? `/${e.code}` : "";
            throw e;
        }
    }
    /**
     * **exists**
     *
     * Validates the existance of a path in the database
     */
    async exists(path) {
        return this.getSnapshot(path).then(snap => (snap.val() ? true : false));
    }
    /**
     * **getFireMock**
     *
     * Asynchronously imports both `FireMock` and the `Faker` libraries
     * then sets `isConnected` to **true**
     */
    async getFireMock(config = {}) {
        try {
            this._mocking = true;
            this._mockLoadingState = "loading";
            const FireMock = await import(/* webpackChunkName: "firemock" */ "firemock");
            this._mockLoadingState = "loaded";
            this._mock = new FireMock.Mock({}, config);
            await this._mock.importFakerLibrary();
            this._isConnected = true;
        }
        catch (e) {
            console.error(`There was an error asynchronously loading Firemock/Faker library's.`);
            if (e.stack) {
                console.log(`The stack trace was:\n`, e.stack);
            }
            const err = createError("abstracted-firebase/import-firemock", `There was a problem importing the FireMock and/or Faker libraries. Both are required to run in "mocking" mode. The error encountered was: ${e.message}`);
            err.name = e.name;
            err.stack = e.stack;
            throw err;
        }
    }
}
