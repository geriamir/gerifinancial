const crypto = require('crypto');

class AiNotConfiguredError extends Error {
  constructor() {
    super('Azure OpenAI is not configured (AZURE_OPENAI_ENDPOINT is unset)');
    this.name = 'AiNotConfiguredError';
    this.code = 'AI_NOT_CONFIGURED';
  }
}

// Off unless a test asks for it. The default has to match an unconfigured
// environment, so that any code path which forgets to check isEnabled() fails in
// the suite rather than in production.
let enabled = false;
let chatResponse = { content: '', finishReason: 'stop' };
let chatError = null;

const MOCK_DIMENSIONS = 8;

/**
 * A deterministic stand-in for a real embedding.
 *
 * Derived from a hash of the input, so identical strings embed identically and
 * different strings do not - enough to exercise similarity and nearest-neighbour
 * logic repeatably, without pretending to carry any semantics.
 */
const fakeEmbedding = (text) => {
  const key = String(text);
  if (overrides.has(key)) return overrides.get(key);
  const digest = crypto.createHash('sha256').update(key).digest();
  const raw = Array.from({ length: MOCK_DIMENSIONS }, (_, i) => (digest[i] / 255) * 2 - 1);
  const norm = Math.sqrt(raw.reduce((sum, v) => sum + v * v, 0)) || 1;
  return raw.map((v) => v / norm);
};

// Hashed vectors are deterministic but carry no meaning, so two descriptions a
// human would call the same are no closer than two unrelated ones. Tests that
// need "near" and "far" to mean something register their own vectors here.
const overrides = new Map();

const defaultChat = async ({ userId }) => {
  if (!enabled) throw new AiNotConfiguredError();
  if (!userId) throw new Error('llmService.chat requires a userId to charge the request to');
  if (chatError) throw chatError;
  return {
    content: chatResponse.content,
    finishReason: chatResponse.finishReason || 'stop',
    model: 'mock-chat',
    usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 }
  };
};

const defaultEmbed = async ({ userId, texts }) => {
  if (!enabled) throw new AiNotConfiguredError();
  if (!userId) throw new Error('llmService.embed requires a userId to charge the request to');
  const input = Array.isArray(texts) ? texts : [texts];
  const vectors = input.map(fakeEmbedding);
  return {
    vectors,
    dimensions: vectors.length ? MOCK_DIMENSIONS : 0,
    model: 'mock-embedding',
    usage: { totalTokens: input.length }
  };
};

module.exports = {
  isEnabled: jest.fn(() => enabled),

  isEmbeddingEnabled: jest.fn(() => enabled),

  assertEnabled: jest.fn(() => {
    if (!enabled) throw new AiNotConfiguredError();
  }),

  chat: jest.fn(defaultChat),

  embed: jest.fn(defaultEmbed),

  asUntrustedData: jest.fn((text, label = 'data') =>
    `<untrusted source="${label}">\n${String(text ?? '').replace(/<\/?untrusted[^>]*>/gi, '').trim()}\n</untrusted>`
  ),

  AiNotConfiguredError,

  // Test controls
  __setEnabled: (value) => { enabled = value; },
  __setChatResponse: (response) => { chatResponse = response; chatError = null; },
  __setChatError: (error) => { chatError = error; },
  __embeddingFor: fakeEmbedding,
  __setEmbedding: (text, vector) => { overrides.set(String(text), vector); },
  __reset: () => {
    enabled = false;
    chatResponse = { content: '', finishReason: 'stop' };
    chatError = null;
    overrides.clear();
    // A test that swaps in its own implementation - to drive a race from inside
    // the request, say - is otherwise still swapped in for every test after it,
    // because clearMocks only clears the calls. That silently makes
    // __setChatResponse and __setChatError do nothing, which looks like a bug in
    // whatever runs next rather than in the test that caused it.
    module.exports.chat.mockImplementation(defaultChat);
    module.exports.embed.mockImplementation(defaultEmbed);
  }
};
