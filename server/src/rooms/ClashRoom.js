import { Room } from "@colyseus/core";
import { ClashRoomState, PlayerState } from "./schema/ClashRoomState.js";

export class ClashRoom extends Room {
  maxClients = 2;
  state = new ClashRoomState();

  onJoin(client) {
    const side = this.state.players.size === 0 ? 1 : -1;
    const player = new PlayerState();
    player.x = side * 0.25;
    player.y = 0;
    this.state.players.set(client.sessionId, player);

    this.state.status = this.clients.length === 2 ? "ready" : "waiting";
  }

  onLeave(client) {
    this.state.players.delete(client.sessionId);
    this.state.status = "waiting";
  }
}