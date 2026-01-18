import { describe, expect, it, vi } from 'vitest';
import { BufferManager } from './buffer-manager';
import { FillerInjector } from './filler-injector';
import { FlowController, withFlowControl } from './flow-controller';
import { FlowManager } from './flow-manager';
import { StallDetector } from './stall-detector';
import { ConversationStateMachine } from './state-machine';
import { ConversationState } from './types';

describe('ConversationStateMachine', () => {
  it('should start in IDLE state', () => {
    const machine = new ConversationStateMachine();
    expect(machine.getState()).toBe(ConversationState.IDLE);
  });

  it('should allow valid transitions', () => {
    const machine = new ConversationStateMachine();

    // IDLE → WAITING
    machine.transition(ConversationState.WAITING);
    expect(machine.getState()).toBe(ConversationState.WAITING);

    // WAITING → SPEAKING
    machine.transition(ConversationState.SPEAKING);
    expect(machine.getState()).toBe(ConversationState.SPEAKING);

    // SPEAKING → IDLE
    machine.transition(ConversationState.IDLE);
    expect(machine.getState()).toBe(ConversationState.IDLE);
  });

  it('should throw error on invalid transitions', () => {
    const machine = new ConversationStateMachine();

    // IDLE → INTERRUPTED is invalid
    expect(() => machine.transition(ConversationState.INTERRUPTED)).toThrow(
      'Invalid state transition'
    );
  });

  it('should notify listeners on state change', () => {
    const machine = new ConversationStateMachine();
    const listener = vi.fn();

    machine.onStateChange(listener);
    machine.transition(ConversationState.WAITING);

    expect(listener).toHaveBeenCalledWith(ConversationState.IDLE, ConversationState.WAITING);
  });

  it('should allow listener removal', () => {
    const machine = new ConversationStateMachine();
    const listener = vi.fn();

    const unsubscribe = machine.onStateChange(listener);
    unsubscribe();

    machine.transition(ConversationState.WAITING);
    expect(listener).not.toHaveBeenCalled();
  });

  it('should reset to IDLE', () => {
    const machine = new ConversationStateMachine();
    machine.transition(ConversationState.WAITING);
    machine.reset();

    expect(machine.getState()).toBe(ConversationState.IDLE);
  });
});

describe('FillerInjector', () => {
  it('should rotate through filler phrases', () => {
    const injector = new FillerInjector(['um', 'hmm', 'uh'], 10);

    expect(injector.getFiller()).toBe('um');
    expect(injector.getFiller()).toBe('hmm');
    expect(injector.getFiller()).toBe('uh');
    expect(injector.getFiller()).toBe('um'); // Wraps around
  });

  it('should respect max fillers limit', () => {
    const injector = new FillerInjector(['um', 'hmm'], 2);

    expect(injector.getFiller()).toBe('um');
    expect(injector.getFiller()).toBe('hmm');
    expect(injector.getFiller()).toBeNull(); // Limit reached
  });

  it('should reset state', () => {
    const injector = new FillerInjector(['um'], 3);

    injector.getFiller();
    injector.getFiller();
    injector.reset();

    expect(injector.getUsedCount()).toBe(0);
    expect(injector.canInjectMore()).toBe(true);
  });

  it('should track used count', () => {
    const injector = new FillerInjector(['um'], 5);

    expect(injector.getUsedCount()).toBe(0);
    injector.getFiller();
    expect(injector.getUsedCount()).toBe(1);
    injector.getFiller();
    expect(injector.getUsedCount()).toBe(2);
  });

  it('should check if more fillers can be injected', () => {
    const injector = new FillerInjector(['um'], 1);

    expect(injector.canInjectMore()).toBe(true);
    injector.getFiller();
    expect(injector.canInjectMore()).toBe(false);
  });
});

describe('StallDetector', () => {
  it('should detect stalls after threshold', async () => {
    const onStall = vi.fn();
    const detector = new StallDetector(50, onStall);

    detector.start();

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(onStall).toHaveBeenCalled();
    const callArgs = onStall.mock.calls[0];
    expect(callArgs?.[0]).toBeGreaterThanOrEqual(50);

    detector.stop();
  });

  it('should reset timer when chunk received', async () => {
    const onStall = vi.fn();
    const detector = new StallDetector(50, onStall);

    detector.start();

    await new Promise((resolve) => setTimeout(resolve, 30));
    detector.notifyChunk(); // Reset timer

    await new Promise((resolve) => setTimeout(resolve, 30));
    // Total elapsed since start: 60ms, but only 30ms since notifyChunk
    // Should not have triggered stall yet
    expect(onStall).not.toHaveBeenCalled();

    detector.stop();
  });

  it('should stop detecting when stopped', async () => {
    const onStall = vi.fn();
    const detector = new StallDetector(50, onStall);

    detector.start();
    detector.stop();

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(onStall).not.toHaveBeenCalled();
  });
});

