// tslint:disable:no-implicit-dependencies
import * as chai from "chai";
import * as helpers from "./testing/helpers";
import { DB } from "abstracted-admin";
import { DB as ClientDB } from "abstracted-client";

import "mocha";
import { Mock } from "firemock";
import { FakeDB } from "./testing/FakeDB";
import { wait } from "common-types";
const expect = chai.expect;

describe("FireMock", () => {
  it("Asking admin for a mock DB gives back a Mock object", async () => {
    const mockDb = await DB.connect({ mocking: true });
    expect(mockDb.mock).to.be.instanceOf(Mock);
    expect(mockDb.mock.db).to.be.an("object");
    expect(mockDb.mock.addSchema).to.be.an("function");
  });

  it("Asking client for a mock DB gives back a Mock object", async () => {
    const mockDb = await ClientDB.connect({ mocking: true });
    expect(mockDb.mock).to.be.instanceOf(Mock);
    expect(mockDb.mock.db).to.be.an("object");
    await mockDb.set("foo", "bar");
    const foo = await mockDb.getValue("foo");
    expect(foo).to.equal("bar");
  });

  it("Asking fakeDB for a mock DB gives back a Mock object", async () => {
    const mockDb = new FakeDB({ mocking: true });
    await mockDb.waitForConnection();
    expect(mockDb.mock).to.be.instanceOf(Mock);
    expect(mockDb.mock.db).to.be.an("object");
    expect(mockDb.mock.addSchema).to.be.an("function");
    await mockDb.set("foo", "bar");
    const foo = await mockDb.getValue("foo");
    expect(foo).to.equal("bar");
  });

  it("Using just JS to do async request", async () => {
    const FireMock = await import("firemock");
    const mock = new FireMock.Mock();
    expect(mock).to.be.instanceOf(Mock);
  });
});
