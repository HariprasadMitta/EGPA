// Minimal client-side Server-Sent-Events reader for our own `data: {...}\n\n`
// formatted streaming API routes (src/app/api/plan, src/app/api/execute-step).
export async function* readSseEvents(response: Response): AsyncGenerator<Record<string, unknown>> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const raw of events) {
      const line = raw.trim();
      if (!line.startsWith("data: ")) continue;
      try {
        yield JSON.parse(line.slice(6));
      } catch {
        // Skip a malformed event rather than crash the whole stream.
      }
    }
  }
}