describe('FlowController', () => {
  describe('constructor', () => {
    it('should create controller with default config', () => {
      const controller = new FlowController();
      expect(controller).toBeDefined();
      expect(controller.getState()).toBe(ConversationState.IDLE);
    });

    it('should accept custom config', () => {
      const controller = new FlowController({
        stallThresholdMs: 1000,
        fillerPhrases: ['custom'],
        maxFillersPerResponse: 5,
      });
      expect(controller).toBeDefined();
    });
  });

  describe('wrap()', () => {
    it('should process stream chunks', async () => {
      const controller = new FlowController();

      async function* mockStream() {
        yield 'chunk1';
        yield 'chunk2';
        yield 'chunk3';
      }

      const chunks: string[] = [];
      for await (const chunk of controller.wrap(mockStream())) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['chunk1', 'chunk2', 'chunk3']);
      expect(controller.getState()).toBe(ConversationState.IDLE);
    });

    it('should transition states correctly', async () => {
      const controller = new FlowController();
      const states: ConversationState[] = [];

      async function* mockStream() {
        states.push(controller.getState());
        yield 'chunk1';
        states.push(controller.getState());
      }

      for await (const _chunk of controller.wrap(mockStream())) {
        // Process chunks
      }

      expect(states).toContain(ConversationState.WAITING);
      expect(states).toContain(ConversationState.SPEAKING);
      expect(controller.getState()).toBe(ConversationState.IDLE);
    });

    it('should track first chunk time', async () => {
      const controller = new FlowController();

      async function* mockStream() {
        yield 'chunk1';
      }

      for await (const _chunk of controller.wrap(mockStream())) {
        // Process
      }

      const stats = controller.getStats();
      expect(stats.firstChunkTime).toBeGreaterThanOrEqual(0);
      expect(stats.chunksProcessed).toBe(1);
    });

    it('should call onFirstChunk callback', async () => {
      const onFirstChunk = vi.fn();
      const controller = new FlowController({ onFirstChunk });

      async function* mockStream() {
        yield 'chunk1';
        yield 'chunk2';
      }

      for await (const _chunk of controller.wrap(mockStream())) {
        // Process
      }

      expect(onFirstChunk).toHaveBeenCalledTimes(1);
    });

    it('should stop on interrupt', async () => {
      const controller = new FlowController();

      async function* mockStream() {
        yield 'chunk1';
        controller.interrupt(); // Interrupt mid-stream
        yield 'chunk2'; // Should not be yielded
        yield 'chunk3';
      }

      const chunks: string[] = [];
      for await (const chunk of controller.wrap(mockStream())) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1); // Only first chunk
      expect(chunks[0]).toBe('chunk1');
      expect(controller.getState()).toBe(ConversationState.INTERRUPTED);
    });

    it('should detect stalls and call callback', async () => {
      const onStallDetected = vi.fn();
      const controller = new FlowController({
        stallThresholdMs: 50,
        enableFillers: false,
        onStallDetected,
      });

      async function* mockStream() {
        await new Promise((resolve) => setTimeout(resolve, 100)); // Stall
        yield 'chunk1';
      }

      for await (const _chunk of controller.wrap(mockStream())) {
        // Process
      }

      expect(onStallDetected).toHaveBeenCalled();
      const stats = controller.getStats();
      expect(stats.stallsDetected).toBeGreaterThan(0);
    });

    it('should inject fillers during stalls before first chunk', async () => {
      const onFillerInjected = vi.fn();
      const controller = new FlowController({
        stallThresholdMs: 50,
        enableFillers: true,
        fillerPhrases: ['um'],
        onFillerInjected,
      });

      async function* mockStream() {
        await new Promise((resolve) => setTimeout(resolve, 100)); // Stall before first chunk
        yield 'chunk1';
      }

      for await (const _chunk of controller.wrap(mockStream())) {
        // Process
      }

      expect(onFillerInjected).toHaveBeenCalledWith('um');
      const stats = controller.getStats();
      expect(stats.fillersInjected).toBeGreaterThan(0);
    });

    it('should NOT inject fillers after first chunk', async () => {
      const onFillerInjected = vi.fn();
      const controller = new FlowController({
        stallThresholdMs: 50,
        enableFillers: true,
        onFillerInjected,
      });

      async function* mockStream() {
        yield 'chunk1'; // First chunk emitted
        await new Promise((resolve) => setTimeout(resolve, 100)); // Stall after first chunk
        yield 'chunk2';
      }

      for await (const _chunk of controller.wrap(mockStream())) {
        // Process
      }

      // Filler should not be injected because first chunk was already emitted
      expect(onFillerInjected).not.toHaveBeenCalled();
    });
  });

  describe('interrupt()', () => {
    it('should allow interrupt from WAITING state', () => {
      const controller = new FlowController();
      // Manually transition to WAITING (normally done in wrap())
      controller.stateMachine.transition(ConversationState.WAITING);

      controller.interrupt();
      expect(controller.getState()).toBe(ConversationState.INTERRUPTED);
    });

    it('should allow interrupt from SPEAKING state', () => {
      const controller = new FlowController();
      controller.stateMachine.transition(ConversationState.WAITING);
      controller.stateMachine.transition(ConversationState.SPEAKING);

      controller.interrupt();
      expect(controller.getState()).toBe(ConversationState.INTERRUPTED);
    });

    it('should not change state if already IDLE', () => {
      const controller = new FlowController();
      expect(controller.getState()).toBe(ConversationState.IDLE);

      controller.interrupt(); // Should not throw or change state
      expect(controller.getState()).toBe(ConversationState.IDLE);
    });
  });

  describe('getStats()', () => {
    it('should return flow statistics', async () => {
      const controller = new FlowController();

      async function* mockStream() {
        yield 'chunk1';
        yield 'chunk2';
      }

      for await (const _chunk of controller.wrap(mockStream())) {
        // Process
      }

      const stats = controller.getStats();
      expect(stats.chunksProcessed).toBe(2);
      expect(stats.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(stats.firstChunkTime).not.toBeNull();
    });
  });
});

