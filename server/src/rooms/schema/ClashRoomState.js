import { schema, t } from "@colyseus/schema";

export const PlayerState = schema({
  x: t.number().default(0),
  y: t.number().default(0),
  hp: t.number().default(100),
  characterId: t.string().default("training"),
});

export const ClashRoomState = schema({
  status: t.string().default("waiting"),
  players: t.map(PlayerState),
});