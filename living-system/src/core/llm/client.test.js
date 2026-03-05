const LLMClient = require('./client');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

// ── Mock provider for testing ──────────────────────────────────────

// We'll test by injecting a fake provider module path.
// Instead, we test the LLMClient constructor logic and method routing
// by monkey-patching after construction (since providers are loaded internally).

function main() {
  console.log('\n--- LLM Client tests ---\n');

  // ── Test 1: Constructor validates provider name ──────────────────

  {
    console.log('Test 1: Unknown provider throws');
    let threw = false;
    try {
      new LLMClient({ provider: 'nonexistent', routine: { model: 'test' } });
    } catch (err) {
      threw = true;
      assert(err.message.includes('Unknown LLM provider'), `error mentions unknown provider (got: ${err.message})`);
    }
    assert(threw, 'constructor threw for unknown provider');
  }

  // ── Test 2: Ollama provider loads correctly ─────────────────────

  {
    console.log('\nTest 2: Ollama provider construction');
    const client = new LLMClient({
      provider: 'ollama',
      routine: { model: 'llama3' },
      endpoint: 'http://localhost:11434',
    });
    assert(client.providerName === 'ollama', `provider is ollama (got: ${client.providerName})`);
    assert(typeof client.generate === 'function', 'has generate()');
    assert(typeof client.generateStrategic === 'function', 'has generateStrategic()');
    assert(typeof client.healthCheck === 'function', 'has healthCheck()');
  }

  // ── Test 3: Anthropic provider loads correctly ──────────────────

  {
    console.log('\nTest 3: Anthropic provider construction');
    const client = new LLMClient({
      provider: 'anthropic',
      apiKey: 'test-key-123',
      routine: { model: 'claude-haiku-4-5-20251001' },
    });
    assert(client.providerName === 'anthropic', `provider is anthropic (got: ${client.providerName})`);
    assert(client._routine.model === 'claude-haiku-4-5-20251001', 'routine model set');
    assert(client._routine.apiKey === 'test-key-123', 'API key passed through');
  }

  // ── Test 4: vLLM provider loads correctly ───────────────────────

  {
    console.log('\nTest 4: vLLM provider construction');
    const client = new LLMClient({
      provider: 'vllm',
      routine: { model: 'mistral-7b' },
      endpoint: 'http://gpu-server:8000',
    });
    assert(client.providerName === 'vllm', `provider is vllm (got: ${client.providerName})`);
    assert(client._routine.endpoint === 'http://gpu-server:8000', 'endpoint set');
  }

  // ── Test 5: Tiered models — same model ──────────────────────────

  {
    console.log('\nTest 5: Same routine and strategic model shares provider');
    const client = new LLMClient({
      provider: 'ollama',
      routine: { model: 'llama3' },
      strategic: { model: 'llama3' },
    });
    assert(client._routine === client._strategic, 'routine and strategic share same provider instance');
  }

  // ── Test 6: Tiered models — different models ────────────────────

  {
    console.log('\nTest 6: Different routine and strategic models');
    const client = new LLMClient({
      provider: 'ollama',
      routine: { model: 'llama3' },
      strategic: { model: 'llama3:70b' },
    });
    assert(client._routine !== client._strategic, 'routine and strategic are different instances');
    assert(client._routine.model === 'llama3', `routine model is llama3 (got: ${client._routine.model})`);
    assert(client._strategic.model === 'llama3:70b', `strategic model is llama3:70b (got: ${client._strategic.model})`);
  }

  // ── Test 7: Tiered models — no strategic falls back to routine ──

  {
    console.log('\nTest 7: No strategic model falls back to routine');
    const client = new LLMClient({
      provider: 'ollama',
      routine: { model: 'llama3' },
    });
    assert(client._routine === client._strategic, 'strategic falls back to routine');
  }

  // ── Test 8: generate() and generateStrategic() route correctly ──

  {
    console.log('\nTest 8: Method routing with mock providers');
    const client = new LLMClient({
      provider: 'ollama',
      routine: { model: 'small' },
      strategic: { model: 'big' },
    });

    // Replace providers with mocks
    const routineCalls = [];
    const strategicCalls = [];

    client._routine = {
      async generate(prompt) { routineCalls.push(prompt); return 'routine-response'; },
      async healthCheck() { return true; },
    };
    client._strategic = {
      async generate(prompt) { strategicCalls.push(prompt); return 'strategic-response'; },
      async healthCheck() { return true; },
    };

    // Test generate() routes to routine
    client.generate('hello').then((result) => {
      assert(result === 'routine-response', `generate() returns routine response (got: ${result})`);
      assert(routineCalls.length === 1, 'routine provider called once');
      assert(strategicCalls.length === 0, 'strategic provider not called');

      // Test generateStrategic() routes to strategic
      return client.generateStrategic('important decision');
    }).then((result) => {
      assert(result === 'strategic-response', `generateStrategic() returns strategic response (got: ${result})`);
      assert(strategicCalls.length === 1, 'strategic provider called once');

      // Test healthCheck() uses routine
      return client.healthCheck();
    }).then((ok) => {
      assert(ok === true, 'healthCheck() delegates to routine provider');
      printResults();
    });

    return; // async chain handles the rest
  }
}

