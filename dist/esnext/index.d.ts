import { IDictionary, IMockAuthConfig } from "firemock";
export { RealTimeDB } from "./db";
export { FileDepthExceeded } from "./errors/FileDepthExceeded";
export { UndefinedAssignment } from "./errors/UndefinedAssignment";
export { _getFirebaseType } from "./util";
export { FirebaseDatabase, DataSnapshot, EventType, Query, Reference } from "@firebase/database-types";
export declare type DebuggingCallback = (message: string) => void;
export declare type IFirebaseConfig = IFirebaseClientConfig | IFirebaseAdminConfig;
export declare type IFirebaseClientConfig = IFirebaseClientConfigProps | IFirebaseConfigMocked;
export declare type IFirebaseAdminConfig = IFirebaseAdminConfigProps | IFirebaseConfigMocked;
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
     * in environment variable
     */
    serviceAccount?: string;
    /**
     * The databaseURL is required but if not passed in as a parameter it can be found
     * in an environment variable
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
}
export interface IFirebaseConfigMocked extends IAbstractedFirebaseConfig {
    mocking: true;
    /** initialize the database to a known state */
    mockData?: IDictionary;
    /** optionally configure mocking for Firebase Authentication */
    mockAuth?: IMockAuthConfig;
}
export declare function isMockConfig(config?: IFirebaseConfig): config is IFirebaseConfigMocked;
export declare function isRealDbConfig(config: IFirebaseConfig): config is IFirebaseAdminConfigProps | IFirebaseClientConfigProps;
