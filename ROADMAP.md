# Public roadmap

`vocal-stack` 2.0.0 is the current stable release. Near-term work is focused on proving the API in
real applications, tightening documentation, and collecting integration evidence before expanding
the core.

## Now: release validation

- Add a repeatable post-release smoke check for the public registry artifact.
- Dogfood the published package in the AI SDK, OpenAI Realtime, LiveKit, and Deepgram recipes.
- Run the package in three external TypeScript voice projects and collect structured feedback.
- Confirm browser behavior in downstream bundlers, not only the repository smoke fixture.
- Document integration problems as reproducible scenarios or chunk-boundary fixtures.

## Next: contributor and release experience

- Configure npm trusted publishing with provenance and an explicit GitHub release approval step.
- Make every README and provider recipe executable in CI.
- Add focused integration examples based on real adopter feedback.
- Publish patch releases for confirmed correctness, typing, packaging, or documentation issues.
- Define the v2 support policy after the first external integrations complete.

## Later: feedback-driven capabilities

Potential work must be justified by multiple real integrations:

- Additional playback acknowledgement strategies for audio players with coarse progress events.
- More reusable failure and interruption scenarios.
- Additional generic telemetry exporters that preserve the content-free default.
- Segmentation policies for languages and providers not covered by current fixtures.

Provider SDKs should remain in recipes rather than the core runtime.

## Ninety-day proof targets

- Three external working integrations with structured feedback.
- 250 monthly npm downloads and 15 GitHub stars.
- Three substantive external issues or discussions.
- One merged external code, documentation, scenario, or recipe contribution.

## Not planned

VAD, STT/TTS clients, WebRTC, telephony, audio DSP, semantic end-of-turn detection, model
orchestration, and hosted dashboards remain outside the package.
