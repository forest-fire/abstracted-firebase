import { IDictionary, wait } from "common-types";
import { Parallel } from "wait-in-parallel";
import * as convert from "typed-conversions";
import { SerializedQuery } from "serialized-query";
import { slashNotation } from "./util";
import { rtdb } from "firebase-api-surface";
import { FileDepthExceeded } from "./errors/FileDepthExceeded";
import { UndefinedAssignment } from "./errors/UndefinedAssignment";
// tslint:disable-next-line:no-implicit-dependencies
import { Mock } from "firemock";
import { EventType } from "firebase-api-surface/dist/esnext/rtdb";

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

export type IMockLoadingState = "not-applicable" | "loaded" | "loading" | "timed-out";
/** time by which the dynamically loaded mock library should be loaded */
export const MOCK_LOADING_TIMEOUT = 2000;

export type DebuggingCallback = (message: string) => void;
export interface IFirebaseConfig {
  debugging?: boolean | DebuggingCallback;
  mocking?: boolean;
}
export interface IFirebaseListener {
  id: string;
  cb: (db: RealTimeDB) => void;
}

export interface IEmitter {
  emit: (event: string | symbol, ...args: any[]) => boolean;
  on: (event: string, value: any) => void;
  once: (event: string, value: any) => void;
}

export abstract class RealTimeDB {
  /** how many miliseconds before the attempt to connect to DB is timed out */
  public CONNECTION_TIMEOUT = 5000;
  /** Logs debugging information to the console */
  public enableDatabaseLogging: (
    logger?: boolean | ((a: string) => any),
    persistent?: boolean
  ) => any;

  protected abstract _eventManager: IEmitter;
  protected _isConnected: boolean = false;
  protected _mockLoadingState: IMockLoadingState = "not-applicable";
  // tslint:disable-next-line:whitespace
  protected _mock: Mock;
  protected _resetMockDb: () => void;
  protected _waitingForConnection: Array<() => void> = [];
  protected _onConnected: IFirebaseListener[] = [];
  protected _onDisconnected: IFirebaseListener[] = [];
  protected _debugging: boolean = false;
  protected _mocking: boolean = false;
  protected _allowMocking: boolean = false;

  protected app: any;
  protected _database: rtdb.IFirebaseDatabase;
  protected abstract _firestore: any;
  protected abstract _storage: any;
  protected abstract _messaging: any;
  protected abstract _auth: any;

  public initialize(config: IFirebaseConfig = {}) {
    if (config.mocking) {
      this._mocking = true;
      this.getFireMock();
    } else {
      this._mocking = false;
      this.connectToFirebase(config).then(() => this.listenForConnectionStatus());
    }
  }

  /**
   * watch
   *
   * Watch for firebase events based on a DB path or Query
   *
   * @param target a database path or a SerializedQuery
   * @param events an event type or an array of event types (e.g., "value", "child_added")
   * @param cb the callback function to call when event triggered
   */
  public watch(
    target: string | SerializedQuery,
    events: EventType | EventType[],
    cb: any
  ) {
    if (!Array.isArray(events)) {
      events = [events];
    }
    events.map(evt => {
      if (typeof target === "string") {
        this.ref(slashNotation(target)).on(evt, cb);
      } else {
        target
          .setDB(this)
          .deserialize()
          .on(evt, cb);
      }
    });
  }

  public unWatch(events?: EventType | EventType[], cb?: any) {
    if (!Array.isArray(events)) {
      events = [events];
    }
    if (!events) {
      this.ref().off();
      return;
    }
    events.map(evt => {
      if (cb) {
        this.ref().off(evt, cb);
      } else {
        this.ref().off(evt);
      }
    });
  }

  /**
   * Get a Firebase SerializedQuery reference
   *
   * @param path path for query
   */
  public query<T = any>(path: string) {
    return SerializedQuery.path<T>(path);
  }

  /** Get a DB reference for a given path in Firebase */
  public ref(path: string = "/"): rtdb.IReference {
    return this._mocking
      ? (this.mock.ref(path) as rtdb.IReference)
      : (this._database.ref(path) as rtdb.IReference);
  }

  public get isMockDb() {
    return this._mocking;
  }

  public get mock() {
    if (!this._mocking && !this._allowMocking) {
      const e = new Error(
        "You can not mock the database without setting mocking in the constructor"
      );
      e.name = "AbstractedFirebase::NotAllowed";
      throw e;
    }
    if (this._mockLoadingState === "loading") {
      const e = new Error(
        `Loading the mock library is an asynchronous task; typically it takes very little time but it is currently in process. You can listen to "waitForConnection()" to ensure the mock library is ready.`
      );
      e.name = "AbstractedFirebase::AsyncError";
      throw e;
    }

    if (!this._mock) {
      const e = new Error(`Attempting to use mock getter but _mock is not set!`);
      e.name = "AbstractedFirebase::NotAllowed";
      throw e;
    }

    return this._mock;
  }

  public async waitForConnection() {
    if (this._mocking) {
      // MOCKING
      if (this._mockLoadingState === "loaded") {
        return;
      }
      const timeout = new Date().getTime() + MOCK_LOADING_TIMEOUT;
      while (this._mockLoadingState === "loading" && new Date().getTime() < timeout) {
        await wait(1);
      }

      return;
    } else {
      // NON-MOCKING
      if (this.isConnected) {
        return;
      }

      const connectionEvent = async () => {
        this._eventManager.once("connection", (state: boolean) => {
          if (state) {
            return;
          } else {
            throw Error(`While waiting for connection received a disconnect message`);
          }
        });
      };

      const p = new Parallel();
      p.add("connection", connectionEvent, this.CONNECTION_TIMEOUT);
      await p.isDone();
      this._isConnected = true;

      return this;
    }
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
            `You have attempted to add the path "${
              pathValue.path
            }" twice to a MultiPathSet operation.`
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
      get payload() {
        return mps.map(i => {
          i.path = [api._basePath, i.path].join("/").replace(/[\/]{2,3}/g, "/");
          return i;
        });
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

  protected abstract connectToFirebase(config: any): Promise<void>;
  protected abstract listenForConnectionStatus(): void;

  protected handleError(e: any, name: string, message = "") {
    console.error(`Error ${message}:`, e);
    return Promise.reject({
      code: `firebase/${name}`,
      message: message + e.message || e
    });
  }

  protected async getFireMock() {
    try {
      this._mockLoadingState = "loading";
      // tslint:disable-next-line:no-implicit-dependencies
      const FireMock = await import("firemock");
      this._mockLoadingState = "loaded";
      this._mock = new FireMock.Mock();
      this._isConnected = true;
      this._mocking = true;
    } catch (e) {
      console.error(`There was an error asynchronously loading Firemock library.`);
      if (e.stack) {
        console.log(`The stack trace was:\n`, e.stack);
      }
      throw e;
    }
  }
}
