// tslint:disable:no-implicit-dependencies
import { DB as Admin } from "abstracted-admin";
import { setupEnv } from "./testing/helpers";
import * as chai from "chai";
const expect = chai.expect;

setupEnv();

describe("Multi-path Set ?", () => {
  it("duplicate events throw error", async () => {
    const db = await Admin.connect();
    const mps = db.multiPathSet("foo/bar");
    const data = [
      {
        path: "/auditing/people/byId/-LG71JiaTVG5qMobx5vh/all/-LG71JibMhlEQ4V_MMfQ",
        value: 1530216926118
      },
      {
        path:
          "/auditing/people/byId/-LG71JiaTVG5qMobx5vh/props/name/-LG71JibMhlEQ4V_MMfQ",
        value: 1530216926118
      },
      {
        path: "/auditing/people/byId/-LG71JiaTVG5qMobx5vh/props/age/-LG71JibMhlEQ4V_MMfQ",
        value: 1530216926118
      }
    ];
    data.map(item => {
      mps.add(item);
    });
    try {
      mps.add({
        path: "/auditing/people/byId/-LG71JiaTVG5qMobx5vh/all/-LG71JibMhlEQ4V_MMfQ",
        value: 1530216926119
      });
      throw new Error("adding duplicate path should have triggered an error in MPS");
    } catch (e) {
      expect(e.name).to.equal("DuplicatePath");
    }
  });
});
