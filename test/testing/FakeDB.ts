import { RealTimeDB, IFirebaseConfig } from "../../src/index";

export class FakeDB extends RealTimeDB {
  constructor(config: IFirebaseConfig = {}) {
    super(config);
    console.log("finishing up with construction");
  }
}
