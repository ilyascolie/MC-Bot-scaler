/**
 * LLMClient — provider-agnostic LLM client with tiered model support.
 *
 * Loads the configured provider (anthropic, ollama, vllm) and exposes two
 * generation methods:
 *   - generate(prompt, systemPrompt)         → routine model (fast/cheap)
 *   - generateStrategic(prompt, systemPrompt) → strategic model (smart/expensive)
 *
 * Retry logic (once) lives here so providers stay simple.
 */

const PROVIDERS = {
  anthropic: './providers/anthropic',
  ollama: './providers/ollama',
  vllm: './providers/vllm',
};

class LLMClient {
  /**
   * @param {object} config — from settings.llm
   * @param {string} config.provider      — 'anthropic' | 'ollama' | 'vllm'
   * @param {object} config.routine       — { model } for routine calls
   * @param {object} [config.strategic]   — { model } for strategic calls (falls back to routine)
   * @param {string} [config.apiKey]      — API key (required for anthropic)
   * @param {string} [config.endpoint]    — base URL override
   * @param {number} [config.temperature=0.7]
   * @param {number} [config.maxTokens=1024]
   * @param {number} [config.timeoutMs=60000]
   */
  constructor(config) {
    const providerName = config.provider || 'ollama';
    if (!PROVIDERS[providerName]) {
      throw new Error(`Unknown LLM provider: ${providerName}. Valid: ${Object.keys(PROVIDERS).join(', ')}`);
    }

    const ProviderClass = require(PROVIDERS[providerName]);

    // Build shared config (everything except model)
    const shared = {
      apiKey: config.apiKey,
      endpoint: config.endpoint,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 1024,
      timeoutMs: config.timeoutMs ?? 60000,
    };

    // Routine provider (always created)
    const routineModel = (config.routine && config.routine.model) || config.model;
    if (!routineModel) throw new Error('LLMClient requires routine.model or model');
    this._routine = new ProviderClass({ ...shared, model: routineModel });

    // Strategic provider (may be same as routine)
    const strategicModel = config.strategic && config.strategic.model;
    if (strategicModel && strategicModel !== routineModel) {
      this._strategic = new ProviderClass({ ...shared, model: strategicModel });
    } else {
      this._strategic = this._routine;
    }

    this.providerName = providerName;
  }

  /**
   * Generate with the routine (fast/cheap) model. Retries once on failure.
   *
   * @param {string} prompt
   * @param {string} [systemPrompt]
   * @returns {Promise<string>}
   */
  async generate(prompt, systemPrompt) {
    return this._callWithRetry(this._routine, prompt, systemPrompt);
  }

  /**
   * Generate with the strategic (smart/expensive) model. Retries once on failure.
   *
   * @param {string} prompt
   * @param {string} [systemPrompt]
   * @returns {Promise<string>}
   */
  async generateStrategic(prompt, systemPrompt) {
    return this._callWithRetry(this._strategic, prompt, systemPrompt);
  }

  /**
   * Health check on the routine provider.
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    return this._routine.healthCheck();
  }

  /**
   * Call provider.generate with one retry.
   * @private
   */
  async _callWithRetry(provider, prompt, systemPrompt) {
    try {
      return await provider.generate(prompt, systemPrompt);
    } catch (firstErr) {
      try {
        return await provider.generate(prompt, systemPrompt);
      } catch (retryErr) {
        throw new Error(
          `LLM generate failed after retry: ${retryErr.message} (first error: ${firstErr.message})`
        );
      }
    }
  }
}

module.exports = LLMClient;
