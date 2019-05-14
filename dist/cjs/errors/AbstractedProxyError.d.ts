export declare class AbstractedProxyError extends Error {
    code: string;
    constructor(e: Error, errName: string, context?: string);
}
