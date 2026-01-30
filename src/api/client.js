const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const buildUrl = path => `${API_BASE_URL}${path}`;

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

export const saveAppState = async (token, state) => {
  const response = await fetch(buildUrl("/api/state"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ state }),
  });

  return handleResponse(response);
};
