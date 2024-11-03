import { useEffect, useRef, useState } from "react";
import ReconnectingWebSocket from "reconnecting-websocket";
import discordSdk from "./Discord";

type SocketData = {
  player1?: {
    username: string;
    position: number;
    refl: boolean;
    score: number;
    date: number;
  };
  player2?: {
    username: string;
    position: number;
    refl: boolean;
    score: number;
    date: number;
  };
  ballPosition?: { x: number; y: number };
};

const url = `wss://${
  import.meta.env.VITE_DISCORD_CLIENT_ID
}.discordsays.com/.proxy/api/ws?channel=${discordSdk.channelId}`;

const useWebSocket = (): [SocketData | null, (data: SocketData) => void] => {
  const [socketPull, setSocketPull] = useState<SocketData | null>(null);
  const [socketPush, setSocketPush] = useState<SocketData | null>(null);
  const webSocketRef = useRef<ReconnectingWebSocket>();

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

  const addSocket = (data: SocketData) => {
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
