import { useEffect, useRef, useState } from "react";
import ReconnectingWebSocket from "reconnecting-websocket";
import discordSdk from "./Discord";

const url = `wss://${
  import.meta.env.VITE_DISCORD_CLIENT_ID
}.discordsays.com/.proxy/api/ws?channel=${discordSdk.channelId}`;

const useWebSocket = (customUrl = url) => {
  const [socketPull, setSocketPull] = useState(null);
  const [socketPush, setSocketPush] = useState(null);
  const webSocketRef = useRef();

  useEffect(() => {
    const socket = new ReconnectingWebSocket(url);
    webSocketRef.current = socket;

    socket.onopen = () => {
      console.log("WebSocket connection established");
    };

    socket.onmessage = (event) => {
      const socketData = JSON.parse(event.data);
      setSocketPull(socketData);
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed");
    };

    return () => socket.close();
  }, []);

  const addSocket = (data) => {
    setSocketPush(data);
  };

  useEffect(() => {
    if (socketPush) {
      webSocketRef.current?.send(JSON.stringify(socketPush));
    }
  }, [socketPush]);

  return [socketPull, addSocket];
};

export default useWebSocket;
