"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import {
  History,
  Check,
  X,
  Search,
  RefreshCw,
  MessageSquare,
  Clock,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface SentMessage {
  id: string;
  phone_number: string;
  flow_name: string | null;
  messages_sent: number;
  status: string;
  has_response: boolean;
  response_text: string | null;
  responded_at: string | null;
  error_message: string | null;
  created_at: string;
}

interface DispatchHistory {
  id: string;
  flow_name: string | null;
  total_contacts: number;
  success_count: number;
  error_count: number;
  status: string;
  created_at: string;
}

export function MessageHistory() {
  const [dispatches, setDispatches] = useState<DispatchHistory[]>([]);
  const [messages, setMessages] = useState<SentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDispatch, setSelectedDispatch] = useState<string | null>(null);
  const [filterResponse, setFilterResponse] = useState<"all" | "with" | "without">("all");

  const supabase = createClient();

  const fetchDispatches = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("dispatch_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setDispatches(data || []);
    } catch (err) {
      console.log("[v0] Error fetching dispatches:", err);
    }
  }, [supabase]);

  const fetchMessages = useCallback(async () => {
    try {
      let query = supabase
        .from("sent_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (selectedDispatch) {
        query = query.eq("dispatch_id", selectedDispatch);
      }

      if (filterResponse === "with") {
        query = query.eq("has_response", true);
      } else if (filterResponse === "without") {
        query = query.eq("has_response", false);
      }

      if (searchQuery) {
        query = query.ilike("phone_number", `%${searchQuery}%`);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.log("[v0] Error fetching messages:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase, selectedDispatch, filterResponse, searchQuery]);

  useEffect(() => {
    fetchDispatches();
    fetchMessages();
  }, [fetchDispatches, fetchMessages]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchDispatches();
    fetchMessages();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo de Disparos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5" />
                Historico de Disparos
              </CardTitle>
              <CardDescription>
                Ultimos disparos realizados
              </CardDescription>
            </div>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {dispatches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">Nenhum disparo realizado ainda</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {dispatches.map((dispatch) => (
                <div
                  key={dispatch.id}
                  onClick={() => setSelectedDispatch(
                    selectedDispatch === dispatch.id ? null : dispatch.id
                  )}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors hover:bg-muted/50",
                    selectedDispatch === dispatch.id && "border-emerald-500 bg-emerald-500/5"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {dispatch.flow_name || "Disparo sem nome"}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDate(dispatch.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {dispatch.total_contacts} contatos
                    </Badge>
                    <Badge className="bg-emerald-500/20 text-emerald-700">
                      <Check className="mr-1 h-3 w-3" />
                      {dispatch.success_count}
                    </Badge>
                    {dispatch.error_count > 0 && (
                      <Badge className="bg-destructive/20 text-destructive">
                        <X className="mr-1 h-3 w-3" />
                        {dispatch.error_count}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mensagens Enviadas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageCircle className="h-5 w-5" />
                Mensagens Enviadas
              </CardTitle>
              <CardDescription>
                Historico detalhado de envios
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por numero..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterResponse === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterResponse("all")}
              >
                Todos
              </Button>
              <Button
                variant={filterResponse === "with" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterResponse("with")}
                className={filterResponse === "with" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              >
                Com Resposta
              </Button>
              <Button
                variant={filterResponse === "without" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterResponse("without")}
              >
                Sem Resposta
              </Button>
            </div>
          </div>

          {/* Lista de Mensagens */}
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageCircle className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">Nenhuma mensagem encontrada</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3",
                    msg.status === "success" && "border-emerald-500/30 bg-emerald-500/5",
                    msg.status === "error" && "border-destructive/30 bg-destructive/5",
                    msg.has_response && "ring-2 ring-emerald-500/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full",
                        msg.status === "success" && "bg-emerald-500/20",
                        msg.status === "error" && "bg-destructive/20",
                        msg.status === "pending" && "bg-muted"
                      )}
                    >
                      {msg.status === "success" && (
                        <Check className="h-4 w-4 text-emerald-600" />
                      )}
                      {msg.status === "error" && (
                        <X className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="font-mono text-sm font-medium">
                        +{msg.phone_number}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDate(msg.created_at)}</span>
                        <span>-</span>
                        <span>{msg.messages_sent} msg(s)</span>
                      </div>
                      {msg.has_response && msg.response_text && (
                        <div className="mt-1 rounded bg-emerald-500/10 p-2 text-xs text-emerald-700">
                          Resposta: {msg.response_text}
                        </div>
                      )}
                      {msg.error_message && (
                        <p className="mt-1 text-xs text-destructive">
                          {msg.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        msg.status === "success" && "bg-emerald-500/20 text-emerald-700",
                        msg.status === "error" && "bg-destructive/20 text-destructive"
                      )}
                    >
                      {msg.status === "success" && "Enviado"}
                      {msg.status === "error" && "Erro"}
                      {msg.status === "pending" && "Pendente"}
                    </Badge>
                    {msg.has_response && (
                      <Badge className="bg-emerald-600 text-white text-xs">
                        <MessageCircle className="mr-1 h-3 w-3" />
                        Respondeu
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
