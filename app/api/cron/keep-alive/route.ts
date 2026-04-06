import { NextResponse } from "next/server";

// This endpoint is called by Vercel Cron to keep the Render service alive
// Configure in vercel.json with: "crons": [{ "path": "/api/cron/keep-alive", "schedule": "*/1 * * * *" }]

const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || "http://localhost:3001";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify cron secret for security (optional but recommended)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(`${WHATSAPP_SERVICE_URL}/ping`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json({ 
        success: false, 
        error: "Service returned error",
        status: response.status 
      }, { status: 500 });
    }

    const data = await response.json();
    
    console.log(`[Keep-Alive Cron] Ping successful - Uptime: ${Math.floor(data.uptime)}s, WhatsApp: ${data.whatsappConnected}`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      service: {
        uptime: data.uptime,
        whatsappConnected: data.whatsappConnected,
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Keep-Alive Cron] Ping failed:", errorMessage);

    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
