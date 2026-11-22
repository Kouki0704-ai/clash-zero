import assert from "assert";
import { boot } from "@colyseus/testing";

import appConfig from "../src/app.config.js";

describe("CLASH ZERO room", () => {
  let colyseus;

  before(async () => colyseus = await boot(appConfig));
  after(async () => colyseus.shutdown());

  beforeEach(async () => {
    await colyseus.cleanup();
  });

  it("synchronizes two players in a room that can be shared by its ID", async () => {
    const serverRoom = await colyseus.createRoom("clash_zero", {});
    const firstClient = await colyseus.connectTo(serverRoom);
    const secondPlayerSynced = new Promise((resolve) => {
      firstClient.onStateChange((state) => {
        if (state.players.size === 2) resolve();
      });
    });
    const secondClient = await colyseus.connectTo(serverRoom);
    await secondPlayerSynced;

    assert.strictEqual(serverRoom.maxClients, 2);
    assert.strictEqual(serverRoom.clients.length, 2);
    assert.strictEqual(serverRoom.state.status, "ready");
    assert.strictEqual(firstClient.roomId, serverRoom.roomId);
    assert.strictEqual(secondClient.roomId, serverRoom.roomId);
    assert.strictEqual(firstClient.state.players.size, 2);
    assert.strictEqual(secondClient.state.players.size, 2);
  });
});