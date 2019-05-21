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
    class AbstractedError extends Error {
        constructor(message, errorCode) {
            super(message);
            this.code = `abstracted-firebase/${errorCode}`;
            this.name = this.code.split("/")[1];
        }
    }
    exports.AbstractedError = AbstractedError;
});
