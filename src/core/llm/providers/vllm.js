'use strict';

class VllmProvider {
  constructor({ endpoint, model, temperature, timeoutMs }) {
    this.endpoint = endpoint || 'http://localhost:8000';
    this.model = model;
    this.temperature = temperature || 0.7;
    this.timeoutMs = timeoutMs || 30000;
  }

  async generate(prompt, systemPrompt) {
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    const body = {
      model: this.model,
      prompt: fullPrompt,
      max_tokens: 1024,
      temperature: this.temperature,
    };
    const res = await fetch(`${this.endpoint}/v1/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`vLLM ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices[0].text;
  }

  async healthCheck() {
    try {
      const res = await fetch(`${this.endpoint}/v1/models`, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch { return false; }
  }
}

module.exports = VllmProvider;
