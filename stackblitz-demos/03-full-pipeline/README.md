# Interactive v2 reliability demo

[Open the live demo in StackBlitz](https://stackblitz.com/github/Gaurav890/vocal-stack/tree/main/stackblitz-demos/03-full-pipeline)

No API key or account setup is required. The demo streams mock model deltas through the v2
reliability layer:

```text
model deltas → normalizer → segmenter → TTS → playback acknowledgement
```

Use **Run complete turn** to see the normal path. Start it again and select **Interrupt for
barge-in** while deltas are arriving to compare:

- generated characters from the model source;
- speakable segments emitted for TTS;
- characters confirmed as played; and
- the reconstructed text the listener actually heard.

The same screen shows incremental Markdown and URL normalization, a pre-speech cue request,
provider-neutral turn metrics, and the distinct `completed` and `interrupted` outcomes.

After either outcome, use **Download trace** to save the versioned event timeline or **Replay last
trace** to reproduce it immediately against a virtual clock. **Upload trace** accepts JSON and JSONL
files from another run. Replay makes no model, TTS, or network calls. The demo opts into its public
mock text; production trace recording omits speech text by default.

## Run locally

```sh
npm install
npm run dev
```

The repository's `npm run examples:check` command replaces the npm dependency with a freshly packed
local artifact and runs a production build. Playwright also exercises both completion and barge-in
paths in Chromium, Firefox, and WebKit.

The demo is intentionally provider-free. Replace the mock source and simulated playback step with
the model, TTS, and audio player used by your application.
