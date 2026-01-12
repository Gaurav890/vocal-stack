# Monitoring Example

This example demonstrates how to use the **VoiceAuditor** module to track performance metrics, monitor latency, and export data for analysis.

## What it demonstrates

- Automatic stream tracking with wrapper
- Manual tracking for fine-grained control
- Real-time metric callbacks
- Summary statistics (averages, percentiles)
- Data export (JSON, CSV)
- Performance comparison between providers

## Key Concepts

### 1. Automatic Tracking

Wrap any async iterable to automatically track metrics:

```javascript
const auditor = new VoiceAuditor();

for await (const chunk of auditor.track('request-id', llmStream)) {
  sendToTTS(chunk);
}

// Metrics are automatically recorded
```

### 2. Real-time Callbacks

Get notified when tracking completes:

```javascript
const auditor = new VoiceAuditor({
  enableRealtime: true,
  onMetric: (metric) => {
    console.log(`TTFT: ${metric.metrics.timeToFirstToken}ms`);
  },
});
```

### 3. Manual Tracking

For more control:

```javascript
auditor.startTracking('my-request');
// ... processing ...
auditor.recordToken('my-request');  // First token
// ... more processing ...
auditor.recordToken('my-request');  // Additional tokens
const metric = auditor.completeTracking('my-request');
```

### 4. Summary Statistics

Get aggregate metrics across all requests:

```javascript
const summary = auditor.getSummary();

console.log(summary.avgTimeToFirstToken);  // Average TTFT
console.log(summary.p95TimeToFirstToken);  // 95th percentile TTFT
console.log(summary.avgTotalDuration);     // Average duration
```

### 5. Export Data

Export metrics for analysis:

```javascript
const json = auditor.export('json');  // For programmatic use
const csv = auditor.export('csv');    // For spreadsheets
```

## How to Run

1. Install dependencies:
```bash
npm install
```

2. Run the example:
```bash
npm start
```

## Expected Output

You'll see four examples:
1. Multiple requests tracked automatically with real-time callbacks
2. Manual tracking with step-by-step token recording
3. Metric export in JSON and CSV formats
4. Performance comparison between fast and slow providers

## Metrics Tracked

- **Time to First Token (TTFT)** - Latency from start to first chunk
- **Total Duration** - Complete processing time
- **Token Count** - Number of chunks received
- **Average Token Latency** - Mean time per token

## Use Cases

- Monitor LLM API performance
- Compare different TTS providers
- Track improvements over time
- Identify performance bottlenecks
- Generate reports for stakeholders
- A/B testing different configurations

## Next Steps

- Try `04-full-pipeline` to combine monitoring with sanitization and flow control
- Use CSV export to analyze trends in Google Sheets or Excel
