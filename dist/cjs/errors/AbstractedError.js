"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class AbstractedError extends Error {
    constructor(message, errorCode) {
        super(message);
        this.code = `abstracted-firebase/${errorCode}`;
        this.name = this.code.split("/")[1];
    }
}
exports.AbstractedError = AbstractedError;
