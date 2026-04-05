"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  Plus,
  Trash2,
  Play,
  Square,
  Check,
  X,
  Clock,
  Send,
  Users,
  MessageSquare,
  Shuffle,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface MessageVariation {
  id: string;
  content: string;
}

interface MessageStep {
  id: string;
  variations: MessageVariation[];
  delay: number; // delay em segundos antes de enviar essa mensagem
}

interface ContactStatus {
  number: string;
  status: "pending" | "sending" | "success" | "error";
  error?: string;
  messagesSent: number;
}

export function BulkMessageSender() {
  // Lista de numeros
  const [numbersInput, setNumbersInput] = useState("");
  const [parsedNumbers, setParsedNumbers] = useState<string[]>([]);
  const [duplicatesRemoved, setDuplicatesRemoved] = useState(0);
  const [dispatchId, setDispatchId] = useState<string | null>(null);

  const supabase = createClient();

  // Fluxo de mensagens
  const [messageSteps, setMessageSteps] = useState<MessageStep[]>([
    {
      id: crypto.randomUUID(),
      variations: [{ id: crypto.randomUUID(), content: "" }],
      delay: 0,
    },
  ]);

  // Delay entre contatos
  const [contactDelay, setContactDelay] = useState(5);

  // Estado do disparo
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [contactStatuses, setContactStatuses] = useState<ContactStatus[]>([]);
  const [currentContactIndex, setCurrentContactIndex] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Parse dos numeros
  const handleParseNumbers = useCallback(() => {
    const lines = numbersInput
      .split(/[\n,;]+/)
      .map((n) => n.trim().replace(/\D/g, ""))
      .filter((n) => n.length >= 10 && n.length <= 13);

    // Remove duplicatas e conta quantos foram removidos
    const unique = [...new Set(lines)];
    const duplicates = lines.length - unique.length;
    setDuplicatesRemoved(duplicates);
    setParsedNumbers(unique);

    // Inicializa status dos contatos
    setContactStatuses(
      unique.map((number) => ({
        number,
        status: "pending",
        messagesSent: 0,
      }))
    );
  }, [numbersInput]);

  // Adicionar nova etapa de mensagem
  const addMessageStep = () => {
    setMessageSteps([
      ...messageSteps,
      {
        id: crypto.randomUUID(),
        variations: [{ id: crypto.randomUUID(), content: "" }],
        delay: 2,
      },
    ]);
  };

  // Remover etapa de mensagem
  const removeMessageStep = (stepId: string) => {
    if (messageSteps.length > 1) {
      setMessageSteps(messageSteps.filter((s) => s.id !== stepId));
    }
  };

  // Adicionar variacao a uma etapa
  const addVariation = (stepId: string) => {
    setMessageSteps(
      messageSteps.map((step) =>
        step.id === stepId
          ? {
              ...step,
              variations: [
                ...step.variations,
                { id: crypto.randomUUID(), content: "" },
              ],
            }
          : step
      )
    );
  };

  // Remover variacao
  const removeVariation = (stepId: string, variationId: string) => {
    setMessageSteps(
      messageSteps.map((step) =>
        step.id === stepId && step.variations.length > 1
          ? {
              ...step,
              variations: step.variations.filter((v) => v.id !== variationId),
            }
          : step
      )
    );
  };

  // Atualizar conteudo da variacao
  const updateVariation = (
    stepId: string,
    variationId: string,
    content: string
  ) => {
    setMessageSteps(
      messageSteps.map((step) =>
        step.id === stepId
          ? {
              ...step,
              variations: step.variations.map((v) =>
                v.id === variationId ? { ...v, content } : v
              ),
            }
          : step
      )
    );
  };

  // Atualizar delay da etapa
  const updateStepDelay = (stepId: string, delay: number) => {
    setMessageSteps(
      messageSteps.map((step) =>
        step.id === stepId ? { ...step, delay } : step
      )
    );
  };

  // Selecionar mensagem aleatoria de uma etapa
  const getRandomVariation = (step: MessageStep): string => {
    const validVariations = step.variations.filter((v) => v.content.trim());
    if (validVariations.length === 0) return "";
    return validVariations[Math.floor(Math.random() * validVariations.length)]
      .content;
  };

  // Funcao de delay
  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  // Iniciar disparo
  const startDispatch = async () => {
    if (parsedNumbers.length === 0) {
      handleParseNumbers();
      return;
    }

    // Validar se tem mensagens
    const hasValidMessages = messageSteps.some((step) =>
      step.variations.some((v) => v.content.trim())
    );
    if (!hasValidMessages) {
      return;
    }

    setIsRunning(true);
    setIsPaused(false);
    abortControllerRef.current = new AbortController();

    // Criar registro do disparo no banco
    let currentDispatchId = dispatchId;
    if (!currentDispatchId) {
      try {
        const { data } = await supabase
          .from("dispatch_history")
          .insert({
            flow_name: `Disparo ${new Date().toLocaleString("pt-BR")}`,
            total_contacts: parsedNumbers.length,
            success_count: 0,
            error_count: 0,
            status: "running",
          })
          .select("id")
          .single();

        if (data) {
          currentDispatchId = data.id;
          setDispatchId(data.id);
        }
      } catch (err) {
        // Se falhar, continua sem salvar no banco
        console.log("[v0] Could not create dispatch record:", err);
      }
    }

    const numbersToProcess = parsedNumbers.slice(currentContactIndex);

    for (let i = 0; i < numbersToProcess.length; i++) {
      if (abortControllerRef.current?.signal.aborted) break;

      const contactIndex = currentContactIndex + i;
      const number = numbersToProcess[i];

      // Atualiza status para "sending"
      setContactStatuses((prev) =>
        prev.map((c, idx) =>
          idx === contactIndex ? { ...c, status: "sending" } : c
        )
      );
      setCurrentContactIndex(contactIndex);

      try {
        let messagesSent = 0;

        // Envia cada etapa de mensagem
        for (let stepIndex = 0; stepIndex < messageSteps.length; stepIndex++) {
          if (abortControllerRef.current?.signal.aborted) break;

          const step = messageSteps[stepIndex];
          const message = getRandomVariation(step);

          if (!message) continue;

          // Delay antes da mensagem (exceto primeira)
          if (stepIndex > 0 && step.delay > 0) {
            await sleep(step.delay * 1000);
          }

          if (abortControllerRef.current?.signal.aborted) break;

          // Envia a mensagem
          const response = await fetch("/api/whatsapp/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: number, message }),
          });

          if (!response.ok) {
            throw new Error("Falha ao enviar");
          }

          messagesSent++;

          // Atualiza contador de mensagens enviadas
          setContactStatuses((prev) =>
            prev.map((c, idx) =>
              idx === contactIndex ? { ...c, messagesSent } : c
            )
          );
        }

        // Marca como sucesso
        setContactStatuses((prev) =>
          prev.map((c, idx) =>
            idx === contactIndex
              ? { ...c, status: "success", messagesSent }
              : c
          )
        );

        // Salvar no banco
        if (currentDispatchId) {
          try {
            await supabase.from("sent_messages").insert({
              dispatch_id: currentDispatchId,
              phone_number: number,
              messages_sent: messagesSent,
              status: "success",
            });
          } catch (err) {
            console.log("[v0] Could not save message record:", err);
          }
        }
      } catch (error) {
        // Marca como erro
        setContactStatuses((prev) =>
          prev.map((c, idx) =>
            idx === contactIndex
              ? {
                  ...c,
                  status: "error",
                  error:
                    error instanceof Error ? error.message : "Erro desconhecido",
                }
              : c
          )
        );

        // Salvar erro no banco
        if (currentDispatchId) {
          try {
            await supabase.from("sent_messages").insert({
              dispatch_id: currentDispatchId,
              phone_number: number,
              messages_sent: 0,
              status: "error",
              error_message: error instanceof Error ? error.message : "Erro desconhecido",
            });
          } catch (err) {
            console.log("[v0] Could not save error record:", err);
          }
        }
      }

      // Delay entre contatos
      if (i < numbersToProcess.length - 1 && !abortControllerRef.current?.signal.aborted) {
        await sleep(contactDelay * 1000);
      }
    }

    // Atualizar estatisticas do disparo no banco
    if (currentDispatchId) {
      try {
        const finalStats = contactStatuses.reduce(
          (acc, c) => {
            if (c.status === "success") acc.success++;
            if (c.status === "error") acc.error++;
            return acc;
          },
          { success: 0, error: 0 }
        );

        await supabase
          .from("dispatch_history")
          .update({
            success_count: finalStats.success,
            error_count: finalStats.error,
            status: "completed",
          })
          .eq("id", currentDispatchId);
      } catch (err) {
        console.log("[v0] Could not update dispatch record:", err);
      }
    }

    setIsRunning(false);
    setCurrentContactIndex(0);
    setDispatchId(null);
  };

  // Parar disparo
  const stopDispatch = () => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
    setIsPaused(true);
  };

  // Reiniciar disparo
  const resetDispatch = () => {
    setContactStatuses(
      parsedNumbers.map((number) => ({
        number,
        status: "pending",
        messagesSent: 0,
      }))
    );
    setCurrentContactIndex(0);
    setIsPaused(false);
  };

  // Estatisticas
  const stats = {
    total: contactStatuses.length,
    success: contactStatuses.filter((c) => c.status === "success").length,
    error: contactStatuses.filter((c) => c.status === "error").length,
    pending: contactStatuses.filter((c) => c.status === "pending").length,
    sending: contactStatuses.filter((c) => c.status === "sending").length,
  };

  const progressPercent =
    stats.total > 0
      ? Math.round(((stats.success + stats.error) / stats.total) * 100)
      : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Coluna Esquerda: Configuracao */}
      <div className="space-y-6">
        {/* Lista de Numeros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Lista de Numeros
            </CardTitle>
            <CardDescription>
              Cole os numeros separados por virgula, ponto e virgula ou nova linha
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="5519996854339&#10;5511999887766&#10;5521998765432"
              value={numbersInput}
              onChange={(e) => setNumbersInput(e.target.value)}
              disabled={isRunning}
              rows={5}
              className="font-mono text-sm"
            />

            <div className="flex items-center justify-between">
              <Button
                onClick={handleParseNumbers}
                variant="secondary"
                size="sm"
                disabled={isRunning || !numbersInput.trim()}
              >
                Processar Numeros
              </Button>

{parsedNumbers.length > 0 && (
              <Badge variant="secondary" className="text-sm">
                {parsedNumbers.length} numero(s) valido(s)
              </Badge>
            )}
            </div>

            {duplicatesRemoved > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-sm text-amber-700">
                  {duplicatesRemoved} numero(s) duplicado(s) removido(s) automaticamente
                </p>
              </div>
            )}

            {parsedNumbers.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2">
                <div className="flex flex-wrap gap-1">
                  {parsedNumbers.map((num, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs font-mono">
                      +{num}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delay entre Contatos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" />
              Delay entre Contatos
            </CardTitle>
            <CardDescription>
              Tempo de espera entre enviar para cada contato
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                min={1}
                max={120}
                value={contactDelay}
                onChange={(e) => setContactDelay(Number(e.target.value) || 5)}
                disabled={isRunning}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">segundos</span>
            </div>
          </CardContent>
        </Card>

        {/* Fluxo de Mensagens */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5" />
              Fluxo de Mensagens
            </CardTitle>
            <CardDescription>
              Configure as mensagens em sequencia com variacoes aleatorias
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {messageSteps.map((step, stepIndex) => (
              <div
                key={step.id}
                className="rounded-lg border border-border bg-muted/20 p-4"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-600 text-white">
                      Mensagem {stepIndex + 1}
                    </Badge>
                    {step.variations.length > 1 && (
                      <Badge variant="outline" className="gap-1">
                        <Shuffle className="h-3 w-3" />
                        {step.variations.length} variacoes
                      </Badge>
                    )}
                  </div>

                  {messageSteps.length > 1 && (
                    <Button
                      onClick={() => removeMessageStep(step.id)}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      disabled={isRunning}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Delay (exceto primeira mensagem) */}
                {stepIndex > 0 && (
                  <div className="mb-4 flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">
                      Aguardar
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      value={step.delay}
                      onChange={(e) =>
                        updateStepDelay(step.id, Number(e.target.value) || 0)
                      }
                      disabled={isRunning}
                      className="w-16 h-8 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">
                      segundos antes de enviar
                    </span>
                  </div>
                )}

                {/* Variacoes */}
                <div className="space-y-3">
                  {step.variations.map((variation, varIndex) => (
                    <div key={variation.id} className="flex gap-2">
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">
                            Variacao {varIndex + 1}
                          </Label>
                        </div>
                        <Textarea
                          placeholder={`Digite a variacao ${varIndex + 1} da mensagem...`}
                          value={variation.content}
                          onChange={(e) =>
                            updateVariation(step.id, variation.id, e.target.value)
                          }
                          disabled={isRunning}
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                      {step.variations.length > 1 && (
                        <Button
                          onClick={() => removeVariation(step.id, variation.id)}
                          variant="ghost"
                          size="icon"
                          className="mt-6 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                          disabled={isRunning}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => addVariation(step.id)}
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  disabled={isRunning}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Adicionar Variacao
                </Button>
              </div>
            ))}

            <Button
              onClick={addMessageStep}
              variant="secondary"
              className="w-full"
              disabled={isRunning}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Mensagem ao Fluxo
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Coluna Direita: Controle e Status */}
      <div className="space-y-6">
        {/* Controle do Disparo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Send className="h-5 w-5" />
              Controle do Disparo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              {!isRunning ? (
                <Button
                  onClick={startDispatch}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  size="lg"
                  disabled={
                    parsedNumbers.length === 0 ||
                    !messageSteps.some((s) =>
                      s.variations.some((v) => v.content.trim())
                    )
                  }
                >
                  <Play className="mr-2 h-5 w-5" />
                  {isPaused ? "Continuar Disparo" : "Iniciar Disparo"}
                </Button>
              ) : (
                <Button
                  onClick={stopDispatch}
                  variant="destructive"
                  className="flex-1"
                  size="lg"
                >
                  <Square className="mr-2 h-5 w-5" />
                  Parar Disparo
                </Button>
              )}

              {(isPaused || stats.success + stats.error > 0) && !isRunning && (
                <Button
                  onClick={resetDispatch}
                  variant="outline"
                  size="lg"
                >
                  Reiniciar
                </Button>
              )}
            </div>

            {/* Progresso */}
            {stats.total > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium">
                    {stats.success + stats.error} / {stats.total}
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
            )}

            {/* Estatisticas */}
            {stats.total > 0 && (
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="text-xl font-bold text-foreground">
                    {stats.total}
                  </div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
                  <div className="text-xl font-bold text-emerald-600">
                    {stats.success}
                  </div>
                  <div className="text-xs text-emerald-600">Enviados</div>
                </div>
                <div className="rounded-lg bg-destructive/10 p-3 text-center">
                  <div className="text-xl font-bold text-destructive">
                    {stats.error}
                  </div>
                  <div className="text-xs text-destructive">Erros</div>
                </div>
                <div className="rounded-lg bg-amber-500/10 p-3 text-center">
                  <div className="text-xl font-bold text-amber-600">
                    {stats.pending + stats.sending}
                  </div>
                  <div className="text-xs text-amber-600">Pendentes</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status dos Contatos */}
        {contactStatuses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Status dos Contatos</CardTitle>
              <CardDescription>
                Acompanhe o progresso de cada numero
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[400px] space-y-2 overflow-y-auto pr-2">
                {contactStatuses.map((contact, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-3 transition-colors",
                      contact.status === "sending" &&
                        "border-amber-500/50 bg-amber-500/5",
                      contact.status === "success" &&
                        "border-emerald-500/50 bg-emerald-500/5",
                      contact.status === "error" &&
                        "border-destructive/50 bg-destructive/5",
                      contact.status === "pending" && "border-border bg-muted/20"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full",
                          contact.status === "pending" && "bg-muted",
                          contact.status === "sending" && "bg-amber-500/20",
                          contact.status === "success" && "bg-emerald-500/20",
                          contact.status === "error" && "bg-destructive/20"
                        )}
                      >
                        {contact.status === "pending" && (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                        {contact.status === "sending" && (
                          <Spinner className="h-4 w-4 text-amber-600" />
                        )}
                        {contact.status === "success" && (
                          <Check className="h-4 w-4 text-emerald-600" />
                        )}
                        {contact.status === "error" && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>

                      <div>
                        <p className="font-mono text-sm font-medium">
                          +{contact.number}
                        </p>
                        {contact.status === "success" && (
                          <p className="text-xs text-emerald-600">
                            {contact.messagesSent} mensagem(ns) enviada(s)
                          </p>
                        )}
                        {contact.status === "error" && contact.error && (
                          <p className="text-xs text-destructive">
                            {contact.error}
                          </p>
                        )}
                        {contact.status === "sending" && (
                          <p className="text-xs text-amber-600">
                            Enviando mensagem {contact.messagesSent + 1}...
                          </p>
                        )}
                      </div>
                    </div>

                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        contact.status === "success" &&
                          "bg-emerald-500/20 text-emerald-700",
                        contact.status === "error" &&
                          "bg-destructive/20 text-destructive",
                        contact.status === "sending" &&
                          "bg-amber-500/20 text-amber-700"
                      )}
                    >
                      {contact.status === "pending" && "Aguardando"}
                      {contact.status === "sending" && "Enviando"}
                      {contact.status === "success" && "Enviado"}
                      {contact.status === "error" && "Erro"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dicas */}
        {contactStatuses.length === 0 && (
          <Card className="border-dashed border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="py-6">
              <h3 className="mb-3 font-medium text-foreground">
                Dicas para evitar bloqueio
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  Adicione varias variacoes para cada mensagem
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  Use delays maiores entre contatos (10-30 segundos)
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  Nao envie para muitos contatos de uma vez
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  Evite links e conteudo que pareca spam
                </li>
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
