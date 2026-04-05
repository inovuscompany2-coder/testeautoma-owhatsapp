"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { QRCodeDisplay } from "./qr-code-display";
import { BulkMessageSender } from "./bulk-message-sender";
import { MessageHistory } from "./message-history";
import { ListCleaner } from "./list-cleaner";
import { Power, PowerOff, Phone, Send, History, Filter, RefreshCw } from "lucide-react";

interface Status {
  connected: boolean;
  connecting: boolean;
  phone?: string;
  qrCode?: string;
}

export function WhatsAppConnect() {
  const [status, setStatus] = useState<Status>({
    connected: false,
    connecting: false,
  });
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"send" | "history" | "clean">("send");
  const [qrTimestamp, setQrTimestamp] = useState<number | null>(null);
  const [qrExpired, setQrExpired] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/whatsapp/status");
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch {
      setError("Servico indisponivel");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchQR = useCallback(async () => {
    if (status.connected) return;

    try {
      const response = await fetch("/api/whatsapp/qr");
      const data = await response.json();
      if (data.qrCode) {
        if (data.qrCode !== qrCode) {
          setQrCode(data.qrCode);
          setQrTimestamp(Date.now());
          setQrExpired(false);
        }
      }
    } catch {
      // Silent fail for QR fetch
    }
  }, [status.connected, qrCode]);

  useEffect(() => {
    fetchStatus();
    const statusInterval = setInterval(fetchStatus, 2000);
    return () => clearInterval(statusInterval);
  }, [fetchStatus]);

  useEffect(() => {
    if (!status.connected && status.connecting) {
      const qrInterval = setInterval(fetchQR, 1500);
      return () => clearInterval(qrInterval);
    } else if (status.connected) {
      setQrCode(null);
      setQrTimestamp(null);
      setQrExpired(false);
    }
  }, [status.connected, status.connecting, fetchQR]);

  // Verifica se o QR expirou (60 segundos)
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

  const handleConnect = async () => {
    setActionLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/whatsapp/connect", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Falha ao conectar");
      }

      setTimeout(fetchQR, 500);
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
      const response = await fetch("/api/whatsapp/disconnect", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Falha ao desconectar");
      }

      setQrCode(null);
      setQrTimestamp(null);
      setQrExpired(false);
      setStatus({ connected: false, connecting: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetQR = async () => {
    setResetLoading(true);
    setError(null);
    setQrCode(null);
    setQrExpired(false);

    try {
      // Primeiro desconecta
      await fetch("/api/whatsapp/disconnect", { method: "POST" });
      
      // Depois reconecta para gerar novo QR
      const response = await fetch("/api/whatsapp/connect", { method: "POST" });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Falha ao gerar novo QR");
      }

      // Busca o novo QR
      setTimeout(fetchQR, 500);
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

  // Se nao estiver conectado, mostra tela centralizada de conexao
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
              qrCode={qrCode}
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
          </CardContent>
        </Card>
      </div>
    );
  }

  // Se estiver conectado, mostra o painel completo com header minimizado
  return (
    <div className="min-h-screen bg-background">
      {/* Header minimizado fixo no topo */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <h1 className="text-lg font-semibold text-foreground">
            WhatsApp Automation
          </h1>

          <div className="flex items-center gap-4">
            {/* Status minimizado */}
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

      {/* Conteudo principal */}
      <main className="mx-auto max-w-7xl px-4 pt-20 pb-8">
        {/* Navegacao por abas */}
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
        </div>

        {/* Conteudo da aba ativa */}
        {activeTab === "send" && <BulkMessageSender />}
        {activeTab === "history" && <MessageHistory />}
        {activeTab === "clean" && <ListCleaner />}
      </main>
    </div>
  );
}
