# V2 reliability pipeline demo

This browser demo streams mock model deltas through the v2 reliability layer and displays:

- incremental Markdown, URL, image, and fenced-code normalization;
- balanced speech segments;
- an explicit pre-speech stall cue;
- confirmed playback acknowledgements; and
- content-free turn metrics.

## Run locally

```sh
npm install
npm run dev
```

The repository's `npm run examples:check` command replaces the package dependency with a freshly
packed local tarball and runs a production build.

## Pipeline

```text
model deltas → normalizer → segmenter → TTS/audio acknowledgement → metrics
```

The demo is intentionally provider-free. Replace the mock source and display-only TTS step with the
model, speech, and audio providers used by your application.
