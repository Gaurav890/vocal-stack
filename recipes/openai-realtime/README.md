# OpenAI Realtime telemetry

Pass each server lifecycle event to `recordOpenAiRealtimeEvent()`. The adapter reads both
`response_id` fields on delta events and the nested response ID/status on `response.created` and
`response.done`. A final response status of `cancelled` or `failed` is preserved in stage
telemetry; incomplete responses are conservatively recorded as failed stages.

Reference: [Realtime server events](https://platform.openai.com/docs/api-reference/realtime-server-events).
