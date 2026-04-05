import { NextRequest, NextResponse } from "next/server";
import { whatsappClient } from "@/lib/whatsapp-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    
    const result = await whatsappClient.getMessages(limit);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] Error getting messages:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get messages" },
      { status: 500 }
    );
  }
}


