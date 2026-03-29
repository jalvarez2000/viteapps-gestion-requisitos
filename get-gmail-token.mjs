/**
 * get-gmail-token.mjs
 * One-time script to obtain Gmail OAuth2 refresh token.
 *
 * Prerequisites:
 *   1. Create a Google Cloud project
 *   2. Enable Gmail API
 *   3. Create OAuth2 credentials (Desktop App)
 *   4. Fill in CLIENT_ID and CLIENT_SECRET below
 *
 * Usage:
 *   node get-gmail-token.mjs
 */

import { createServer } from "http";

// ─── FILL THESE IN (or set GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET as env vars) ─
const CLIENT_ID =
  process.env.GMAIL_CLIENT_ID ?? "YOUR_CLIENT_ID_HERE";
const CLIENT_SECRET =
  process.env.GMAIL_CLIENT_SECRET ?? "YOUR_CLIENT_SECRET_HERE";
// ─────────────────────────────────────────────────────────────────────────────

const REDIRECT_URI = "http://localhost:3333/callback";
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.modify",
].join(" ");

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth" +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  "&response_type=code" +
  `&scope=${encodeURIComponent(SCOPES)}` +
  "&access_type=offline" +
  "&prompt=consent";

console.log("\n📧 Gmail OAuth2 Token Generator\n");
console.log("1. Open this URL in your browser:\n");
console.log(authUrl);
console.log(
  "\n2. Sign in as viteappsbreizh@gmail.com (the app mailbox account)."
);
console.log("3. Grant all requested permissions.");
console.log(
  "4. You will be redirected to localhost — this script will capture the code.\n"
);

// Start a temporary local server to capture the OAuth callback
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:3333");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.end(`<h1>Error: ${error}</h1>`);
    console.error("\n❌ OAuth error:", error);
    server.close();
    return;
  }

  if (!code) {
    res.end("<h1>No code received</h1>");
    server.close();
    return;
  }

  res.end("<h1>✅ Authorization successful! Check your terminal.</h1>");

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();

  if (tokens.error) {
    console.error(
      "\n❌ Token exchange error:",
      tokens.error_description ?? tokens.error
    );
    server.close();
    return;
  }

  console.log("\n✅ Tokens obtained!\n");
  console.log("Add these to your .env.local (apps/api and apps/app):\n");
  console.log(`GMAIL_CLIENT_ID=${CLIENT_ID}`);
  console.log(`GMAIL_CLIENT_SECRET=${CLIENT_SECRET}`);
  console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log("\nAlso set:");
  console.log("GMAIL_TARGET_ADDRESS=viteappsbreizh@gmail.com\n");

  if (!tokens.refresh_token) {
    console.warn(
      "⚠️  No refresh_token returned. This usually means the account already has a token.\n" +
        "   Revoke access at https://myaccount.google.com/permissions and run this script again."
    );
  }

  server.close();
});

server.listen(3333, () => {
  console.log("⏳ Waiting for OAuth callback on http://localhost:3333 ...\n");
});
