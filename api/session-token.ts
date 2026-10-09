import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";

const SECRET = process.env.SESSION_SECRET || "block-blast-tournament-secret-key-2026";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { mode = "classic", playerId = "guest" } = req.body || {};
  const seed = Date.now() + Math.floor(Math.random() * 1000000);
  const timestamp = Date.now();

  const payload = `${playerId}:${mode}:${seed}:${timestamp}`;
  const signature = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");

  return res.status(200).json({
    seed,
    timestamp,
    token: `${payload}.${signature}`,
  });
}
