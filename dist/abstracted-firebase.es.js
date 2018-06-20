export { rtdb } from 'firebase-api-surface';

class FileDepthExceeded extends Error {
    constructor(e) {
        super(e.message);
        this.stack = e.stack;
        if (e.name === "Error") {
            e.name = "AbstractedFirebase";
        }
    }
}

class UndefinedAssignment extends Error {
    constructor(e) {
        super(e.message);
        this.stack = e.stack;
        if (e.name === "Error") {
            e.name = "AbstractedFirebase";
        }
    }
}

function _getFirebaseType(context, kind) {
    if (!this.app) {
        const e = new Error(`You must first connect before using the ${kind}() API`);
        e.name = "NotAllowed";
        throw e;
    }
    const property = `_${kind}`;
    if (!context[property]) {
        context[property] = this.app.storage();
    }
    return context[property];
}

export { FileDepthExceeded, UndefinedAssignment, _getFirebaseType };
//# sourceMappingURL=abstracted-firebase.es.js.map
