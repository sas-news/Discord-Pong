import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import http from "http";
import { WebSocket, WebSocketServer } from "ws";

dotenv.config({ path: "../.env" });

const app = express();
const port = 3001;
const host = "127.0.0.1";

app.use(express.json());

app.post("/api/token", async (req, res) => {
  try {
    const response = await fetch(`https://discord.com/api/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.VITE_DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: req.body.code,
      }),
    });

    if (!response.ok) {
      return res
        .status(response.status)
        .send({ error: "Failed to fetch token" });
    }

    const data = await response.json();
    const access_token = data.access_token;

    res.send({ access_token });
  } catch (error) {
    console.error("Error fetching token:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: "/api/ws" });

const channels = {};

wss.on("connection", (ws, req) => {
  const urlParams = new URLSearchParams(req.url?.split("?")[1]);
  const channel = urlParams.get("channel");

  if (!channel) {
    ws.close();
    return;
  }

  if (!channels[channel]) {
    channels[channel] = new Set();
  }

  channels[channel].add(ws);
  console.log(`Client connected to channel: ${channel}`);

  ws.on("message", (data, isBinary) => {
    try {
      const message = JSON.parse(data.toString());
      if (!channels[channel].data) {
        channels[channel].data = {};
      }
      channels[channel].data = { ...channels[channel].data, ...message };

      // Log all data stored in the channel
      console.log("Current channel data:", channels[channel].data);

      for (const client of channels[channel]) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(channels[channel].data), {
            binary: isBinary,
          });
        }
      }
    } catch (e) {
      console.log("Received non-JSON message");
    }
  });

  ws.on("close", () => {
    channels[channel].delete(ws);
    if (channels[channel].size === 0) {
      delete channels[channel];
    }
    console.log(`Client disconnected from channel: ${channel}`);
  });
});

server.listen(port, host, () => {
  console.log(`http://127.0.0.1:${port}`);
});
