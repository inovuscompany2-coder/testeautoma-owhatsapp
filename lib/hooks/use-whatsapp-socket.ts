"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";

export interface WhatsAppStatus {
  status: "disconnected" | "connecting" | "qr" | "connected";
  connected: boolean;
  connecting: boolean;
  phone?: string;
  reconnecting?: boolean;
  reconnectAttempts?: number;
  disconnectReason?: string;
}

export interface QRData {
  qrCode: string | null;
  connected: boolean;
  connecting: boolean;
  status: string;
}

export interface ReceivedMessage {
  id: string;
  from: string;
  message: string;
  timestamp: number;
  pushName?: string;
}

export interface ReconnectingData {
  attempt: number;
  maxAttempts: number;
  nextAttemptIn: number;
}

interface UseWhatsAppSocketOptions {
  serviceUrl?: string;
  autoConnect?: boolean;
}

export function useWhatsAppSocket(options: UseWhatsAppSocketOptions = {}) {
  const {
    serviceUrl = process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_URL || "http://localhost:3001",
    autoConnect = true,
  } = options;

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [status, setStatus] = useState<WhatsAppStatus>({
    status: "disconnected",
    connected: false,
    connecting: false,
  });
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [lastMessage, setLastMessage] = useState<ReceivedMessage | null>(null);
  const [reconnectingInfo, setReconnectingInfo] = useState<ReconnectingData | null>(null);
  const [authFailure, setAuthFailure] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);

  // Initialize socket connection
  useEffect(() => {
    if (!autoConnect) return;

    const newSocket = io(serviceUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Socket connection events
    newSocket.on("connect", () => {
      console.log("[Socket.io] Connected to WhatsApp service");
      setIsSocketConnected(true);
      setError(null);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("[Socket.io] Disconnected:", reason);
      setIsSocketConnected(false);
    });

    newSocket.on("connect_error", (err) => {
      console.error("[Socket.io] Connection error:", err.message);
      setError(`Erro de conexao: ${err.message}`);
      setIsSocketConnected(false);
    });

    // WhatsApp events
    newSocket.on("status", (data: WhatsAppStatus) => {
      console.log("[Socket.io] Status update:", data);
      setStatus(data);
      
      // Clear QR and reconnecting info when connected
      if (data.connected) {
        setQrData(null);
        setReconnectingInfo(null);
        setAuthFailure(null);
      }
    });

    newSocket.on("qr", (data: QRData) => {
      console.log("[Socket.io] QR Code received");
      setQrData(data);
    });

    newSocket.on("message", (data: ReceivedMessage) => {
      console.log("[Socket.io] New message:", data.from);
      setLastMessage(data);
    });

    newSocket.on("reconnecting", (data: ReconnectingData) => {
      console.log("[Socket.io] Reconnecting:", data);
      setReconnectingInfo(data);
    });

    newSocket.on("auth_failure", (data: { message: string }) => {
      console.error("[Socket.io] Auth failure:", data.message);
      setAuthFailure(data.message);
    });

    newSocket.on("error", (data: { message: string }) => {
      console.error("[Socket.io] Error:", data.message);
      setError(data.message);
    });

    // Cleanup on unmount
    return () => {
      console.log("[Socket.io] Cleaning up socket connection");
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [serviceUrl, autoConnect]);

  // Request WhatsApp connection
  const connectWhatsApp = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("connect_whatsapp");
    } else {
      // Fallback to HTTP if socket not connected
      return fetch("/api/whatsapp/connect", { method: "POST" });
    }
  }, []);

  // Request WhatsApp disconnection
  const disconnectWhatsApp = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("disconnect_whatsapp");
    } else {
      // Fallback to HTTP if socket not connected
      return fetch("/api/whatsapp/disconnect", { method: "POST" });
    }
  }, []);

  // Request current status
  const requestStatus = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("get_status");
    }
  }, []);

  // Request current QR
  const requestQR = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("get_qr");
    }
  }, []);

  return {
    // Socket state
    socket,
    isSocketConnected,
    
    // WhatsApp state
    status,
    qrData,
    lastMessage,
    reconnectingInfo,
    authFailure,
    error,
    
    // Actions
    connectWhatsApp,
    disconnectWhatsApp,
    requestStatus,
    requestQR,
  };
}
