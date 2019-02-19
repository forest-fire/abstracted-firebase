import { IFirebaseWatchHandler, IFirebaseWatchContext } from "./db";
export declare const WatcherEventWrapper: (context: IFirebaseWatchContext) => (handler: IFirebaseWatchHandler) => (snapshot: import("../../../../../../Users/ken/mine/forest-fire/abstracted-firebase/node_modules/firemock/dist/snapshot").default<any>, previousChildKey?: string) => any;
