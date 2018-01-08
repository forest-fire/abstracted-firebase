import * as admin from "firebase-admin";
import * as client from "@firebase/database-types";
import { SerializedQuery } from "serialized-query";
import { Mock, Reference } from "firemock";
export declare type Reference = admin.database.Reference | client.Reference;
export declare type Query = admin.database.Query | client.Query;
export declare type Database = admin.database.Database | client.FirebaseDatabase;
export declare type DataSnapshot = admin.database.DataSnapshot | client.DataSnapshot;
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
    protected static connection: Database;
    protected mocking: boolean;
    protected _mock: Mock;
    protected _waitingForConnection: Array<() => void>;
    protected _onConnected: IFirebaseListener[];
    protected _onDisconnected: IFirebaseListener[];
    protected _debugging: boolean;
    protected _mocking: boolean;
    protected _allowMocking: boolean;
    constructor(config?: IFirebaseConfig);
    ref(path: string): Reference<any>;
    allowMocking(): void;
    readonly mock: Mock;
    resetMockDb(): void;
    waitForConnection(): Promise<void | {}>;
    readonly isConnected: boolean;
    set<T = any>(path: string, value: T): Promise<void>;
    update<T = any>(path: string, value: Partial<T>): Promise<void>;
    remove<T = any>(path: string, ignoreMissing?: boolean): Promise<void>;
    getSnapshot(path: string | SerializedQuery): Promise<DataSnapshot>;
    getValue<T = any>(path: string): Promise<T>;
    getRecord<T = any>(path: string | SerializedQuery, idProp?: string): Promise<T>;
    getList<T = any[]>(path: string | SerializedQuery, idProp?: string): Promise<T[]>;
    getSortedList<T = any[]>(query: any, idProp?: string): Promise<T[]>;
    push<T = any>(path: string, value: T): Promise<any>;
    exists(path: string): Promise<boolean>;
    protected handleError(e: any, name: string, message?: string): Promise<never>;
}
