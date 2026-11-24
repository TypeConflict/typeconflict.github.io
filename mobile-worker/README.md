# Corner Mobile Publish Studio

GitHub App 登入的手機／電腦發文後台，部署在 Cloudflare Workers。公開網站仍在 GitHub Pages。

- 後台：<https://corner-publish-studio.irene-qh-yan.workers.dev/>
- 公開網站：<https://typeconflict.github.io/>
- Repo：`TypeConflict/typeconflict.github.io`，內容寫入 `main`
- GitHub App：`blog-mobile-studio`

## 目前狀態

2026-11-24 已部署；真實 Safari 確認登入、辨識帳號及載入既有內容，GitHub 已有後台發布 Note 的紀錄。這次整理將已部署的修正同步回版本控制：User-Agent、PKCE、跨裝置 SHA 檢查、可在 GitHub 憑證失效時登出、表單 `reset` 名稱衝突修正，以及可見的內容載入錯誤。

15 項本機自動測試通過，但仍使用模擬 GitHub／D1。手機安裝、照片／Blog 寫入、真實 token refresh 及長期多裝置使用仍需驗收。尚未提供自動儲存、草稿同步、離線發布或背景發布。

## 檔案與資料流

- `public/index.html`、`style.css`、`client.js`：介面與發布流程。
- `public/manifest.webmanifest`、`icon.svg`、`sw.js`：可安裝的 PWA 外殼；API 和登入請求不做離線快取。
- `src/index.js`：GitHub OAuth、session、讀寫 GitHub 的 API。
- `schema.sql`：D1 `sessions` 表及到期索引。
- `test/`：Worker 與前端回歸測試。
- `wrangler.toml`：共用範本；資料庫 ID 是待填的 placeholder，不能直接當作本機部署完成設定。
- `wrangler.local.toml`：每台電腦私有部署設定，已忽略，不會提交。

瀏覽器經 GitHub OAuth（state + S256 PKCE）登入，Worker 檢查允許的帳號及 repository 存取。Access／refresh token 使用 AES-GCM 加密後放入 D1，session ID 雜湊後儲存；瀏覽器只收隨機的 HttpOnly Secure SameSite=Lax cookie，期限最長 30 天。

讀取與發布透過 GitHub Contents API；寫入限同源 POST 且含自訂標頭。前端帶上讀取時的 content SHA，過期版本回傳 409。照片上傳和貼文提交是兩次 GitHub 寫入。

## 已有部署的維護方式

在 repo 根目錄：

```sh
cd mobile-worker
npm test
```

首次在另一台電腦部署時，複製範本：

```sh
cp wrangler.toml wrangler.local.toml
```

編輯 **本機** `wrangler.local.toml`：將 `database_id` 換成 Cloudflare D1 控制台中 `corner-studio-sessions` 的 ID。確認 Worker `name` 為 `corner-publish-studio`，保留 `keep_vars = true`；不要在設定檔填入 Secrets。

本專案最近使用 Wrangler `4.167.0`。以下命令會在需要時下載官方工具：

```sh
npx wrangler@4.167.0 login
npx wrangler@4.167.0 deploy --config wrangler.local.toml --keep-vars
```

`--keep-vars` 保留 Cloudflare 控制台設定的文字變數；Secrets 也保留。不要用含假 `GH_CLIENT_ID` 的舊設定覆寫現在的值。僅修改 README 或歷史目錄不需要部署 Worker。

目前沒有自動部署：更新 GitHub 檔案不等於 Cloudflare 已更新。應先測試，再從要部署的正確分支部署；正式維護建議合併後從最新 `main` 發布。

## 新建環境的必要設定

| 位置 | 名稱 | 用途 |
| --- | --- | --- |
| Cloudflare Text | `GH_CLIENT_ID` | GitHub App 的 Client ID，不是 App ID |
| Cloudflare Text | `ALLOWED_LOGIN` | 授權的 GitHub 帳號，目前為 `TypeConflict` |
| Cloudflare Secret | `GH_CLIENT_SECRET` | GitHub App Client Secret |
| Cloudflare Secret | `ENCRYPTION_KEY` | 32 隨機 bytes 的 base64，供 AES-GCM 使用 |
| Cloudflare D1 binding | `DB` | 連接 `corner-studio-sessions` |
| Worker assets binding | `ASSETS` | Wrangler 依設定上傳 `public/` 後自動連接 |

這些 Secret 不應放在 repo、聊天、截圖或瀏覽器儲存。加密金鑰可在本機以 `openssl rand -base64 32` 產生，輸出只填入 Cloudflare Secret 與密碼管理器。更換會使現有 session 無法解密；目前沒有自動金鑰輪替流程。

GitHub App 只安裝於這個 repo，Repository permissions 為 Contents Read and write（及預設 Metadata 讀取）。啟用會過期的 user authorization tokens。Webhook 不啟用。實際登入回呼為：

```text
https://corner-publish-studio.irene-qh-yan.workers.dev/auth/callback
```

GitHub 若要求建立私鑰才能安裝，可依其提示建立並私人保存 `.pem`；這份程式使用使用者 OAuth 流程，不需把私鑰上傳 Worker。

首次建立資料庫與資料表（既有環境不要重建資料庫）：

```sh
npx wrangler@4.167.0 d1 create corner-studio-sessions
# 把回傳的 ID 填入本機設定，再執行：
npx wrangler@4.167.0 d1 execute corner-studio-sessions --remote --file=schema.sql --config wrangler.local.toml
```

## 修改後的檢查

1. 執行 `npm test`，再檢查 Worker／client／service worker 的語法。
2. 修改 client 時更新 `index.html` 的 script 版本參數，並同步 `sw.js` 的 cache 名稱和預快取網址，避免舊裝置沿用舊檔。
3. 表單控制項的 `id`／`name` 不要使用 `reset`、`submit` 等會遮蔽原生方法的名稱。測試不要只用假的 DOM；也要在真實瀏覽器開啟。
4. 部署後確認登入帳號、既有文章、Note／Blog／Photo、關閉重開和登出。測試發布會產生公開內容，請使用願意公開的文字與圖片。
5. 無法登入時，從首頁重新開始，不要重新整理含一次性授權碼的 callback。

## 已知邊界

- 同一 session 同時 refresh 尚未序列化，可能導致 refresh token 輪替衝突；此部分仍待強化。
- 到期 session 不會被自動定時清理；登入時會拒絕使用到期紀錄。
- 刪除貼文不會移除照片檔案或 Git 歷史；上傳失敗也可能留下孤立檔案。
- 後台編輯歷史多圖貼文會只帶入第一張；新貼文規則是一張，不要用此表單重新儲存需保留多圖的舊資料。
- 這是 repo 寫入服務，需保護 Cloudflare 與 GitHub 帳戶。ALLOWED_LOGIN 並不能取代 GitHub App 的 repo 授權限制。

## 參考

- [GitHub App user access token 與 PKCE](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
- [GitHub REST API 必要的 User-Agent](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api#user-agent-required)
- [Wrangler 設定](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Cloudflare Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/get-started/)
