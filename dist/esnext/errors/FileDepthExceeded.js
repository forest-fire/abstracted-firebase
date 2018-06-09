export default class FirebaseDepthExceeded extends Error {
    constructor(e) {
        super(e.message);
        this.stack = e.stack;
        if (e.name === "Error") {
            e.name = "AbstractedFirebase";
        }
    }
}
