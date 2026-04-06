import { NextResponse } from "next/server";

const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || "http://localhost:3001";

export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const startTime = Date.now();
    const response = await fetch(`${WHATSAPP_SERVICE_URL}/ping`, {
      signal: controller.signal,
    });
    const latency = Date.now() - startTime;
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json({ 
        online: false, 
        error: "Service returned error",
        latency,
      });
    }

    const data = await response.json();

    return NextResponse.json({
      online: true,
      latency,
      uptime: data.uptime,
      whatsappConnected: data.whatsappConnected,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      online: false,
      error: error instanceof Error ? error.message : "Service offline",
      timestamp: new Date().toISOString(),
    });
  }
}
