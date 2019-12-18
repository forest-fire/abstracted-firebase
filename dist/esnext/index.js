export { RealTimeDB } from "./db";
export { FileDepthExceeded } from "./errors/FileDepthExceeded";
export { UndefinedAssignment } from "./errors/UndefinedAssignment";
export { _getFirebaseType } from "./util";
import { FirebaseDatabase } from "@firebase/database-types";
import { FirebaseAuth } from "@firebase/auth-types";
export { FirebaseDatabase, FirebaseAuth };
export * from "./types";
export function isMockConfig(config = {}) {
    return config.mocking === true;
}
export function isRealDbConfig(config) {
    return config.mocking !== true;
}
