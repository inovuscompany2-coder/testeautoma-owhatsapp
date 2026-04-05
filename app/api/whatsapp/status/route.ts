import { NextResponse } from "next/server";
import { whatsappClient } from "@/lib/whatsapp-client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await whatsappClient.getStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error("[API] Error getting status:", error);
    return NextResponse.json(
      { 
        connected: false, 
        connecting: false,
        error: error instanceof Error ? error.message : "Service unavailable" 
      },
      { status: 500 }
    );
  }
}
