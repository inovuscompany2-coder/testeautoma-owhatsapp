"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Smartphone, ScanLine, RefreshCw, AlertCircle } from "lucide-react";

interface QRCodeDisplayProps {
  qrCode: string | null;
  isLoading: boolean;
  isExpired?: boolean;
  onReset?: () => void;
  isResetting?: boolean;
}

export function QRCodeDisplay({ qrCode, isLoading, isExpired, onReset, isResetting }: QRCodeDisplayProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-72 w-72 items-center justify-center rounded-2xl border border-border bg-card">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-72 w-72 flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card">
        <Spinner className="h-10 w-10 text-emerald-600" />
        <div className="text-center">
          <p className="font-medium text-foreground">Gerando QR Code...</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Aguarde um momento
          </p>
        </div>
      </div>
    );
  }

  if (!qrCode) {
    return (
      <div className="flex h-72 w-72 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border bg-muted/30">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Smartphone className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="font-medium text-foreground">Pronto para conectar</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Clique no botao abaixo para iniciar
          </p>
        </div>
      </div>
    );
  }

  // QR expirado
  if (isExpired) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="overflow-hidden rounded-2xl border-2 border-amber-500/50 bg-white p-3 shadow-lg">
            <div className="relative h-64 w-64">
              <img
                src={qrCode}
                alt="QR Code expirado"
                className="h-64 w-64 opacity-20 blur-sm"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80">
                <AlertCircle className="h-12 w-12 text-amber-600" />
                <p className="text-lg font-semibold text-amber-700">QR Code Expirado</p>
                <Button
                  onClick={onReset}
                  disabled={isResetting}
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {isResetting ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Gerar Novo QR
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="text-center">
          <p className="font-medium text-amber-700">QR Code expirou</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Clique no botao acima para gerar um novo
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="overflow-hidden rounded-2xl border-2 border-emerald-500/30 bg-white p-3 shadow-lg">
          <img
            src={qrCode}
            alt="QR Code para conectar WhatsApp"
            className="h-64 w-64"
          />
        </div>
        <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg">
          <ScanLine className="h-5 w-5" />
        </div>
      </div>
      <div className="text-center">
        <p className="font-medium text-foreground">Escaneie o QR Code</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Abra o WhatsApp no celular e escaneie
        </p>
      </div>
      {onReset && (
        <Button
          onClick={onReset}
          disabled={isResetting}
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
        >
          {isResetting ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Gerando...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Gerar Novo QR
            </>
          )}
        </Button>
      )}
    </div>
  );
}
