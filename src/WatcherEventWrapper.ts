import {
  IFirebaseWatchEvent,
  IFirebaseWatchHandler,
  IFirebaseWatchContext,
  IFirebaseWatchCoreEvent
} from "./db";

export const WatcherEventWrapper = (context: IFirebaseWatchContext) => (
  handler: IFirebaseWatchHandler
) => {
  // tslint:disable-next-line:whitespace
  return (snapshot: import("firemock").SnapShot, previousChildKey?: string) => {
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
