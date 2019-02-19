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
    exports.WatcherEventWrapper = (context) => (handler) => {
        // tslint:disable-next-line:whitespace
        return (snapshot, previousChildKey) => {
            const event = {
                key: snapshot.key,
                value: snapshot.val()
            };
            if (previousChildKey) {
                event.previousChildKey = previousChildKey;
            }
            const fullEvent = Object.assign({}, event, context);
            return handler(fullEvent);
        };
    };
});
