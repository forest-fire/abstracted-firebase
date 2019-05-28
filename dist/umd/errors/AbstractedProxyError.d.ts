import { IStackFrame } from "common-types";
export declare class AbstractedProxyError extends Error {
    code: string;
    stackFrames: IStackFrame[];
    constructor(e: Error, typeSubtype?: string, context?: string);
}
