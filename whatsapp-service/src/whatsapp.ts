// @ts-nocheck
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import QRCode from "qrcode";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type ConnectionStatus = "disconnected" | "connecting" | "qr" | "connected";

export interface ReceivedMessage {
  id: string;
  from: string;
  message: string;
  timestamp: number;
  pushName?: string;
}

class WhatsAppService {
  private client: typeof Client.prototype | null = null;
  private connectionStatus: ConnectionStatus = "disconnected";
  private qrCodeBase64: string | null = null;
  private connectedPhone: string | null = null;
  private messages: ReceivedMessage[] = [];
  private isInitializing = false;

  getStatus() {
    return {
      status: this.connectionStatus,
      connected: this.connectionStatus === "connected",
      connecting: this.connectionStatus === "connecting" || this.connectionStatus === "qr",
      phone: this.connectedPhone,
    };
  }

  getQR() {
    return {
      qrCode: this.qrCodeBase64,
      connected: this.connectionStatus === "connected",
      connecting: this.connectionStatus === "connecting" || this.connectionStatus === "qr",
      status: this.connectionStatus,
    };
  }

  async connect(): Promise<{ message: string; status: ConnectionStatus }> {
    if (this.connectionStatus === "connected") {
      return { message: "Already connected", status: this.connectionStatus };
    }

    if (this.isInitializing) {
      return { message: "Connection in progress", status: this.connectionStatus };
    }

    this.isInitializing = true;
    this.connectionStatus = "connecting";

    try {
      await this.initializeClient();
      return { message: "Connection initiated", status: this.connectionStatus };
    } catch (error) {
      this.connectionStatus = "disconnected";
      this.isInitializing = false;
      throw error;
    }
  }

  private async initializeClient() {
    // Destroy existing client if any
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (e) {
        console.log("[WhatsApp] Error destroying old client:", e);
      }
      this.client = null;
    }

    const authPath = path.join(__dirname, "..", "auth");

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: authPath,
      }),
      puppeteer: {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-gpu",
        ],
      },
    });

    // QR Code event
    this.client.on("qr", async (qr: string) => {
      console.log("[WhatsApp] QR Code received");
      this.connectionStatus = "qr";
      try {
        this.qrCodeBase64 = await QRCode.toDataURL(qr);
        console.log("[WhatsApp] QR Code generated as base64");
      } catch (err) {
        console.error("[WhatsApp] Error generating QR:", err);
      }
    });

    // Ready event
    this.client.on("ready", async () => {
      console.log("[WhatsApp] Client is ready!");
      this.connectionStatus = "connected";
      this.qrCodeBase64 = null;
      this.isInitializing = false;

      try {
        const info = this.client?.info;
        if (info?.wid?.user) {
          this.connectedPhone = info.wid.user;
          console.log("[WhatsApp] Connected as:", this.connectedPhone);
        }
      } catch (e) {
        console.log("[WhatsApp] Could not get phone info");
      }
    });

    // Authenticated event
    this.client.on("authenticated", () => {
      console.log("[WhatsApp] Authenticated successfully");
    });

    // Auth failure event
    this.client.on("auth_failure", (msg: string) => {
      console.error("[WhatsApp] Authentication failed:", msg);
      this.connectionStatus = "disconnected";
      this.isInitializing = false;
    });

    // Disconnected event
    this.client.on("disconnected", (reason: string) => {
      console.log("[WhatsApp] Disconnected:", reason);
      this.connectionStatus = "disconnected";
      this.qrCodeBase64 = null;
      this.connectedPhone = null;
      this.isInitializing = false;
    });

    // Message event
    this.client.on("message", async (msg: any) => {
      try {
        const contact = await msg.getContact();
        const receivedMessage: ReceivedMessage = {
          id: msg.id._serialized || Date.now().toString(),
          from: msg.from,
          message: msg.body || this.getMessageType(msg),
          timestamp: msg.timestamp ? msg.timestamp * 1000 : Date.now(),
          pushName: contact?.pushname || contact?.name || undefined,
        };

        this.messages.unshift(receivedMessage);
        if (this.messages.length > 100) {
          this.messages = this.messages.slice(0, 100);
        }

        console.log("[WhatsApp] New message from:", receivedMessage.pushName || receivedMessage.from);
      } catch (error) {
        console.error("[WhatsApp] Error processing message:", error);
      }
    });

    // Initialize the client
    console.log("[WhatsApp] Initializing client...");
    await this.client.initialize();
  }

  private getMessageType(msg: any): string {
    if (msg.hasMedia) {
      if (msg.type === "image") return "[Imagem]";
      if (msg.type === "video") return "[Video]";
      if (msg.type === "audio" || msg.type === "ptt") return "[Audio]";
      if (msg.type === "document") return "[Documento]";
      if (msg.type === "sticker") return "[Sticker]";
      return "[Media]";
    }
    if (msg.type === "location") return "[Localizacao]";
    if (msg.type === "vcard" || msg.type === "multi_vcard") return "[Contato]";
    return msg.body || "[Mensagem]";
  }

  async sendMessage(to: string, message: string): Promise<{ success: boolean; message: string }> {
    if (!this.client || this.connectionStatus !== "connected") {
      throw new Error("WhatsApp not connected");
    }

    // Format number
    let number = to.replace(/[^0-9]/g, "");
    if (!number.includes("@")) {
      number = `${number}@c.us`;
    }

    try {
      await this.client.sendMessage(number, message);
      return { success: true, message: "Message sent successfully" };
    } catch (error) {
      console.error("[WhatsApp] Error sending message:", error);
      throw new Error("Failed to send message");
    }
  }

  getMessages(limit: number = 50): { messages: ReceivedMessage[] } {
    return { messages: this.messages.slice(0, limit) };
  }

  async disconnect(): Promise<{ message: string }> {
    if (this.client) {
      try {
        await this.client.logout();
      } catch (e) {
        console.log("[WhatsApp] Error during logout:", e);
      }
      try {
        await this.client.destroy();
      } catch (e) {
        console.log("[WhatsApp] Error during destroy:", e);
      }
      this.client = null;
    }

    this.connectionStatus = "disconnected";
    this.qrCodeBase64 = null;
    this.connectedPhone = null;
    this.messages = [];
    this.isInitializing = false;

    return { message: "Disconnected successfully" };
  }
}

export const whatsappService = new WhatsAppService();
