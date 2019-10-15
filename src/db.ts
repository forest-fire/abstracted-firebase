// tslint:disable: member-ordering
// tslint:disable:no-implicit-dependencies
import { IDictionary, wait } from "common-types";
import * as convert from "typed-conversions";
import { SerializedQuery } from "serialized-query";
import { slashNotation } from "./util";
import { FileDepthExceeded } from "./errors/FileDepthExceeded";
import { UndefinedAssignment } from "./errors/UndefinedAssignment";
import { WatcherEventWrapper } from "./WatcherEventWrapper";
import {
  FirebaseDatabase,
  DataSnapshot,
  EventType,
  Reference
} from "@firebase/database-types";

import {
  IFirebaseConfig,
  IMockLoadingState,
  IFirebaseWatchHandler,
  IPathSetter,
  IMultiPathSet,
  IClientEmitter,
  IAdminEmitter
} from "./types";
import { PermissionDenied } from "./errors";
import { AbstractedProxyError } from "./errors/AbstractedProxyError";
import {
  isMockConfig,
  IFirebaseListener,
  IFirebaseConnectionCallback
} from ".";
import { AbstractedError } from "./errors/AbstractedError";

type Mock = import("firemock").Mock;
type IMockAuthConfig = import("firemock").IMockAuthConfig;
type IMockConfigOptions = import("firemock").IMockConfigOptions;

/** time by which the dynamically loaded mock library should be loaded */
export const MOCK_LOADING_TIMEOUT = 2000;
export abstract class RealTimeDB<A = any> {
  public get isMockDb() {
    return this._mocking;
  }

  /**
   * **getPushKey**
   *
   * Get's a push-key from the server at a given path. This ensures that multiple
   * client's who are writing to the database will use the server's time rather than
   * their own local time.
   *
   * @param path the path in the database where the push-key will be pushed to
   */
  public async getPushKey(path: string) {
    const key = await this.ref(path).push().key;
    return key;
  }

  public get mock(): Mock {
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
      const e = new Error(
        `Attempting to reference mock() on DB but _mock is not set [ mocking: ${this._mocking} ]!`
      );
      e.name = "AbstractedFirebase::NotAllowed";
      throw e;
    }

