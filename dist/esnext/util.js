export function slashNotation(path) {
    return path.substr(0, 5) === ".info"
        ? path.substr(0, 5) + path.substring(5).replace(/\./g, "/")
        : path.replace(/\./g, "/");
}
export function _getFirebaseType(context, kind) {
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
