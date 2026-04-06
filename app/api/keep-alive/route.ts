import { NextResponse } from "next/server";

const RENDER_URL = process.env.NEXT_PUBLIC_WHATSAPP_API_URL || process.env.WHATSAPP_API_URL;

// Store last ping info
let lastPingStatus = {
  timestamp: "",
  success: false,
  error: "",
  responseTime: 0,
};

export async function GET() {
  if (!RENDER_URL) {
    return NextResponse.json({ 
      error: "WHATSAPP_API_URL not configured",
      lastPing: lastPingStatus 
    }, { status: 500 });
  }

  const startTime = Date.now();
  
  try {
    const response = await fetch(`${RENDER_URL}/health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    const responseTime = Date.now() - startTime;
    const data = await response.json();
    
    lastPingStatus = {
      timestamp: new Date().toISOString(),
      success: response.ok,
      error: "",
      responseTime,
    };

    return NextResponse.json({
      status: "alive",
      renderStatus: data,
      responseTime,
      lastPing: lastPingStatus,
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    lastPingStatus = {
      timestamp: new Date().toISOString(),
      success: false,
      error: (error as Error).message,
      responseTime,
    };

    return NextResponse.json({
      status: "error",
      error: (error as Error).message,
      responseTime,
      lastPing: lastPingStatus,
    }, { status: 500 });
  }
}

// For getting last ping status without actually pinging
export async function POST() {
  return NextResponse.json({ lastPing: lastPingStatus });
}
