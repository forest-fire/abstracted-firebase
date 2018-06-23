export {
  RealTimeDB,
  IFirebaseListener,
  FirebaseBoolean,
  IFirebaseWatchCoreEvent,
  IFirebaseWatchEvent,
  IFirebaseWatchHandler
} from "./db";
export { FileDepthExceeded } from "./errors/FileDepthExceeded";
export { UndefinedAssignment } from "./errors/UndefinedAssignment";
export { _getFirebaseType } from "./util";
export { rtdb } from "firebase-api-surface";
// tslint:disable-next-line:no-submodule-imports
import { EventType as FirebaseEvent } from "firebase-api-surface/dist/esnext/rtdb";

export type DebuggingCallback = (message: string) => void;
export type IFirebaseConfig = IFirebaseClientConfig | IFirebaseAdminConfig;
export type IFirebaseClientConfig = IFirebaseClientConfigProps | IFirebaseConfigMocked;
export type IFirebaseAdminConfig = IFirebaseAdminConfigProps & IFirebaseConfigMocked;
export interface IFirebaseClientConfigProps extends IAbstractedFirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

export interface IFirebaseAdminConfigProps extends IAbstractedFirebaseConfig {
  serviceAccount: string;
  databaseUrl: string;
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
  mocking: true;
}
