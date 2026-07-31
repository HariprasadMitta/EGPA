import { prisma } from "@/lib/prisma";

export async function logToolCall(entry: {
  executionId: string;
  stepId: string;
  toolName: string;
  argsJson: string;
  result: string;
}): Promise<void> {
  await prisma.toolCallLog.create({
    data: {
      executionRunId: entry.executionId,
      stepId: entry.stepId,
      toolName: entry.toolName,
      argsJson: entry.argsJson,
      // Guard against an unexpectedly huge tool result bloating the row.
      result: entry.result.slice(0, 4000),
    },
  });
}
