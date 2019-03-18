"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function isValueBasedEvent(evt, context) {
    return context.targetType === "query";
}
exports.WatcherEventWrapper = (context) => (handler) => {
    return (snapshot, previousChildKey) => {
        let event;
        const value = snapshot.val();
        if (isValueBasedEvent(event, context)) {
            event = {
                previousChildKey,
                key: snapshot.key,
                value,
                eventType: context.eventType,
                targetType: "query"
            };
        }
        else {
            event = {
                key: snapshot.key,
                eventType: context.eventType,
                targetType: "path",
                paths: value
            };
        }
        const fullEvent = event;
        return handler(fullEvent);
    };
};
