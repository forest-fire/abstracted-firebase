import { IFirebaseWatchHandler, IFirebaseWatchContext } from "./db";
import { DataSnapshot } from "@firebase/database-types";
export declare const WatcherEventWrapper: (context: IFirebaseWatchContext) => (handler: IFirebaseWatchHandler) => (snapshot: DataSnapshot, previousChildKey?: string) => any;
