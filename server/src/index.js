import server from "./app.config.js";

const port = Number(process.env.PORT) || 2567;
server.listen(port);
console.info(`CLASH ZERO server listening on port ${port}`);
