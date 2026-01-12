import { VoiceAuditor } from 'vocal-stack/monitor';

console.log('=== Monitoring Example ===\n');

// Example 1: Automatic tracking with stream wrapper
console.log('Example 1: Automatic stream tracking\n');

async function* mockLLMStream(delayMs = 50) {
  const chunks = [
    'Hello ',
    'this ',
    'is ',
    'a ',
    'streaming ',
    'response.',
  ];

  // Simulate initial delay (time to first token)
  await new Promise(resolve => setTimeout(resolve, 120));

  for (const chunk of chunks) {
    yield chunk;
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}

const auditor = new VoiceAuditor({
  enableRealtime: true,
  onMetric: (metric) => {
    console.log(`[REALTIME] Request ${metric.id} completed:`);
    console.log(`  - Time to first token: ${metric.metrics.timeToFirstToken}ms`);
    console.log(`  - Total duration: ${metric.metrics.totalDuration}ms`);
    console.log(`  - Token count: ${metric.metrics.tokenCount}`);
  },
});

// Track first request
for await (const chunk of auditor.track('req-001', mockLLMStream())) {
  process.stdout.write(chunk);
}
console.log('\n');

// Track second request (faster)
for await (const chunk of auditor.track('req-002', mockLLMStream(30))) {
  process.stdout.write(chunk);
}
console.log('\n');

// Track third request (slower)
for await (const chunk of auditor.track('req-003', mockLLMStream(70))) {
  process.stdout.write(chunk);
}
console.log('\n\n');

// Get summary statistics
const summary = auditor.getSummary();
console.log('Summary Statistics:');
console.log(`  - Total requests: ${summary.count}`);
console.log(`  - Avg TTFT: ${summary.avgTimeToFirstToken.toFixed(2)}ms`);
console.log(`  - P95 TTFT: ${summary.p95TimeToFirstToken.toFixed(2)}ms`);
console.log(`  - Avg duration: ${summary.avgTotalDuration.toFixed(2)}ms`);
console.log(`  - P95 duration: ${summary.p95TotalDuration.toFixed(2)}ms`);
console.log();

// Example 2: Manual tracking (more control)
console.log('Example 2: Manual tracking\n');

const auditor2 = new VoiceAuditor();

// Start tracking
auditor2.startTracking('manual-001');

// Simulate processing
await new Promise(resolve => setTimeout(resolve, 80));

// Record first token
auditor2.recordToken('manual-001');
console.log('First token received');

// Continue processing
for (let i = 0; i < 5; i++) {
  await new Promise(resolve => setTimeout(resolve, 40));
  auditor2.recordToken('manual-001');
  console.log(`Token ${i + 2} received`);
}

// Complete tracking
const metric = auditor2.completeTracking('manual-001');
console.log('\nManual tracking result:');
console.log(`  - TTFT: ${metric.metrics.timeToFirstToken}ms`);
console.log(`  - Total duration: ${metric.metrics.totalDuration}ms`);
console.log(`  - Token count: ${metric.metrics.tokenCount}`);
console.log();

// Example 3: Exporting metrics
console.log('Example 3: Exporting metrics\n');

// Add more tracked requests
for (let i = 4; i <= 6; i++) {
  for await (const _chunk of auditor.track(`req-00${i}`, mockLLMStream())) {
    // Process silently
  }
}

// Export as JSON
const jsonExport = auditor.export('json');
console.log('JSON Export (first 500 chars):');
console.log(jsonExport.substring(0, 500) + '...\n');

// Export as CSV
const csvExport = auditor.export('csv');
console.log('CSV Export:');
console.log(csvExport);

// Example 4: Performance comparison
console.log('\nExample 4: Performance comparison\n');

const auditor3 = new VoiceAuditor();

// Fast provider
async function* fastProvider() {
  await new Promise(resolve => setTimeout(resolve, 50));
  for (let i = 0; i < 10; i++) {
    yield 'fast ';
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

// Slow provider
async function* slowProvider() {
  await new Promise(resolve => setTimeout(resolve, 150));
  for (let i = 0; i < 10; i++) {
    yield 'slow ';
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

// Test both
for await (const _chunk of auditor3.track('fast-provider', fastProvider())) {
  // Process
}

for await (const _chunk of auditor3.track('slow-provider', slowProvider())) {
  // Process
}

const metrics = auditor3.getMetrics();
const fastMetric = metrics.find(m => m.id === 'fast-provider');
const slowMetric = metrics.find(m => m.id === 'slow-provider');

console.log('Performance Comparison:');
console.log('\nFast Provider:');
console.log(`  - TTFT: ${fastMetric.metrics.timeToFirstToken}ms`);
console.log(`  - Total: ${fastMetric.metrics.totalDuration}ms`);
console.log(`  - Avg latency: ${fastMetric.metrics.averageTokenLatency.toFixed(2)}ms/token`);

console.log('\nSlow Provider:');
console.log(`  - TTFT: ${slowMetric.metrics.timeToFirstToken}ms`);
console.log(`  - Total: ${slowMetric.metrics.totalDuration}ms`);
console.log(`  - Avg latency: ${slowMetric.metrics.averageTokenLatency.toFixed(2)}ms/token`);

const improvement = ((slowMetric.metrics.timeToFirstToken - fastMetric.metrics.timeToFirstToken) / slowMetric.metrics.timeToFirstToken * 100).toFixed(1);
console.log(`\nFast provider is ${improvement}% faster for TTFT`);

console.log('\n=== Example Complete ===');
