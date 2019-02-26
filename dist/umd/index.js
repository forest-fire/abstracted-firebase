(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./db", "./errors/FileDepthExceeded", "./errors/UndefinedAssignment", "./util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var db_1 = require("./db");
    exports.RealTimeDB = db_1.RealTimeDB;
    exports.FirebaseBoolean = db_1.FirebaseBoolean;
    var FileDepthExceeded_1 = require("./errors/FileDepthExceeded");
    exports.FileDepthExceeded = FileDepthExceeded_1.FileDepthExceeded;
    var UndefinedAssignment_1 = require("./errors/UndefinedAssignment");
    exports.UndefinedAssignment = UndefinedAssignment_1.UndefinedAssignment;
    var util_1 = require("./util");
    exports._getFirebaseType = util_1._getFirebaseType;
});
