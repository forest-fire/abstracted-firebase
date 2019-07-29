"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function isValueBasedEvent(evt, context) {
    return context.targetType === "query";
}
exports.WatcherEventWrapper = (context) => (handler) => {
    return (snapshot, previousChildKey) => {
        const value = snapshot.val();
        const key = snapshot.key;
        const kind = "server-event";
        const fullEvent = Object.assign({}, context, { value,
            key,
            kind,
            previousChildKey });
        return handler(fullEvent);
    };
};
