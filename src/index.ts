import { IDictionary } from "common-types";

export { RealTimeDB } from "./db";
export { FileDepthExceeded } from "./errors/FileDepthExceeded";
export { UndefinedAssignment } from "./errors/UndefinedAssignment";
export { _getFirebaseType } from "./util";
import {
  FirebaseDatabase,
  DataSnapshot,
  EventType,
  Reference
} from "@firebase/database-types";
import { FirebaseAuth } from "@firebase/auth-types";
export { FirebaseDatabase, FirebaseAuth, DataSnapshot, EventType, Reference };

export type DebuggingCallback = (message: string) => void;
export type IFirebaseConfig = IFirebaseClientConfig | IFirebaseAdminConfig;
export type IFirebaseClientConfig =
  | IFirebaseClientConfigProps
  | IFirebaseConfigMocked;
export type IFirebaseAdminConfig =
  | IFirebaseAdminConfigProps
  | IFirebaseConfigMocked;

export * from "./types";
export interface IFirebaseClientConfigProps extends IAbstractedFirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  mocking?: false;
}

export interface IFirebaseAdminConfigProps extends IAbstractedFirebaseConfig {
  /**
   * The service account must be provided but if not passed in it can be found
   * in the `FIREBASE_SERVICE_ACCOUNT` environment variable. In both cases the
   * string value is expected to be encoded in base64.
   */
  serviceAccount?: string;
  /**
   * The databaseURL is required but if not passed in as a parameter it can be found
   * in the `FIREBASE_DATA_ROOT_URL` environment variable
   */
  databaseUrl?: string;
  mocking?: false | undefined;
}

export interface IAbstractedFirebaseConfig {
  /** set debugging override from logging config */
  debugging?: boolean | DebuggingCallback;
  /** whether to load and use a mocking database */
  mocking?: boolean;
  /** set a name for the database; useful when there's more than one */
  name?: string;
  /** TBD  */
  logging?: any;
  /** override the default timeout of 5 seconds */
  timeout?: number;
}

/** an _async_ mock function which returns a dictionary data structure */
export type AsyncMockData = () => Promise<IDictionary>;

export interface IFirebaseConfigMocked extends IAbstractedFirebaseConfig {
  mocking: true;
  /**
   * Initializes the database to a known state.
   *
   * You can either put in a dictionary if it's available synchronously
   * or you can pass in an async function which resolves to the dictionary
   * asynchronously
   */
  mockData?: IDictionary | AsyncMockData;
  /** optionally configure mocking for Firebase Authentication */
  // tslint:disable-next-line: no-implicit-dependencies
  mockAuth?: import("firemock").IMockAuthConfig;
}

export function isMockConfig(
  config: IFirebaseConfig = {}
): config is IFirebaseConfigMocked {
  return (config as IFirebaseConfigMocked).mocking === true;
}

export function isRealDbConfig(
  config: IFirebaseConfig
): config is IFirebaseAdminConfigProps | IFirebaseClientConfigProps {
  return config.mocking !== true;
}
