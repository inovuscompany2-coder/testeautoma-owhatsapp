// @ts-nocheck
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import QRCode from "qrcode";
import path from "path";
import { fileURLToPath } from "url";
import type { EventEmitter, ReceivedMessage, ConnectionStatus } from "./whatsapp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface SessionInfo {
  userId: string;
  status: ConnectionStatus;
  connected: boolean;
  connecting: boolean;
  phone: string | null;
  reconnecting: boolean;
  reconnectAttempts: number;
  createdAt: Date;
  lastActivity: Date;
}

/**
 * WhatsAppSession - Manages a single WhatsApp connection for a user
 */
class WhatsAppSession {
  private client: typeof Client.prototype | null = null;
  private connectionStatus: ConnectionStatus = "disconnected";
  private qrCodeBase64: string | null = null;
  private connectedPhone: string | null = null;
  private messages: ReceivedMessage[] = [];
  private isInitializing = false;
  
  // Reconnection properties
  private autoReconnect = true;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private reconnectDelays = [5000, 10000, 30000, 60000, 120000];
  
  // Event emitter for Socket.io integration
  private eventEmitter: EventEmitter | null = null;
  
  // Session metadata
  public readonly userId: string;
  public readonly createdAt: Date;
  public lastActivity: Date;

  constructor(userId: string) {
    this.userId = userId;
    this.createdAt = new Date();
    this.lastActivity = new Date();
    console.log(`[Session:${userId}] Created new session`);
  }

  setEventEmitter(emitter: EventEmitter) {
    this.eventEmitter = emitter;
  }

  private emitEvent(event: string, data: unknown) {
    if (this.eventEmitter) {
      // Include userId in all events for multi-tenant routing
      this.eventEmitter.emit(event, { ...data as object, userId: this.userId });
    }
  }

  private updateActivity() {
    this.lastActivity = new Date();
  }

  getStatus(): SessionInfo & { status: ConnectionStatus } {
    this.updateActivity();
    return {
      userId: this.userId,
      status: this.connectionStatus,
      connected: this.connectionStatus === "connected",
      connecting: this.connectionStatus === "connecting" || this.connectionStatus === "qr",
      phone: this.connectedPhone,
      reconnecting: this.reconnectTimeoutId !== null,
      reconnectAttempts: this.reconnectAttempts,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity,
    };
  }

  getQR() {
    this.updateActivity();
    return {
      qrCode: this.qrCodeBase64,
      connected: this.connectionStatus === "connected",
      connecting: this.connectionStatus === "connecting" || this.connectionStatus === "qr",
      status: this.connectionStatus,
      userId: this.userId,
    };
  }

  async connect(): Promise<{ message: string; status: ConnectionStatus }> {
    this.updateActivity();
    
    if (this.connectionStatus === "connected") {
      return { message: "Already connected", status: this.connectionStatus };
    }

    if (this.isInitializing) {
      return { message: "Connection in progress", status: this.connectionStatus };
    }

    this.isInitializing = true;
    this.connectionStatus = "connecting";
    this.emitEvent("status", this.getStatus());

    try {
      await this.initializeClient();
      return { message: "Connection initiated", status: this.connectionStatus };
    } catch (error) {
      this.connectionStatus = "disconnected";
      this.isInitializing = false;
      this.emitEvent("status", this.getStatus());
      throw error;
    }
  }

  private async initializeClient() {
    // Destroy existing client if any
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (e) {
        console.log(`[Session:${this.userId}] Error destroying old client:`, e);
      }
      this.client = null;
    }

