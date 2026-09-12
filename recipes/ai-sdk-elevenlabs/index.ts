import { type LanguageModel, streamText } from 'ai';
import type { VoiceTextSource, VoiceTurn } from 'vocal-stack/turn';

export interface ElevenLabsSocket {
  send(data: string): void;
  close(): void;
}

export function sourceFromAiSdk(model: LanguageModel, prompt: string): VoiceTextSource {
  return (signal) =>
    streamText({
      model,
      prompt,
      abortSignal: signal,
    }).textStream;
}

export async function sendSegmentsToElevenLabs(
  turn: VoiceTurn,
  socket: ElevenLabsSocket
): Promise<void> {
  try {
    for await (const event of turn.events) {
      if (event.type === 'speech.segment') {
        socket.send(JSON.stringify({ text: event.segment.text }));
      }
    }
  } finally {
    try {
      socket.send(JSON.stringify({ text: '' }));
    } finally {
      socket.close();
    }
  }
}
