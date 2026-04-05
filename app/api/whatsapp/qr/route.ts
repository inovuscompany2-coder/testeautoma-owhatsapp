import { NextResponse } from "next/server";
import { whatsappClient } from "@/lib/whatsapp-client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await whatsappClient.getQR();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API] Error getting QR:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get QR code" },
      { status: 500 }
    );
  }
}
