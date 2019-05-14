export class AbstractedProxyError extends Error {
  public code: string;
  constructor(e: Error, errName: string, context?: string) {
    super(
      context
        ? `${e.name ? `[Proxy of ${e.name}]` : ""}` + context + ".\n" + e.message
        : `${e.name ? `[Proxy of ${e.name}]` : ""}` + e.message
    );
    this.stack = e.stack;
    const name = `abstracted-firebase/${errName ? errName : "unknown-error"}`;
    if (e.name === "Error") {
      this.name = name;
    }
    this.code = name.split("/")[1];
    this.stack = e.stack;
  }
}
