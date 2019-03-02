import { SerializedQuery } from "serialized-query";
import { FirebaseDatabase, DataSnapshot, EventType } from "@firebase/database-types";
import { IEmitter, IFirebaseWatchHandler, IPathSetter, IMockLoadingState, IFirebaseConfig } from "./types";
declare type Mock = import("firemock").Mock;
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
    protected abstract _auth: import('@firebase/auth-types').FirebaseAuth;
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
    ref(path?: string): import("@firebase/database-types").Reference | import("firemock").Reference<any>;
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
     * Equivalent to Firebase's traditional "multi-path updates" which are
     * in behaviour are really "multi-path SETs". Calling this function provides
     * access to simplified API for adding and executing this operation.
     *
     * @param paths an array of path and value updates
     */
    multiPathSet(base?: string): {
        /** The base reference path which all paths will be relative to */
        _basePath: string;
        basePath(path?: string): string | any;
        /** Add in a new path and value to be included in the operation */
        add<X = any>(pathValue: IPathSetter<X>): any;
        /** the relative paths from the base which will be updated upon execution */
        readonly paths: string[];
        /** the absolute paths (including the base offset) which will be updated upon execution */
        readonly fullPaths: string[];
        readonly payload: IPathSetter<any>[];
        findPathItem(path: string): string;
        /** receive a call back on conclusion of the firebase operation */
        callback(cb: (err: any, pathSetters: IPathSetter<any>[]) => void): void;
        execute(): Promise<any>;
    };
    update<T = any>(path: string, value: Partial<T>): Promise<any>;
    remove<T = any>(path: string, ignoreMissing?: boolean): Promise<any>;
    /** returns the firebase snapshot at a given path in the database */
    getSnapshot(path: string | SerializedQuery): Promise<DataSnapshot>;
    /** returns the JS value at a given path in the database */
    getValue<T = any>(path: string): Promise<T>;
    /**
     * Gets a snapshot from a given path in the DB
     * and converts it to a JS object where the snapshot's key
     * is included as part of the record (as 'id' by default)
     */
    getRecord<T = any>(path: string | SerializedQuery<T>, idProp?: string): Promise<T>;
    /**
     * Get a list of a given type
     *
     * @param path the path in the database to
     * @param idProp
     */
    getList<T = any>(path: string | SerializedQuery<T>, idProp?: string): Promise<T[]>;
    /**
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
     * Pushes a value (typically a hash) under a given path in the
     * database but allowing Firebase to insert a unique "push key"
     * to ensure the value is placed into a Dictionary/Hash structure
     * of the form of "/{path}/{pushkey}/{value}"
     */
    push<T = any>(path: string, value: T): Promise<void>;
    /** validates the existance of a path in the database */
    exists(path: string): Promise<boolean>;
    protected abstract connectToFirebase(config: any): Promise<void>;
    protected abstract listenForConnectionStatus(): void;
    protected handleError(e: any, name: string, message?: string): Promise<never>;
    protected getFireMock(): Promise<void>;
}
export {};
