"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { RefreshCw, AlertCircle, Info, AlertTriangle, Bug, Trash2 } from "lucide-react";

interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  source: string;
  userId?: string;
  sessionId?: string;
  data?: Record<string, unknown>;
}

const levelConfig = {
  debug: { icon: Bug, color: "text-slate-500", bg: "bg-slate-500/10", badge: "bg-slate-100 text-slate-700" },
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10", badge: "bg-blue-100 text-blue-700" },
  warn: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", badge: "bg-amber-100 text-amber-700" },
  error: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10", badge: "bg-red-100 text-red-700" },
};

export function ConnectionLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "debug" | "info" | "warn" | "error">("all");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("level", filter);
      params.set("limit", "200");

      const response = await fetch(`/api/whatsapp/logs?${params.toString()}`);
      const data = await response.json();

      if (data.logs) {
        setLogs(data.logs);
      }
      setError(null);
    } catch {
      setError("Erro ao carregar logs");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const filteredLogs = filter === "all" ? logs : logs.filter((log) => log.level === filter);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Logs de Conexao</CardTitle>
            <CardDescription>Historico de eventos do servico WhatsApp</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            >
              {autoRefresh && <Spinner className="mr-1.5 h-3 w-3" />}
              Auto
            </Button>
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {(["all", "error", "warn", "info", "debug"] as const).map((level) => (
            <Button
              key={level}
              variant={filter === level ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(level)}
              className={filter === level ? "bg-foreground text-background" : ""}
            >
              {level === "all" ? "Todos" : level.charAt(0).toUpperCase() + level.slice(1)}
              {level !== "all" && (
                <span className="ml-1.5 text-xs opacity-70">
                  ({logs.filter((l) => l.level === level).length})
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-sm font-medium text-destructive">{error}</p>
          </div>
        )}

        {/* Logs list */}
        <ScrollArea className="h-[400px] rounded-lg border">
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-6 w-6" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Info className="mb-2 h-8 w-8" />
              <p>Nenhum log encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredLogs.map((log, index) => {
                const config = levelConfig[log.level];
                const Icon = config.icon;

                return (
                  <div key={index} className={`flex gap-3 p-3 ${config.bg}`}>
                    <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${config.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={`text-xs ${config.badge}`}>
                          {log.level}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(log.timestamp)} {formatTimestamp(log.timestamp)}
                        </span>
                        {log.source && (
                          <span className="text-xs text-muted-foreground">
                            [{log.source}]
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground break-words">{log.message}</p>
                      {log.data && Object.keys(log.data).length > 0 && (
                        <pre className="mt-1 text-xs text-muted-foreground bg-muted/50 p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {filteredLogs.length} log{filteredLogs.length !== 1 ? "s" : ""}
            {filter !== "all" && ` (filtrado por ${filter})`}
          </span>
          {autoRefresh && <span>Atualizando automaticamente...</span>}
        </div>
      </CardContent>
    </Card>
  );
}
