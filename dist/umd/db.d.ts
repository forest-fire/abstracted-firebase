import { SerializedQuery } from "serialized-query";
import { FirebaseDatabase, DataSnapshot, EventType, Reference } from "@firebase/database-types";
import { IFirebaseConfig, IEmitter, IMockLoadingState, IFirebaseWatchHandler, IMultiPathSet } from "./types";
declare type Mock = import("firemock").Mock;
declare type IMockAuthConfig = import("firemock").IMockAuthConfig;
/** time by which the dynamically loaded mock library should be loaded */
export declare const MOCK_LOADING_TIMEOUT = 2000;
export declare abstract class RealTimeDB {
    /** how many miliseconds before the attempt to connect to DB is timed out */
    CONNECTION_TIMEOUT: number;
    /** Logs debugging information to the console */
    enableDatabaseLogging: (logger?: boolean | ((a: string) => any), persistent?: boolean) => any;
    protected abstract _eventManager: IEmitter;
    protected _isConnected: boolean;
    protected _mockLoadingState: IMockLoadingState;
    protected _mock: Mock;
    protected _resetMockDb: () => void;
    protected _waitingForConnection: Array<() => void>;
    protected _debugging: boolean;
    protected _mocking: boolean;
    protected _allowMocking: boolean;
    protected app: any;
    protected _database: FirebaseDatabase;
    protected _fakerReady: Promise<any>;
    protected abstract _auth: any;
    initialize(config?: IFirebaseConfig): void;
    /**
     * watch
     *
     * Watch for firebase events based on a DB path or Query
     *
     * @param target a database path or a SerializedQuery
     * @param events an event type or an array of event types (e.g., "value", "child_added")
     * @param cb the callback function to call when event triggered
     */
    watch(target: string | SerializedQuery, events: EventType | EventType[], cb: IFirebaseWatchHandler): void;
    unWatch(events?: EventType | EventType[], cb?: any): void;
    /**
     * Get a Firebase SerializedQuery reference
     *
     * @param path path for query
     */
    query<T = any>(path: string): SerializedQuery<T>;
    /** Get a DB reference for a given path in Firebase */
    ref(path?: string): Reference;
    readonly isMockDb: boolean;
    readonly mock: Mock;
    /**
     * Provides a promise-based way of waiting for the connection to be
     * established before resolving
     */
    waitForConnection(): Promise<this>;
    readonly isConnected: boolean;
    /** set a "value" in the database at a given path */
    set<T = any>(path: string, value: T): Promise<void>;
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
    multiPathSet(base?: string): IMultiPathSet;
    /**
     * **update**
     *
     * Update the database at a given path. Note that this operation is
     * **non-destructive**, so assuming that the value you are passing in
     * a POJO/object then the properties sent in will be updated but if
     * properties that exist in the DB, but not in the value passed in,
     * then these properties will _not_ be changed.
     */
    update<T = any>(path: string, value: Partial<T>): Promise<void>;
    /**
     * **remove**
     *
     * Removes a path from the database. By default if you attempt to
     * remove a path in the database which _didn't_ exist it will throw
     * a `abstracted-firebase/remove` error. If you'd prefer for this
     * error to be ignored than you can pass in **true** to the `ignoreMissing`
     * parameter.
     */
    remove<T = any>(path: string, ignoreMissing?: boolean): Promise<any>;
    /**
     * **getSnapshot**
     *
     * returns the Firebase snapshot at a given path in the database
     */
    getSnapshot(path: string | SerializedQuery): Promise<DataSnapshot>;
    /**
     * **getValue**
     *
     * Returns the JS value at a given path in the database. This method is a
     * typescript _generic_ which defaults to `any` but you can set the type to
     * whatever value you expect at that path in the database.
     */
    getValue<T = any>(path: string): Promise<T>;
    /**
     * **getRecord**
     *
     * Gets a snapshot from a given path in the Firebase DB
     * and converts it to a JS object where the snapshot's key
     * is included as part of the record (as `id` by default)
     */
    getRecord<T = any>(path: string | SerializedQuery<T>, idProp?: string): Promise<T>;
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
    getList<T = any>(path: string | SerializedQuery<T>, idProp?: string): Promise<T[]>;
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
    getSortedList<T = any>(query: any, idProp?: string): Promise<T[]>;
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
    push<T = any>(path: string, value: T): Promise<void>;
    /**
     * **exists**
     *
     * Validates the existance of a path in the database
     */
    exists(path: string): Promise<boolean>;
    protected abstract connectToFirebase(config: any): Promise<void>;
    protected abstract listenForConnectionStatus(): void;
    /**
     * **getFireMock**
     *
     * Asynchronously imports both `FireMock` and the `Faker` libraries
     * then sets `isConnected` to **true**
     */
    protected getFireMock(config?: IMockAuthConfig): Promise<void>;
}
export {};
