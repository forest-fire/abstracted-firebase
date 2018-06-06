import { RealTimeDB } from "./db";
import FileDepthExceeded from "./errors/FileDepthExceeded";
import UndefinedAssignment from "./errors/UndefinedAssignment";
export {
  RealTimeDB,
  IFirebaseConfig,
  IFirebaseListener,
  FirebaseBoolean,
  DebuggingCallback,
  FirebaseEvent
} from "./db";

export { rtdb, auth } from "firebase-api-surface";
export { FileDepthExceeded, UndefinedAssignment };
