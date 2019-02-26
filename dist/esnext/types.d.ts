import { DataSnapshot, OnDisconnect, Query, ThenableReference } from "@firebase/database-types";
import { IDictionary } from "common-types";
export declare type EventType = "value" | "child_moved" | "child_removed" | "child_added" | "child_changed";
export interface IReference<T = any> extends IQuery {
    readonly key: string | null;
    readonly parent: IReference | null;
    readonly root: IReference;
    /** Writes data to a Database location */
    set(newVal: T, onComplete?: (a: Error | null) => void): Promise<void>;
    /** Write/update 1:M values to the Database, if you need to update multiple paths in DB then the keys must be deep paths notated by slash-notation */
    update(objectToMerge: Partial<T> | IDictionary<Partial<T>>, onComplete?: (a: Error | null) => void): Promise<void>;
    /** Like set() but also specifies the priority for that data */
    setWithPriority(newVal: T, newPriority: string | number | null, onComplete?: (a: Error | null) => void): Promise<any>;
    /** Removes the data at this Database location. Any data at child locations will also be deleted. */
    remove(onComplete?: (a: Error | null) => void): Promise<void>;
    /** Atomically modifies the data at this location */
    transaction(transactionUpdate: (a: Partial<T>) => any, onComplete?: (a: Error | null, b: boolean, c: DataSnapshot | null) => any, applyLocally?: boolean): Promise<ITransactionResult<T>>;
    /** Sets a priority for the data at this Database location. */
    setPriority(priority: string | number | null, onComplete?: (a: Error | null) => void): Promise<void>;
    /** Generates a new child location using a unique key and returns a Reference. */
    push(value?: any, onComplete?: (a: Error | null) => void): ThenableReference;
    /** Returns an OnDisconnect object - see Enabling Offline Capabilities in JavaScript for more information on how to use it. */
    onDisconnect(): OnDisconnect;
}
export interface ITransactionResult<T = any> {
    committed: boolean;
    snapshot: DataSnapshot;
    toJSON?: () => IDictionary;
}
export interface IQuery extends Query {
    on(eventType: EventType, callback: (a: DataSnapshot | null, b?: string) => any, cancelCallbackOrContext?: IDictionary | null, context?: IDictionary | null): (a: DataSnapshot | null, b?: string) => any;
}
