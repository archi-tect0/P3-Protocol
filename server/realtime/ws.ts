import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { verifyMessage } from "ethers";
import crypto from "crypto";
import { validateSessionToken } from "../atlas/services/sessionBridge";

export type EventType = "payment" | "message" | "note";
export type RealtimeEvent = { type: EventType; address: string; payload: any };

const subscriptions = new Map<string, Set<WebSocket>>();

interface ClientSession {
  address: string | null;
  authenticated: boolean;
  pendingChallenge: string | null;
  challengeExpiresAt: number | null;
}

const clientSessions = new Map<WebSocket, ClientSession>();
const CHALLENGE_EXPIRY_MS = 60000;

function generateChallenge(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function publish(event: RealtimeEvent) {
  const clients = subscriptions.get(event.address.toLowerCase());
  clients?.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  });
}

export function attachWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(
      request.url || "",
      `http://${request.headers.host}`
    ).pathname;

    if (pathname === "/realtime") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", (ws) => {
    clientSessions.set(ws, {
      address: null,
      authenticated: false,
      pendingChallenge: null,
      challengeExpiresAt: null,
    });

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(String(data));
        handleMessage(ws, message);
      } catch (e) {
        console.error("WS parse error:", e);
        ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      }
    });

    ws.on("close", () => {
      const session = clientSessions.get(ws);
      if (session?.address && session.authenticated) {
        subscriptions.get(session.address)?.delete(ws);
      }
      clientSessions.delete(ws);
    });
  });

  console.log("WebSocket realtime server attached on /realtime (secured)");
}

function handleMessage(
  ws: WebSocket,
  message: { address?: string; signature?: string; sessionToken?: string }
): void {
  const session = clientSessions.get(ws);
  if (!session) return;

  const { address, signature, sessionToken } = message;

  if (!address || typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Invalid wallet address format",
      })
    );
    return;
  }

  const normalizedAddress = address.toLowerCase();

  if (session.authenticated && session.address === normalizedAddress) {
    ws.send(
      JSON.stringify({
        type: "subscribed",
        address: normalizedAddress,
        message: "Already authenticated and subscribed",
      })
    );
    return;
  }

  if (sessionToken) {
    if (validateSessionToken(sessionToken, normalizedAddress)) {
      authenticateAndSubscribe(ws, session, normalizedAddress, "session");
      return;
    } else {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Invalid or expired session token",
        })
      );
      return;
    }
  }

  if (!signature) {
    const challenge = generateChallenge();
    const timestamp = Date.now();
    const challengeMessage = `P3 Realtime Subscription\n\nWallet: ${normalizedAddress}\nChallenge: ${challenge}\nTimestamp: ${timestamp}`;

    session.address = normalizedAddress;
    session.pendingChallenge = challengeMessage;
    session.challengeExpiresAt = timestamp + CHALLENGE_EXPIRY_MS;

    ws.send(
      JSON.stringify({
        type: "challenge",
        challenge: challengeMessage,
        address: normalizedAddress,
      })
    );
    return;
  }

  if (!session.pendingChallenge || !session.challengeExpiresAt) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "No pending challenge. Please request a new one.",
      })
    );
    return;
  }

  if (Date.now() > session.challengeExpiresAt) {
    session.pendingChallenge = null;
    session.challengeExpiresAt = null;
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Challenge expired. Please request a new one.",
      })
    );
    return;
  }

  if (session.address !== normalizedAddress) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Address mismatch with pending challenge",
      })
    );
    return;
  }

  try {
    const recoveredAddress = verifyMessage(session.pendingChallenge, signature);

    if (recoveredAddress.toLowerCase() !== normalizedAddress) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Signature verification failed: wallet mismatch",
        })
      );
      return;
    }

    session.pendingChallenge = null;
    session.challengeExpiresAt = null;

    authenticateAndSubscribe(ws, session, normalizedAddress, "signature");
  } catch (error) {
    console.error("[Realtime] Signature verification error:", error);
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Signature verification failed",
      })
    );
  }
}

function authenticateAndSubscribe(
  ws: WebSocket,
  session: ClientSession,
  address: string,
  authMethod: string
): void {
  session.address = address;
  session.authenticated = true;

  const set = subscriptions.get(address) || new Set();
  set.add(ws);
  subscriptions.set(address, set);

  console.log(
    `[Realtime] Client authenticated and subscribed: ${address.slice(0, 10)}... (${authMethod})`
  );

  ws.send(
    JSON.stringify({
      type: "subscribed",
      address,
      authMethod,
      message: "Successfully authenticated and subscribed to events",
    })
  );
}
