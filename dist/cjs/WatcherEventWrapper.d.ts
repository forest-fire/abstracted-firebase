import { IFirebaseWatchHandler, IFirebaseWatchContext } from "./types";
import { DataSnapshot } from "./index";
export declare const WatcherEventWrapper: (context: IFirebaseWatchContext) => (handler: IFirebaseWatchHandler) => (snapshot: DataSnapshot, previousChildKey?: string) => any;
