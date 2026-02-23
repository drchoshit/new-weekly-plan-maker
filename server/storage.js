const fs = require("fs/promises");
const path = require("path");

const DATA_PATH =
  process.env.DATA_PATH || path.join(__dirname, "data", "app_state.json");
const BACKUP_DIR =
  process.env.BACKUP_DIR || path.join(path.dirname(DATA_PATH), "backups");

let writeQueue = Promise.resolve();

const queueWrite = operation => {
  writeQueue = writeQueue.then(operation, operation);
  return writeQueue;
};

const ensureDir = async targetPath => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
};

const parseEnvelope = parsed => {
  if (!parsed || typeof parsed !== "object") {
    return { state: null, version: 0, updatedAt: null };
  }

  // Backward compatibility: older payload may only contain state/updatedAt.
  if (Object.prototype.hasOwnProperty.call(parsed, "state")) {
    return {
      state: parsed.state ?? null,
      version: Number.isInteger(parsed.version) ? parsed.version : 0,
      updatedAt: parsed.updatedAt ?? null,
    };
  }

  // Legacy format: file itself was the state object.
  return {
    state: parsed,
    version: 0,
    updatedAt: null,
  };
};

const readEnvelope = async () => {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parseEnvelope(parsed);
  } catch (error) {
    if (error.code === "ENOENT") {
      return { state: null, version: 0, updatedAt: null };
    }
    throw error;
  }
};

const readState = async () => {
  const envelope = await readEnvelope();
  return envelope.state;
};

const writeState = async (state, options = {}) =>
  queueWrite(async () => {
    const { expectedVersion } = options;
    const current = await readEnvelope();

    if (
      Number.isInteger(expectedVersion) &&
      expectedVersion !== current.version
    ) {
      const error = new Error("State version conflict");
      error.code = "VERSION_CONFLICT";
      error.current = current;
      throw error;
    }

    await ensureDir(DATA_PATH);

    const nextEnvelope = {
      state: state ?? {},
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(DATA_PATH, JSON.stringify(nextEnvelope, null, 2));
    return nextEnvelope;
  });

const formatBackupStamp = date => {
  const pad = value => String(value).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "_",
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join("");
};

const createBackup = async () =>
  queueWrite(async () => {
    const envelope = await readEnvelope();
    if (envelope.state == null) {
      return null;
    }

    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const timestamp = formatBackupStamp(new Date());
    const fileName = `app_state_${timestamp}_v${envelope.version}.json`;
    const filePath = path.join(BACKUP_DIR, fileName);
    await fs.writeFile(filePath, JSON.stringify(envelope, null, 2));
    return filePath;
  });

const pruneBackups = async retentionDays =>
  queueWrite(async () => {
    const days = Number.isFinite(retentionDays) ? retentionDays : 30;
    const safeDays = Math.max(1, Math.floor(days));
    const maxAgeMs = safeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    let entries = [];
    try {
      entries = await fs.readdir(BACKUP_DIR, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") {
        return 0;
      }
      throw error;
    }

    let deletedCount = 0;
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      const fullPath = path.join(BACKUP_DIR, entry.name);
      const stat = await fs.stat(fullPath);
      if (now - stat.mtimeMs > maxAgeMs) {
        await fs.unlink(fullPath);
        deletedCount += 1;
      }
    }

    return deletedCount;
  });

const runBackupCycle = async ({ retentionDays = 30 } = {}) => {
  const backupFile = await createBackup();
  const prunedCount = await pruneBackups(retentionDays);
  return { backupFile, prunedCount };
};

module.exports = {
  BACKUP_DIR,
  DATA_PATH,
  createBackup,
  pruneBackups,
  readEnvelope,
  readState,
  runBackupCycle,
  writeState,
};
