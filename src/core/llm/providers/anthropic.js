'use strict';

class AnthropicProvider {
  constructor({ apiKey, model, temperature, timeoutMs }) {
    this.apiKey = apiKey;
    this.model = model || 'claude-3-haiku-20240307';
    this.temperature = temperature || 0.7;
    this.timeoutMs = timeoutMs || 30000;
  }

  async generate(prompt, systemPrompt) {
    const body = {
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt || '',
      messages: [{ role: 'user', content: prompt }],
      temperature: this.temperature,
    };
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.content[0].text;
  }

  async healthCheck() {
    return !!this.apiKey;
  }
}

module.exports = AnthropicProvider;
