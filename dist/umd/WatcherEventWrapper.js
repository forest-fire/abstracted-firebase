(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
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
            const fullEvent = Object.assign({}, event, context);
            return handler(fullEvent);
        };
    };
});
