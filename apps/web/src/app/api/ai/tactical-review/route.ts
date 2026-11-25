import { z } from "zod";
import {
  checkAiRateLimit,
  streamTacticalReview,
} from "@fm27/ai-analyst";
import { DualPhaseTacticSchema, PlayerSchema } from "@fm27/shared-types";

const RequestPayloadSchema = z.object({
  prompt: z.string().min(1).max(4000),
  tactic: DualPhaseTacticSchema,
  squad: z.array(PlayerSchema).optional(),
  previousInteractionId: z.string().max(256).optional(),
  tier: z.enum(["standard", "deep", "micro"]).default("standard"),
});

export async function POST(request: Request): Promise<Response> {
  const forwarded = request.headers.get("x-forwarded-for");
  const clientIp = forwarded?.split(",")[0]?.trim() || "local-client";
  const limit = checkAiRateLimit(`tactical-review:${clientIp}`, 25, 60_000);

  if (!limit.allowed) {
    return Response.json(
      { error: "Too many AI review requests. Please wait before retrying." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  let parsedBody: z.infer<typeof RequestPayloadSchema>;
  try {
    const json = (await request.json()) as unknown;
    parsedBody = RequestPayloadSchema.parse(json);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid request payload" },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const sendSse = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        for await (const chunk of streamTacticalReview(parsedBody)) {
          if (chunk.type === "delta") {
            sendSse("delta", {
              text: chunk.text ?? "",
              modelUsed: chunk.modelUsed,
              fallback: chunk.fallback,
            });
          } else if (chunk.type === "completed") {
            sendSse("done", {
              interactionId: chunk.interactionId ?? "",
              modelUsed: chunk.modelUsed,
              fallback: chunk.fallback,
            });
          }
        }
      } catch (err) {
        sendSse("error", {
          message: err instanceof Error ? err.message : "Stream interrupted",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
