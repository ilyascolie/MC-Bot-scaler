/**
 * OllamaClient — POST to /api/generate on a local or remote Ollama instance.
 *
 * Usage:
 *   const client = new OllamaClient({ baseUrl, model });
 *   const text = await client.generate(prompt, systemPrompt);
 */

class OllamaClient {
  /**
   * @param {object}  config
   * @param {string}  config.baseUrl      — e.g. 'http://localhost:11434'
   * @param {string}  config.model        — Ollama model name (e.g. 'llama3')
   * @param {number}  [config.temperature=0.7]
   * @param {number}  [config.timeoutMs=30000]
   */
  constructor({ baseUrl, model, temperature = 0.7, timeoutMs = 30000 }) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.model = model;
    this.temperature = temperature;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Send a generation request. Retries once on failure.
   *
   * @param {string}  prompt       — user/main prompt text
   * @param {string}  [systemPrompt] — system prompt (persona, context)
   * @returns {Promise<string>} — raw generated text
   */
  async generate(prompt, systemPrompt) {
    const body = {
      model: this.model,
      prompt,
      stream: false,
      options: { temperature: this.temperature },
    };
    if (systemPrompt) body.system = systemPrompt;

    try {
      return await this._post(body);
    } catch (firstErr) {
      // Retry once
      try {
        return await this._post(body);
      } catch (retryErr) {
        throw new Error(
          `Ollama generate failed after retry: ${retryErr.message} (first error: ${firstErr.message})`
        );
      }
    }
  }

  /**
   * Check that the Ollama server is reachable and the configured model
   * is available.
   *
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return false;
      const data = await res.json();
      const models = (data.models || []).map((m) => m.name);
      return models.some(
        (n) => n === this.model || n.startsWith(`${this.model}:`)
      );
    } catch {
      return false;
    }
  }

  /**
   * Low-level POST to /api/generate. Returns the response text.
   * @private
   */
  async _post(body) {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ollama HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();
    return data.response ?? '';
  }
}

module.exports = OllamaClient;
