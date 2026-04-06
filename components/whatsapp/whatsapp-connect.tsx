"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { QRCodeDisplay } from "./qr-code-display";
import { BulkMessageSender } from "./bulk-message-sender";
import { MessageHistory } from "./message-history";
import { ListCleaner } from "./list-cleaner";
import { ConnectionLogs } from "./connection-logs";
import { ServerKeepAlive } from "./server-keep-alive";
import { useWhatsAppSocket } from "@/lib/hooks/use-whatsapp-socket";
import { Power, PowerOff, Phone, Send, History, Filter, FileText, Wifi, WifiOff } from "lucide-react";

export function WhatsAppConnect() {
  const {
    isSocketConnected,
    status: socketStatus,
    qrData,
    reconnectingInfo,
    authFailure,
    error: socketError,
    connectWhatsApp,
    disconnectWhatsApp,
  } = useWhatsAppSocket();

  // Local state for UI
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"send" | "history" | "clean" | "logs">("send");
  const [qrTimestamp, setQrTimestamp] = useState<number | null>(null);
  const [qrExpired, setQrExpired] = useState(false);

  // Fallback HTTP polling when Socket.io is not connected
  const [httpStatus, setHttpStatus] = useState<{
    connected: boolean;
    connecting: boolean;
    phone?: string;
  }>({ connected: false, connecting: false });
  const [httpQrCode, setHttpQrCode] = useState<string | null>(null);

  // Combined status - prefer Socket.io, fallback to HTTP
  const status = isSocketConnected 
    ? { 
        connected: socketStatus.connected, 
        connecting: socketStatus.connecting, 
        phone: socketStatus.phone 
      }
    : httpStatus;

  const qrCode = isSocketConnected ? qrData?.qrCode : httpQrCode;

  // HTTP fallback for status polling
  const fetchStatusHTTP = useCallback(async () => {
    if (isSocketConnected) return; // Skip if socket is connected
    
    try {
      const response = await fetch("/api/whatsapp/status");
      const data = await response.json();
      setHttpStatus(data);
      setError(null);
    } catch {
      setError("Servico indisponivel");
    } finally {
      setLoading(false);
    }
  }, [isSocketConnected]);

  // HTTP fallback for QR polling
  const fetchQRHTTP = useCallback(async () => {
    if (isSocketConnected || status.connected) return;

    try {
      const response = await fetch("/api/whatsapp/qr");
      const data = await response.json();
      if (data.qrCode) {
        if (data.qrCode !== httpQrCode) {
          setHttpQrCode(data.qrCode);
          setQrTimestamp(Date.now());
          setQrExpired(false);
        }
      }
    } catch {
      // Silent fail for QR fetch
    }
  }, [isSocketConnected, status.connected, httpQrCode]);

  // Initial load and HTTP polling fallback
  useEffect(() => {
    // Set loading to false once socket connects or after initial HTTP fetch
    if (isSocketConnected) {
      setLoading(false);
    } else {
      fetchStatusHTTP();
      const statusInterval = setInterval(fetchStatusHTTP, 2000);
      return () => clearInterval(statusInterval);
    }
  }, [isSocketConnected, fetchStatusHTTP]);

  // HTTP QR polling fallback
  useEffect(() => {
    if (isSocketConnected) return;
    
    if (!status.connected && status.connecting) {
      const qrInterval = setInterval(fetchQRHTTP, 1500);
      return () => clearInterval(qrInterval);
    } else if (status.connected) {
      setHttpQrCode(null);
      setQrTimestamp(null);
      setQrExpired(false);
    }
  }, [isSocketConnected, status.connected, status.connecting, fetchQRHTTP]);

  // Update QR timestamp when Socket.io sends new QR
  useEffect(() => {
    if (qrData?.qrCode) {
      setQrTimestamp(Date.now());
      setQrExpired(false);
    }
  }, [qrData?.qrCode]);

  // Clear QR when connected
  useEffect(() => {
    if (status.connected) {
      setQrTimestamp(null);
      setQrExpired(false);
    }
  }, [status.connected]);

  // Check QR expiry (60 seconds)
  useEffect(() => {
    if (!qrTimestamp || !qrCode) return;
    
    const checkExpiry = setInterval(() => {
      const age = Date.now() - qrTimestamp;
      if (age > 60000) {
        setQrExpired(true);
      }
    }, 1000);
    
    return () => clearInterval(checkExpiry);
  }, [qrTimestamp, qrCode]);

  // Handle socket errors
  useEffect(() => {
    if (socketError) {
      setError(socketError);
    }
  }, [socketError]);

  // Handle auth failures
  useEffect(() => {
    if (authFailure) {
      setError(`Falha de autenticacao: ${authFailure}`);
    }
  }, [authFailure]);

  const handleConnect = async () => {
    setActionLoading(true);
    setError(null);

    try {
      const response = await connectWhatsApp();
      if (response && !response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Falha ao conectar");
      }
      setTimeout(fetchQRHTTP, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setActionLoading(true);
    setError(null);

    try {
      const response = await disconnectWhatsApp();
      if (response && !response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Falha ao desconectar");
      }
      
      setHttpQrCode(null);
      setQrTimestamp(null);
      setQrExpired(false);
      setHttpStatus({ connected: false, connecting: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetQR = async () => {
    setResetLoading(true);
    setError(null);
    setHttpQrCode(null);
    setQrExpired(false);

    try {
      // First disconnect
      await fetch("/api/whatsapp/disconnect", { method: "POST" });
      
      // Then reconnect to generate new QR
      const response = await fetch("/api/whatsapp/connect", { method: "POST" });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Falha ao gerar novo QR");
      }

      // Fetch new QR
      setTimeout(fetchQRHTTP, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setResetLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Spinner className="h-8 w-8" />
            <p className="text-muted-foreground">Carregando...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If not connected, show centered connection screen
  if (!status.connected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">WhatsApp Automation</CardTitle>
            <CardDescription>
              Conecte seu WhatsApp para iniciar os disparos
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            {/* Connection type indicator */}
            <div className="flex items-center gap-2 text-xs">
              {isSocketConnected ? (
                <span className="flex items-center gap-1 text-emerald-600">
                  <Wifi className="h-3 w-3" />
                  Tempo real
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600">
                  <WifiOff className="h-3 w-3" />
                  Polling
                </span>
              )}
            </div>

            {/* Reconnecting info */}
            {reconnectingInfo && (
              <div className="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-sm font-medium text-amber-700">
                  Reconectando automaticamente...
                </p>
                <p className="mt-1 text-xs text-amber-600">
                  Tentativa {reconnectingInfo.attempt} de {reconnectingInfo.maxAttempts}
                  {" "}(proxima em {Math.round(reconnectingInfo.nextAttemptIn / 1000)}s)
                </p>
              </div>
            )}

            {error && (
              <div className="w-full rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                <p className="text-sm font-medium text-destructive">{error}</p>
                {error === "Servico indisponivel" && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Configure a variavel <code className="rounded bg-muted px-1.5 py-0.5 text-xs">WHATSAPP_SERVICE_URL</code> nas Vars
                  </p>
                )}
              </div>
            )}

            <QRCodeDisplay
              qrCode={qrCode ?? null}
              isLoading={status.connecting && !qrCode}
              isExpired={qrExpired}
              onReset={handleResetQR}
              isResetting={resetLoading}
            />

            <Button
              onClick={handleConnect}
              disabled={actionLoading || status.connecting}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              size="lg"
            >
              {actionLoading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Iniciando...
                </>
              ) : status.connecting ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Aguardando scan...
                </>
              ) : (
                <>
                  <Power className="mr-2 h-4 w-4" />
                  Conectar WhatsApp
                </>
              )}
            </Button>

            {/* Server Keep-Alive Monitor */}
            <div className="w-full pt-4 border-t">
              <ServerKeepAlive />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If connected, show full panel with minimized header
  return (
    <div className="min-h-screen bg-background">
      {/* Fixed minimized header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-foreground">
              WhatsApp Automation
            </h1>
            {/* Connection type indicator */}
            {isSocketConnected ? (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <Wifi className="h-3 w-3" />
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-600">
                <WifiOff className="h-3 w-3" />
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Minimized status */}
            <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <Phone className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-600">
                {status.phone ? `+${status.phone}` : "Conectado"}
              </span>
            </div>

            <Button
              onClick={handleDisconnect}
              disabled={actionLoading}
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {actionLoading ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <>
                  <PowerOff className="mr-1.5 h-4 w-4" />
                  Desconectar
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 pt-20 pb-8">
        {/* Tab navigation */}
        <div className="mb-6 flex gap-2 border-b border-border">
          <button
            onClick={() => setActiveTab("send")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "send"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Send className="h-4 w-4" />
            Disparar
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "history"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="h-4 w-4" />
            Historico
          </button>
          <button
            onClick={() => setActiveTab("clean")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "clean"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Filter className="h-4 w-4" />
            Limpar Lista
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "logs"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="h-4 w-4" />
            Logs
          </button>
        </div>

        {/* Active tab content */}
        {activeTab === "send" && <BulkMessageSender />}
        {activeTab === "history" && <MessageHistory />}
        {activeTab === "clean" && <ListCleaner />}
        {activeTab === "logs" && <ConnectionLogs />}
      </main>
    </div>
  );
}
