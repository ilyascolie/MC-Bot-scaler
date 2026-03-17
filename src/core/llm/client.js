'use strict';

const OllamaProvider = require('./providers/ollama');
const AnthropicProvider = require('./providers/anthropic');
const VllmProvider = require('./providers/vllm');

const PROVIDERS = { ollama: OllamaProvider, anthropic: AnthropicProvider, vllm: VllmProvider };

class LLMClient {
  constructor(config) {
    const ProviderClass = PROVIDERS[config.provider];
    if (!ProviderClass) throw new Error(`Unknown provider: ${config.provider}`);

    // Routine model — used for most decisions
    this.routine = new ProviderClass({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      model: config.routine.model,
      temperature: config.temperature,
      timeoutMs: config.timeoutMs,
    });

    // Strategic model — used for K4+ bots or when pending proposals exist
    this.strategic = new ProviderClass({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      model: config.strategic.model,
      temperature: config.temperature,
      timeoutMs: config.timeoutMs,
    });
  }

  async generate(prompt, systemPrompt) {
    try {
      return await this.routine.generate(prompt, systemPrompt);
    } catch (err) {
      // Retry once
      console.warn('LLM routine call failed, retrying:', err.message);
      return await this.routine.generate(prompt, systemPrompt);
    }
  }

  async generateStrategic(prompt, systemPrompt) {
    try {
      return await this.strategic.generate(prompt, systemPrompt);
    } catch (err) {
      console.warn('LLM strategic call failed, retrying:', err.message);
      return await this.strategic.generate(prompt, systemPrompt);
    }
  }

  async healthCheck() {
    return await this.routine.healthCheck();
  }
}

module.exports = LLMClient;
