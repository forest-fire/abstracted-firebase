export class FileDepthExceeded extends Error {
  constructor(e: Error) {
    super(e.message);
    this.stack = e.stack;
    if (e.name === "Error") {
      e.name = "AbstractedFirebase";
    }
  }
}
