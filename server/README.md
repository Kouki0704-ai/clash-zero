# CLASH ZERO server

The Colyseus server hosts the 1v1 `clash_zero` room. The room ID returned when a room is created is the invite code; a second player can join by that ID.

[Colyseus documentation](https://docs.colyseus.io/)

## :crossed_swords: Usage

```
npm start
```

The server listens on port 2567 by default. Set `PORT` to override it.

## Structure

- `src/index.js`: server entry point
- `src/app.config.js`: room registration and WebSocket transport
- `src/rooms/ClashRoom.js`: two-player room lifecycle
- `src/rooms/schema/ClashRoomState.js`: synchronized player and match state
- `test/ClashRoom.test.js`: verifies two-player room state synchronization
- `loadtest/example.js`: scriptable client for `npm run loadtest`
- `ecosystem.config.cjs`: pm2 configuration, used when deploying to Colyseus Cloud

## Scripts

- `npm start`: run the server in watch mode (`node --watch src/index.js`)
- `npm test`: run the mocha test suite
- `npm run build`: no build step — the sources run as-is
- `npm run loadtest`: connect N simulated clients with [`@colyseus/loadtest`](https://github.com/colyseus/colyseus-loadtest/)