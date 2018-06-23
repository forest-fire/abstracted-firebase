import { IDictionary } from "common-types";
// tslint:disable-next-line:no-implicit-dependencies
import { SnapShot } from "firemock";
import {
  IFirebaseWatchEvent,
  IFirebaseWatchHandler,
  IFirebaseWatchContext,
  IFirebaseWatchCoreEvent
} from "./db";

export const WatcherEventWrapper = (context: IFirebaseWatchContext) => (
  handler: IFirebaseWatchHandler
) => {
  return (snapshot: SnapShot, previousChildKey?: string) => {
    const event: IFirebaseWatchCoreEvent = {
      key: snapshot.key,
      value: snapshot.val()
    };
    if (previousChildKey) {
      event.previousChildKey = previousChildKey;
    }
    const fullEvent: IFirebaseWatchEvent = { ...event, ...context };
    console.log("FULL EVENT", fullEvent);

    return handler(fullEvent);
  };
};
