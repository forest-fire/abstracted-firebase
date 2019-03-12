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
    let event: IFirebaseWatchEvent;
    const value = snapshot.val();

    if (isValueBasedEvent(event, context)) {
      event = {
        previousChildKey,
        key: snapshot.key,
        value,
        eventType: context.eventType,
        targetType: "query"
      };
    } else {
      event = {
        key: snapshot.key,
        eventType: context.eventType,
        targetType: "path",
        paths: value
      };
    }

    const fullEvent: IFirebaseWatchEvent = { ...event, ...context };

    return handler(fullEvent);
  };
};
