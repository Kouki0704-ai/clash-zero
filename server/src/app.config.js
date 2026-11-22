import { defineServer, defineRoom } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ClashRoom } from "./rooms/ClashRoom.js";

const server = defineServer({
  transport: new WebSocketTransport(),
  rooms: {
    clash_zero: defineRoom(ClashRoom),
  },
});

export default server;