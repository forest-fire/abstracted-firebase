import FileDepthExceeded from "./errors/FileDepthExceeded";
import UndefinedAssignment from "./errors/UndefinedAssignment";
export { RealTimeDB, IFirebaseListener, FirebaseBoolean, FirebaseEvent } from "./db";
export { rtdb } from "firebase-api-surface";
export { FileDepthExceeded, UndefinedAssignment };
export declare type DebuggingCallback = (message: string) => void;
export interface IFirebaseConfig {
    debugging?: boolean | DebuggingCallback;
    mocking?: boolean;
}
