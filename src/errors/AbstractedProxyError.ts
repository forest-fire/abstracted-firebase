import { IStackFrame, parseStack } from "common-types";
export class AbstractedProxyError extends Error {
  public code: string;
  public stackFrames: IStackFrame[];

  constructor(e: Error, typeSubtype: string = null, context?: string) {
    super(
      context
        ? `${e.name ? `[Proxy of ${e.name}]` : ""}` + context + ".\n" + e.message
        : `${e.name ? `[Proxy of ${e.name}]` : ""}` + e.message
    );
    this.stack = e.stack;
    const parts: string[] = typeSubtype.split("/");
    const [type, subType] =
      parts.length === 2 ? parts : ["abstracted-firemodel", parts[0]];
    this.name = `${type}/${subType}`;
    this.code = `${subType}`;
    this.stack = e.stack;
    try {
      this.stackFrames = parseStack(this.stack);
    } catch (e) {
      // ignore if there was an error parsing
    }
  }
}