    // Each user gets their own auth folder
    const authPath = path.join(__dirname, "..", "auth", this.userId);

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: authPath,
        clientId: this.userId,
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
      console.log(`[Session:${this.userId}] QR Code received`);
      this.connectionStatus = "qr";
      this.updateActivity();
      try {
        this.qrCodeBase64 = await QRCode.toDataURL(qr);
        this.emitEvent("qr", this.getQR());
        this.emitEvent("status", this.getStatus());
      } catch (err) {
        console.error(`[Session:${this.userId}] Error generating QR:`, err);
      }
    });

    // Ready event
    this.client.on("ready", async () => {
      console.log(`[Session:${this.userId}] Client is ready!`);
      this.connectionStatus = "connected";
      this.qrCodeBase64 = null;
      this.isInitializing = false;
      this.reconnectAttempts = 0;
      this.cancelReconnect();
      this.updateActivity();

      try {
        const info = this.client?.info;
        if (info?.wid?.user) {
          this.connectedPhone = info.wid.user;
          console.log(`[Session:${this.userId}] Connected as:`, this.connectedPhone);
        }
      } catch (e) {
        console.log(`[Session:${this.userId}] Could not get phone info`);
      }

      this.emitEvent("status", this.getStatus());
    });

    // Authenticated event
    this.client.on("authenticated", () => {
      console.log(`[Session:${this.userId}] Authenticated successfully`);
      this.updateActivity();
    });

    // Auth failure event
    this.client.on("auth_failure", (msg: string) => {
      console.error(`[Session:${this.userId}] Authentication failed:`, msg);
      this.connectionStatus = "disconnected";
      this.isInitializing = false;
      this.updateActivity();
      
      this.emitEvent("auth_failure", { message: msg, userId: this.userId });
      this.emitEvent("status", this.getStatus());
    });

    // Disconnected event
    this.client.on("disconnected", (reason: string) => {
      console.log(`[Session:${this.userId}] Disconnected:`, reason);
      this.connectionStatus = "disconnected";
      this.qrCodeBase64 = null;
      this.connectedPhone = null;
      this.isInitializing = false;
      this.updateActivity();

      this.emitEvent("status", { ...this.getStatus(), disconnectReason: reason });

      // Auto-reconnect unless user explicitly logged out
      if (this.autoReconnect && reason !== "LOGOUT" && reason !== "NAVIGATION") {
        this.scheduleReconnect();
      }
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

        this.updateActivity();
        console.log(`[Session:${this.userId}] New message from:`, receivedMessage.pushName || receivedMessage.from);
        
        this.emitEvent("message", { ...receivedMessage, userId: this.userId });
      } catch (error) {
        console.error(`[Session:${this.userId}] Error processing message:`, error);
      }
    });

    // Initialize the client
    console.log(`[Session:${this.userId}] Initializing client...`);
    await this.client.initialize();
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(`[Session:${this.userId}] Max reconnection attempts reached. Stopping auto-reconnect.`);
      this.reconnectAttempts = 0;
      return;
    }

    const delay = this.reconnectDelays[Math.min(this.reconnectAttempts, this.reconnectDelays.length - 1)];
    console.log(`[Session:${this.userId}] Scheduling reconnect attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts} in ${delay / 1000}s`);

    this.emitEvent("reconnecting", {
      attempt: this.reconnectAttempts + 1,
      maxAttempts: this.maxReconnectAttempts,
      nextAttemptIn: delay,
      userId: this.userId,
    });

    this.reconnectTimeoutId = setTimeout(async () => {
      this.reconnectTimeoutId = null;
      this.reconnectAttempts++;

      try {
        console.log(`[Session:${this.userId}] Attempting reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        await this.connect();
        this.reconnectAttempts = 0;
        console.log(`[Session:${this.userId}] Reconnection successful!`);
      } catch (error) {
        console.error(`[Session:${this.userId}] Reconnection failed:`, error);
        this.scheduleReconnect();
      }
    }, delay);
  }

  cancelReconnect() {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
      this.reconnectAttempts = 0;
      console.log(`[Session:${this.userId}] Reconnection cancelled`);
    }
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
    this.updateActivity();
    
    if (!this.client || this.connectionStatus !== "connected") {
      throw new Error("WhatsApp not connected");
    }

    let number = to.replace(/[^0-9]/g, "");
    if (!number.includes("@")) {
      number = `${number}@c.us`;
    }

    try {
      await this.client.sendMessage(number, message);
      return { success: true, message: "Message sent successfully" };
    } catch (error) {
      console.error(`[Session:${this.userId}] Error sending message:`, error);
      throw new Error("Failed to send message");
    }
  }

  getMessages(limit: number = 50): { messages: ReceivedMessage[] } {
    this.updateActivity();
    return { messages: this.messages.slice(0, limit) };
  }

  async disconnect(): Promise<{ message: string }> {
    this.cancelReconnect();
    
    const previousAutoReconnect = this.autoReconnect;
    this.autoReconnect = false;

    if (this.client) {
      try {
        await this.client.logout();
      } catch (e) {
        console.log(`[Session:${this.userId}] Error during logout:`, e);
      }
      try {
        await this.client.destroy();
      } catch (e) {
        console.log(`[Session:${this.userId}] Error during destroy:`, e);
      }
      this.client = null;
    }

    this.connectionStatus = "disconnected";
    this.qrCodeBase64 = null;
    this.connectedPhone = null;
    this.messages = [];
    this.isInitializing = false;
    this.autoReconnect = previousAutoReconnect;
    this.updateActivity();

    this.emitEvent("status", this.getStatus());

    return { message: "Disconnected successfully" };
  }

  async destroy(): Promise<void> {
    await this.disconnect();
    console.log(`[Session:${this.userId}] Session destroyed`);
  }
}

/**
 * SessionManager - Manages multiple WhatsApp sessions for multi-tenant support
 */
class SessionManager {
  private sessions: Map<string, WhatsAppSession> = new Map();
  private eventEmitter: EventEmitter | null = null;
  private maxSessionsPerUser = 1; // Limit sessions per user

  constructor() {
    console.log("[SessionManager] Initialized");
  }

  setEventEmitter(emitter: EventEmitter) {
    this.eventEmitter = emitter;
    // Set emitter for all existing sessions
    this.sessions.forEach(session => {
      session.setEventEmitter(emitter);
    });
  }

  /**
   * Get or create a session for a user
   */
  async getOrCreateSession(userId: string): Promise<WhatsAppSession> {
    let session = this.sessions.get(userId);

    if (!session) {
      session = new WhatsAppSession(userId);
      if (this.eventEmitter) {
        session.setEventEmitter(this.eventEmitter);
      }
      this.sessions.set(userId, session);
      console.log(`[SessionManager] Created session for user: ${userId}`);
    }

    return session;
  }

  /**
   * Get an existing session for a user
   */
  getSession(userId: string): WhatsAppSession | undefined {
    return this.sessions.get(userId);
  }

  /**
   * Check if a user has an active session
   */
  hasSession(userId: string): boolean {
    return this.sessions.has(userId);
  }

  /**
   * Destroy a user's session
   */
  async destroySession(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (session) {
      await session.destroy();
      this.sessions.delete(userId);
      console.log(`[SessionManager] Destroyed session for user: ${userId}`);
    }
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): Map<string, WhatsAppSession> {
    return this.sessions;
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get all session statuses
   */
  getAllStatuses(): SessionInfo[] {
    return Array.from(this.sessions.values()).map(session => session.getStatus());
  }

  /**
   * Cleanup inactive sessions (sessions without activity for a specified time)
   */
  async cleanupInactiveSessions(maxInactiveMs: number = 30 * 60 * 1000): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [userId, session] of this.sessions) {
      const inactiveTime = now.getTime() - session.lastActivity.getTime();
      if (inactiveTime > maxInactiveMs) {
        await this.destroySession(userId);
        cleanedCount++;
        console.log(`[SessionManager] Cleaned up inactive session: ${userId}`);
      }
    }

    return cleanedCount;
  }

  /**
   * Destroy all sessions
   */
  async destroyAllSessions(): Promise<void> {
    for (const userId of this.sessions.keys()) {
      await this.destroySession(userId);
    }
    console.log("[SessionManager] All sessions destroyed");
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
