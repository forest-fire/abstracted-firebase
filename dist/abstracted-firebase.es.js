import firebaseApiSurface from 'firebase-api-surface';

function unwrapExports (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

function _typeof(obj) {
  if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
    _typeof = function (obj) {
      return typeof obj;
    };
  } else {
    _typeof = function (obj) {
      return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
    };
  }

  return _typeof(obj);
}

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

function _defineProperties(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor) descriptor.writable = true;
    Object.defineProperty(target, descriptor.key, descriptor);
  }
}

function _createClass(Constructor, protoProps, staticProps) {
  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
  if (staticProps) _defineProperties(Constructor, staticProps);
  return Constructor;
}

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

var __awaiter = undefined && undefined.__awaiter || function (thisArg, _arguments, P, generator) {
  return new (P || (P = Promise))(function (resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }

    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }

    function step(result) {
      result.done ? resolve(result.value) : new P(function (resolve) {
        resolve(result.value);
      }).then(fulfilled, rejected);
    }

    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};

Object.defineProperty(exports, "__esModule", {
  value: true
});

var convert = require("typed-conversions");

var serialized_query_1 = require("serialized-query");

var util_1 = require("./util");

var firemock_1 = require("firemock");

var FileDepthExceeded_1 = require("./errors/FileDepthExceeded");

var UndefinedAssignment_1 = require("./errors/UndefinedAssignment");

var FirebaseBoolean;

(function (FirebaseBoolean) {
  FirebaseBoolean[FirebaseBoolean["true"] = 1] = "true";
  FirebaseBoolean[FirebaseBoolean["false"] = 0] = "false";
})(FirebaseBoolean = exports.FirebaseBoolean || (exports.FirebaseBoolean = {}));

