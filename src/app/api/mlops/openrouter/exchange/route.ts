export const runtime = "nodejs";

interface ExchangeRequestBody {
  code: string;
  codeVerifier: string;
}

export async function POST(request: Request) {
  let body: ExchangeRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.code || !body.codeVerifier) {
    return Response.json({ error: "Missing code or codeVerifier." }, { status: 400 });
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/auth/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: body.code,
        code_verifier: body.codeVerifier,
        code_challenge_method: "S256",
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.key) {
      return Response.json(
        { error: data.error || "OpenRouter did not return a key for this code." },
        { status: 502 }
      );
    }

    return Response.json({ key: data.key });
  } catch (err) {
    return Response.json(
      { error: `OpenRouter key exchange failed: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}