    return this._mock;
  }

  public get isConnected() {
    return this._isConnected;
  }

  public get config() {
    return this._config;
  }

  public static connect: (config: any) => Promise<any>;
  /** how many miliseconds before the attempt to connect to DB is timed out */
  public CONNECTION_TIMEOUT = 5000;
  /** Logs debugging information to the console */
  public enableDatabaseLogging: (
    logger?: boolean | ((a: string) => any),
    persistent?: boolean
  ) => any;

  protected abstract _eventManager: IClientEmitter | IAdminEmitter;
  protected abstract _clientType: "client" | "admin";
  protected _isConnected: boolean = false;
  protected _mockLoadingState: IMockLoadingState = "not-applicable";
  // tslint:disable-next-line:whitespace
  protected _mock: Mock;
  protected _resetMockDb: () => void;
  protected _waitingForConnection: Array<() => void> = [];
  protected _debugging: boolean = false;
  protected _mocking: boolean = false;
  protected _allowMocking: boolean = false;
  protected _onConnected: IFirebaseListener[] = [];
  protected _onDisconnected: IFirebaseListener[] = [];
  protected app: any;
  protected _database: FirebaseDatabase;
  /** the config the db was started with */
  protected _config: IFirebaseConfig;
  protected abstract _auth: any;

  public constructor(config: IFirebaseConfig) {
    this._config = config;
    if (config.timeout) {
      this.CONNECTION_TIMEOUT = config.timeout;
    }
  }

  /**
   * called by `client` and `admin` at end of constructor
   */
  public initialize(config: IFirebaseConfig = {}) {
    this._mocking = config.mocking ? true : false;
    this.connectToFirebase(config).then(() => this.listenForConnectionStatus());
  }

  public abstract async auth(): Promise<A>;

  /**
   * watch
   *
   * Watch for firebase events based on a DB path or `SerializedQuery` (path plus query elements)
   *
   * @param target a database path or a SerializedQuery
   * @param events an event type or an array of event types (e.g., "value", "child_added")
   * @param cb the callback function to call when event triggered
   */
  public watch(
    target: string | SerializedQuery<any>,
    events: EventType | EventType[],
    cb: IFirebaseWatchHandler
  ) {
    if (!Array.isArray(events)) {
      events = [events];
    }

    try {
      events.map(evt => {
        const dispatch = WatcherEventWrapper({
          eventType: evt,
          targetType: "path"
        })(cb);

        if (typeof target === "string") {
          this.ref(slashNotation(target)).on(evt, dispatch);
        } else {
          target
            .setDB(this)
            .deserialize()
            .on(evt, dispatch);
        }
      });
    } catch (e) {
      console.warn(
        `abstracted-firebase: failure trying to watch event ${JSON.stringify(
          events
        )}`
      );
      throw new AbstractedProxyError(e);
    }
  }

  public unWatch(events?: EventType | EventType[], cb?: any) {
    try {
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
    } catch (e) {
      e.name = e.code.includes("abstracted-firebase")
        ? "AbstractedFirebase"
        : e.code;
      e.code = "abstracted-firebase/unWatch";
      throw e;
    }
  }

  /**
   * Get a Firebase SerializedQuery reference
   *
   * @param path path for query
   */
  public query<T extends object = any>(path: string) {
    return SerializedQuery.path<T>(path);
  }

  /** Get a DB reference for a given path in Firebase */
  public ref(path: string = "/"): Reference {
    return this._mocking ? this.mock.ref(path) : this._database.ref(path);
  }

  /**
   * Provides a promise-based way of waiting for the connection to be
   * established before resolving
   */
  public async waitForConnection() {
    const config = this._config;
    if (isMockConfig(config)) {
      // MOCKING
      await this.getFireMock({ db: config.mockData, auth: config.mockAuth });
    } else {
      // NON-MOCKING
      if (this._isConnected) {
        return;
      }

      const connectionEvent = () => {
        try {
          return new Promise((resolve, reject) => {
            this._eventManager.once("connection", (state: boolean) => {
              if (state) {
                resolve();
              } else {
                reject(
                  new AbstractedError(
                    `While waiting for a connection received a disconnect message instead`,
                    `no-connection`
                  )
                );
              }
            });
          });
        } catch (e) {
          throw e;
        }
      };

      const timeout = async () => {
        await wait(this.CONNECTION_TIMEOUT);
        throw new AbstractedError(
          `The database didn't connect after the allocated period of ${this.CONNECTION_TIMEOUT}ms`,
          "connection-timeout"
        );
      };

      await Promise.race([connectionEvent(), timeout()]);
      this._isConnected = true;

      return this;
    }

    this._onConnected.map(i => i.cb(this, i.ctx));
  }

  /**
   * get a notification when DB is connected; returns a unique id
   * which can be used to remove the callback. You may, optionally,
   * state a unique id of your own.
   *
   * By default the callback will receive the database connection as it's
   * `this`/context. This means that any locally defined variables will be
   * dereferenced an unavailable. If you want to retain a connection to this
   * state you should include the optional _context_ parameter and your
   * callback will get a parameter passed back with this context available.
   */
  public notifyWhenConnected(
    cb: IFirebaseConnectionCallback,
    id?: string,
    /**
     * additional context/pointers for your callback to use when activated
     */
    ctx?: IDictionary
  ): string {
    if (!id) {
      id = Math.random()
        .toString(36)
        .substr(2, 10);
    } else {
      if (this._onConnected.map(i => i.id).includes(id)) {
        throw new AbstractedError(
          `Request for onConnect() notifications was done with an explicit key [ ${id} ] which is already in use!`,
          `duplicate-listener`
        );
      }
    }

    this._onConnected = this._onConnected.concat({ id, cb, ctx });
    return id;
  }

  /**
   * removes a callback notification previously registered
   */
  public removeNotificationOnConnection(id: string) {
    this._onConnected = this._onConnected.filter(i => i.id !== id);

    return this;
  }

  /** set a "value" in the database at a given path */
  public async set<T = any>(path: string, value: T): Promise<void> {
    // return new Promise((resolve, reject))
    try {
      const results = await this.ref(path).set(value);
    } catch (e) {
      if (e.code === "PERMISSION_DENIED") {
        throw new PermissionDenied(
          e,
          `The attempt to set a value at path "${path}" failed due to incorrect permissions.`
        );
      }
      if (
        e.message.indexOf(
          "path specified exceeds the maximum depth that can be written"
        ) !== -1
      ) {
        throw new FileDepthExceeded(e);
      }

      if (
        e.message.indexOf("First argument includes undefined in property") !==
        -1
      ) {
        e.name = "FirebaseUndefinedValueAssignment";
        throw new UndefinedAssignment(e);
      }

      throw new AbstractedProxyError(
        e,
        "unknown",
        JSON.stringify({ path, value })
      );
    }
  }

  /**
   * **multiPathSet**
   *
   * Equivalent to Firebase's traditional "multi-path updates" which are
   * in behaviour are really "multi-path SETs". Calling this function provides
   * access to simplified API for adding and executing this operation.
   *
   * What's important to understand is that the structure of this request
   * is an array of name/values where the _name_ is a path in the database
   * and the _value_ is what is to be **set** there. By grouping these together
   * you not only receive performance benefits but also they are treated as
   * a "transaction" where either _all_ or _none_ of the updates will take
   * place.
   *
   * @param base you can state a _base_ path which all subsequent paths will be
   * based off of. This is often useful when making a series of changes to a
   * part of the Firebase datamodel. In particular, if you are using **FireModel**
   * then operations which effect a single "model" will leverage this **base**
   * property
   *
   * [Blog Post](https://firebase.googleblog.com/2015/09/introducing-multi-location-updates-and_86.html)
   */
  public multiPathSet(base?: string) {
    const mps: IPathSetter[] = [];
    const ref = this.ref.bind(this);
    let callback: (err: any, pathSetters: IPathSetter[]) => void;
    const makeFullPath = (path: string, basePath: string) => {
      return [basePath, path].join("/").replace(/[\/]{2,3}/g, "/");
    };
    const api: IMultiPathSet = {
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

      add<X = any>(pathValue: IPathSetter<X>) {
        if (api.paths.includes(pathValue.path)) {
          const message = `You have attempted to add the path "${
            pathValue.path
          }" twice to a MultiPathSet operation [ value: ${
            pathValue.value
          } ]. For context the payload in the multi-path-set was already: ${JSON.stringify(
            api.payload,
            null,
            2
          )}`;
          const e: any = new Error(message);
          e.name = "DuplicatePath";
          throw e;
        }

        mps.push(pathValue);
        return api;
      },

      get paths() {
        return mps.map(i => i.path);
      },

      get fullPaths() {
        return mps.map(i =>
          [api._basePath, i.path].join("/").replace(/[\/]{2,3}/g, "/")
        );
      },

      get payload() {
        return mps.map(i => {
          i.path = [api._basePath, i.path].join("/").replace(/[\/]{2,3}/g, "/");
          return i;
        });
      },
      findPathItem(path: string) {
        let result = "unknown";

        api.payload.map(i => {
          if (i.path === path) {
            result = i.value;
          }
        });

        return result;
      },

      callback(cb: (err: any, pathSetters: IPathSetter[]) => void) {
        callback = cb;
        return api;
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

        try {
          await ref().update(updateHash);
          if (callback) {
            callback(null, mps);
          }
          // resolve();
        } catch (e) {
          if (callback) {
            callback(e, mps);
          }
          if (e.code === "PERMISSION_DENIED") {
            throw new PermissionDenied(
              e,
              "Firebase Database - permission denied"
            );
          }

          throw new AbstractedProxyError(
            e,
            "abstracted-firebase/mps-failure",
            `While executing a MPS there was a failure. The base path was ${api._basePath}.`
          );
        }
        // });
      }
    };

    return api;
  }

  /**
   * **update**
   *
   * Update the database at a given path. Note that this operation is
   * **non-destructive**, so assuming that the value you are passing in
   * a POJO/object then the properties sent in will be updated but if
   * properties that exist in the DB, but not in the value passed in,
   * then these properties will _not_ be changed.
   *
   * [API Docs](https://firebase.google.com/docs/reference/js/firebase.database.Reference#update)
   */
  public async update<T = any>(path: string, value: Partial<T>): Promise<void> {
    try {
      const result = await this.ref(path).update(value);
    } catch (e) {
      if (e.code === "PERMISSION_DENIED") {
        throw new PermissionDenied(
          e,
          `The attempt to update a value at path "${path}" failed due to incorrect permissions.`
        );
      } else {
        throw new AbstractedProxyError(
          e,
          undefined,
          `While updating the path "${path}", an error occurred`
        );
      }
    }
  }

  /**
   * **remove**
   *
   * Removes a path from the database. By default if you attempt to
   * remove a path in the database which _didn't_ exist it will throw
   * a `abstracted-firebase/remove` error. If you'd prefer for this
   * error to be ignored than you can pass in **true** to the `ignoreMissing`
   * parameter.
   *
   * [API  Docs](https://firebase.google.com/docs/reference/js/firebase.database.Reference#remove)
   */
  public async remove<T = any>(path: string, ignoreMissing = false) {
    const ref = this.ref(path);
    try {
      const result = await ref.remove();
      return result;
    } catch (e) {
      if (e.code === "PERMISSION_DENIED") {
        throw new PermissionDenied(
          e,
          `The attempt to remove a value at path "${path}" failed due to incorrect permissions.`
        );
      } else {
        throw new AbstractedProxyError(
          e,
          undefined,
          `While removing the path "${path}", an error occurred`
        );
      }
    }
  }

  /**
   * **getSnapshot**
   *
   * returns the Firebase snapshot at a given path in the database
   */
  public async getSnapshot<T extends object = any>(
    path: string | SerializedQuery<T>
  ): Promise<DataSnapshot> {
    try {
      const response =
        (await typeof path) === "string"
          ? this.ref(slashNotation(path as string)).once("value")
          : (path as SerializedQuery<T>).setDB(this).execute();
      return response;
    } catch (e) {
      throw new AbstractedProxyError(e);
    }
  }

  /**
   * **getValue**
   *
   * Returns the JS value at a given path in the database. This method is a
   * typescript _generic_ which defaults to `any` but you can set the type to
   * whatever value you expect at that path in the database.
   */
  public async getValue<T = any>(path: string): Promise<T> {
    try {
      const snap = await this.getSnapshot(path);
      return snap.val() as T;
    } catch (e) {
      throw new AbstractedProxyError(e);
    }
  }

  /**
   * **getRecord**
   *
   * Gets a snapshot from a given path in the Firebase DB
   * and converts it to a JS object where the snapshot's key
   * is included as part of the record (as `id` by default)
   */
  public async getRecord<T extends object = any>(
    path: string | SerializedQuery<T>,
    idProp = "id"
  ): Promise<T> {
    try {
      const snap = await this.getSnapshot<T>(path);
      let object = snap.val();
      if (typeof object !== "object") {
        object = { value: snap.val() };
      }

      return { ...object, ...{ [idProp]: snap.key } };
    } catch (e) {
      throw new AbstractedProxyError(e);
    }
  }

  /**
   * **getList**
   *
   * Get a list of a given type (defaults to _any_). Assumes that the
   * "key" for the record is the `id` property but that can be changed
   * with the optional `idProp` parameter.
   *
   * @param path the path in the database to
   * @param idProp
   */
  public async getList<T extends object = any>(
    path: string | SerializedQuery<T>,
    idProp = "id"
  ): Promise<T[]> {
    try {
      const snap = await this.getSnapshot<T>(path);
      return snap.val() ? convert.snapshotToArray<T>(snap, idProp) : [];
    } catch (e) {
      throw new AbstractedProxyError(e);
    }
  }

  /**
   * **getSortedList**
   *
   * getSortedList() will return the sorting order that was defined in the Firebase
   * Query. This _can_ be useful but often the sort orders
   * really intended for the server only (so that filteration
   * is done on the right set of data before sending to client).
   *
   * @param query Firebase "query ref"
   * @param idProp what property name should the Firebase key be converted to (default is "id")
   */
  public async getSortedList<T = any>(query: any, idProp = "id"): Promise<T[]> {
    try {
      return this.getSnapshot(query).then(snap => {
        return convert.snapshotToArray<T>(snap, idProp);
      });
    } catch (e) {
      throw new AbstractedProxyError(e);
    }
  }

  /**
   * **push**
   *
   * Pushes a value (typically a hash) under a given path in the
   * database but allowing Firebase to insert a unique "push key"
   * to ensure the value is placed into a Dictionary/Hash structure
   * of the form of `/{path}/{pushkey}/{value}`
   *
   * Note, the pushkey will be generated on the Firebase side and
   * Firebase keys are guarenteed to be unique and embedded into the
   * UUID is precise time-based information so you _can_ count on
   * the keys to have a natural time based sort order.
   */
  public async push<T = any>(path: string, value: T) {
    try {
      this.ref(path).push(value);
    } catch (e) {
      if (e.code === "PERMISSION_DENIED") {
        throw new PermissionDenied(
          e,
          `The attempt to push a value to path "${path}" failed due to incorrect permissions.`
        );
      } else {
        throw new AbstractedProxyError(
          e,
          undefined,
          `While pushing to the path "${path}", an error occurred`
        );
      }
    }
  }

  /**
   * **exists**
   *
   * Validates the existance of a path in the database
   */
  public async exists(path: string): Promise<boolean> {
    return this.getSnapshot(path).then(snap => (snap.val() ? true : false));
  }

  /**
   * monitorConnection
   *
   * allows interested parties to hook into event messages when the
   * DB connection either connects or disconnects
   */
  protected _monitorConnection(snap: DataSnapshot) {
    this._isConnected = snap.val();
    // call active listeners
    if (this._isConnected) {
      if (this._eventManager.connection) {
        this._eventManager.connection(this._isConnected);
      }
      this._onConnected.forEach(listener =>
        listener.ctx
          ? listener.cb.bind(listener.ctx)(this)
          : listener.cb.bind(this)()
      );
    } else {
      this._onDisconnected.forEach(listener => listener.cb(this));
    }
  }

  protected abstract connectToFirebase(config: any): Promise<void>;
  protected abstract listenForConnectionStatus(): void;

  /**
   * **getFireMock**
   *
   * Asynchronously imports both `FireMock` and the `Faker` libraries
   * then sets `isConnected` to **true**
   */
  protected async getFireMock(config: IMockConfigOptions = {}) {
    try {
      this._mocking = true;
      this._mockLoadingState = "loading";
      const FireMock = await import(
        /* webpackChunkName: "firemock" */ "firemock"
      );
      this._mockLoadingState = "loaded";
      this._mock = await FireMock.Mock.prepare(config);
      this._isConnected = true;
    } catch (e) {
      throw new AbstractedProxyError(
        e,
        "abstracted-firebase/firemock-load-failure",
        `Failed to load the FireMock library asynchronously. The config passed in was ${JSON.stringify(
          config,
          null,
          2
        )}`
      );
    }
  }
}