var RealTimeDB =
/*#__PURE__*/
function () {
  function RealTimeDB() {
    var config = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, RealTimeDB);

    this._waitingForConnection = [];
    this._onConnected = [];
    this._onDisconnected = [];
    this._debugging = false;
    this._mocking = false;
    this._allowMocking = false;

    if (config.mocking) {
      this._mocking = true;
      this._mock = new firemock_1.Mock();
    }
  }

  _createClass(RealTimeDB, [{
    key: "query",
    value: function query(path) {
      return serialized_query_1.SerializedQuery.path(path);
    }
  }, {
    key: "ref",
    value: function ref(path) {
      return this._mocking ? this.mock.ref(path) : RealTimeDB.connection.ref(path);
    }
  }, {
    key: "allowMocking",
    value: function allowMocking() {
      this._allowMocking = true;
    }
  }, {
    key: "resetMockDb",
    value: function resetMockDb() {
      firemock_1.resetDatabase();
    }
  }, {
    key: "waitForConnection",
    value: function waitForConnection() {
      return __awaiter(this, void 0, void 0, function* () {
        var _this = this;

        if (RealTimeDB.isConnected) {
          return Promise.resolve();
        }

        return new Promise(function (resolve) {
          var cb = function cb() {
            resolve();
          };

          _this._waitingForConnection.push(cb);
        });
      });
    }
  }, {
    key: "set",
    value: function set(path, value) {
      return __awaiter(this, void 0, void 0, function* () {
        try {
          return this.ref(path).set(value);
        } catch (e) {
          if (e.message.indexOf("path specified exceeds the maximum depth that can be written") !== -1) {
            console.log("FILE DEPTH EXCEEDED");
            throw new FileDepthExceeded_1.default(e);
          }

          if (e.name === "Error") {
            e.name = "AbstractedFirebaseSetError";
          }

          if (e.message.indexOf("First argument contains undefined in property") !== -1) {
            e.name = "FirebaseUndefinedValueAssignment";
            throw new UndefinedAssignment_1.default(e);
          }

          throw e;
        }
      });
    }
  }, {
    key: "multiPathSet",
    value: function multiPathSet(base) {
      var mps = [];
      var ref = this.ref.bind(this);

      var _callback;

      var api = {
        _basePath: base || "/",
        basePath: function basePath(path) {
          if (path === undefined) {
            return api._basePath;
          }

          api._basePath = path;
          return api;
        },
        add: function add(pathValue) {
          var exists = new Set(api.paths);

          if (pathValue.path.indexOf("/") === -1) {
            pathValue.path = "/" + pathValue.path;
          }

          if (exists.has(pathValue.path)) {
            var e = new Error("You have attempted to add the path \"".concat(pathValue.path, "\" twice."));
            e.code = "duplicate-path";
            throw e;
          }

          mps.push(pathValue);
          return api;
        },

        get paths() {
          return mps.map(function (i) {
            return i.path;
          });
        },

        get fullPaths() {
          return mps.map(function (i) {
            return [api._basePath, i.path].join("/").replace(/[\/]{2,3}/g, "/");
          });
        },

        callback: function callback(cb) {
          _callback = cb;
          return;
        },
        execute: function execute() {
          return __awaiter(this, void 0, void 0, function* () {
            var updateHash = {};
            var fullyQualifiedPaths = mps.map(function (i) {
              return Object.assign({}, i, {
                path: [api._basePath, i.path].join("/").replace(/[\/]{2,3}/g, "/")
              });
            });
            fullyQualifiedPaths.map(function (item) {
              updateHash[item.path] = item.value;
            });
            return ref().update(updateHash).then(function () {
              if (_callback) {
                _callback(null, mps);

                return;
              }
            }).catch(function (e) {
              if (_callback) {
                _callback(e, mps);
              }

              throw e;
            });
          });
        }
      };
      return api;
    }
  }, {
    key: "update",
    value: function update(path, value) {
      return __awaiter(this, void 0, void 0, function* () {
        try {
          return this.ref(path).update(value);
        } catch (e) {
          if (e.name === "Error") {
            e.name = "AbstractedFirebaseUpdateError";
          }

          if (e.message.indexOf("First argument path specified exceeds the maximum depth") !== -1) {
            e.name = "AbstractedFirebaseUpdateDepthError";
          }

          throw e;
        }
      });
    }
  }, {
    key: "remove",
    value: function remove(path) {
      var ignoreMissing = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
      return __awaiter(this, void 0, void 0, function* () {
        var _this2 = this;

        var ref = this.ref(path);
        return ref.remove().catch(function (e) {
          if (ignoreMissing && e.message.indexOf("key is not defined") !== -1) {
            return Promise.resolve();
          }

          _this2.handleError(e, "remove", "attempt to remove ".concat(path, " failed: "));
        });
      });
    }
  }, {
    key: "getSnapshot",
    value: function getSnapshot(path) {
      return __awaiter(this, void 0, void 0, function* () {
        return typeof path === "string" ? this.ref(util_1.slashNotation(path)).once("value") : path.setDB(this).execute();
      });
    }
  }, {
    key: "getValue",
    value: function getValue(path) {
      return __awaiter(this, void 0, void 0, function* () {
        var snap = yield this.getSnapshot(path);
        return snap.val();
      });
    }
  }, {
    key: "getRecord",
    value: function getRecord(path) {
      var idProp = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "id";
      return __awaiter(this, void 0, void 0, function* () {
        return this.getSnapshot(path).then(function (snap) {
          var object = snap.val();

          if (_typeof(object) !== "object") {
            object = {
              value: snap.val()
            };
          }

          return Object.assign({}, object, _defineProperty({}, idProp, snap.key));
        });
      });
    }
  }, {
    key: "getList",
    value: function getList(path) {
      var idProp = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "id";
      return __awaiter(this, void 0, void 0, function* () {
        return this.getSnapshot(path).then(function (snap) {
          return snap.val() ? convert.snapshotToArray(snap, idProp) : [];
        });
      });
    }
  }, {
    key: "getSortedList",
    value: function getSortedList(query) {
      var idProp = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "id";
      return __awaiter(this, void 0, void 0, function* () {
        return this.getSnapshot(query).then(function (snap) {
          return convert.snapshotToArray(snap, idProp);
        });
      });
    }
  }, {
    key: "push",
    value: function push(path, value) {
      return __awaiter(this, void 0, void 0, function* () {
        this.ref(path).push(value);
      });
    }
  }, {
    key: "exists",
    value: function exists(path) {
      return __awaiter(this, void 0, void 0, function* () {
        return this.getSnapshot(path).then(function (snap) {
          return snap.val() ? true : false;
        });
      });
    }
  }, {
    key: "handleError",
    value: function handleError(e, name) {
      var message = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "";
      console.error("Error ".concat(message, ":"), e);
      return Promise.reject({
        code: "firebase/".concat(name),
        message: message + e.message || e
      });
    }
  }, {
    key: "mock",
    get: function get() {
      if (!this._mocking && !this._allowMocking) {
        throw new Error("You can not mock the database without setting mocking in the constructor");
      }

      if (!this._mock) {
        this._mock = new firemock_1.Mock();
        firemock_1.resetDatabase();
      }

      return this._mock;
    }
  }, {
    key: "isConnected",
    get: function get() {
      return RealTimeDB.isConnected;
    }
  }]);

  return RealTimeDB;
}();

RealTimeDB.isConnected = false;
RealTimeDB.isAuthorized = false;
exports.RealTimeDB = RealTimeDB;

var db = /*#__PURE__*/Object.freeze({

});

var lib = createCommonjsModule(function (module, exports) {

Object.defineProperty(exports, "__esModule", {
  value: true
});



exports.default = db.RealTimeDB;

var db_2 = db;

exports.RealTimeDB = db_2.RealTimeDB;
exports.FirebaseBoolean = db_2.FirebaseBoolean;



exports.rtdb = firebaseApiSurface.rtdb;
exports.auth = firebaseApiSurface.auth;
});

var index = unwrapExports(lib);
var lib_1 = lib.RealTimeDB;
var lib_2 = lib.FirebaseBoolean;
var lib_3 = lib.rtdb;
var lib_4 = lib.auth;

export default index;
export { lib_1 as RealTimeDB, lib_2 as FirebaseBoolean, lib_3 as rtdb, lib_4 as auth };
