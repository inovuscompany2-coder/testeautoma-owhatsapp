import { NextResponse } from "next/server";

const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || "http://localhost:3001";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get("level") || "";
    const userId = searchParams.get("userId") || "";
    const limit = searchParams.get("limit") || "100";

    const url = new URL(`${WHATSAPP_SERVICE_URL}/logs`);
    if (level) url.searchParams.set("level", level);
    if (userId) url.searchParams.set("userId", userId);
    url.searchParams.set("limit", limit);

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API] Error fetching logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs", logs: [] },
      { status: 500 }
    );
  }
}
