import { NextResponse } from "next/server";
import { whatsappClient } from "@/lib/whatsapp-client";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await whatsappClient.resetQR();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] Error resetting QR:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reset QR" },
      { status: 500 }
    );
  }
}
