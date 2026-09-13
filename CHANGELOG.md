# vocal-stack

## 2.0.1

### Patch Changes

- 7512431: Improve the npm and GitHub documentation with a clearer quick start, package trust signals,
  provider recipe navigation, and an updated post-release roadmap. Compile the TypeScript quickstart
  against the packed artifact during release checks.

## 2.0.0

### Major Changes

- Add provider-neutral streaming normalization and Unicode-safe speech segmentation.
- Add independent voice turns with immediate barge-in settlement and playback acknowledgement.
- Add privacy-safe stage telemetry, normalized metrics, generic sinks, and JSON/JSONL export.
- Add virtual-clock scenarios for deterministic stall, failure, and interruption testing.
- Add `/text`, `/turn`, `/telemetry`, and `/testing` entry points while retaining v1 compatibility.
- Require Node.js 22 or newer and add ESM/CJS, type, browser, audit, and size release gates.

## 1.0.2

### Patch Changes

- Fix CI test reliability by implementing fake timers

## 1.0.0

### Major Changes

- First version of vocal-stack
