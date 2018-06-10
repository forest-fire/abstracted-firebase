import { SerializedQuery } from "serialized-query";
import { rtdb } from "firebase-api-surface";
export interface IPathSetter<T = any> {
    path: string;
    value: T;
}
export declare type FirebaseEvent = "child_added" | "child_removed" | "child_changed" | "child_moved" | "value";
export declare enum FirebaseBoolean {
    true = 1,
    false = 0
}
export declare type DebuggingCallback = (message: string) => void;
export interface IFirebaseConfig {
    debugging?: boolean | DebuggingCallback;
    mocking?: boolean;
}
export interface IFirebaseListener {
    id: string;
    cb: (db: RealTimeDB) => void;
}
export declare abstract class RealTimeDB {
    protected _isConnected: boolean;
    protected _database: rtdb.IFirebaseDatabase;
    protected _mock: import("firemock").Mock;
    protected _resetMockDb: () => void;
    protected _waitingForConnection: Array<() => void>;
    protected _onConnected: IFirebaseListener[];
    protected _onDisconnected: IFirebaseListener[];
    protected _debugging: boolean;
    protected _mocking: boolean;
    protected _allowMocking: boolean;
    constructor(config?: IFirebaseConfig);
    query<T = any>(path: string): SerializedQuery<T>;
    /** Get a DB reference for a given path in Firebase */
    ref(path: string): rtdb.IReference;
    /**
     * Typically mocking functionality is disabled if mocking is not on
     * but there are cases -- particular in testing against a real DB --
     * where the mock functionality is still useful for building a base state.
     */
    allowMocking(): void;
    readonly mock: import("firemock/dist/esnext/mock").default;
    /** clears all "connections" and state from the database */
    resetMockDb(): void;
    waitForConnection(): Promise<void | {}>;
    readonly isConnected: boolean;
    /** set a "value" in the database at a given path */
    set<T = T>(path: string, value: T): Promise<void>;
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
        /** receive a call back on conclusion of the firebase operation */
        callback(cb: (err: any, pathSetters: IPathSetter<any>[]) => void): void;
        execute(): Promise<any>;
    };
    update<T = any>(path: string, value: Partial<T>): Promise<any>;
    remove<T = any>(path: string, ignoreMissing?: boolean): Promise<void>;
    /** returns the firebase snapshot at a given path in the database */
    getSnapshot(path: string | SerializedQuery): Promise<rtdb.IDataSnapshot>;
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
    protected handleError(e: any, name: string, message?: string): Promise<never>;
    protected getFireMock(): Promise<typeof import("firemock")>;
}
