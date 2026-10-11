# Index Metrix ⚡ — Fast URL & Backlink Indexer for Google

Index Metrix is a high-speed, multi-tier URL and backlink indexing acceleration platform with official **Google Search Console API** integration.

---

## 🚀 Key Modules & Architecture

### 1. ⚡ Bulk URL & Backlink Submitter (Any Webpage / Third-Party Backlink)
* **High-Speed Queue:** Submit up to **200 URLs** per batch.
* **Automatic Deduplication & Validation:** Strips duplicate links and validates URL structure.
* **Multi-Tier Crawl Syndication:**
  * **Google WebSub Hub:** `https://pubsubhubbub.appspot.com/publish`
  * **Google XML-RPC:** `http://blogsearch.google.com/ping/RPC2`
  * **IndexNow Protocol:** `https://api.indexnow.org/indexnow`
  * **Googlebot Crawl Gateway:** Dynamic feed `/crawl-hub` & `/feed.xml` with microdata schema.
* **Truthful Status Reporting:** Reports links as `Processed` in priority crawl pipelines. Third-party unowned links are accurately marked as `Unverified` (preventing false "Indexed" claims).

### 2. 🔍 Google Search Console API (Authorized Properties)
* **Secure OAuth 2.0 Flow:** Connect with Google using official Google consent and disconnect anytime.
* **Property Scoping:** Fetches and displays only properties verified in the user's Search Console account (`sc-domain:...` or `https://...`).
* **Official URL Inspection API:** Real-time inspection via `https://searchconsole.googleapis.com/v1/urlInspection/index:inspect`.
  * Returns accurate Google statuses: `Indexed`, `Not Indexed`, `Failed`, or `Pending`.
  * **Strict Scoping Enforcement:** Disallows inspecting URLs that do not belong to the selected verified property.
* **Sitemaps Manager:** View submitted sitemaps, error counts, and submit new sitemaps (`sitemaps.submit`).

---

## 🔑 How to Setup Google Search Console OAuth 2.0

### Step 1: Create OAuth Credentials in Google Cloud Console
1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Select your project (or create a new one).
3. Go to **APIs & Services > Library**, search for and **Enable**:
   * **Google Search Console API** (Search Console API)
4. Go to **APIs & Services > OAuth consent screen**:
   * Select **External** (or Internal for Google Workspace).
   * Enter App name: `Index Metrix`.
   * Add scopes:
     * `.../auth/webmasters.readonly`
     * `.../auth/webmasters`
     * `openid`, `email`, `profile`
   * Add your Google account under **Test users**.
5. Go to **APIs & Services > Credentials**:
   * Click **Create Credentials > OAuth client ID**.
   * Application type: **Web application**.
   * Name: `Index Metrix Web Client`.
   * **Authorized redirect URIs:** Add `https://indexmetrix.vercel.app/auth/google/callback` and `http://localhost:3000/auth/google/callback`
   * Click **Create** and copy your **Client ID** and **Client Secret**.

### Step 2: Configure Environment Variables
Open or create `.env` in the project root:
```env
PORT=3000
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
APP_SECRET=instant_indexing_secret
```

### Step 3: Run the Application
```bash
# Double-click start.bat OR run via terminal:
npm start
```
Open **`http://localhost:3000`** in your browser, switch to the **Google Search Console** tab, and click **Connect Google Search Console**!
