const fs = require("fs/promises");
const path = require("path");

const DATA_PATH =
  process.env.DATA_PATH || path.join(__dirname, "data", "app_state.json");

const ensureDir = async () => {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
};

const readState = async () => {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed?.state ?? null;
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

const writeState = async state => {
  await ensureDir();
  const payload = {
    state: state ?? {},
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(DATA_PATH, JSON.stringify(payload, null, 2));
};

module.exports = { readState, writeState, DATA_PATH };
