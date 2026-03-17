'use strict';

class OllamaProvider {
  constructor({ endpoint, model, temperature, timeoutMs }) {
    this.endpoint = endpoint || 'http://localhost:11434';
    this.model = model;
    this.temperature = temperature || 0.7;
    this.timeoutMs = timeoutMs || 30000;
  }

  async generate(prompt, systemPrompt) {
    const body = {
      model: this.model,
      prompt: prompt,
      system: systemPrompt || '',
      stream: false,
      options: { temperature: this.temperature },
    };
    const res = await fetch(`${this.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.response;
  }

  async healthCheck() {
    const res = await fetch(`${this.endpoint}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.models?.some(m => m.name.includes(this.model)) ?? false;
  }
}

module.exports = OllamaProvider;
