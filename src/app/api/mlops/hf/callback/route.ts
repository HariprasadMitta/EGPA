export const runtime = "nodejs";

function redirectToMlOps(request: Request, hash: string) {
  const url = new URL("/mlops", request.url);
  return Response.redirect(`${url.toString()}#${hash}`, 302);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return redirectToMlOps(request, `hf_error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return redirectToMlOps(request, `hf_error=${encodeURIComponent("Missing authorization code.")}`);
  }

  const clientId = process.env.HF_CLIENT_ID;
  const clientSecret = process.env.HF_CLIENT_SECRET;
  const redirectUri = process.env.HF_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return redirectToMlOps(
      request,
      `hf_error=${encodeURIComponent("Hugging Face OAuth is not configured on the server.")}`
    );
  }

  try {
    const tokenRes = await fetch("https://huggingface.co/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return redirectToMlOps(
        request,
        `hf_error=${encodeURIComponent(tokenData.error_description || "Hugging Face token exchange failed.")}`
      );
    }

    const accessToken = tokenData.access_token as string;

    let username: string | null = null;
    try {
      const whoamiRes = await fetch("https://huggingface.co/api/whoami-v2", {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (whoamiRes.ok) {
        const whoami = await whoamiRes.json();
        username = whoami.name ?? null;
      }
    } catch {
      // Non-fatal - the connection still works without a display name.
    }

    const hash = `hf_token=${encodeURIComponent(accessToken)}${
      username ? `&hf_user=${encodeURIComponent(username)}` : ""
    }`;
    return redirectToMlOps(request, hash);
  } catch (err) {
    return redirectToMlOps(
      request,
      `hf_error=${encodeURIComponent(`Hugging Face token exchange failed: ${(err as Error).message}`)}`
    );
  }
}
