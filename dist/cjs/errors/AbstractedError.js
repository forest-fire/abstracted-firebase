"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class AbstractedError extends Error {
    constructor(
    /** a human friendly error message */
    message, 
    /**
     * either of the syntax `type/subType` or alternatively just
     * `subType` where type will be defaulted to **abstracted-firebase**
     */
    errorCode) {
        super(message);
        const parts = errorCode.split("/");
        const [type, subType] = parts.length === 1 ? ["abstracted-firebase", parts[0]] : parts;
        this.name = `${type}/${subType}`;
        this.code = subType;
    }
}
exports.AbstractedError = AbstractedError;