function printResults() {
  // ── Test 9: Anthropic provider requires apiKey ──────────────────

  {
    console.log('\nTest 9: Anthropic requires apiKey');
    let threw = false;
    try {
      new LLMClient({ provider: 'anthropic', routine: { model: 'test' } });
    } catch (err) {
      threw = true;
      assert(err.message.includes('apiKey'), `error mentions apiKey (got: ${err.message})`);
    }
    assert(threw, 'constructor threw without apiKey');
  }

  // ── Test 10: Config defaults ────────────────────────────────────

  {
    console.log('\nTest 10: Config defaults');
    const client = new LLMClient({
      provider: 'ollama',
      routine: { model: 'llama3' },
    });
    assert(client._routine.temperature === 0.7, `default temperature is 0.7 (got: ${client._routine.temperature})`);
    assert(client._routine.timeoutMs === 60000, `default timeout is 60000 (got: ${client._routine.timeoutMs})`);
  }

  // ── Test 11: Config overrides ───────────────────────────────────

  {
    console.log('\nTest 11: Config overrides');
    const client = new LLMClient({
      provider: 'ollama',
      routine: { model: 'llama3' },
      temperature: 0.3,
      timeoutMs: 120000,
    });
    assert(client._routine.temperature === 0.3, `temperature override (got: ${client._routine.temperature})`);
    assert(client._routine.timeoutMs === 120000, `timeout override (got: ${client._routine.timeoutMs})`);
  }

  // ── Test 12: Retry on failure ───────────────────────────────────

  {
    console.log('\nTest 12: Retry logic');
    const client = new LLMClient({
      provider: 'ollama',
      routine: { model: 'test' },
    });

    let callCount = 0;
    client._routine = {
      async generate() {
        callCount++;
        if (callCount === 1) throw new Error('transient');
        return 'recovered';
      },
      async healthCheck() { return true; },
    };

    client.generate('test').then((result) => {
      assert(result === 'recovered', `retried and recovered (got: ${result})`);
      assert(callCount === 2, `called twice (got: ${callCount})`);

      // Test permanent failure
      let permCallCount = 0;
      client._routine = {
        async generate() {
          permCallCount++;
          throw new Error('permanent');
        },
        async healthCheck() { return true; },
      };

      return client.generate('test').catch((err) => {
        assert(err.message.includes('failed after retry'), `error mentions retry (got: ${err.message})`);
        assert(permCallCount === 2, `called twice on permanent failure (got: ${permCallCount})`);
        finalResults();
      });
    });
  }
}

function finalResults() {
  // ── Test 13: Legacy model field fallback ────────────────────────

  {
    console.log('\nTest 13: Legacy model field fallback');
    const client = new LLMClient({
      provider: 'ollama',
      model: 'legacy-model',
    });
    assert(client._routine.model === 'legacy-model', `falls back to model field (got: ${client._routine.model})`);
  }

  // ── Test 14: Missing model throws ───────────────────────────────

  {
    console.log('\nTest 14: Missing model throws');
    let threw = false;
    try {
      new LLMClient({ provider: 'ollama' });
    } catch (err) {
      threw = true;
      assert(err.message.includes('model'), `error mentions model (got: ${err.message})`);
    }
    assert(threw, 'constructor threw without model');
  }

  console.log(`\n========================================`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
