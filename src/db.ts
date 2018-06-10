import { IDictionary } from "common-types";
import * as convert from "typed-conversions";
import { SerializedQuery } from "serialized-query";
import { slashNotation } from "./util";
import { rtdb } from "firebase-api-surface";
import FileDepthExceeded from "./errors/FileDepthExceeded";
import UndefinedAssignment from "./errors/UndefinedAssignment";

export interface IPathSetter<T = any> {
  path: string;
  value: T;
}

export type FirebaseEvent =
  | "child_added"
  | "child_removed"
  | "child_changed"
  | "child_moved"
  | "value";

export enum FirebaseBoolean {
  true = 1,
  false = 0
}

export type DebuggingCallback = (message: string) => void;
export interface IFirebaseConfig {
  debugging?: boolean | DebuggingCallback;
  mocking?: boolean;
}
export interface IFirebaseListener {
  id: string;
  cb: (db: RealTimeDB) => void;
}

export abstract class RealTimeDB {
  protected _isConnected: boolean = false;
  protected _database: rtdb.IFirebaseDatabase;
  // tslint:disable-next-line:whitespace
  protected _mock: import("firemock").Mock;
  protected _resetMockDb: () => void;
  protected _waitingForConnection: Array<() => void> = [];
  protected _onConnected: IFirebaseListener[] = [];
  protected _onDisconnected: IFirebaseListener[] = [];
  protected _debugging: boolean = false;
  protected _mocking: boolean = false;
  protected _allowMocking: boolean = false;

  public query<T = any>(path: string) {
    return SerializedQuery.path<T>(path);
  }

  /** Get a DB reference for a given path in Firebase */
  public ref(path: string): rtdb.IReference {
    return this._mocking
      ? (this.mock.ref(path) as rtdb.IReference)
      : (this._database.ref(path) as rtdb.IReference);
  }

  /**
   * Typically mocking functionality is disabled if mocking is not on
   * but there are cases -- particular in testing against a real DB --
   * where the mock functionality is still useful for building a base state.
   */
  public allowMocking() {
    this._allowMocking = true;
  }

  public get mock() {
    if (!this._mocking && !this._allowMocking) {
      const e = new Error(
        "You can not mock the database without setting mocking in the constructor"
      );
      e.name = "AbstractedFirebase::NotAllowed";
      throw e;
    }

    if (!this._mock) {
      const e = new Error(`Attempting to use mock getter but _mock is not set!`);
      e.name = "AbstractedFirebase::NotAllowed";
      throw e;
    }

    return this._mock;
  }

  /** clears all "connections" and state from the database */
  public resetMockDb() {
    this._resetMockDb();
  }

