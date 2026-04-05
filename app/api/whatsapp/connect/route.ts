import { NextResponse } from "next/server";
import { whatsappClient } from "@/lib/whatsapp-client";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await whatsappClient.connect();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] Error connecting:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to connect" },
      { status: 500 }
    );
  }
}
