import { useEffect, useRef } from "react";
import { getTokens } from "../api/client";

const WS_BASE_URL = process.env.EXPO_PUBLIC_WS_BASE_URL;

export function useHouseholdSocket(householdId, onMessage) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!householdId) return;

    let socket;
    let reconnectTimer;
    let closedByUs = false;

    function connect() {
      const { access } = getTokens();
      if (!access) return;

      socket = new WebSocket(
        `${WS_BASE_URL}/ws/households/${householdId}/?token=${access}`
      );

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current?.(data);
        } catch {
          // ignore malformed messages
        }
      };

      socket.onclose = () => {
        if (!closedByUs) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      closedByUs = true;
      clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [householdId]);
}
