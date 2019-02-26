import {
  IFirebaseWatchEvent,
  IFirebaseWatchHandler,
  IFirebaseWatchContext,
  IFirebaseWatchCoreEvent
} from "./db";
import { DataSnapshot } from "@firebase/database-types";

export const WatcherEventWrapper = (context: IFirebaseWatchContext) => (
  handler: IFirebaseWatchHandler
) => {
  // tslint:disable-next-line:whitespace
  return (snapshot: DataSnapshot, previousChildKey?: string) => {
    const event: IFirebaseWatchCoreEvent = {
      key: snapshot.key,
      value: snapshot.val()
    };
    if (previousChildKey) {
      event.previousChildKey = previousChildKey;
    }
    const fullEvent: IFirebaseWatchEvent = { ...event, ...context };

    return handler(fullEvent);
  };
};