describe('withFlowControl()', () => {
  it('should wrap stream with flow control', async () => {
    async function* mockStream() {
      yield 'a';
      yield 'b';
      yield 'c';
    }

    const chunks: string[] = [];
    for await (const chunk of withFlowControl(mockStream())) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['a', 'b', 'c']);
  });

  it('should accept config', async () => {
    const onFirstChunk = vi.fn();

    async function* mockStream() {
      yield 'chunk';
    }

    for await (const _chunk of withFlowControl(mockStream(), { onFirstChunk })) {
      // Process
    }

    expect(onFirstChunk).toHaveBeenCalled();
  });
});

describe('BufferManager', () => {
  it('should add chunks to buffer', () => {
    const buffer = new BufferManager(5);

    buffer.add('chunk1');
    buffer.add('chunk2');
    buffer.add('chunk3');

    expect(buffer.getSize()).toBe(3);
    expect(buffer.getAll()).toEqual(['chunk1', 'chunk2', 'chunk3']);
  });

  it('should work as circular buffer when full', () => {
    const buffer = new BufferManager(3);

    buffer.add('a');
    buffer.add('b');
    buffer.add('c');
    buffer.add('d'); // Overwrites 'a'
    buffer.add('e'); // Overwrites 'b'

    expect(buffer.getSize()).toBe(3);
    // Returns oldest to newest: c (oldest), d, e (newest)
    expect(buffer.getAll()).toEqual(['c', 'd', 'e']);
  });

  it('should clear buffer', () => {
    const buffer = new BufferManager(5);

    buffer.add('chunk1');
    buffer.add('chunk2');
    buffer.clear();

    expect(buffer.isEmpty()).toBe(true);
    expect(buffer.getSize()).toBe(0);
    expect(buffer.getAll()).toEqual([]);
  });

  it('should check if buffer is full', () => {
    const buffer = new BufferManager(2);

    expect(buffer.isFull()).toBe(false);
    buffer.add('a');
    expect(buffer.isFull()).toBe(false);
    buffer.add('b');
    expect(buffer.isFull()).toBe(true);
  });

  it('should throw error for invalid size', () => {
    expect(() => new BufferManager(0)).toThrow('Buffer size must be positive');
    expect(() => new BufferManager(-1)).toThrow('Buffer size must be positive');
  });
});

