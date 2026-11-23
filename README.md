# Irene’s Corner — GitHub Pages edition

A lightweight static website for GitHub Pages, with Blog, Notes, Projects, Photos and an automatically updated latest-photo sidebar.

## Deploy to `TypeConflict/typeconflict.github.io`

1. Back up or create a branch first. Your repository currently contains MkDocs (`mkdocs.yml`, `docs/` and `site/`); this package does **not** need those files and does not delete them.
2. Upload **the contents** of this folder (`index.html`, `app.js`, `styles.css`, `content.json`, `assets/`, `.nojekyll`) to the **root of the repository**, not an enclosing folder.
3. Go to **Settings → Pages → Build and deployment**. Select **Deploy from a branch**, branch **main**, folder **/(root)**, then save. The site should appear at https://typeconflict.github.io/ after GitHub Pages finishes building.
4. Do not use `mkdocs gh-deploy` after switching to root deployment unless intentionally changing the site again.

## Publish your first note / article / photo

- Open https://typeconflict.github.io/#studio to prepare content locally. This is **not a login-protected backend** and does **not** publish directly.
- Click **Download content.json** in the editor.
- In GitHub, replace the root `content.json` file with the downloaded version and commit. Once Pages deploys, everyone sees the new content.
- Images selected in Studio are compressed and embedded as data URLs in `content.json`. Good for trying a few photos, **not recommended for a growing photography archive**; for larger galleries, put compressed `.webp`/`.jpg` files under `assets/photos/` and reference their paths in the JSON instead.
- Drafts are local to the browser. Export your JSON before clearing browser storage. The public editor is only a convenient draft tool, not a production CMS.

## Edit content without the editor

In `content.json`:

```json
{
  "blog": [{"id":"hello","title":"Hello","date":"2026-11-24T10:00:00+08:00","summary":"My first post","tags":["Writing"],"body":"## Hello\n\nA paragraph."}],
  "notes": [{"id":"note-1","date":"2026-11-24T10:00:00+08:00","text":"A quick note!","tags":[]}],
  "photos": [{"id":"photo-1","date":"2026-11-24T10:00:00+08:00","caption":"A bird at the wetlands","images":["assets/photos/bird.webp"],"tags":["Birds"]}],
  "projects": []
}
```

The photo with the newest `date` is automatically shown in the home sidebar. Use ISO 8601 date/time with timezone. Do not include private photo EXIF/geolocation unless you want to disclose it.

## Local preview

```bash
python -m http.server 8080
```

Open http://localhost:8080/. Do not open the file via `file://`, since `fetch('content.json')` may be blocked.

## Limitations & future upgrade

This is a deployable static site, **not** an authenticated cross-device publishing app. GitHub Pages does not provide a database or upload API. A future PWA editor can connect an authenticated GitHub OAuth flow or a server-backed CMS; do not place access tokens in public JavaScript.

Existing MkDocs notes in `docs/` are intentionally preserved in the repo but are not automatically displayed by this site; migrate them into `content.json` as desired.
