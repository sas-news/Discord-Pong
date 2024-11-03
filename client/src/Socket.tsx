import { useEffect, useRef, useState } from "react";
import ReconnectingWebSocket from "reconnecting-websocket";
import discordSdk from "./Discord";

type SocketData = {
  btn?: string;
  quizmaster?: string | null;
};

const url = `wss://${
  import.meta.env.VITE_DISCORD_CLIENT_ID
}.discordsays.com/.proxy/api/ws?channel=${discordSdk.channelId}`;

const useWebSocket = (): [SocketData | null, (data: SocketData) => void] => {
  const [socketPush, setSocketPush] = useState<SocketData | null>(null);
  const [socketPull, setSocketPull] = useState<SocketData | null>(null);

  const webSocketRef = useRef<ReconnectingWebSocket>();

  useEffect(() => {
    const socket = new ReconnectingWebSocket(url);
    webSocketRef.current = socket;
    console.log("そけおおおおんんん");

    socket.onmessage = (event) => {
      const socketData = JSON.parse(event.data);
      setSocketPull(socketData);
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