describe('FlowManager', () => {
  describe('event system', () => {
    it('should emit events during flow', async () => {
      const manager = new FlowManager({ stallThresholdMs: 1000 });
      const events: string[] = [];

      manager.on((event) => {
        events.push(event.type);
      });

      manager.start();
      manager.processChunk('chunk1');
      manager.processChunk('chunk2');
      manager.complete();

      expect(events).toContain('state-change');
      expect(events).toContain('first-chunk');
      expect(events).toContain('chunk-processed');
      expect(events).toContain('completed');
    });

    it('should emit stall-detected and filler-injected events', async () => {
      const manager = new FlowManager({
        stallThresholdMs: 50,
        enableFillers: true,
        fillerPhrases: ['um'],
      });

      const events: string[] = [];
      manager.on((event) => {
        events.push(event.type);
      });

      manager.start();
      await new Promise((resolve) => setTimeout(resolve, 100));
      manager.processChunk('chunk1');
      manager.complete();

      expect(events).toContain('stall-detected');
      expect(events).toContain('filler-injected');
    });

    it('should emit interrupted event', () => {
      const manager = new FlowManager();
      const events: string[] = [];

      manager.on((event) => {
        events.push(event.type);
      });

      manager.start();
      manager.processChunk('chunk1');
      manager.interrupt();

      expect(events).toContain('interrupted');
      expect(manager.getState()).toBe(ConversationState.INTERRUPTED);
    });

    it('should allow listener removal', () => {
      const manager = new FlowManager();
      const listener = vi.fn();

      const unsubscribe = manager.on(listener);
      unsubscribe();

      manager.start();
      manager.complete();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('manual flow control', () => {
    it('should require start() before processing', () => {
      const manager = new FlowManager();

      expect(() => manager.processChunk('chunk')).toThrow('FlowManager not started');
      expect(() => manager.complete()).toThrow('FlowManager not started');
    });

    it('should throw if started twice', () => {
      const manager = new FlowManager();

      manager.start();
      expect(() => manager.start()).toThrow('FlowManager already started');
      manager.complete();
    });

    it('should track stats correctly', () => {
      const manager = new FlowManager();

      manager.start();
      manager.processChunk('chunk1');
      manager.processChunk('chunk2');
      manager.processChunk('chunk3');
      manager.complete();

      const stats = manager.getStats();
      expect(stats.chunksProcessed).toBe(3);
      expect(stats.firstChunkTime).toBeGreaterThanOrEqual(0);
      expect(stats.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should manage buffer correctly', () => {
      const manager = new FlowManager({ bufferSize: 5 });

      manager.start();
      manager.processChunk('chunk1');
      manager.processChunk('chunk2');

      expect(manager.getBufferedChunks()).toEqual(['chunk1', 'chunk2']);

      manager.interrupt();
      expect(manager.getBufferedChunks()).toEqual([]); // Buffer cleared
      manager.complete();
    });
  });

  describe('interrupt handling', () => {
    it('should stop processing after interrupt', () => {
      const manager = new FlowManager();
      const events: string[] = [];

      manager.on((event) => {
        events.push(event.type);
      });

      manager.start();
      manager.processChunk('chunk1');
      manager.interrupt();
      manager.processChunk('chunk2'); // Should be ignored

      const chunkEvents = events.filter((e) => e === 'chunk-processed');
      expect(chunkEvents).toHaveLength(1); // Only first chunk
    });

    it('should clear buffer on interrupt', () => {
      const manager = new FlowManager();

      manager.start();
      manager.processChunk('chunk1');
      manager.processChunk('chunk2');

      expect(manager.getBufferedChunks()).toHaveLength(2);

      manager.interrupt();
      expect(manager.getBufferedChunks()).toHaveLength(0);
      manager.complete();
    });
  });
});

describe('Integration: FlowController with BufferManager', () => {
  it('should buffer chunks and clear on interrupt', async () => {
    const controller = new FlowController();

    async function* mockStream() {
      yield 'chunk1';
      yield 'chunk2';
      controller.interrupt();
      yield 'chunk3'; // Should not be processed
    }

    const chunks: string[] = [];
    for await (const chunk of controller.wrap(mockStream())) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['chunk1', 'chunk2']);
    expect(controller.getBufferedChunks()).toEqual([]); // Cleared on interrupt
  });

  it('should allow access to buffered chunks', async () => {
    const controller = new FlowController();

    async function* mockStream() {
      yield 'chunk1';
      yield 'chunk2';
      yield 'chunk3';
    }

    const chunks: string[] = [];
    for await (const chunk of controller.wrap(mockStream())) {
      chunks.push(chunk);
      // Check buffer is being populated
      expect(controller.getBufferedChunks().length).toBeGreaterThan(0);
    }

    expect(chunks).toEqual(['chunk1', 'chunk2', 'chunk3']);
  });
});
