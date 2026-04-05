"use client";

import { cn } from "@/lib/utils";

interface ConnectionStatusProps {
  connected: boolean;
  connecting: boolean;
  phone?: string;
}

export function ConnectionStatus({
  connected,
  connecting,
  phone,
}: ConnectionStatusProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "h-3 w-3 rounded-full",
          connected
            ? "bg-emerald-500"
            : connecting
              ? "bg-amber-500 animate-pulse"
              : "bg-muted-foreground/30"
        )}
      />
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">
          {connected
            ? "Conectado"
            : connecting
              ? "Conectando..."
              : "Desconectado"}
        </span>
        {connected && phone && (
          <span className="text-xs text-muted-foreground">
            +{phone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, "$1 ($2) $3-$4")}
          </span>
        )}
      </div>
    </div>
  );
}
