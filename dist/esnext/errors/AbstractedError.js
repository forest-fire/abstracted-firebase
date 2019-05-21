export class AbstractedError extends Error {
    constructor(message, errorCode) {
        super(message);
        this.code = `abstracted-firebase/${errorCode}`;
        this.name = this.code.split("/")[1];
    }
}
