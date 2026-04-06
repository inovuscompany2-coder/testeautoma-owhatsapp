import { NextResponse } from "next/server";

const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || "http://localhost:3001";

// In-memory logs for when whatsapp-service is not running
const fallbackLogs = [
  {
    timestamp: new Date().toISOString(),
    level: "info" as const,
    message: "Sistema de logs iniciado. Aguardando conexao com whatsapp-service.",
    source: "frontend",
  },
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get("level") || "";
    const userId = searchParams.get("userId") || "";
    const limit = searchParams.get("limit") || "100";

    const url = new URL(`${WHATSAPP_SERVICE_URL}/logs`);
    if (level) url.searchParams.set("level", level);
    if (userId) url.searchParams.set("userId", userId);
    url.searchParams.set("limit", limit);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(url.toString(), {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // Return empty logs if service returns error
      return NextResponse.json({ logs: fallbackLogs, total: fallbackLogs.length });
    }

    // Check content type to ensure it's JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return NextResponse.json({ logs: fallbackLogs, total: fallbackLogs.length });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    // Service unavailable - return fallback logs without error
    return NextResponse.json({ 
      logs: fallbackLogs, 
      total: fallbackLogs.length,
      serviceOffline: true 
    });
  }
}
