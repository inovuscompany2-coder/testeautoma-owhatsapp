"use client";

import { useEffect, useState, useCallback, useRef } from "react";

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
  enableSocket?: boolean;
}

export function useWhatsAppSocket(options: UseWhatsAppSocketOptions = {}) {
  const {
    serviceUrl = process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_URL || "http://localhost:3001",
    autoConnect = true,
    // Socket disabled by default - only enable when whatsapp-service is running
    enableSocket = process.env.NEXT_PUBLIC_ENABLE_SOCKET === "true",
  } = options;

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const socketRef = useRef<any>(null);
  const socketAttemptedRef = useRef(false);

  // Initialize socket connection only if enabled and service URL is configured
  useEffect(() => {
    if (!autoConnect || !enableSocket || socketAttemptedRef.current) return;
    
    socketAttemptedRef.current = true;

    // Dynamically import socket.io-client to avoid errors when not needed
    const initSocket = async () => {
      try {
        const { io } = await import("socket.io-client");
        
        const newSocket = io(serviceUrl, {
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 3, // Reduced attempts
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 5000, // 5 second timeout
        });

        socketRef.current = newSocket;

        // Socket connection events
        newSocket.on("connect", () => {
          console.log("[Socket.io] Connected to WhatsApp service");
          setIsSocketConnected(true);
          setError(null);
        });

        newSocket.on("disconnect", (reason: string) => {
          console.log("[Socket.io] Disconnected:", reason);
          setIsSocketConnected(false);
        });

        newSocket.on("connect_error", () => {
          // Silently handle - will use HTTP fallback
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
      } catch {
        // Socket.io not available or failed to connect
        console.log("[Socket.io] Socket connection not available, using HTTP polling");
      }
    };

    initSocket();

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [serviceUrl, autoConnect, enableSocket]);

  // Request WhatsApp connection - always use HTTP for commands
  const connectWhatsApp = useCallback(async () => {
    // Emit via socket if connected
    if (socketRef.current?.connected) {
      socketRef.current.emit("connect_whatsapp");
    }
    // Always also call HTTP API for reliability
    return fetch("/api/whatsapp/connect", { method: "POST" });
  }, []);

  // Request WhatsApp disconnection
  const disconnectWhatsApp = useCallback(async () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("disconnect_whatsapp");
    }
    return fetch("/api/whatsapp/disconnect", { method: "POST" });
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

  // Update status from HTTP polling (for external use)
  const updateStatus = useCallback((newStatus: WhatsAppStatus) => {
    setStatus(newStatus);
  }, []);

  const updateQrData = useCallback((newQrData: QRData | null) => {
    setQrData(newQrData);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // Socket state
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
    
    // State setters for HTTP polling fallback
    updateStatus,
    updateQrData,
    clearError,
  };
}
