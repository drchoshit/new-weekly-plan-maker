const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const bcrypt = require("bcryptjs");
const cors = require("cors");
const express = require("express");
const jwt = require("jsonwebtoken");
const {
  BACKUP_DIR,
  DATA_PATH,
  readEnvelope,
  runBackupCycle,
  writeState,
} = require("./storage");

const app = express();

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const AUTH_USERNAME = process.env.AUTH_USERNAME;
const AUTH_PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH;

const parseIntInRange = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < min || parsed > max) {
    return fallback;
  }
  return parsed;
};

const BACKUP_ENABLED = process.env.BACKUP_ENABLED !== "false";
const BACKUP_HOUR_KST = parseIntInRange(process.env.BACKUP_HOUR_KST, 3, 0, 23);
const BACKUP_MINUTE_KST = parseIntInRange(
  process.env.BACKUP_MINUTE_KST,
  0,
  0,
  59
);
const BACKUP_RETENTION_DAYS = parseIntInRange(
  process.env.BACKUP_RETENTION_DAYS,
  30,
  1,
  3650
);

let lastBackupDateKey = "";

const parseBaseVersion = value => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
};

const getKstDateTimeParts = () => {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(new Date());
  const map = {};
  parts.forEach(part => {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  });

  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
};

const runBackupOnce = async reason => {
  const result = await runBackupCycle({ retentionDays: BACKUP_RETENTION_DAYS });
  const backupName = result.backupFile || "skipped(no-state)";
  console.log(
    `[backup] reason=${reason} file=${backupName} pruned=${result.prunedCount}`
  );
};

const maybeRunScheduledBackup = async () => {
  if (!BACKUP_ENABLED) {
    return;
  }

  const now = getKstDateTimeParts();
  if (now.hour !== BACKUP_HOUR_KST || now.minute !== BACKUP_MINUTE_KST) {
    return;
  }

  const dateKey = `${now.year}-${now.month}-${now.day}`;
  if (lastBackupDateKey === dateKey) {
    return;
  }

  lastBackupDateKey = dateKey;
  try {
    await runBackupOnce("schedule");
  } catch (error) {
    lastBackupDateKey = "";
    console.error("[backup] scheduled backup failed:", error);
  }
};

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
  const envelope = await readEnvelope();
  return res.json({
    state: envelope.state ?? null,
    version: envelope.version ?? 0,
    updatedAt: envelope.updatedAt ?? null,
  });
});

app.put("/api/state", requireAuth, async (req, res) => {
  const { state, baseVersion } = req.body || {};
  const expectedVersion = parseBaseVersion(baseVersion);

  try {
    const saved = await writeState(state ?? {}, { expectedVersion });

    return res.json({
      ok: true,
      version: saved.version,
      updatedAt: saved.updatedAt,
    });
  } catch (error) {
    if (error.code === "VERSION_CONFLICT") {
      return res.status(409).json({
        error: "STATE_CONFLICT",
        message: "State was updated from another client.",
        state: error.current?.state ?? null,
        version: error.current?.version ?? 0,
        updatedAt: error.current?.updatedAt ?? null,
      });
    }
    throw error;
  }
});

app.put("/api/state/weekly-calendars", requireAuth, async (req, res) => {
  const { weeklyCalendars, baseVersion } = req.body || {};
  const expectedVersion = parseBaseVersion(baseVersion);
  const currentEnvelope = await readEnvelope();
  const currentState = currentEnvelope.state ?? {};
  const nextState = {
    ...currentState,
    weeklyCalendars: weeklyCalendars ?? {},
  };

  try {
    const saved = await writeState(nextState, { expectedVersion });

    return res.json({
      ok: true,
      version: saved.version,
      updatedAt: saved.updatedAt,
    });
  } catch (error) {
    if (error.code === "VERSION_CONFLICT") {
      return res.status(409).json({
        error: "STATE_CONFLICT",
        message: "State was updated from another client.",
        state: error.current?.state ?? null,
        version: error.current?.version ?? 0,
        updatedAt: error.current?.updatedAt ?? null,
      });
    }
    throw error;
  }
});

app.post("/api/backups/run", requireAuth, async (_req, res) => {
  const result = await runBackupCycle({ retentionDays: BACKUP_RETENTION_DAYS });
  return res.json({
    ok: true,
    backupFile: result.backupFile,
    prunedCount: result.prunedCount,
  });
});

app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
  console.log(`Using data file at ${DATA_PATH}`);
  console.log(`Using backup dir at ${BACKUP_DIR}`);
  console.log(
    `Daily backup schedule(KST): ${BACKUP_HOUR_KST
      .toString()
      .padStart(2, "0")}:${BACKUP_MINUTE_KST.toString().padStart(2, "0")}`
  );
  console.log(`Backup retention days: ${BACKUP_RETENTION_DAYS}`);
  console.log(`Backup enabled: ${BACKUP_ENABLED ? "yes" : "no"}`);

  if (BACKUP_ENABLED) {
    const timer = setInterval(() => {
      maybeRunScheduledBackup().catch(error => {
        console.error("[backup] scheduler loop failed:", error);
      });
    }, 30000);
    if (typeof timer.unref === "function") {
      timer.unref();
    }
  }
});
