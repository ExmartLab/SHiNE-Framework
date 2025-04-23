// server.js - Main entry point
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { connectToDatabase } from "./src/lib/mongodb.js";
import gameConfig from "./src/game.json" assert { type: "json" };
import explanationConfig from "./src/explanation.json" assert { type: "json" };
import { setupExplanationEngine } from "./src/lib/server/explanation_engine/index.js";
import { setupSocketHandlers } from "./src/lib/server/socket/index.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(async () => {
  const httpServer = createServer(handler);
  const { db } = await connectToDatabase();
  const io = new Server(httpServer);
  
  // Initialize explanation engine
  const explanationEngine = await setupExplanationEngine(db, explanationConfig);
  
  // Setup socket event handlers
  setupSocketHandlers(io, db, gameConfig, explanationConfig, explanationEngine);
  
  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});