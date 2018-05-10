import { SerializedQuery } from "serialized-query";
import { Mock } from "firemock";
import { rtdb } from "firebase-api-surface";
export interface IPathSetter<T = any> {
    path: string;
    value: T;
}
export declare type FirebaseEvent = "child_added" | "child_removed" | "child_changed" | "child_moved" | "value";
export declare enum FirebaseBoolean {
    true = 1,
    false = 0,
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
    protected static isConnected: boolean;
    protected static isAuthorized: boolean;
    protected static connection: rtdb.IFirebaseDatabase;
    protected _mock: Mock;
    protected _waitingForConnection: Array<() => void>;
    protected _onConnected: IFirebaseListener[];
    protected _onDisconnected: IFirebaseListener[];
    protected _debugging: boolean;
    protected _mocking: boolean;
    protected _allowMocking: boolean;
    constructor(config?: IFirebaseConfig);
    query<T = any>(path: string): SerializedQuery<T>;
    ref(path: string): rtdb.IReference;
    allowMocking(): void;
    readonly mock: Mock;
    resetMockDb(): void;
    waitForConnection(): Promise<void | {}>;
    readonly isConnected: boolean;
    set<T = T>(path: string, value: T): Promise<void>;
    multiPathSet(base?: string): {
        _basePath: string;
        basePath(path?: string): string | any;
        add<X = any>(pathValue: IPathSetter<X>): any;
        readonly paths: string[];
        readonly fullPaths: string[];
        callback(cb: (err: any, pathSetters: IPathSetter<any>[]) => void): void;
        execute(): Promise<any>;
    };
    update<T = any>(path: string, value: Partial<T>): Promise<any>;
    remove<T = any>(path: string, ignoreMissing?: boolean): Promise<void>;
    getSnapshot(path: string | SerializedQuery): Promise<rtdb.IDataSnapshot>;
    getValue<T = any>(path: string): Promise<T>;
    getRecord<T = any>(path: string | SerializedQuery<T>, idProp?: string): Promise<T>;
    getList<T = any>(path: string | SerializedQuery<T>, idProp?: string): Promise<T[]>;
    getSortedList<T = any>(query: any, idProp?: string): Promise<T[]>;
    push<T = any>(path: string, value: T): Promise<void>;
    exists(path: string): Promise<boolean>;
    protected handleError(e: any, name: string, message?: string): Promise<never>;
}
