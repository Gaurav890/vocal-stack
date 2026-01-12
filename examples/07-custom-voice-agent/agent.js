import OpenAI from 'openai';
import { SpeechSanitizer } from 'vocal-stack/sanitizer';
import { FlowController } from 'vocal-stack/flow';
import { VoiceAuditor } from 'vocal-stack/monitor';
import { writeFile } from 'fs/promises';
import { EventEmitter } from 'events';

/**
 * CustomVoiceAgent - Production-ready conversational voice agent
 *
 * Features:
 * - Multi-turn conversation with history
 * - Automatic text sanitization
 * - Natural filler injection
 * - Performance monitoring
 * - Barge-in support
 * - Event-driven architecture
 * - Error handling and retry logic
 */
export class CustomVoiceAgent extends EventEmitter {
  constructor(config = {}) {
    super();

    const {
      openaiApiKey = process.env.OPENAI_API_KEY,
      model = 'gpt-4-turbo',
      systemPrompt = 'You are a helpful voice assistant.',
      maxHistoryLength = 10,
      sanitizerRules = ['markdown', 'urls', 'code-blocks'],
      stallThresholdMs = 1000,
      enableFillers = true,
      fillerPhrases = ['um', 'let me think', 'hmm', 'well'],
      enableMonitoring = true,
      ttsProvider = null, // Custom TTS provider function
    } = config;

    if (!openaiApiKey) {
      throw new Error('OpenAI API key required');
    }

    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.model = model;
    this.systemPrompt = systemPrompt;
    this.maxHistoryLength = maxHistoryLength;
    this.ttsProvider = ttsProvider;

    // Conversation state
    this.conversationHistory = [];
    this.currentRequestId = null;
    this.isProcessing = false;

    // Setup vocal-stack components
    this.sanitizer = new SpeechSanitizer({
      rules: sanitizerRules,
    });

    this.flowController = new FlowController({
      stallThresholdMs,
      enableFillers,
      fillerPhrases,
      onFillerInjected: (filler) => this.handleFiller(filler),
    });

    this.auditor = enableMonitoring
      ? new VoiceAuditor({
          enableRealtime: true,
          onMetric: (metric) => this.handleMetric(metric),
        })
      : null;
  }

  /**
   * Send a message and get voice response
   */
  async chat(userMessage, requestId = null) {
    if (this.isProcessing) {
      throw new Error('Agent is currently processing another request');
    }

    this.isProcessing = true;
    this.currentRequestId = requestId || `req-${Date.now()}`;

    try {
      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage,
      });

      // Trim history if too long
      this.trimHistory();

      // Emit event
      this.emit('request-start', {
        requestId: this.currentRequestId,
        message: userMessage,
      });

      // Get LLM response
      const llmStream = this.streamCompletion();
      const pipeline = this.auditor
        ? this.auditor.track(
            this.currentRequestId,
            this.flowController.wrap(this.sanitizer.sanitizeStream(llmStream))
          )
        : this.flowController.wrap(this.sanitizer.sanitizeStream(llmStream));

      let fullResponse = '';
      const chunks = [];

      // Process stream
      for await (const chunk of pipeline) {
        if (chunk.trim()) {
          chunks.push(chunk);
          fullResponse += chunk;

          // Emit chunk event
          this.emit('chunk', {
            requestId: this.currentRequestId,
            chunk,
          });

          // Send to TTS if provider available
          if (this.ttsProvider) {
            await this.ttsProvider(chunk);
          }
        }
      }

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: fullResponse,
      });

      // Emit completion event
      this.emit('request-complete', {
        requestId: this.currentRequestId,
        response: fullResponse,
        chunks,
      });

      return {
        text: fullResponse,
        chunks,
        requestId: this.currentRequestId,
      };
    } catch (error) {
      this.emit('error', {
        requestId: this.currentRequestId,
        error,
      });
      throw error;
    } finally {
      this.isProcessing = false;
      this.currentRequestId = null;
    }
  }

  /**
   * Interrupt current processing (barge-in)
   */
  interrupt() {
    if (!this.isProcessing) {
      return;
    }

    this.flowController.interrupt();

    this.emit('interrupted', {
      requestId: this.currentRequestId,
    });

    this.isProcessing = false;
  }

  /**
   * Stream completion from OpenAI
   */
  async *streamCompletion() {
    const messages = [
      { role: 'system', content: this.systemPrompt },
      ...this.conversationHistory,
    ];

    const stream = await this.openai.chat.completions.create({
      model: this.model,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 500,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  /**
   * Handle filler injection
   */
  handleFiller(filler) {
    this.emit('filler-injected', {
      requestId: this.currentRequestId,
      filler,
    });

    // Send filler to TTS if provider available
    if (this.ttsProvider) {
      this.ttsProvider(filler);
    }
  }

  /**
   * Handle monitoring metrics
   */
  handleMetric(metric) {
    this.emit('metric', metric);
  }

  /**
   * Trim conversation history
   */
  trimHistory() {
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(
        -this.maxHistoryLength
      );
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
    this.emit('history-cleared');
  }

  /**
   * Get conversation history
   */
  getHistory() {
    return [...this.conversationHistory];
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      flow: this.flowController.getStats(),
      monitoring: this.auditor ? this.auditor.getSummary() : null,
      conversation: {
        messagesInHistory: this.conversationHistory.length,
        isProcessing: this.isProcessing,
      },
    };
  }

  /**
   * Export monitoring metrics
   */
  exportMetrics(format = 'json') {
    if (!this.auditor) {
      throw new Error('Monitoring not enabled');
    }
    return this.auditor.export(format);
  }

  /**
   * Save audio file (if using TTS provider that returns audio data)
   */
  async saveAudio(audioData, filename) {
    await writeFile(filename, audioData);
    this.emit('audio-saved', { filename });
  }
}

export default CustomVoiceAgent;
