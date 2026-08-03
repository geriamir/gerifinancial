const { AzureOpenAI } = require('openai');
const { DefaultAzureCredential, getBearerTokenProvider } = require('@azure/identity');
const logger = require('../../utils/logger');
const config = require('../../config');
const aiBudget = require('./aiBudget');
const aiCostMeter = require('./aiCostMeter');

const COGNITIVE_SERVICES_SCOPE = 'https://cognitiveservices.azure.com/.default';

// Reasoning-capable models spend completion tokens on reasoning before they emit
// anything, so a cap that looks generous for the visible answer can produce an
// empty response instead of a short one. This default leaves room for both.
const DEFAULT_MAX_COMPLETION_TOKENS = 1000;

/**
 * Raised when an AI feature is invoked in an environment with no model
 * configured. Separate from a request failure so callers can present "not
 * available here" rather than "something went wrong".
 */
class AiNotConfiguredError extends Error {
  constructor() {
    super('Azure OpenAI is not configured (AZURE_OPENAI_ENDPOINT is unset)');
    this.name = 'AiNotConfiguredError';
    this.code = 'AI_NOT_CONFIGURED';
  }
}

/**
 * The single place this application talks to a language model.
 *
 * Everything funnels through here for three reasons that are easier to enforce
 * once than at every call site:
 *
 *  1. Spend. Every request is charged to a per-user daily budget before it is
 *     sent and recorded against it afterwards, so no feature can quietly become
 *     expensive.
 *  2. Blast radius. This service reads transaction text and nothing else. It has
 *     no access to bank credentials, to the KEK, or to any write path - so a
 *     model that is talked into misbehaving has nothing dangerous to reach for.
 *  3. Testability. One seam means one mock: src/test/setup.js replaces this
 *     module globally, and the suite can never make a network call or spend
 *     money by accident.
 *
 * Authentication is Entra ID only. The account is provisioned with local
 * authentication disabled, so there is no API key anywhere in this codebase, in
 * the environment, or in a vault.
 */
class LlmService {
  constructor() {
    this.client = null;
  }

  isEnabled() {
    return config.ai.enabled;
  }

  // Separate from isEnabled because matching transactions needs only embeddings.
  // Requiring a chat deployment for that would switch off categorisation in any
  // environment provisioned with embeddings alone.
  isEmbeddingEnabled() {
    return config.ai.embeddingsEnabled;
  }

  assertEnabled() {
    if (!this.isEnabled()) throw new AiNotConfiguredError();
  }

  /**
   * The client is built on first use rather than at import time. Constructing it
   * eagerly would make every test and every local run try to resolve a managed
   * identity that is not there.
   */
  getClient() {
    if (this.client) return this.client;
    // Only the endpoint matters here. Which deployments exist is the caller's
    // concern, and one client serves both chat and embeddings.
    if (!config.ai.endpoint) throw new AiNotConfiguredError();

    const credential = new DefaultAzureCredential({
      // Container Apps uses a user-assigned identity, and DefaultAzureCredential
      // needs its client id to know which one to ask for. Same identity, and the
      // same variable, as the Key Vault providers use.
      managedIdentityClientId: process.env.AZURE_CLIENT_ID
    });

    this.client = new AzureOpenAI({
      endpoint: config.ai.endpoint,
      apiVersion: config.ai.apiVersion,
      // Refreshes the token behind the scenes; tokens last an hour and this
      // process is long-lived.
      azureADTokenProvider: getBearerTokenProvider(credential, COGNITIVE_SERVICES_SCOPE),
      timeout: config.ai.requestTimeoutMs,
      // Retries 429s and 5xxs with backoff. Rate limits are routine rather than
      // exceptional at these quotas, so this is load-bearing.
      maxRetries: config.ai.maxRetries
    });

    logger.info(`LLM service initialized (${config.ai.endpoint}, chat=${config.ai.chatDeployment})`);
    return this.client;
  }