  public async waitForConnection() {
    if (this.isConnected) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      const cb = () => {
        resolve();
      };
      this._waitingForConnection.push(cb);
    });
  }

  public get isConnected() {
    return this._isConnected;
  }

  /** set a "value" in the database at a given path */
  public async set<T = T>(path: string, value: T): Promise<void> {
    try {
      return this.ref(path).set(value);
    } catch (e) {
      if (
        e.message.indexOf(
          "path specified exceeds the maximum depth that can be written"
        ) !== -1
      ) {
        console.log("FILE DEPTH EXCEEDED");
        throw new FileDepthExceeded(e);
      }

      if (e.name === "Error") {
        e.name = "AbstractedFirebaseSetError";
      }
      if (e.message.indexOf("First argument contains undefined in property") !== -1) {
        e.name = "FirebaseUndefinedValueAssignment";
        throw new UndefinedAssignment(e);
      }
      throw e;
    }
  }

  /**
   * Equivalent to Firebase's traditional "multi-path updates" which are
   * in behaviour are really "multi-path SETs". Calling this function provides
   * access to simplified API for adding and executing this operation.
   *
   * @param paths an array of path and value updates
   */
  public multiPathSet(base?: string) {
    const mps: IPathSetter[] = [];
    const ref = this.ref.bind(this);
    let callback: (err: any, pathSetters: IPathSetter[]) => void;
    const api = {
      /** The base reference path which all paths will be relative to */
      _basePath: base || "/",
      // a fluent API setter/getter for _basePath
      basePath(path?: string) {
        if (path === undefined) {
          return api._basePath;
        }

        api._basePath = path;
        return api;
      },
      /** Add in a new path and value to be included in the operation */
      add<X = any>(pathValue: IPathSetter<X>) {
        const exists = new Set(api.paths);
        if (pathValue.path.indexOf("/") === -1) {
          pathValue.path = "/" + pathValue.path;
        }
        if (exists.has(pathValue.path)) {
          const e: any = new Error(
            `You have attempted to add the path "${pathValue.path}" twice.`
          );
          e.code = "duplicate-path";
          throw e;
        }
        mps.push(pathValue);
        return api;
      },
      /** the relative paths from the base which will be updated upon execution */
      get paths() {
        return mps.map(i => i.path);
      },
      /** the absolute paths (including the base offset) which will be updated upon execution */
      get fullPaths() {
        return mps.map(i => [api._basePath, i.path].join("/").replace(/[\/]{2,3}/g, "/"));
      },
      /** receive a call back on conclusion of the firebase operation */
      callback(cb: (err: any, pathSetters: IPathSetter[]) => void) {
        callback = cb;
        return;
      },
      async execute() {
        const updateHash: IDictionary = {};
        const fullyQualifiedPaths = mps.map(i => ({
          ...i,
          path: [api._basePath, i.path].join("/").replace(/[\/]{2,3}/g, "/")
        }));
        fullyQualifiedPaths.map(item => {
          updateHash[item.path] = item.value;
        });

        return ref()
          .update(updateHash)
          .then(() => {
            if (callback) {
              callback(null, mps);
              return;
            }
          })
          .catch((e: any) => {
            if (callback) {
              callback(e, mps);
            }

            throw e;
          });
      }
    };

    return api;
  }

  public async update<T = any>(path: string, value: Partial<T>): Promise<any> {
    try {
      return this.ref(path).update(value);
    } catch (e) {
      if (e.name === "Error") {
        e.name = "AbstractedFirebaseUpdateError";
      }
      if (
        e.message.indexOf("First argument path specified exceeds the maximum depth") !==
        -1
      ) {
        e.name = "AbstractedFirebaseUpdateDepthError";
      }
      throw e;
    }
  }

  public async remove<T = any>(path: string, ignoreMissing = false) {
    const ref = this.ref(path);

    return ref.remove().catch((e: any) => {
      if (ignoreMissing && e.message.indexOf("key is not defined") !== -1) {
        return Promise.resolve();
      }

      this.handleError(e, "remove", `attempt to remove ${path} failed: `);
    });
  }

  /** returns the firebase snapshot at a given path in the database */
  public async getSnapshot(path: string | SerializedQuery): Promise<rtdb.IDataSnapshot> {
    return typeof path === "string"
      ? this.ref(slashNotation(path)).once("value")
      : path.setDB(this).execute();
  }

  /** returns the JS value at a given path in the database */
  public async getValue<T = any>(path: string): Promise<T> {
    const snap = await this.getSnapshot(path);
    return snap.val() as T;
  }

  /**
   * Gets a snapshot from a given path in the DB
   * and converts it to a JS object where the snapshot's key
   * is included as part of the record (as 'id' by default)
   */
  public async getRecord<T = any>(
    path: string | SerializedQuery<T>,
    idProp = "id"
  ): Promise<T> {
    return this.getSnapshot(path).then(snap => {
      let object = snap.val();

      if (typeof object !== "object") {
        object = { value: snap.val() };
      }

      return { ...object, ...{ [idProp]: snap.key } };
    });
  }

  /**
   * Get a list of a given type
   *
   * @param path the path in the database to
   * @param idProp
   */
  public async getList<T = any>(
    path: string | SerializedQuery<T>,
    idProp = "id"
  ): Promise<T[]> {
    return this.getSnapshot(path).then(snap => {
      return snap.val() ? convert.snapshotToArray<T>(snap, idProp) : [];
    });
  }

  /**
   * getSortedList() will return the sorting order that was defined in the Firebase
   * Query. This _can_ be useful but often the sort orders
   * really intended for the server only (so that filteration
   * is done on the right set of data before sending to client).
   *
   * @param query Firebase "query ref"
   * @param idProp what property name should the Firebase key be converted to (default is "id")
   */
  public async getSortedList<T = any>(query: any, idProp = "id"): Promise<T[]> {
    return this.getSnapshot(query).then(snap => {
      return convert.snapshotToArray<T>(snap, idProp);
    });
  }

  /**
   * Pushes a value (typically a hash) under a given path in the
   * database but allowing Firebase to insert a unique "push key"
   * to ensure the value is placed into a Dictionary/Hash structure
   * of the form of "/{path}/{pushkey}/{value}"
   */
  public async push<T = any>(path: string, value: T) {
    this.ref(path).push(value);
  }

  /** validates the existance of a path in the database */
  public async exists(path: string): Promise<boolean> {
    return this.getSnapshot(path).then(snap => (snap.val() ? true : false));
  }

  /**
   * initialize
   *
   * Allows the core module to initialize the object after the
   * client or admin modules constructors are called
   *
   */
  protected initialize(config: IFirebaseConfig = {}) {
    if (config.mocking) {
      this._mocking = true;
      this.getFireMock().then(() => {
        console.log("mocking db established");
      });
    }
  }

  protected handleError(e: any, name: string, message = "") {
    console.error(`Error ${message}:`, e);
    return Promise.reject({
      code: `firebase/${name}`,
      message: message + e.message || e
    });
  }

  protected async getFireMock() {
    try {
      // tslint:disable-next-line:no-implicit-dependencies
      const FireMock = await import("firemock");
      this._mock = new FireMock.Mock();

      this._mock.db.resetDatabase();
      this._mocking = true;

      return FireMock;
    } catch (e) {
      console.error(
        `There was an error asynchronously loading Firemock library.`,
        e.message
      );
      console.log(`The stack trace was:\n`, e.stack);
      console.info(`\nNo error thrown but no mocking functionality is available!`);

      this._mocking = false;
    }
  }
}
