# NexAI

> AI-Powered Personal & Developer Workspace with Utility-Metered Billing.

NexAI is a personal knowledge and developer productivity workspace designed with real, token-based credit metering, personal library management with semantic RAG retrieval, structured document drafting, variable-driven prompt templating, and an administrative usage dashboard.

## Tech Stack

- **Client:** React, Vite, SCSS Modules, Zustand, React Router, Lucide Icons, Axios.
- **Server:** Node.js, Express, Mongoose (MongoDB), Zod, Pino logging, Helmet, CORS.
- **AI / Retrieval:** Google Gemini API, Pinecone Vector Database.
- **Billing:** Razorpay (Test Mode).

## Prerequisites

- Node.js >= 20.0.0 (check with `node -v` or use `nvm use`)
- npm >= 10.0.0
- MongoDB instance (local or MongoDB Atlas connection string)

## Quick Start

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure environment:**
   - Copy `server/.env.example` to `server/.env` and configure `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `GEMINI_API_KEY`.
   - Copy `client/.env.example` to `client/.env`.

3. **Run development servers:**

   ```bash
   npm run dev
   ```
   - Client: http://localhost:5173
   - Server: http://localhost:5000 (Health check: http://localhost:5000/api/health)

4. **Lint and format:**

   ```bash
   npm run lint
   npm run format
   ```

5. **Run test suite:**
   ```bash
   npm run test
   ```

## Development Progress

- [x] **Step 1: Scaffold & Design System** (`feature/scaffold`)
- [x] **Step 2: Authentication & Persistence** (`feature/auth`)
- [x] **Step 3: Backend Chat with SSE & Metering** (`feature/backend-chat`)
- [x] **Step 4: Chat UI & Real-Time Streaming** (`feature/chat-ui`)
  - Full-height responsive Chat workspace with collapsible conversation sidebar
  - Streaming fetch + ReadableStream SSE consumption with token/done/error parsing
  - Markdown rendering with Prism syntax highlighting and one-click code copying
  - Live CreditBadge updates in Topbar & Sidebar on stream completion
  - 402 Insufficient Credits handling with "Recharge to continue" banner and input locking
  - Generation abort (Stop button), typing indicator, smart auto-scrolling, and model picker (Flash/Pro)
- [x] **Step 5: Library & Semantic RAG** (`feature/library`)
  - Web link scraping (`cheerio`) and note categorization
  - AI-suggested titles, summaries, and tags with Gemini Flash
  - Suggest &rarr; Review &rarr; Confirm flow with live credit synchronization
  - Provider-agnostic Vector Database service (`vectorDb.service.js`) with Pinecone and local fallback
  - Dense embeddings via Gemini embedding models (`text-embedding-004`)
  - Semantic vector search merged with MongoDB text-ranking fallback
  - Library UI with tag filtering, search bar, skeleton loading, empty states, edit and delete dialogs
- [x] **Step 6: Unified Collapsible Sidebar, Minimalist Chat Canvas & Project Workspaces** (`feature/sidebar-and-hero-ui`)
  - Single responsive navigation sidebar (260px expanded / 64px compact icon rail) with localStorage persistence
  - Direct integration of `+ New chat`, live chat title filter, recents list with rename, pin, and delete actions
  - Role-gated primary navigation (Admin link strictly for `user.role === 'admin'`)
  - Gemini-inspired Hero state ("Where should we start?") with glowing floating prompt bar and starter suggestion chips
  - Web Speech API voice dictation with feature detection and pulsing animation
  - Model selection dropdown (Gemini 3.8 Flash / Gemini 3.1 Pro) and context file attachment trigger
  - Full-bleed edge-to-edge chat conversation canvas
  - **ChatGPT-Style Project Workspaces:**
    - Custom project instructions automatically prepended to Gemini system prompts
    - Local source file uploads (PDF, Markdown, code, JSON) injected as grounded knowledge base context (up to 50k chars per file)
    - Project Gallery (`/projects`) and workspace page (`/projects/:id`) with capacity tracker (2MB text quota)
    - Sidebar projects collapsible drawer with direct project-scoped chat initiation and chat movement
  - 114 tests passing across monorepo (60 backend, 54 frontend)
- [x] **Step 7: Prompt Vault & In-Chat Template Integration** (`feature/prompt-vault`)
  - Dedicated `/prompts` route with dynamic prompt template creation and syntax highlighting for `{{variables}}`
  - Variable fill modal with real-time preview and direct injection into chat
  - Favorite pinning, tag filtering, and instant search
- [x] **Step 8: Consolidated Library & Document Management** (`feature/consolidated-library`)
  - Polymorphic Library items (`link`, `note`, `document`, `file`, `interview`) with tabbed filtering
  - Structured AI document generation (`pdf-lib`) with PDF export and custom file attachment
  - Suggest -> Review -> Confirm workflow with reactive token deduction
- [x] **Step 9: AI Mock Interview Platform** (`feature/ai-interview`)
  - Dedicated `/interview` route with Role, Seniority, and Topic setup configuration
  - Interactive simulation arena with Gemini Senior Technical Lead / Viva Defense Examiner persona
  - Hardware-accelerated CSS `VoiceRipple` visualizer responding to candidate and AI speech
  - Web Speech API speech-to-text dictation and synthesized text-to-speech audio readout
  - Real-time SSE streaming responses with turn critique and progressive technical follow-ups
  - Comprehensive performance scorecard evaluation (0-100 rating, category breakdown, strengths, areas for improvement)
  - Automatic archival of completed scorecard and transcript into the Library under `type: 'interview'`
  - Metered with `creditCheck` and atomic token deduction ($\lceil \text{totalTokens} / 100 \rceil$)
  - 167 tests passing across monorepo (89 backend, 78 frontend)
- [x] **Step 10: Unified Search & Command Palette** (`feature/search`)
  - Dedicated `/search` route and global Command Palette (`Ctrl+K`)
  - Deep hybrid multi-collection search across Library, Prompts, and Chats
  - Scoped to authenticated user with category tab breakdowns and recent query memory
- [x] **Step 11: Wallet & Billing** (`feature/wallet-billing`)
  - Razorpay Test Mode integration with dynamic checkout script loading
  - Cryptographic HMAC SHA-256 signature verification and atomic idempotency locks
  - Real-time wallet credit additions, transaction history ledger, and instant test recharge
- [x] **Step 12: Admin Dashboard** (`feature/admin-dashboard`)
  - Role-gated `/admin` portal with `requireRole('admin')` server middleware
  - Aggregated platform KPIs: active users, total tokens, revenue, and error metrics
  - Time-series charts, Gemini Flash vs Pro split, and live transaction/error tables
- [x] **Step 14: Mobile Responsiveness & Enterprise-Grade PWA** (`feature/mobile-pwa`)
  - Modern dynamic viewport unit overhaul (`100dvh`) across AppLayout, Chat, Modals, Drawers, and Schema Designer to eliminate mobile address bar and software keyboard cutoffs.
  - Responsive mobile drawer navigation with touch backdrop, 44x44px accessible touch targets, and overflow-proof Topbar with auto-compacting search trigger and credit pill.
  - Mobile Chat Composer optimization: responsive mic/attachment actions, 16px iOS auto-zoom prevention, and stacked model selector pill.
  - Bottom-sheet overlay transformation for Modals, Prompts Variable Fill, and Model Selector Popovers on `< 640px` viewports.
  - Enterprise Progressive Web App (PWA) with `vite-plugin-pwa`, standalone display mode, orientation locking, dark theme `#121214` token alignment, and offline Workbox caching for app shells, Google Fonts, and assets.
  - Native in-app install UX with `usePWAInstall` hook, custom dismissible install prompt banner, one-click install button in Topbar/Settings, and step-by-step iOS Safari Add-to-Home-Screen guide.

