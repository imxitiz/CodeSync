/**
 * Health check utility to verify server availability
 * This helps wake up sleeping servers (like on Render) before establishing socket connections
 */

import { BACKEND_API_URL } from "./constant";

/**
 * Check if the server is healthy and responding
 * @param {number} timeout - Timeout in milliseconds (default: 10000)
 * @returns {Promise<boolean>} - True if server is healthy, false otherwise
 */
export const checkServerHealth = async (timeout = 10_000) => {
  const backendUrl = BACKEND_API_URL;
  const healthUrl = `${backendUrl}/api/health`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(healthUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      // Validate response is JSON and has our specific format
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        return false;
      }

      const data = await response.json();

      // Check for our specific response format
      if (
        data &&
        data.status === "ok" &&
        data.message === "Server is healthy" &&
        data.timestamp
      ) {
        return true;
      }
      return false;
    }
    return false;
  } catch (_error) {
    return false;
  }
};

/**
 * Wait for server to be healthy with retries
 * @param {Object} options - Configuration options
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 5)
 * @param {number} options.retryDelay - Delay between retries in milliseconds (default: 2000)
 * @param {number} options.timeout - Timeout for each health check (default: 10000)
 * @param {Function} options.onRetry - Callback called on each retry attempt
 * @returns {Promise<boolean>} - True if server becomes healthy, false if all retries exhausted
 */
export const waitForServerHealth = async (options = {}) => {
  const {
    maxRetries = 5,
    retryDelay = 2000,
    timeout = 10_000,
    onRetry = null,
  } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (onRetry) {
      onRetry(attempt, maxRetries);
    }

    const isHealthy = await checkServerHealth(timeout);

    if (isHealthy) {
      return true;
    }

    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  return false;
};

/**
 * Wake up server with a simple ping - useful for servers that sleep after inactivity
 * This is a fire-and-forget request to wake up the server
 */
export const wakeUpServer = () => {
  // Simple fire-and-forget request to wake up server
  fetch(`${BACKEND_API_URL}/api/health`).catch(() => {});
};
