# 部落格草構

記錄研究歷程與生活軼事的個人網站。公開網站由 GitHub Pages 提供；日常發文使用獨立的 Cloudflare 手機後台。

- **公開網站**：<https://typeconflict.github.io/>
- **Repository**：<https://github.com/TypeConflict/typeconflict.github.io>

## 日常使用

透過製作一個後台發文系統來簡化記錄的過程，以便較為直觀地隨想隨記。

<img width="999" height="683" alt="截圖 2026-11-24 下午5 54 46" src="https://github.com/user-attachments/assets/ac3be623-c983-4eb2-83c6-9f5b6a5795cb" />

| 類型 | 用途 | 內容 |
| --- | --- | --- |
| Note | 短筆記 | 文字、Tags |
| Blog | 長文章 | 標題、摘要、簡易 Markdown、Tags |
| Photo | 照片記錄 | 每篇一張照片、說明、Tags |

發布後，後台會直接提交 `main` 上的 `content.json`；照片另存於 `assets/photos/`。GitHub Pages 完成部署後，讀者才會看到更新。首頁 Latest snapshot 會選日期最新的照片貼文，使用其第一張圖片。歷史多張照片貼文仍會在 Photos 顯示所有圖片。

**已發布內容跨裝置共用；手機後台的未發布草稿不會自動儲存或同步。** 發布與讀取內容需要網路。Projects 目前須直接修改 `content.json`，尚未提供專用後台表單。

完整操作與替代編輯入口見 [發布指南](docs/publishing.md)。

## 專案結構

```text
.
├── index.html             公開網站骨架與導覽
├── app.js                 頁面、內容渲染、簡易 Markdown、舊本機編輯器
├── styles.css             公開網站外觀與響應式排版
├── content.json           Blog / Notes / Photos / Projects 的發布資料
├── assets/                公開圖示、示意圖與照片
│   └── photos/
├── admin.html / .css / .js 備用 PAT 發布介面（沿用既有網址）
├── mobile-worker/         Cloudflare 登入與手機後台
│   ├── public/            後台介面、PWA、service worker
│   ├── src/index.js       登入、session、讀取、上傳、發布 API
│   ├── test/              前端與 Worker 自動測試
│   ├── schema.sql         D1 登入資料表
│   └── wrangler.toml      公開設定範本
├── docs/publishing.md      發布流程與限制
├── legacy/mkdocs/         舊 MkDocs 原文、設定與既有產物
├── PUBLISHING.md           舊文件入口，導向目前發布指南
└── .nojekyll               GitHub Pages 靜態檔案標記
```

現行網站不需要 MkDocs。歷史資料集中於 `legacy/mkdocs/`，沒有自動匯入 `content.json`；既有 `docs/`、`site/` 路徑已搬移。舊版產物僅供參考，不再用於部署。

## 想調整什麼，改哪裡？

| 調整項目 | 檔案／位置 |
| --- | --- |
| 網站名稱、導覽、頁尾 | `index.html` |
| 首頁介紹、Currently、Topics、About 文案 | `app.js` 的 `home()`、`about()` |
| 公開網站配色、字體、卡片、手機排版 | `styles.css` |
| 文章與 Projects 資料 | 後台，或 `content.json` |
| 後台欄位與版面 | `mobile-worker/public/index.html`、`style.css` |
| 後台互動、照片壓縮 | `mobile-worker/public/client.js` |
| 登入、權限檢查、發布規則 | `mobile-worker/src/index.js` |
| 後台名稱、主畫面圖示 | `mobile-worker/public/manifest.webmanifest`、`icon.svg` |

## 本機預覽與檢查

公開網站不需要安裝前端套件。在 repo 根目錄執行：

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

開啟 <http://localhost:8080/>。使用 HTTP 預覽，避免直接以 `file://` 開啟造成 JSON 讀取失敗。按 `Ctrl+C` 停止。

後台測試使用 Node.js 22 或更新版本，不需要真實憑證或安裝測試套件：

```sh
cd mobile-worker
npm test
```

## 部署分成兩部分

**公開網站**：預期 GitHub Pages 設為 `main` 分支、`/(root)`。內容或外觀變更合併至 `main` 後，檢查 GitHub 的部署結果。不要用舊版 `mkdocs gh-deploy` 覆蓋目前網站。

**手機後台**：Cloudflare Worker 獨立部署。合併 repo 不會自動更新 Worker，目前未設定 GitHub 到 Cloudflare 的自動部署。設定、D1、Secrets 與保留網頁變數的部署方法，見 [後台維護文件](mobile-worker/README.md)。

## 憑證與資料邊界

GitHub App 的 access／refresh token 在 Worker 端使用 AES-GCM 加密後保存在 D1；瀏覽器只持有 HttpOnly、Secure、SameSite=Lax 的隨機 session cookie。寫入 API 會檢查同源請求；內容更新使用 SHA 檢查，避免舊畫面覆寫另一台裝置的修改。

`GH_CLIENT_SECRET`、`ENCRYPTION_KEY` 只設在 Cloudflare Secrets。PAT、`.pem` 私鑰、`.env`、`.dev.vars`、本機部署設定與個人說明書不可提交公開 repo。`.gitignore` 是防誤加措施，不會替已外洩的憑證撤銷權限。

發布內容與照片是公開資料。刪除貼文只會移除資料中的引用，不會抹除照片檔案或 Git 歷史。
