# GitHub Publish Studio

The publishing dashboard is available at `/admin.html` after this pull request is merged and Pages deploys.

## First-time setup

1. Visit https://github.com/settings/personal-access-tokens/new and create a **fine-grained personal access token**.
2. Choose your account, restrict repository access to **Only select repositories → TypeConflict/typeconflict.github.io**.
3. Under Repository permissions, enable **Contents: Read and write**. Do not grant broad permissions; give the token a short expiration.
4. Open https://typeconflict.github.io/admin.html on a trusted device, paste the token, and connect.
5. Choose Note, Blog or Photo, then publish. The editor writes `content.json` to branch `main` and uploads WebP images to `assets/photos/`. GitHub Pages then deploys the changes.

## Security

- The token lives in **page memory only** and is cleared from the input after connecting. Refreshing or closing the tab discards it.
- Never commit the token into this repository, `content.json`, screenshots or notes. Do not use the dashboard on shared computers.
- The dashboard is public HTML and does not have a password-protected server. Anyone can view the editor, but the GitHub API requires a valid token to publish.
- A fine-grained token can still modify or delete any file in the authorized repository, so keep expiration short and revoke it if compromised.
- To revoke, visit https://github.com/settings/personal-access-tokens.
- Use only the genuine `typeconflict.github.io` HTTPS domain before pasting a token.

## Behavior and limitations

- A new photo is resized in your browser (up to 1800px) and re-encoded as WebP, removing embedded EXIF metadata. This reduces file size but does **not** guarantee every privacy-sensitive detail in the image is removed (e.g. visible location clues).
- Only one new photo can be uploaded per post. Older multi-photo posts are still visible in the Photos gallery. Latest snapshot updates automatically because the homepage sorts published photo dates.
- Editing a photo post without selecting a new file preserves its images; selecting one new file replaces image references. Old uploaded files are **not** deleted automatically.
- Deleting a post removes it from `content.json` but does not erase uploaded photos or Git history.
- Uploads are separate GitHub commits. If the final `content.json` update fails, some orphan image files may remain. Retry publication or clean up manually.
- The `main` branch must allow direct writes. A future OAuth/server-side flow or a GitHub App could replace the personal token approach.
- The dashboard is an online browser editor, **not yet an installable PWA or native mobile app**.
- Updates from multiple devices should be sequential; the editor reloads content before every commit, but parallel writers may still cause a conflict.
- Content is public immediately after deployment. Do not use this editor to publish private material.

## Current public editor

The existing `/#studio` page is a *local* drafting/export tool. The new `/admin.html` is the direct GitHub publishing tool. They are intentionally separate.
