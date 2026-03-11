const API_BASE_URL_STORAGE_KEY = "apiBaseUrlOverride";
const ENV_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const normalizeBaseUrl = value => {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

export const getApiBaseUrl = () => {
  try {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(API_BASE_URL_STORAGE_KEY)
        : "";
    if (stored) {
      return normalizeBaseUrl(stored);
    }
  } catch {
    // Ignore localStorage access issues and fall back to env var.
  }

  return normalizeBaseUrl(ENV_API_BASE_URL);
};

export const setApiBaseUrlOverride = value => {
  const normalized = normalizeBaseUrl(value);

  try {
    if (typeof window === "undefined") {
      return normalized;
    }

    if (normalized) {
      window.localStorage.setItem(API_BASE_URL_STORAGE_KEY, normalized);
    } else {
      window.localStorage.removeItem(API_BASE_URL_STORAGE_KEY);
    }

    window.dispatchEvent(new Event("api-base-url-updated"));
  } catch {
    // Ignore localStorage access issues.
  }

  return normalized;
};

const buildUrl = path => `${getApiBaseUrl()}${path}`;

const handleResponse = async response => {
  if (!response.ok) {
    const error = new Error("API request failed");
    error.status = response.status;
    error.body = await response.json().catch(() => ({}));
    throw error;
  }
  return response.json();
};

export const login = async ({ username, password }) => {
  const response = await fetch(buildUrl("/api/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  return handleResponse(response);
};

export const getAppState = async token => {
  const response = await fetch(buildUrl("/api/state"), {
    headers: { Authorization: `Bearer ${token}` },
  });

  return handleResponse(response);
};

export const saveAppState = async (token, state, options = {}) => {
  const { baseVersion } = options;
  const response = await fetch(buildUrl("/api/state"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ state, baseVersion }),
  });

  return handleResponse(response);
};

export const saveWeeklyCalendars = async (
  token,
  weeklyCalendars,
  options = {}
) => {
  const { baseVersion } = options;
  const response = await fetch(buildUrl("/api/state/weekly-calendars"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ weeklyCalendars, baseVersion }),
  });

  return handleResponse(response);
};
