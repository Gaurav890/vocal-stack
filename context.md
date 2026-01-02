🤖 CLAUDE.md - vocal-stack Constitution
🎯 Project Vision
vocal-stack is a high-performance utility library for developers building Voice AI agents. It focuses on "The Last Mile": transforming LLM text into speech-optimized strings, managing latency with fillers, and handling barge-in logic. It is headless, framework-agnostic, and optimized for speed.[6]
🛠 Tech Stack
Runtime: Node.js (ESM)
Language: TypeScript (Strict Mode)
Bundler: tsup (Generates ESM & CJS)
Linter/Formatter: biome
Testing: vitest
Versioning: changesets
📁 Folder Structure
src/: Core logic
sanitizer/: Text processing and markdown stripping
flow/: Latency management and filler injection
monitor/: Latency auditing and profiling
index.ts: Public API entry point
tests/: Unit and integration tests (parallel to src)
docs/: Deep-dive architectural guides
📜 Coding Rules
Naming: Use PascalCase for classes, camelCase for functions/variables.
Exports: Prefer named exports over default exports.
Types: Always define interfaces for configuration objects. Use readonly for state properties.
Testing: Every new feature must have a .test.ts file in the same directory or the tests/ folder. Aim for 90%+ coverage.
Error Handling: Use custom error classes (e.g., VocalStackError) for predictable failure modes.
Async: Use Stream or AsyncIterable for text-processing utilities to minimize TTFT (Time to First Token).
🚀 Common Commands
Install: npm install[7]
Build: npm run build (runs tsup)
Test: npm test or npx vitest
Lint/Format: npm run lint or npx @biomejs/biome check --write .
Dev: npm run dev (watch mode)
💡 AI Guidance (Project Context)
Markdown Stripping: When working on the SpeechSanitizer, remember that TTS engines fail on URLs, code blocks, and complex punctuation. Focus on "Speakability."
Filler Logic: Fillers should be injected only when a stream stall is detected (>700ms). Never inject fillers if the first chunk of real data has already been sent.
Latency Profiling: The VoiceAudit tool should measure startTime to firstTokenReceived and firstTokenReceived to lastTokenReceived.