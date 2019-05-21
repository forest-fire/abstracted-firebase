export class AbstractedError extends Error {
  public code: string;
  constructor(message: string, errorCode: string) {
    super(message);
    this.code = `abstracted-firebase/${errorCode}`;
    this.name = this.code.split("/")[1];
  }
}
