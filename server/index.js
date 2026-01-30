const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const bcrypt = require("bcryptjs");
const cors = require("cors");
const express = require("express");
const jwt = require("jsonwebtoken");
const { readState, writeState, DATA_PATH } = require("./storage");

const app = express();

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const AUTH_USERNAME = process.env.AUTH_USERNAME;
const AUTH_PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH;

const hasAuthConfig = Boolean(JWT_SECRET && AUTH_USERNAME && AUTH_PASSWORD_HASH);

if (!hasAuthConfig) {
  console.warn("Missing auth environment variables. Check server/.env.example.");
}

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const [, token] = authHeader.split(" ");

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/login", async (req, res) => {
  if (!hasAuthConfig) {
    return res.status(500).json({ error: "Auth configuration missing" });
  }

  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "Missing credentials" });
  }

  if (username !== AUTH_USERNAME) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const isValid = await bcrypt.compare(password, AUTH_PASSWORD_HASH);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "12h" });
  return res.json({ token });
});

app.get("/api/state", requireAuth, async (_req, res) => {
  const state = await readState();
  return res.json({ state: state ?? null });
});

app.put("/api/state", requireAuth, async (req, res) => {
  const { state } = req.body || {};

  await writeState(state ?? {});

  return res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
  console.log(`Using data file at ${DATA_PATH}`);
});
