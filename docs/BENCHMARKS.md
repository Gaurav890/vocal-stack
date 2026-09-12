# Benchmarks

Run the checked-in benchmark after a production build:

```sh
npm run benchmark
```

The benchmark measures complete-string normalization and balanced segmentation over a fixed fixture
containing Markdown, a URL, an email address, punctuation, and emoji. Results depend on CPU, runtime,
and power state; use them to compare commits on the same machine, not as an end-to-end voice latency
claim.

Release notes should copy results here only with the date, runtime, platform, architecture, and
commit. Network and provider latency are intentionally excluded.
