import { SnapShot } from "firemock";
import { IFirebaseWatchHandler, IFirebaseWatchContext } from "./db";
export declare const WatcherEventWrapper: (context: IFirebaseWatchContext) => (handler: IFirebaseWatchHandler) => (snapshot: SnapShot<any>, previousChildKey?: string) => any;
