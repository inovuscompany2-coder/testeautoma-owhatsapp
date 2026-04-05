// WhatsApp HTTP Client - REST API only
// Connects to an external WhatsApp service
// No native dependencies - only fetch calls

const WHATSAPP_SERVICE_URL =
  process.env.WHATSAPP_SERVICE_URL || "http://localhost:3001";
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN || "";

export interface ReceivedMessage {
  id: string;
  from: string;
  message: string;
  timestamp: number;
  pushName?: string;
}

export interface WhatsAppStatus {
  connected: boolean;
  phone?: string | null;
  qrCode?: string | null;
  connecting: boolean;
  status: string;
}

interface ApiResponse {
  success?: boolean;
  message?: string;
  error?: string;
  qrCode?: string | null;
  status?: string;
  connected?: boolean;
  connecting?: boolean;
  phone?: string | null;
}

class WhatsAppClient {
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = WHATSAPP_SERVICE_URL;
    this.token = WHATSAPP_API_TOKEN;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...headers, ...options.headers },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data as T;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error("Serviço indisponível");
      }
      throw error;
    }
  }

  async getQR(): Promise<ApiResponse> {
    return this.request<ApiResponse>("/qr");
  }

  async getStatus(): Promise<WhatsAppStatus> {
    return this.request<WhatsAppStatus>("/status");
  }

  async connect(): Promise<ApiResponse> {
    return this.request<ApiResponse>("/connect", { method: "POST" });
  }

  async disconnect(): Promise<ApiResponse> {
    return this.request<ApiResponse>("/disconnect", { method: "POST" });
  }

  async resetQR(): Promise<ApiResponse> {
    return this.request<ApiResponse>("/reset-qr", { method: "POST" });
  }

  async sendMessage(
    to: string,
    message: string
  ): Promise<{ success: boolean; message: string }> {
    return this.request("/send", {
      method: "POST",
      body: JSON.stringify({ to, message }),
    });
  }

  async getMessages(limit?: number): Promise<{ messages: ReceivedMessage[] }> {
    const query = limit ? `?limit=${limit}` : "";
    return this.request<{ messages: ReceivedMessage[] }>(`/messages${query}`);
  }
}

export const whatsappClient = new WhatsAppClient();
