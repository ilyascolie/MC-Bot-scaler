/**
 * Ollama provider — POST to /api/generate on a local or remote Ollama instance.
 */

class OllamaProvider {
  /**
   * @param {object} config
   * @param {string} config.model       — Ollama model name (e.g. 'llama3')
   * @param {string} [config.endpoint]  — base URL (default: http://localhost:11434)
   * @param {number} [config.temperature=0.7]
   * @param {number} [config.timeoutMs=60000]
   */
  constructor({ model, endpoint, temperature = 0.7, timeoutMs = 60000 }) {
    this.model = model;
    this.endpoint = (endpoint || 'http://localhost:11434').replace(/\/+$/, '');
    this.temperature = temperature;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Generate text from a prompt.
   *
   * @param {string} prompt       — user/main prompt text
   * @param {string} [systemPrompt] — system prompt
   * @returns {Promise<string>}
   */
  async generate(prompt, systemPrompt) {
    const body = {
      model: this.model,
      prompt,
      stream: false,
      options: { temperature: this.temperature },
    };
    if (systemPrompt) body.system = systemPrompt;

    const res = await fetch(`${this.endpoint}/api/generate`, {
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

  /**
   * Check that the Ollama server is reachable and the model is available.
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const res = await fetch(`${this.endpoint}/api/tags`, {
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
}

module.exports = OllamaProvider;
