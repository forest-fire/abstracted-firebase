import {
  IFirebaseWatchEvent,
  IFirebaseWatchHandler,
  IFirebaseWatchContext,
  IValueBasedWatchEvent,
  IPathBasedWatchEvent
} from "./types";
import { DataSnapshot } from "@firebase/database-types";

function isValueBasedEvent(
  evt: IFirebaseWatchEvent,
  context: IFirebaseWatchContext
): evt is IValueBasedWatchEvent {
  return context.targetType === "query";
}

export const WatcherEventWrapper = (context: IFirebaseWatchContext) => (
  handler: IFirebaseWatchHandler
) => {
  return (snapshot: DataSnapshot, previousChildKey?: string) => {
    const value = snapshot.val();
    const key = snapshot.key;
    const kind = "server-event";
    const fullEvent: IFirebaseWatchEvent = {
      ...context,
      value,
      key,
      kind,
      previousChildKey
    };

    return handler(fullEvent);
  };
};
