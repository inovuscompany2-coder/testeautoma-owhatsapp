import { NextResponse } from "next/server";

const RENDER_URL = process.env.NEXT_PUBLIC_WHATSAPP_API_URL || process.env.WHATSAPP_API_URL;

// This endpoint is called automatically by Vercel Cron every 5 minutes
// It keeps the Render server awake 24/7
export async function GET(request: Request) {
  // Verify cron secret in production (optional but recommended)
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Still allow the request but log it
    console.log("[Cron] Unauthorized request, but allowing for keep-alive");
  }

  if (!RENDER_URL) {
    console.log("[Cron] WHATSAPP_API_URL not configured");
    return NextResponse.json({ error: "WHATSAPP_API_URL not configured" }, { status: 500 });
  }

  const startTime = Date.now();
  
  try {
    // Ping the health endpoint
    const response = await fetch(`${RENDER_URL}/health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    const responseTime = Date.now() - startTime;
    const data = await response.json();
    
    console.log(`[Cron] Ping successful - ${responseTime}ms - Server status: ${data.status || "ok"}`);

    return NextResponse.json({
      success: true,
      message: "Render server pinged successfully",
      responseTime,
      serverStatus: data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`[Cron] Ping failed after ${responseTime}ms:`, (error as Error).message);

    return NextResponse.json({
      success: false,
      error: (error as Error).message,
      responseTime,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// Allow manual trigger via POST
export async function POST() {
  return GET(new Request("http://localhost"));
}
