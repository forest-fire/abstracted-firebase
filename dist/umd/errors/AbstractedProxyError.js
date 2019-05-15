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
    class AbstractedProxyError extends Error {
        constructor(e, errName = null, context) {
            super(context
                ? `${e.name ? `[Proxy of ${e.name}]` : ""}` + context + ".\n" + e.message
                : `${e.name ? `[Proxy of ${e.name}]` : ""}` + e.message);
            this.stack = e.stack;
            const name = `abstracted-firebase/${errName ? errName : e.name || "unknown-error"}`;
            if (e.name === "Error") {
                this.name = name;
            }
            this.code = name.split("/")[1];
            this.stack = e.stack;
        }
    }
    exports.AbstractedProxyError = AbstractedProxyError;
});
