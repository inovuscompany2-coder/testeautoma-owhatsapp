"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Trash2,
  Copy,
  Download,
  AlertTriangle,
  Check,
  Filter,
  Users,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface CleaningResult {
  original: number;
  valid: number;
  duplicates: number;
  invalid: number;
  alreadySent: number;
  cleanedNumbers: string[];
  duplicateNumbers: string[];
  invalidNumbers: string[];
  sentNumbers: string[];
}

export function ListCleaner() {
  const [numbersInput, setNumbersInput] = useState("");
  const [result, setResult] = useState<CleaningResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Opcoes de limpeza
  const [removeDuplicates, setRemoveDuplicates] = useState(true);
  const [removeInvalid, setRemoveInvalid] = useState(true);
  const [removeSent, setRemoveSent] = useState(true);

  const supabase = createClient();

  const cleanList = useCallback(async () => {
    setLoading(true);

    try {
      // Parse dos numeros
      const lines = numbersInput
        .split(/[\n,;]+/)
        .map((n) => n.trim().replace(/\D/g, ""))
        .filter((n) => n.length > 0);

      const original = lines.length;

      // Separar validos e invalidos
      const validNumbers: string[] = [];
      const invalidNumbers: string[] = [];

      lines.forEach((n) => {
        if (n.length >= 10 && n.length <= 13) {
          validNumbers.push(n);
        } else {
          invalidNumbers.push(n);
        }
      });

      // Encontrar duplicatas
      const seen = new Map<string, number>();
      const duplicateNumbers: string[] = [];
      const uniqueNumbers: string[] = [];

      validNumbers.forEach((n) => {
        const count = seen.get(n) || 0;
        if (count === 0) {
          uniqueNumbers.push(n);
        } else if (count === 1) {
          duplicateNumbers.push(n);
        }
        seen.set(n, count + 1);
      });

      // Verificar numeros ja enviados no banco
      let sentNumbers: string[] = [];
      if (removeSent) {
        try {
          const { data } = await supabase
            .from("sent_messages")
            .select("phone_number")
            .in("phone_number", uniqueNumbers)
            .eq("status", "success");

          if (data) {
            sentNumbers = data.map((d) => d.phone_number);
          }
        } catch (err) {
          // Se o banco nao estiver disponivel, continua sem filtrar
          console.log("[v0] Could not check sent numbers:", err);
        }
      }

      // Aplicar filtros
      let cleanedNumbers = [...uniqueNumbers];

      if (removeDuplicates) {
        // Ja esta sem duplicatas
      }

      if (removeInvalid) {
        // Invalidos ja foram separados
      } else {
        cleanedNumbers = [...cleanedNumbers, ...invalidNumbers];
      }

      if (removeSent && sentNumbers.length > 0) {
        cleanedNumbers = cleanedNumbers.filter((n) => !sentNumbers.includes(n));
      }

      setResult({
        original,
        valid: cleanedNumbers.length,
        duplicates: removeDuplicates ? duplicateNumbers.length : 0,
        invalid: removeInvalid ? invalidNumbers.length : 0,
        alreadySent: sentNumbers.length,
        cleanedNumbers,
        duplicateNumbers,
        invalidNumbers,
        sentNumbers,
      });
    } finally {
      setLoading(false);
    }
  }, [numbersInput, removeDuplicates, removeInvalid, removeSent, supabase]);

  const copyToClipboard = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.cleanedNumbers.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.log("[v0] Failed to copy:", err);
    }
  };

  const downloadList = () => {
    if (!result) return;
    const blob = new Blob([result.cleanedNumbers.join("\n")], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `numeros-limpos-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setResult(null);
    setNumbersInput("");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5" />
            Limpeza de Lista
          </CardTitle>
          <CardDescription>
            Remova duplicatas, numeros invalidos e numeros ja contatados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Opcoes de limpeza */}
          <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="removeDuplicates"
                checked={removeDuplicates}
                onCheckedChange={(checked) => setRemoveDuplicates(checked === true)}
              />
              <Label htmlFor="removeDuplicates" className="text-sm cursor-pointer">
                Remover duplicatas
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="removeInvalid"
                checked={removeInvalid}
                onCheckedChange={(checked) => setRemoveInvalid(checked === true)}
              />
              <Label htmlFor="removeInvalid" className="text-sm cursor-pointer">
                Remover invalidos
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="removeSent"
                checked={removeSent}
                onCheckedChange={(checked) => setRemoveSent(checked === true)}
              />
              <Label htmlFor="removeSent" className="text-sm cursor-pointer">
                Remover ja enviados
              </Label>
            </div>
          </div>

          {/* Input de numeros */}
          <Textarea
            placeholder="Cole sua lista de numeros aqui...&#10;5519996854339&#10;5511999887766&#10;5521998765432"
            value={numbersInput}
            onChange={(e) => setNumbersInput(e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />

          <div className="flex gap-3">
            <Button
              onClick={cleanList}
              disabled={loading || !numbersInput.trim()}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Filter className="mr-2 h-4 w-4" />
                  Limpar Lista
                </>
              )}
            </Button>
            {result && (
              <Button onClick={reset} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resultado */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Resultado da Limpeza
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Estatisticas */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-2xl font-bold text-foreground">
                  {result.original}
                </div>
                <div className="text-xs text-muted-foreground">Original</div>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
                <div className="text-2xl font-bold text-emerald-600">
                  {result.valid}
                </div>
                <div className="text-xs text-emerald-600">Limpos</div>
              </div>
              {result.duplicates > 0 && (
                <div className="rounded-lg bg-amber-500/10 p-3 text-center">
                  <div className="text-2xl font-bold text-amber-600">
                    {result.duplicates}
                  </div>
                  <div className="text-xs text-amber-600">Duplicatas</div>
                </div>
              )}
              {result.invalid > 0 && (
                <div className="rounded-lg bg-destructive/10 p-3 text-center">
                  <div className="text-2xl font-bold text-destructive">
                    {result.invalid}
                  </div>
                  <div className="text-xs text-destructive">Invalidos</div>
                </div>
              )}
              {result.alreadySent > 0 && (
                <div className="rounded-lg bg-blue-500/10 p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {result.alreadySent}
                  </div>
                  <div className="text-xs text-blue-600">Ja Enviados</div>
                </div>
              )}
            </div>

            {/* Alertas */}
            {(result.duplicates > 0 || result.invalid > 0 || result.alreadySent > 0) && (
              <div className="space-y-2">
                {result.duplicates > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium text-amber-700">
                        {result.duplicates} numero(s) duplicado(s) removido(s)
                      </p>
                      <p className="text-xs text-amber-600/70">
                        {result.duplicateNumbers.slice(0, 5).join(", ")}
                        {result.duplicateNumbers.length > 5 && "..."}
                      </p>
                    </div>
                  </div>
                )}
                {result.invalid > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div>
                      <p className="text-sm font-medium text-destructive">
                        {result.invalid} numero(s) invalido(s) removido(s)
                      </p>
                      <p className="text-xs text-destructive/70">
                        {result.invalidNumbers.slice(0, 5).join(", ")}
                        {result.invalidNumbers.length > 5 && "..."}
                      </p>
                    </div>
                  </div>
                )}
                {result.alreadySent > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-700">
                        {result.alreadySent} numero(s) ja contatado(s) removido(s)
                      </p>
                      <p className="text-xs text-blue-600/70">
                        {result.sentNumbers.slice(0, 5).join(", ")}
                        {result.sentNumbers.length > 5 && "..."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Lista limpa */}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Lista Limpa ({result.cleanedNumbers.length} numeros)
                </span>
                <div className="flex gap-2">
                  <Button
                    onClick={copyToClipboard}
                    variant="outline"
                    size="sm"
                  >
                    {copied ? (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        Copiar
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={downloadList}
                    variant="outline"
                    size="sm"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Baixar
                  </Button>
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto">
                <div className="flex flex-wrap gap-1">
                  {result.cleanedNumbers.slice(0, 50).map((num, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs font-mono">
                      +{num}
                    </Badge>
                  ))}
                  {result.cleanedNumbers.length > 50 && (
                    <Badge variant="secondary" className="text-xs">
                      +{result.cleanedNumbers.length - 50} mais
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
