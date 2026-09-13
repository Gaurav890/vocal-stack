## What changed

Describe the behavior or documentation changed by this pull request.

## Why

Explain the voice-pipeline problem or contributor need this addresses. Link a reproducible issue or
scenario when available.

## Verification

- [ ] `npm run check` passes locally.
- [ ] New or changed behavior has a regression test.
- [ ] Streaming behavior is tested across meaningful chunk boundaries.
- [ ] Interruption or failure paths settle without pending timers or unhandled rejections.
- [ ] Package behavior or public API changes include a changeset; otherwise this is not applicable.

## Package guarantees

- [ ] The core remains provider-neutral and has no runtime dependencies.
- [ ] Default telemetry contains no prompts, transcripts, tool arguments, or speech text.
- [ ] Existing v2 and deprecated v1 entry points remain compatible, or the change is clearly
      documented.
- [ ] Any performance claim has a checked-in reproducible benchmark.
