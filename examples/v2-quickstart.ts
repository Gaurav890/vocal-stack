import { countSpeechCharacters } from 'vocal-stack/text';
import { createVoicePipeline } from 'vocal-stack/turn';

async function* modelText(signal: AbortSignal): AsyncIterable<string> {
  for (const delta of ['Let me ', 'check [the guide](https://example.com).']) {
    if (signal.aborted) return;
    yield delta;
  }
}

export async function runQuickstart(playSegment: (text: string) => Promise<void>): Promise<string> {
  const pipeline = createVoicePipeline({ stallCues: { enabled: false } });
  const turn = pipeline.startTurn({ id: 'quickstart', source: modelText });

  for await (const event of turn.events) {
    if (event.type !== 'speech.segment') continue;
    await playSegment(event.segment.text);
    turn.acknowledgePlayback({
      segmentId: event.segment.id,
      charactersPlayed: countSpeechCharacters(event.segment.text),
    });
  }

  return (await turn.result).heardText;
}
