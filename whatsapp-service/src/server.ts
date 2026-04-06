import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { whatsappService } from "./whatsapp.js";
import { logger, connectionLogger } from "./logger.js";

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT || 3001;
const API_TOKEN = process.env.API_TOKEN || "";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Socket.io server with CORS
const io = new Server(httpServer, {
  cors: {
    origin: [FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Middleware
app.use(cors());
app.use(express.json());

// Root endpoint (no auth)
app.get("/", (req, res) => {
  res.json({ 
    service: "WhatsApp Automation", 
    status: "running",
    websocket: true,
    endpoints: ["/status", "/qr", "/connect", "/disconnect", "/send", "/messages"]
  });
});

// Health check (no auth)
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth middleware for protected routes
const authMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  // Skip auth if no token configured
  if (!API_TOKEN) {
    next();
    return;
  }
  
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${API_TOKEN}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};

// Status endpoint
app.get("/status", authMiddleware, (req, res) => {
  try {
    const status = whatsappService.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// QR Code endpoint
app.get("/qr", authMiddleware, (req, res) => {
  try {
    const qr = whatsappService.getQR();
    res.json(qr);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Connect endpoint
app.post("/connect", authMiddleware, async (req, res) => {
  try {
    const result = await whatsappService.connect();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Disconnect endpoint
app.post("/disconnect", authMiddleware, async (req, res) => {
  try {
    const result = await whatsappService.disconnect();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Send message endpoint
app.post("/send", authMiddleware, async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) {
      res.status(400).json({ error: "Missing 'to' or 'message'" });
      return;
    }
    const result = await whatsappService.sendMessage(to, message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get messages endpoint
app.get("/messages", authMiddleware, (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const result = whatsappService.getMessages(limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Logs endpoint
app.get("/logs", authMiddleware, (req, res) => {
  try {
    const level = req.query.level as string | undefined;
    const userId = req.query.userId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;

    let logs = logger.getBuffer();

    // Filter by level if specified
    if (level && ["debug", "info", "warn", "error"].includes(level)) {
      logs = logs.filter((log) => log.level === level);
    }

    // Filter by userId if specified
    if (userId) {
      logs = logs.filter((log) => log.userId === userId);
    }

    // Sort by timestamp descending (newest first)
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Limit results
    logs = logs.slice(0, limit);

    res.json({ logs, total: logs.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message, logs: [] });
  }
});

// ============================================
// Socket.io Event Handlers
// ============================================

io.on("connection", (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);
  
  // Send current status immediately on connection
  const currentStatus = whatsappService.getStatus();
  socket.emit("status", currentStatus);
  
  // If there's a QR code, send it
  const qrData = whatsappService.getQR();
  if (qrData.qrCode) {
    socket.emit("qr", qrData);
  }

  // Handle client requesting connection
  socket.on("connect_whatsapp", async () => {
    try {
      console.log(`[Socket.io] Client ${socket.id} requested WhatsApp connection`);
      const result = await whatsappService.connect();
      socket.emit("connect_response", result);
    } catch (error) {
      socket.emit("error", { message: (error as Error).message });
    }
  });

  // Handle client requesting disconnection
  socket.on("disconnect_whatsapp", async () => {
    try {
      console.log(`[Socket.io] Client ${socket.id} requested WhatsApp disconnection`);
      const result = await whatsappService.disconnect();
      socket.emit("disconnect_response", result);
    } catch (error) {
      socket.emit("error", { message: (error as Error).message });
    }
  });

  // Handle client requesting status
  socket.on("get_status", () => {
    const status = whatsappService.getStatus();
    socket.emit("status", status);
  });

  // Handle client requesting QR
  socket.on("get_qr", () => {
    const qrData = whatsappService.getQR();
    socket.emit("qr", qrData);
  });

  socket.on("disconnect", () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// ============================================
// WhatsApp Service Event Emitter Integration
// ============================================

// Set up the WhatsApp service to emit events to Socket.io
whatsappService.setEventEmitter({
  emit: (event: string, data: unknown) => {
    console.log(`[Socket.io] Broadcasting event: ${event}`);
    io.emit(event, data);
  }
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`
========================================
  WhatsApp Service running on port ${PORT}
========================================

REST Endpoints:
  GET  /           - Service info (no auth)
  GET  /health     - Health check (no auth)
  GET  /status     - Connection status
  GET  /qr         - Get QR Code
  POST /connect    - Start connection
  POST /disconnect - Disconnect
  POST /send       - Send message
  GET  /messages   - Get received messages

WebSocket Events (Socket.io):
  Server -> Client:
    status        - Connection status updates
    qr            - QR Code updates
    message       - New messages received
    auth_failure  - Authentication failures
    reconnecting  - Reconnection attempts
  
  Client -> Server:
    connect_whatsapp    - Request connection
    disconnect_whatsapp - Request disconnection
    get_status          - Request current status
    get_qr              - Request current QR code

Environment:
  PORT: ${PORT}
  API_TOKEN: ${API_TOKEN ? "Configured" : "Not set (no auth required)"}
  FRONTEND_URL: ${FRONTEND_URL}
`);
});
