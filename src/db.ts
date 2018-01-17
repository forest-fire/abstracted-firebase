// tslint:disable:no-submodule-imports
// tslint:disable:no-implicit-dependencies
import FirebaseApp = require("firebase/app");
import * as admin from "firebase-admin";
import * as client from "@firebase/database-types";
import { IDictionary } from "common-types";
import * as convert from "typed-conversions";
import { SerializedQuery } from "serialized-query";
import * as moment from "moment";
import * as process from "process";
import { slashNotation } from "./util";
import { Mock, Reference, resetDatabase } from "firemock";
// import { FirebaseApp } from "@firebase/app-types";

export type Reference = admin.database.Reference | client.Reference;
export type Query = admin.database.Query | client.Query;
export type Database = admin.database.Database | client.FirebaseDatabase;
export type DataSnapshot = admin.database.DataSnapshot | client.DataSnapshot;

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
  protected static isConnected: boolean = false;
  protected static isAuthorized: boolean = false;
  protected static connection: Database;
  protected mocking: boolean = false;
  protected _mock: Mock;
  protected _waitingForConnection: Array<() => void> = [];
  protected _onConnected: IFirebaseListener[] = [];
  protected _onDisconnected: IFirebaseListener[] = [];
  protected _debugging: boolean = false;
  protected _mocking: boolean = false;
  protected _allowMocking: boolean = false;

  constructor(config: IFirebaseConfig = {}) {
    if (config.mocking) {
      this._mocking = true;
      this._mock = new Mock();
    }
  }

  /** Get a DB reference for a given path in Firebase */
  public ref(path: string) {
    return this._mocking
      ? (this.mock.ref(path) as Reference)
      : (RealTimeDB.connection.ref(path) as Reference);
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
      throw new Error(
        "You can not mock the database without setting mocking in the constructor"
      );
    }

    if (!this._mock) {
      this._mock = new Mock();
      resetDatabase();
    }

    return this._mock;
  }

  /** clears all "connections" and state from the database */
  public resetMockDb() {
    resetDatabase();
  }

  public async waitForConnection() {
    if (RealTimeDB.isConnected) {
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
    return RealTimeDB.isConnected;
  }

  /** set a "value" in the database at a given path */
  public async set<T = any>(path: string, value: T) {
    return this.ref(path)
      .set(value)
      .catch(e => this.handleError(e, "set", `setting value @ "${path}"`));
  }

  public async update<T = any>(path: string, value: Partial<T>) {
    return this.ref(path).update(value);
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

  public async getSnapshot(
    path: string | SerializedQuery
  ): Promise<DataSnapshot> {
    return typeof path === "string"
      ? this.ref(slashNotation(path)).once("value")
      : path.setDB(this).execute();
  }

  /** returns the value at the given path in the database */
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
    path: string | SerializedQuery,
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
   *
   * @param path the path in the database to
   * @param idProp
   */
  public async getList<T = any[]>(
    path: string | SerializedQuery,
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
  public async getSortedList<T = any[]>(
    query: any,
    idProp = "id"
  ): Promise<T[]> {
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
    return this.ref(path).push(value);
  }

  /** validates the existance of a path in the database */
  public async exists(path: string): Promise<boolean> {
    return this.getSnapshot(path).then(snap => (snap.val() ? true : false));
  }

  protected handleError(e: any, name: string, message = "") {
    console.error(`Error ${message}:`, e);
    return Promise.reject({
      code: `firebase/${name}`,
      message: message + e.message || e
    });
  }
}
