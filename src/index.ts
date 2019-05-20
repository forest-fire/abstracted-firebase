import { IDictionary } from "firemock";

export { RealTimeDB } from "./db";
export { FileDepthExceeded } from "./errors/FileDepthExceeded";
export { UndefinedAssignment } from "./errors/UndefinedAssignment";
export { _getFirebaseType } from "./util";

export type DebuggingCallback = (message: string) => void;
export type IFirebaseConfig = IFirebaseClientConfig | IFirebaseAdminConfig;
export type IFirebaseClientConfig = IFirebaseClientConfigProps & IFirebaseConfigMocked;
export type IFirebaseAdminConfig = IFirebaseAdminConfigProps & IFirebaseConfigMocked;

export * from "./types";
export interface IFirebaseClientConfigProps extends IAbstractedFirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

export interface IFirebaseAdminConfigProps extends IAbstractedFirebaseConfig {
  /**
   * The service account must be provided but if not passed in it can be found
   * in environment variable
   */
  serviceAccount?: string;
  /**
   * The databaseURL is required but if not passed in as a parameter it can be found
   * in an environment variable
   */
  databaseUrl?: string;
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
}

export interface IFirebaseConfigMocked extends IAbstractedFirebaseConfig {
  mocking?: true;
  /** initialize the database to a known state */
  mockData?: IDictionary;
}
