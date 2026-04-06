"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Pause, Play, RefreshCw, Clock, Zap } from "lucide-react";

interface PingStatus {
  timestamp: string;
  success: boolean;
  error: string;
  responseTime: number;
}

interface KeepAliveResponse {
  status: string;
  renderStatus?: { status: string; timestamp: string };
  responseTime: number;
  lastPing: PingStatus;
  error?: string;
}

const PING_INTERVAL = 30000; // 30 seconds

export function ServerKeepAlive() {
  const [isActive, setIsActive] = useState(true);
  const [lastPing, setLastPing] = useState<PingStatus | null>(null);
  const [pingCount, setPingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [timeUntilNextPing, setTimeUntilNextPing] = useState(PING_INTERVAL / 1000);

  const ping = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/keep-alive", { cache: "no-store" });
      const data: KeepAliveResponse = await response.json();
      
      setLastPing(data.lastPing);
      setPingCount((prev) => prev + 1);
    } catch (error) {
      setLastPing({
        timestamp: new Date().toISOString(),
        success: false,
        error: (error as Error).message,
        responseTime: 0,
      });
    } finally {
      setIsLoading(false);
      setTimeUntilNextPing(PING_INTERVAL / 1000);
    }
  }, []);

  // Ping interval
  useEffect(() => {
    if (!isActive) return;

    // Initial ping
    ping();

    const intervalId = setInterval(ping, PING_INTERVAL);
    
    return () => clearInterval(intervalId);
  }, [isActive, ping]);

  // Countdown timer
  useEffect(() => {
    if (!isActive) return;

    const countdownId = setInterval(() => {
      setTimeUntilNextPing((prev) => (prev > 0 ? prev - 1 : PING_INTERVAL / 1000));
    }, 1000);

    return () => clearInterval(countdownId);
  }, [isActive]);

  const formatTime = (seconds: number) => {
    return `${seconds}s`;
  };

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return "Nunca";
    return new Date(timestamp).toLocaleTimeString("pt-BR");
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Server Keep-Alive
          </CardTitle>
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? "Ativo" : "Pausado"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Status Row */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Status do Render:</span>
          {lastPing ? (
            <Badge variant={lastPing.success ? "outline" : "destructive"} className="gap-1">
              {lastPing.success ? (
                <>
                  <Zap className="h-3 w-3" />
                  Online ({lastPing.responseTime}ms)
                </>
              ) : (
                "Offline"
              )}
            </Badge>
          ) : (
            <Badge variant="secondary">Aguardando...</Badge>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-muted/50 rounded-md p-2">
            <div className="font-semibold">{pingCount}</div>
            <div className="text-muted-foreground">Pings</div>
          </div>
          <div className="bg-muted/50 rounded-md p-2">
            <div className="font-semibold">{formatTimestamp(lastPing?.timestamp || "")}</div>
            <div className="text-muted-foreground">Último</div>
          </div>
          <div className="bg-muted/50 rounded-md p-2">
            <div className="font-semibold flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" />
              {isActive ? formatTime(timeUntilNextPing) : "--"}
            </div>
            <div className="text-muted-foreground">Próximo</div>
          </div>
        </div>

        {/* Error Display */}
        {lastPing?.error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded-md p-2">
            Erro: {lastPing.error}
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setIsActive(!isActive)}
          >
            {isActive ? (
              <>
                <Pause className="h-3 w-3 mr-1" />
                Pausar
              </>
            ) : (
              <>
                <Play className="h-3 w-3 mr-1" />
                Retomar
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={ping}
            disabled={isLoading}
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Pings automáticos a cada 30s para evitar sleep do Render
        </p>
      </CardContent>
    </Card>
  );
}
