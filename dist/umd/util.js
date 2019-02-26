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
    function slashNotation(path) {
        return path.substr(0, 5) === ".info"
            ? path.substr(0, 5) + path.substring(5).replace(/\./g, "/")
            : path.replace(/\./g, "/");
    }
    exports.slashNotation = slashNotation;
    function _getFirebaseType(context, kind) {
        if (!this.app) {
            const e = new Error(`You must first connect before using the ${kind}() API`);
            e.name = "NotAllowed";
            throw e;
        }
        const property = `_${kind}`;
        if (!context[property]) {
            context[property] = this.app.storage();
        }
        return context[property];
    }
    exports._getFirebaseType = _getFirebaseType;
});