  /**
   * Wraps text this application did not author so it reads as data rather than
   * instructions.
   *
   * This matters more here than in most applications. Transaction descriptions
   * and transfer memos are written by whoever moved the money - a merchant, or
   * anyone who can send the user a shekel with a note attached - so they are
   * genuinely attacker-influenced input that lands in a prompt. Anything derived
   * from a Transaction should pass through here.
   *
   * Delimiting is a mitigation, not a guarantee. The real containment is that
   * this service can only read: no call made through it has access to
   * credentials, to the KEK, or to anything that writes.
   */
  asUntrustedData(text, label = 'data') {
    const safe = String(text ?? '')
      // Stop the payload from closing the fence and appearing to speak as us.
      .replace(/<\/?untrusted[^>]*>/gi, '')
      .trim();
    return `<untrusted source="${label}">\n${safe}\n</untrusted>`;
  }

  /**
   * A single chat completion.
   *
   * userId is required, not optional: it is what the spend budget is counted
   * against, and an unattributed request is one nobody can be stopped from
   * repeating.
   */
  async chat({
    userId,
    system,
    messages = [],
    maxCompletionTokens = DEFAULT_MAX_COMPLETION_TOKENS,
    responseFormat,
    temperature,
    purpose = 'unspecified'
  }) {
    this.assertEnabled();
    if (!userId) throw new Error('llmService.chat requires a userId to charge the request to');

    await aiBudget.assertWithinBudget(userId);

    const payload = {
      model: config.ai.chatDeployment,
      messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
      max_completion_tokens: maxCompletionTokens
    };
    // Only sent when asked for: the gpt-5 family rejects a temperature other
    // than its default, so passing one unconditionally would break the models
    // this is actually deployed against.
    if (temperature !== undefined) payload.temperature = temperature;
    if (responseFormat) payload.response_format = responseFormat;

    const startedAt = Date.now();
    let response;
    try {
      response = await this.getClient().chat.completions.create(payload);
    } catch (error) {
      logger.error(`LLM chat failed (purpose=${purpose}): ${error.message}`);
      throw error;
    }

    const usage = response.usage || {};
    await aiBudget.record(userId, usage.total_tokens || 0);
    aiCostMeter.record(purpose, usage.total_tokens || 0);

    logger.info(
      `LLM chat purpose=${purpose} tokens=${usage.total_tokens || 0} ms=${Date.now() - startedAt}`
    );

    const choice = response.choices && response.choices[0];
    return {
      content: (choice && choice.message && choice.message.content) || '',
      finishReason: choice && choice.finish_reason,
      model: response.model,
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      }
    };
  }

  /**
   * Embeds one or more strings, returning a vector per input in the order given.
   *
   * Batching is left to the caller because the useful batch size depends on what
   * is being embedded; the API accepts an array and charges per token either
   * way, so one call with many inputs is strictly cheaper in round trips than
   * many calls with one.
   */
  async embed({ userId, texts, purpose = 'unspecified' }) {
    if (!this.isEmbeddingEnabled()) throw new AiNotConfiguredError();
    if (!userId) throw new Error('llmService.embed requires a userId to charge the request to');

    const input = Array.isArray(texts) ? texts : [texts];
    // Same shape as a real response, so a caller destructuring `dimensions` or
    // `model` does not get undefined for the one input that never reaches the API.
    if (input.length === 0) {
      return {
        vectors: [],
        dimensions: 0,
        model: config.ai.embeddingDeployment,
        usage: { totalTokens: 0 }
      };
    }

    await aiBudget.assertWithinBudget(userId);

    const response = await this.getClient().embeddings.create({
      model: config.ai.embeddingDeployment,
      input
    });

    const usage = response.usage || {};
    await aiBudget.record(userId, usage.total_tokens || 0);
    aiCostMeter.record(purpose, usage.total_tokens || 0);

    // The API does not promise ordering, but it does return an index per item.
    const vectors = [...response.data]
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);

    logger.info(`LLM embed purpose=${purpose} inputs=${input.length} tokens=${usage.total_tokens || 0}`);

    return {
      vectors,
      dimensions: vectors.length ? vectors[0].length : 0,
      model: response.model,
      usage: { totalTokens: usage.total_tokens || 0 }
    };
  }
}

module.exports = new LlmService();
module.exports.AiNotConfiguredError = AiNotConfiguredError;
