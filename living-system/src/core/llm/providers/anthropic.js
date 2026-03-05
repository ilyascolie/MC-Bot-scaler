/**
 * Anthropic provider — POST to api.anthropic.com/v1/messages.
 *
 * Expects config.apiKey and config.endpoint (optional, defaults to Anthropic's API).
 */

class AnthropicProvider {
  /**
   * @param {object} config
   * @param {string} config.apiKey      — Anthropic API key
   * @param {string} config.model       — model id (e.g. 'claude-haiku-4-5-20251001')
   * @param {string} [config.endpoint]  — base URL override
   * @param {number} [config.maxTokens=1024]
   * @param {number} [config.temperature=0.7]
   * @param {number} [config.timeoutMs=60000]
   */
  constructor({ apiKey, model, endpoint, maxTokens = 1024, temperature = 0.7, timeoutMs = 60000 }) {
    if (!apiKey) throw new Error('AnthropicProvider requires apiKey');
    this.apiKey = apiKey;
    this.model = model;
    this.endpoint = (endpoint || 'https://api.anthropic.com').replace(/\/+$/, '');
    this.maxTokens = maxTokens;
    this.temperature = temperature;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Generate text from a prompt.
   *
   * @param {string} prompt       — user message
   * @param {string} [systemPrompt] — system message
   * @returns {Promise<string>}
   */
  async generate(prompt, systemPrompt) {
    const body = {
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: [{ role: 'user', content: prompt }],
    };
    if (systemPrompt) body.system = systemPrompt;

    const res = await fetch(`${this.endpoint}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Anthropic HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();
    return (data.content && data.content[0] && data.content[0].text) || '';
  }

  /**
   * Check that the Anthropic API is reachable.
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      // Simple test: send a tiny request
      const res = await fetch(`${this.endpoint}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
        signal: AbortSignal.timeout(10000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

module.exports = AnthropicProvider;
