# Contributing

Contributions are welcome, especially real integration reports, chunk-boundary fixtures, failure
scenarios, provider recipes, and documentation corrections.

## Setup

Use Node.js 24 (`nvm use`), then run:

```sh
npm ci
npm run check
```

Browser smoke tests require Playwright browsers:

```sh
npx playwright install chromium firefox webkit
npm run build
npm run test:browser
```

## Pull requests

- Add a regression test before or with every behavior fix.
- Keep the core package provider-neutral and free of runtime dependencies.
- Do not add transcript, prompt, tool-argument, or speech content to default telemetry.
- Preserve v1 compatibility exports throughout v2.
- Include reproducible benchmark code for any performance claim.
- Explain which interruption, failure, browser, or provider path was exercised.

Please keep changes focused and use a changeset for user-visible behavior.
