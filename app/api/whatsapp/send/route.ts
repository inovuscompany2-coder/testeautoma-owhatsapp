import { NextRequest, NextResponse } from "next/server";
import { whatsappClient } from "@/lib/whatsapp-client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, message } = body;

    if (!to || !message) {
      return NextResponse.json(
        { error: "Missing 'to' or 'message' in request body" },
        { status: 400 }
      );
    }

    const result = await whatsappClient.sendMessage(to, message);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] Error sending message:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send message" },
      { status: 500 }
    );
  }
}
