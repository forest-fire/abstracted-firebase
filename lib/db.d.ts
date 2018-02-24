import { SerializedQuery } from "serialized-query";
import { Mock } from "firemock";
import { rtdb } from "firebase-api-surface";
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
export declare abstract class RealTimeDB<T = any> {
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
    readonly query: SerializedQuery<T>;
    ref(path: string): rtdb.IReference;
    allowMocking(): void;
    readonly mock: Mock;
    resetMockDb(): void;
    waitForConnection(): Promise<void | {}>;
    readonly isConnected: boolean;
    set<K = T>(path: string, value: K): Promise<void>;
    update<K = T>(path: string, value: Partial<K>): Promise<any>;
    remove<K = T>(path: string, ignoreMissing?: boolean): Promise<void>;
    getSnapshot(path: string | SerializedQuery): Promise<rtdb.IDataSnapshot>;
    getValue<K = T>(path: string): Promise<K>;
    getRecord<K = T>(path: string | SerializedQuery<K>, idProp?: string): Promise<K>;
    getList<K = T>(path: string | SerializedQuery<K>, idProp?: string): Promise<K[]>;
    getSortedList<K = T>(query: any, idProp?: string): Promise<K[]>;
    push<K = T>(path: string, value: K): Promise<void>;
    exists(path: string): Promise<boolean>;
    protected handleError(e: any, name: string, message?: string): Promise<never>;
}
