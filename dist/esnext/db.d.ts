import { IDictionary } from "common-types";
import { SerializedQuery } from "serialized-query";
import { FirebaseDatabase, DataSnapshot, EventType, Reference } from "@firebase/database-types";
import { IFirebaseConfig, IMockLoadingState, IFirebaseWatchHandler, IMultiPathSet, IClientEmitter, IAdminEmitter } from "./types";
import { IFirebaseListener, IFirebaseConnectionCallback } from ".";
declare type Mock = import("firemock").Mock;
declare type IMockConfigOptions = import("firemock").IMockConfigOptions;
/** time by which the dynamically loaded mock library should be loaded */
export declare const MOCK_LOADING_TIMEOUT = 2000;
export declare abstract class RealTimeDB<A = any> {
    readonly isMockDb: boolean;
    /**
     * **getPushKey**
     *
     * Get's a push-key from the server at a given path. This ensures that multiple
     * client's who are writing to the database will use the server's time rather than
     * their own local time.
     *
     * @param path the path in the database where the push-key will be pushed to
     */
    getPushKey(path: string): Promise<string>;
    readonly mock: Mock;
    readonly isConnected: boolean;
    readonly config: IFirebaseConfig;
    static connect: (config: any) => Promise<any>;
    /** how many miliseconds before the attempt to connect to DB is timed out */
    CONNECTION_TIMEOUT: number;
    /** Logs debugging information to the console */
    enableDatabaseLogging: (logger?: boolean | ((a: string) => any), persistent?: boolean) => any;
    protected abstract _eventManager: IClientEmitter | IAdminEmitter;
    protected abstract _clientType: "client" | "admin";
    protected _isConnected: boolean;
    protected _mockLoadingState: IMockLoadingState;
    protected _mock: Mock;
    protected _resetMockDb: () => void;
    protected _waitingForConnection: Array<() => void>;
    protected _debugging: boolean;
    protected _mocking: boolean;
    protected _allowMocking: boolean;
    protected _onConnected: IFirebaseListener[];
    protected _onDisconnected: IFirebaseListener[];
    protected app: any;
    protected _database: FirebaseDatabase;
    /** the config the db was started with */
    protected _config: IFirebaseConfig;
    protected abstract _auth: any;
    constructor(config?: IFirebaseConfig);
    /**
     * called by `client` and `admin` at end of constructor
     */
    initialize(config?: IFirebaseConfig): void;
    abstract auth(): Promise<A>;
    /**
     * watch
     *
     * Watch for firebase events based on a DB path or `SerializedQuery` (path plus query elements)
     *
     * @param target a database path or a SerializedQuery
     * @param events an event type or an array of event types (e.g., "value", "child_added")
     * @param cb the callback function to call when event triggered
     */
    watch(target: string | SerializedQuery<any>, events: EventType | EventType[], cb: IFirebaseWatchHandler): void;
    unWatch(events?: EventType | EventType[], cb?: any): void;
    /**
     * Get a Firebase SerializedQuery reference
     *
     * @param path path for query
     */
    query<T extends object = any>(path: string): SerializedQuery<T>;
    /** Get a DB reference for a given path in Firebase */
    ref(path?: string): Reference;
    /**
     * Provides a promise-based way of waiting for the connection to be
     * established before resolving
     */
    waitForConnection(): Promise<this>;
    /**
     * get a notification when DB is connected; returns a unique id
     * which can be used to remove the callback. You may, optionally,
     * state a unique id of your own.
     *
     * By default the callback will receive the database connection as it's
     * `this`/context. This means that any locally defined variables will be
     * dereferenced an unavailable. If you want to retain a connection to this
     * state you should include the optional _context_ parameter and your
     * callback will get a parameter passed back with this context available.
     */
    notifyWhenConnected(cb: IFirebaseConnectionCallback, id?: string, 
    /**
     * additional context/pointers for your callback to use when activated
     */
    ctx?: IDictionary): string;
    /**
     * removes a callback notification previously registered
     */
    removeNotificationOnConnection(id: string): this;
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
     *
     * [Blog Post](https://firebase.googleblog.com/2015/09/introducing-multi-location-updates-and_86.html)
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
     *
     * [API Docs](https://firebase.google.com/docs/reference/js/firebase.database.Reference#update)
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
     *
     * [API  Docs](https://firebase.google.com/docs/reference/js/firebase.database.Reference#remove)
     */
    remove<T = any>(path: string, ignoreMissing?: boolean): Promise<any>;
    /**
     * **getSnapshot**
     *
     * returns the Firebase snapshot at a given path in the database
     */
    getSnapshot<T extends object = any>(path: string | SerializedQuery<T>): Promise<DataSnapshot>;
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
    getRecord<T extends object = any>(path: string | SerializedQuery<T>, idProp?: string): Promise<T>;
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
    getList<T extends object = any>(path: string | SerializedQuery<T>, idProp?: string): Promise<T[]>;
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
    /**
     * monitorConnection
     *
     * allows interested parties to hook into event messages when the
     * DB connection either connects or disconnects
     */
    protected _monitorConnection(snap: DataSnapshot): void;
    protected abstract connectToFirebase(config: any): Promise<void>;
    protected abstract listenForConnectionStatus(): void;
    /**
     * **getFireMock**
     *
     * Asynchronously imports both `FireMock` and the `Faker` libraries
     * then sets `isConnected` to **true**
     */
    protected getFireMock(config?: IMockConfigOptions): Promise<void>;
}
export {};
