import { createVoicePipeline, type VoiceTextSource } from 'vocal-stack/turn';

export const fluxPipeline = createVoicePipeline({
  text: { mode: 'source' },
  stallCues: { enabled: false },
});

export function sourceForFlux(
  text: AsyncIterable<string>,
  cancelFlux: (reason: unknown) => void
): VoiceTextSource {
  return (signal) => ({
    async *[Symbol.asyncIterator]() {
      const iterator = text[Symbol.asyncIterator]();
      const abort = () => {
        try {
          cancelFlux(signal.reason);
        } catch {
          // Local interruption must not depend on a provider socket still being writable.
        }
        try {
          const returned = iterator.return?.();
          if (returned) void Promise.resolve(returned).catch(() => {});
        } catch {
          // Upstream iterator cancellation is best-effort.
        }
      };
      signal.addEventListener('abort', abort, { once: true });
      try {
        while (!signal.aborted) {
          const next = await iterator.next();
          if (next.done || signal.aborted) return;
          yield next.value;
        }
      } finally {
        signal.removeEventListener('abort', abort);
      }
    },
  });
}
