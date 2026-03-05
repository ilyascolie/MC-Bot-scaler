/**
 * vLLM provider — POST to /v1/completions (OpenAI-compatible API).
 */

class VllmProvider {
  /**
   * @param {object} config
   * @param {string} config.model       — model name served by vLLM
   * @param {string} [config.endpoint]  — base URL (default: http://localhost:8000)
   * @param {string} [config.apiKey]    — optional API key
   * @param {number} [config.maxTokens=1024]
   * @param {number} [config.temperature=0.7]
   * @param {number} [config.timeoutMs=60000]
   */
  constructor({ model, endpoint, apiKey, maxTokens = 1024, temperature = 0.7, timeoutMs = 60000 }) {
    this.model = model;
    this.endpoint = (endpoint || 'http://localhost:8000').replace(/\/+$/, '');
    this.apiKey = apiKey || '';
    this.maxTokens = maxTokens;
    this.temperature = temperature;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Generate text from a prompt.
   *
   * @param {string} prompt       — user prompt
   * @param {string} [systemPrompt] — prepended to prompt if provided
   * @returns {Promise<string>}
   */
  async generate(prompt, systemPrompt) {
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

    const body = {
      model: this.model,
      prompt: fullPrompt,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
    };

    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const res = await fetch(`${this.endpoint}/v1/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`vLLM HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();
    return (data.choices && data.choices[0] && data.choices[0].text) || '';
  }

  /**
   * Check that the vLLM server is reachable.
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const headers = {};
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

      const res = await fetch(`${this.endpoint}/v1/models`, {
        headers,
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

module.exports = VllmProvider;
