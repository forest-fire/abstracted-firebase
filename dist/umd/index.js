(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./db", "./errors/FileDepthExceeded", "./errors/UndefinedAssignment", "./util", "@firebase/database-types", "@firebase/auth-types", "./types"], factory);
    }
})(function (require, exports) {
    "use strict";
    function __export(m) {
        for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
    }
    Object.defineProperty(exports, "__esModule", { value: true });
    var db_1 = require("./db");
    exports.RealTimeDB = db_1.RealTimeDB;
    var FileDepthExceeded_1 = require("./errors/FileDepthExceeded");
    exports.FileDepthExceeded = FileDepthExceeded_1.FileDepthExceeded;
    var UndefinedAssignment_1 = require("./errors/UndefinedAssignment");
    exports.UndefinedAssignment = UndefinedAssignment_1.UndefinedAssignment;
    var util_1 = require("./util");
    exports._getFirebaseType = util_1._getFirebaseType;
    var database_types_1 = require("@firebase/database-types");
    exports.FirebaseDatabase = database_types_1.FirebaseDatabase;
    var auth_types_1 = require("@firebase/auth-types");
    exports.FirebaseAuth = auth_types_1.FirebaseAuth;
    __export(require("./types"));
    function isMockConfig(config = {}) {
        return config.mocking === true;
    }
    exports.isMockConfig = isMockConfig;
    function isRealDbConfig(config) {
        return config.mocking !== true;
    }
    exports.isRealDbConfig = isRealDbConfig;
});
