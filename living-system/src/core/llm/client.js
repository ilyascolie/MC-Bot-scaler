/**
 * LLMClient — Ollama API client.
 *
 * Sends POST requests to /api/generate on a local (or remote) Ollama
 * instance. Handles retries, timeouts, and streaming vs. non-streaming
 * responses.
 */

/**
 * @typedef {object} LLMRequest
 * @property {string} model    — Ollama model name (e.g. 'llama3')
 * @property {string} prompt   — the full prompt text
 * @property {string} [system] — optional system prompt
 * @property {object} [options] — Ollama generation options (temperature, etc.)
 */

/**
 * @typedef {object} LLMResponse
 * @property {string}  text       — generated text
 * @property {number}  totalMs    — total generation time in ms
 * @property {boolean} done       — whether generation is complete
 * @property {object}  [raw]      — raw Ollama response for debugging
 */

class LLMClient {
  /**
   * @param {object} config
   * @param {string} config.baseUrl — Ollama base URL (e.g. 'http://localhost:11434')
   * @param {string} config.model   — default model name
   * @param {number} [config.timeoutMs=60000] — request timeout
   */
  constructor({ baseUrl, model, timeoutMs = 60000 }) {
    this.baseUrl = baseUrl;
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Send a generation request to Ollama and return the full response.
   *
   * @param {LLMRequest} request
   * @returns {Promise<LLMResponse>}
   */
  async generate(request) {
    // TODO: POST to ${this.baseUrl}/api/generate with JSON body
    // TODO: handle timeout, parse JSON response, wrap in LLMResponse
    throw new Error('LLMClient.generate() not implemented');
  }

  /**
   * Check whether the Ollama server is reachable and the model is loaded.
   *
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    // TODO: GET ${this.baseUrl}/api/tags, check model is present
    throw new Error('LLMClient.healthCheck() not implemented');
  }
}

module.exports = LLMClient;
