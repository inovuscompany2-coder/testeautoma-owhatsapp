import express from "express";
import cors from "cors";
import { whatsappService } from "./whatsapp.js";

const app = express();
const PORT = process.env.PORT || 3001;
const API_TOKEN = process.env.API_TOKEN || "";

// Middleware
app.use(cors());
app.use(express.json());

// Root endpoint (no auth)
app.get("/", (req, res) => {
  res.json({ 
    service: "WhatsApp Automation", 
    status: "running",
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

// Start server
app.listen(PORT, () => {
  console.log(`
========================================
  WhatsApp Service running on port ${PORT}
========================================

Endpoints:
  GET  /           - Service info (no auth)
  GET  /health     - Health check (no auth)
  GET  /status     - Connection status
  GET  /qr         - Get QR Code
  POST /connect    - Start connection
  POST /disconnect - Disconnect
  POST /send       - Send message
  GET  /messages   - Get received messages

Environment:
  PORT: ${PORT}
  API_TOKEN: ${API_TOKEN ? "Configured" : "Not set (no auth required)"}
`);
});
