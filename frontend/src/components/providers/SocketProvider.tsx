"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { io, type Socket } from "socket.io-client";

const SocketContext = createContext<Socket | null>(null);

export function useSocket(): Socket | null {
  return useContext(SocketContext);
}

export default function SocketProvider({ children }: { children: React.ReactNode }) {
  const socket = useMemo(
    () =>
      io(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000", {
        autoConnect: false,
        transports: ["websocket"],
      }),
    [],
  );

  useEffect(() => {
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, [socket]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}