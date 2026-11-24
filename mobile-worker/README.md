# Corner Mobile Publish Studio

A standalone, mobile-friendly **PWA** publisher for https://typeconflict.github.io/. The existing site stays on GitHub Pages; this separate Cloudflare Worker acts as an authenticated publishing companion.

**Status: implementation draft. Not deployed or browser-tested yet.** The OAuth App setup and Cloudflare resources require account-owner actions.

## Architecture

- PWA frontend served at the same origin as the Worker.
- GitHub App **user authorization** using OAuth web application flow, with short-lived access tokens and refresh tokens enabled.
- A GitHub login allowlist (`ALLOWED_LOGIN=TypeConflict`) prevents other users from obtaining editing sessions.
- Worker stores encrypted user access/refresh tokens in Cloudflare D1; browser receives only a random HttpOnly Secure SameSite=Lax session cookie.
- The Worker reads and updates `content.json` via the GitHub REST API and uploads compressed WebP images.
- The public website remains https://typeconflict.github.io; editor is hosted on your own Worker URL, for example `https://corner-publish-studio.<your-subdomain>.workers.dev`.
- GitHub Pages deployment continues to run asynchronously after successful GitHub commits.

## Setup (account owner; do not paste secrets into chat)

1. **Create the GitHub App**: GitHub → Settings → Developer settings → GitHub Apps → New GitHub App.
   - GitHub App name: choose a unique name.
   - Homepage URL: your final Worker URL.
   - Callback URL: `https://<your-worker-url>/auth/callback` (use your real host; the code derives this from the request origin).
   - Repository permissions: **Contents: Read and write**; no webhooks needed.
   - Under optional features, **enable expiring user authorization tokens**.
   - Install the app **only on** `TypeConflict/typeconflict.github.io`.
   - Note the **Client ID**, create a **Client Secret**. Do not commit or paste either secret into public files.
2. **Cloudflare**: create a free Cloudflare account and install Node.js locally. From `mobile-worker/`, run `npx wrangler login` followed by `npx wrangler d1 create corner-studio-sessions`. Copy the printed database ID into `wrangler.toml`.
3. Set `GH_CLIENT_ID` in `wrangler.toml` to the GitHub App Client ID. Verify `ALLOWED_LOGIN` matches your exact GitHub username.
4. Run `npx wrangler d1 execute corner-studio-sessions --remote --file=./schema.sql`.
5. Store secrets via `npx wrangler secret put GH_CLIENT_SECRET` and `npx wrangler secret put ENCRYPTION_KEY`. Generate the encryption key locally with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`; copy its output **only** to the secret prompt (do not share publicly). **Save this encryption key in a secure password manager**; changing it invalidates existing stored sessions.
6. Run `npx wrangler deploy` and note the actual workers.dev address. Return to GitHub App settings and confirm Homepage URL and Callback URL match this exact deployed origin. If your Cloudflare account uses a different workers.dev subdomain, use that, not a guessed example.
7. Visit the Worker URL → Sign in with GitHub → authorize the app → test one Note. On your phone, open the same address in Chrome/Safari → **Add to Home Screen** (Android also offers Install App).
8. After confirming one photo upload reaches Photos and the homepage latest-photo widget, you can revoke your old fine-grained PAT in GitHub Settings. The original `admin.html` remains as a fallback; use it only when required.

### Commands (PowerShell)

```powershell
cd mobile-worker
npx wrangler login
npx wrangler d1 create corner-studio-sessions
# Edit wrangler.toml: database_id and GH_CLIENT_ID
npx wrangler d1 execute corner-studio-sessions --remote --file=./schema.sql
npx wrangler secret put GH_CLIENT_SECRET
npx wrangler secret put ENCRYPTION_KEY
npx wrangler deploy
```

> The Worker has no login bypass. GitHub must recognize the installed App and the `TypeConflict` account. Do not deploy with broad repo access.

## Security and operational notes

- Sessions expire after 30 days; GitHub can require reauthorization sooner.
- GitHub App user refresh tokens rotate; logging in simultaneously on many devices may require reauthorization if older refresh tokens are invalidated. A future production hardening pass should serialize refreshes per user/session.
- Only use HTTPS. Browser session cookie is HttpOnly and never exposes GitHub credentials to JavaScript.
- The `ALLOWED_LOGIN` check is necessary but not a substitute for GitHub App repository permissions.
- `/api/publish` supports one image per Photo entry. It commits directly to `main` and never erases Git history.
- The Worker accepts only same-origin form writes with an additional request header. Do not grant access from arbitrary websites.
- Images are re-encoded to WebP in the browser (EXIF not retained), though visual location clues can remain.
- Image uploads and the final content commit are separate operations; failed publishing might leave orphan files.
- No off-line background publishing is implemented. The PWA shell can install, but writing requires internet access.
- Worker sessions contain highly privileged tokens: restrict Cloudflare account access, secure D1, and rotate/revoke GitHub credentials if compromised.
- The main repo `main` must allow authenticated commits.
- After pressing Publish, the GitHub commit is immediate but the public GitHub Pages website updates only when deployment finishes.

## Test checklist

- GitHub authorization and logout
- Refresh browser without losing login
- Create/edit/delete Note
- Create/edit Blog and inspect Markdown
- Upload/edit Photo from phone; verify one-image limit and sidebar
- Confirm errors on network interruption, invalid OAuth state, and an unauthorized GitHub account
- Confirm logout clears session cookie

## Known limitation

The Worker and frontend have **not** had end-to-end testing against a real GitHub App/Cloudflare environment, and some environment-specific configuration or security hardening may be needed before treating it as production.
