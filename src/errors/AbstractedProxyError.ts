import { IStackFrame, parseStack } from "common-types";
export class AbstractedProxyError extends Error {
  public code: string;
  public stackFrames: IStackFrame[];

  constructor(e: Error, typeSubtype: string = null, context?: string) {
    super("");
    this.stack = e.stack;
    const parts: string[] = typeSubtype.split("/");
    const [type, subType] =
      parts.length === 2 ? parts : ["abstracted-firemodel", parts[0]];
    this.name = `${type}/${subType}`;
    this.code = `${subType}`;
    this.stack = e.stack;

    try {
      this.stackFrames = parseStack(this.stack, {
        ignorePatterns: ["timers.js", "mocha/lib", "runners/node"]
      });
    } catch (e) {
      // ignore if there was an error parsing
    }
    const shortStack = this.stackFrames
      ? this.stackFrames.slice(0, 3).map(i => `${i.shortPath}/${i.fn}::${i.line}`)
      : "";
    this.message = context
      ? `${e.name ? `[Proxy of ${e.name}]` : ""}` +
        context +
        ".\n" +
        e.message +
        `\n${shortStack}`
      : `${e.name ? `[Proxy of ${e.name}]` : ""}[ ${type}/${subType}]: ${
          e.message
        }\n${shortStack}`;
  }
}
