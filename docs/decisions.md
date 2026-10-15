# Architecture Decisions Log

This log tracks architectural and design decisions made for the NexAI project, per Section 0 of the build guide.

## ADR-001: Transition to NexAI v2 Architecture

- **Date:** 2026-09-23
- **Status:** Accepted
- **Context:** v1 scope was overly broad and lacked SaaS monetization and credit metering. v2 trims the scope into phased deliverables with a core focus on metered token-based billing, RAG/personal library, structured document generation, and an admin dashboard.
- **Decision:** Remove legacy v1 monolithic prototype code and rebuild cleanly using a structured monorepo (`client/` and `server/`), following the Step-by-Step build order in `docs/BUILD_GUIDE.md`.

## ADR-002: SCSS Modules & Semantic Tokens (No External UI Kits)

- **Date:** 2026-09-23
- **Status:** Accepted
- **Context:** High UI quality and full customization are required without CSS framework lock-in or leaky abstractions like Tailwind/MUI.
- **Decision:** Build a custom design system with SCSS modules using CSS variables for primitives and semantic tokens. Components consume semantic variables only. Theme switching is handled via `[data-theme]` attribute on the `<html>` root, defaulting to dark mode.

## ADR-003: Step-by-Step Environment Validation

- **Date:** 2026-09-23
- **Status:** Accepted
- **Context:** Requiring all third-party API credentials (Gemini, Pinecone, Razorpay, Google OAuth) at Step 1 causes server startup failures before those features are developed.
- **Decision:** Validate environment variables with Zod, requiring only foundational server configuration (`NODE_ENV`, `PORT`, `CLIENT_URL`, `MONGODB_URI`) during Step 1. All service-specific keys are defined as optional in Step 1 and will become strictly required in their respective implementation steps. No fallback values are provided for secrets.

## ADR-004: Dev API Proxy & Flat ESLint Configuration

- **Date:** 2026-09-23
- **Status:** Accepted
- **Context:** Cross-origin cookie handling and CORS can introduce issues during local development. In addition, modern ESLint uses flat config (`eslint.config.js`).
- **Decision:** Vite development server proxies `/api` directly to `http://localhost:5000`. Flat ESLint configuration is established across both workspaces.

## ADR-005: NPM Workspaces Monorepo Organization

- **Date:** 2026-09-23
- **Status:** Accepted
- **Context:** Managing client and server independently without monorepo tooling causes script fragmentation and duplicate dependency management.
- **Decision:** Use native npm workspaces in the root `package.json` with `workspaces: ["client", "server"]`. Root scripts (`npm run dev`, `npm run lint`, `npm test`) orchestrate both workspaces simultaneously without adding third-party monorepo tools like Turborepo or Lerna.

## ADR-006: Structured Logging with Pino

- **Date:** 2026-09-23
- **Status:** Accepted
- **Context:** Standard `console.log` produces unstructured logs that cannot be easily queried in production log aggregators and lack request latency tracking.
- **Decision:** Use `pino` and `pino-http` for server-side logging. In development mode (`NODE_ENV=development`), pipe through `pino-pretty` for human-readable colorized console output; in production, emit NDJSON for high-performance log aggregation.

## ADR-007: Provider-Agnostic Vector DB Abstraction (Pinecone Deferred)

- **Date:** 2026-09-23
- **Status:** Accepted
- **Context:** Requiring Pinecone API keys and vector indexes in Step 1 blocks early local development and UI testing. Furthermore, tying core logic directly to Pinecone risks vendor lock-in.
- **Decision:** Defer vector DB initialization to Step 5 (Personal Library). All future vector operations will be isolated behind a clean `vectorDb.service.js` interface (`upsert`, `query`, `remove`), keeping the application provider-agnostic and allowing Chroma or self-hosted alternatives in the future.

## ADR-008: Health Check Degraded State Handling

- **Date:** 2026-09-23
- **Status:** Accepted
- **Context:** If the MongoDB database is disconnected, returning HTTP 200 `status: "ok"` masks backend failure from orchestrators, reverse proxies, and cloud providers (e.g. Render).
- **Decision:** In `/api/health`, check `isDbConnected()`. If connected, return HTTP 200 with `status: "ok"`, `db: "connected"`. If disconnected, return HTTP 503 Service Unavailable with `status: "degraded"`, `db: "disconnected"`.

## ADR-009: Dual-Token Architecture and Auto-Refresh Axios Interceptor

- **Date:** 2026-09-25
- **Status:** Accepted
- **Context:** Access tokens stored in localStorage are vulnerable to XSS attacks. Conversely, putting everything strictly in cookies makes it difficult for client applications to pass credentials to WebSockets, EventSource (SSE streams), and third-party tools.
- **Decision:** Implement a dual-token strategy:
  1. **Access Token:** Short-lived (15 minutes), kept in memory in the client Zustand store, passed as `Authorization: Bearer <token>` in HTTP requests and SSE queries.
  2. **Refresh Token:** Long-lived (7 days), stored in an `httpOnly`, `SameSite=None; Secure` (production) cookie inaccessible to JavaScript.
  3. **Auto-Refresh Interceptor:** The client Axios instance intercepts 401 Unauthorized responses, queues pending requests, requests a fresh access token from `/api/auth/refresh`, and transparently retries the failed requests without interrupting the user session. On page reload, `checkAuth` runs once on app mount to re-hydrate the session seamlessly.

## ADR-010: Server-Sent Events (SSE) Streaming and Atomic Credit Ledger Metering

- **Date:** 2026-09-25
- **Status:** Accepted
- **Context:** Delivering real-time conversational AI responses without WebSockets requires an efficient unidirectional stream. Simultaneously, ensuring real token usage accounts for billing requires strict atomic deduction that prevents negative balances or race conditions.
- **Decision:**
  1. **Streaming Protocol:** Use HTTP Server-Sent Events (SSE) via `POST /api/chats/:id/messages` using standard chunk headers (`text/event-stream`). Events follow a typed structure (`event: token`, `event: done`, `event: error`).
  2. **Atomic Token Metering:** Credits are computed as `Math.ceil(tokensUsed / 100) * CREDITS_PER_100_TOKENS` from real Gemini `usageMetadata`. User credits are decremented atomically using MongoDB `$max: [0, { $subtract: ['$wallet.creditsRemaining', creditsDeducted] }]` and `$add` on `totalTokensConsumed`, guaranteeing `creditsRemaining >= 0`. Every call creates an immutable `UsageLog` entry.
  3. **Zero Balance Gatekeeping:** The `creditCheck` middleware halts execution prior to invocation if `wallet.creditsRemaining <= 0` with HTTP 402 `INSUFFICIENT_CREDITS`.
  4. **Gemini SDK:** Adopted the official `@google/genai` SDK with model identifiers dynamic via environment variables (`GEMINI_FLASH_MODEL`, `GEMINI_PRO_MODEL`), defaulting to `gemini-3.8-flash` and `gemini-3.1-pro-preview`.

## ADR-011: Reactive Streaming Chat UI, Live Credit Synchronization, and Composer State Machine

- **Date:** 2026-09-25
- **Status:** Accepted
- **Context:** Delivering a responsive, production-ready AI chat experience requires incremental token rendering, syntax-highlighted code with copy ergonomics, live wallet credit synchronization without page reloads, and responsive handling of low-credit/402 states.
- **Decision:**
  1. **Fetch & ReadableStream SSE Reader:** Implemented `lib/sse.js` using `fetch` with `ReadableStream` decoder to handle incoming `token`, `done`, and `error` event chunks.
  2. **Reactive Credit State Sync:** On receiving the `done` SSE packet containing `{ creditsRemaining, tokensUsed }`, `chatStore` directly calls `useAuthStore.getState().updateCredits(...)`, instantly updating the `CreditBadge` in the topbar and responsive drawers without any page reload or background polling.
  3. **Error Recovery & Transient Demand Handling:** Integrated friendly error sanitization for Google 503 high-demand states with auto-retry and in-bubble action triggers (Regenerate / Resend prompt).
  4. **Composer State & 402 Gatekeeping:** The composer supports Enter to send and Shift+Enter for newlines. When `insufficientCredits` (HTTP 402) occurs, the input locks with a prominent "Recharge to continue" banner directing users to `/wallet`.

## ADR-012: Personal Library, Semantic Vector Search, and Suggest-Review-Confirm Flow

- **Date:** 2026-09-25
- **Status:** Accepted
- **Context:** Storing unstructured articles and notes with simple keyword search leads to poor retrieval when users recall concepts rather than exact words. Furthermore, automatically saving AI summaries without user review risks populating the personal knowledge base with inaccurate or hallucinated metadata.
- **Decision:**
  1. **Suggest &rarr; Review &rarr; Confirm Pattern:** Implemented a two-step flow (`SaveItemModal` containing `SaveItemForm` and `SuggestionReview`). AI suggestions are generated via `POST /api/library/suggest` (metered through `creditCheck` and atomic token deduction), presented to the user for editing (title, summary, tags), and committed to MongoDB only when explicitly confirmed.
  2. **Link Content Extraction:** Implemented `linkExtractor.service.js` with `cheerio` to extract clean title, meta description, and article body text while stripping out scripts, styles, navigations, and advertisements.
  3. **Provider-Agnostic Vector Database Abstraction:** Implemented `vectorDb.service.js` exposing `upsert`, `query`, and `remove`. Supports Pinecone as the production index while providing a resilient in-memory cosine-similarity fallback for local development and test isolation without third-party credentials.
  4. **Semantic Vector Search with Hybrid Text Fallback:** `GET /api/library/search?q=` generates query embeddings via Gemini embedding models (`text-embedding-004`), queries the vector database filtered strictly by `userId`, and merges/ranks results with MongoDB `$text` search to ensure comprehensive coverage.

## ADR-013: Unified Collapsible Sidebar and Minimalist Hero Chat Canvas

- **Date:** 2026-09-26
- **Status:** Accepted
- **Context:** The initial desktop layout presented a global navigation sidebar alongside an inner nested chat sub-sidebar on `/chat`, consuming excessive horizontal screen space and fragmenting user navigation. Modern AI interfaces (Gemini, Claude) employ a single, unified, collapsible navigation rail.
- **Decision:**
  1. **Single Collapsible Rail:** Replace the duplicate double-sidebar with a single responsive navigation rail supporting two states: Collapsed (64px icon rail with tooltips) and Expanded (260px wide drawer with brand header, `+ New chat`, `Search chats` filter, navigation links, filterable Recents conversation history with pin/rename/delete actions, and a user wallet card).
  2. **Minimalist Hero State:** In the chat workspace, empty or new conversations render an uncluttered hero headline ("Where should we start?"), a glowing floating prompt bar with model selection (`Flash` / `Pro`), voice dictation (Web Speech API), file attachment, and quick starter suggestion chips.
  3. **Full-Width Message Thread:** Active chat conversations occupy the full workspace width for maximum readability.

## ADR-014: Consolidated Knowledge Library Architecture

- **Date:** 2026-09-26
- **Status:** Accepted
- **Context:** Maintaining separate disconnected pages for "Library" (links/notes) and "Documents" (AI structured drafts) causes feature fragmentation and user confusion about where generated content lives. Users also need a centralized place to store uploaded local files and view AI interview evaluation reports.
- **Decision:**
  1. **Unified Library Hub:** Consolidate Links, Notes, AI Generated Documents, Uploaded Custom Files, and Interview Reports into a single `/library` page backed by the polymorphic `LibraryItem` Mongoose schema (`type: "link" | "note" | "document" | "file" | "interview"`).
  2. **Tabbed Content Filtering:** Provide instant tabbed filters: `All`, `Notes & Links`, `Documents`, `Files`, `Interviews`.
  3. **Chat Context Attachment:** The chat composer includes an attachment trigger allowing users to seamlessly inject context either by selecting an existing item from their Library or uploading a new file from their device.

## ADR-015: AI Interview Platform Architecture and Metered Evaluation Scorecards

- **Date:** 2026-09-26
- **Status:** Accepted
- **Context:** Developers and diploma/engineering students preparing for viva examinations, technical screenings, and HR rounds lack an interactive, voice-enabled simulation environment that provides rigorous real-time questioning and actionable competency analytics.
- **Decision:**
  1. **Interactive Simulation Arena:** Build an `/interview` feature allowing users to configure target role (Full-Stack, React, Node.js, System Design, Capstone Viva), seniority, and topic. Gemini acts as an experienced interviewer conducting dynamic turn-by-turn dialogue with hints and follow-up probes.
  2. **Voice Ripple Audio Visualizer & Transcript:** Implement an animated audio ripple/waveform reflecting speaking state for both the candidate and AI. Include Web Speech API speech-to-text input, optional text-to-speech playback, and a collapsible live transcript drawer.
  3. **Comprehensive Scorecard Report:** Upon interview conclusion, Gemini evaluates candidate responses against an assessment rubric: Overall Score (0-100), rating, categorical breakdown (Technical Accuracy, Problem Solving, Communication, System Design), key strengths, and tailored study recommendations.
  4. **Automatic Library Archival:** The generated scorecard and transcript are automatically archived into the user's Library under the `interview` category for permanent access and study.
  5. **Credit Metering:** Every conversational turn and final evaluation report passes through `creditCheck` middleware and deducts credits atomically using real token usage: $\lceil \text{totalTokens} / 100 \rceil$.

## ADR-016: Project Workspaces, Local Source File Context Injection, and Isolated Conversation Memory

- **Date:** 2026-09-26
- **Status:** Accepted
- **Context:** Complex developer workflows (such as MSBTE capstone viva prep, repository architecture design, or full-stack feature planning) require grouping related conversations, enforcing persistent system instructions, and providing custom context files (code, markdown, specifications) without having to re-upload or re-explain context in every individual chat session.
- **Decision:**
  1. **Project Data Model:** Implemented `Project` model with `userId`, `name`, `description`, `color`, `customInstructions`, and embedded `sources: [{ name, content, size, mimeType, createdAt }]`.
  2. **Chat Association & Memory Isolation:** Added `projectId` and `pinned` flags to `Chat` model. The `Chat` model indexes `{ userId: 1, projectId: 1, updatedAt: -1 }`. Chats can be associated with a project or moved between projects.
  3. **Runtime Agent Context Injection:** In `chat.agent.js` and `chat.controller.js`, when a chat has a `projectId`, the agent automatically prepends the project's `customInstructions` to the system prompt and injects up to 50,000 characters per source file as ground truth reference context into Gemini's prompt stream.
  4. **Frontend Workspaces UI:** Created `/projects` gallery and `/projects/:id` workspace pages with split-screen layout, project capacity progress bar (up to 2MB text capacity), source file uploader, source text viewer modal, and project settings modal.
  5. **Unified Sidebar Integration:** Integrated a collapsible "Projects" section in the primary sidebar with quick creation, project switching, chat unlinking/moving, and direct chat creation within projects.

## ADR-017: AI Mock Interview Demo Simulation Mode (Zero-Credit Testing Engine)

- **Date:** 2026-09-26
- **Status:** Accepted
- **Context:** When developers or users evaluate the AI Mock Interview Platform locally or during staging with zero credit balance or when third-party Gemini API quotas are exhausted, testing the end-to-end interactive workflow (setup, Web Speech dictation, Voice Ripple audio visualizer, real-time SSE critique streaming, scorecard evaluation, and polymorphic library archival) was blocked by HTTP 402 `INSUFFICIENT_CREDITS`.
- **Decision:**
  1. **Session Simulation Flag:** Added `isSimulation: { type: Boolean, default: false }` to `InterviewSession` schema and Zod validators.
  2. **Zero-Credit Middleware Exemption:** `creditCheck` middleware passes requests through when `isSimulation: true` (or `x-simulation: true` header / `?simulation=true` query) is present, with zero token deductions.
  3. **Multi-Turn SSE Streaming Simulator:** In `respondInterview`, simulated sessions stream realistic multi-turn technical questions (Concurrency & Boundaries &rarr; Resilience & Load Shedding &rarr; Observability & Tracing &rarr; Distributed Caching & Tradeoffs) in real-time word chunks over SSE, triggering authentic typing and Voice Ripple visualizer animations.
  4. **Scorecard Generation & Library Archival:** In `concludeInterview`, simulated sessions compute a comprehensive scorecard (0-100 overall score, category breakdown, recommendations) and auto-archive into `LibraryItem` with `type: 'interview'` and `[Simulation]` title badge.
  5. **Frontend Ergonomics:** Added a "🎮 Demo Simulation (No Credits Required)" button to `InterviewSetup.jsx` and the credit warning banner in `InterviewPage.jsx`, and added a `Demo Simulation` badge to `InterviewArena.jsx`.
  6. **Zero Regression Safety:** Live Gemini AI logic and credit wallet metering remain 100% untouched and fully active when `isSimulation` is false.

## ADR-018: Unified Hybrid Search and Enhanced Command Palette Architecture

- **Date:** 2026-09-26
- **Status:** Accepted
- **Context:** Finding previously created content in personal AI workspaces is fragmented when users have to individually check the Library, Prompt Vault, and Chat History. A unified, cross-domain hybrid retrieval system was required that combines vector semantic similarity with full-text indexing, backed by a global keyboard-accessible Command Palette (Ctrl+K).
- **Decision:**
  1. **Cross-Domain Search Engine:** Implemented `search.service.js` and `GET /api/search?q=&type=&limit=` executing scoped queries strictly isolated to `req.user._id`:
     - **Knowledge Library:** Hybrid retrieval combining vector similarity via `vectorDbService.query` (using Gemini embedding `text-embedding-004`) and MongoDB `$text` / regex search on title, summary, content, tags, and document sections.
     - **Prompt Vault:** Full-text and regex search on prompt title, description, template, and tags, prioritizing favorites.
     - **Chat History:** Search across chat titles and message contents, returning matched messages with surrounding snippet context and role attribution.
  2. **Categorized Multi-Tab Search UI:** Built `/search` page featuring real-time debounced search, category tabs with live counts (`All`, `Library`, `Prompts`, `Chats`), highlighted snippet matches, empty states with recent search caching in `localStorage`, and direct navigation links to respective workspaces.
  3. **Live Command Palette Integration:** Upgraded global `CommandPalette` (Ctrl+K) to dynamically execute live unified searches alongside standard navigation commands, presenting categorized results for instant keyboard-driven jump actions.

## ADR-019: Wallet, Razorpay Test Mode, Webhook Architecture & Concurrency Idempotency

- **Date:** 2026-09-26
- **Status:** Accepted
- **Context:** Metered SaaS applications require robust billing flows where user wallets are credited based on verified third-party payment gateways. Because payment notifications can arrive concurrently from both client-side redirect/checkout verification and server-side webhook deliveries (or duplicate webhook retries), an atomic idempotency strategy is mandatory to eliminate double-crediting.
- **Decision:**
  1. **Server-Side Plan Configuration:** All plan tiers, currency pricing (in INR and paise), credit quantities, and privilege elevations are hard-coded in `server/src/config/plans.js`. The client never dictates price or credit amounts (`GET /api/wallet/plans`).
  2. **Raw-Body Webhook Parser Isolation:** In `server/src/app.js`, mounted `/api/webhooks` with `express.raw({ type: '*/*' })` strictly *before* global `express.json()` middleware. This preserves the pristine HTTP body buffer required for authentic Razorpay HMAC SHA256 signature verification (`X-Razorpay-Signature`).
  3. **Atomic Idempotent Transaction Ledger:**
     - A unique index on `Transaction.paymentId` is enforced in MongoDB.
     - When a payment is processed via `/wallet/verify` or `/webhooks/razorpay`, `processSuccessfulPayment` atomically attempts `findOneAndUpdate({ orderId, status: { $ne: 'success' } }, ...)` or catches MongoDB `E11000` duplicate key collisions on `paymentId`.
     - User wallet credits (`wallet.creditsRemaining`) are incremented via `$inc` **if and only if** the transaction status transition lock is acquired. Concurrent requests or repeated retries safely return the existing transaction record without duplicate crediting.
  4. **Razorpay Test Mode Integration:** Built `client/src/features/wallet/` (`PlanCard`, `TransactionTable`) and `WalletPage.jsx` supporting dynamic script injection (`https://checkout.razorpay.com/v1/checkout.js`), test-card checkout flows, and a zero-friction "⚡ Instant Test Mode Recharge" action for automated grading and offline demo environments.



## ADR-020: Role-Gated Admin Analytics Dashboard & Aggregation Pipeline

- **Date:** 2026-09-27
- **Status:** Accepted
- **Context:** Platform administrators require comprehensive visibility into platform KPIs, token consumption trends, model utilization split (Flash vs Pro), revenue metrics, and error rates, while preventing non-admin users from viewing sensitive administrative data.
- **Decision:**
  1. **Strict RBAC & Route Protection:** Implemented `requireRole('admin')` middleware on server (`/api/admin/*`) and `AdminRoute.jsx` on client, returning HTTP 403 Forbidden to non-admin users and automatically redirecting unauthenticated users.
  2. **High-Performance Aggregations:** Aggregated platform statistics via MongoDB aggregation pipelines (`UsageLog.aggregate`, `Transaction.aggregate`) for daily time-series analysis, model breakdown, and recent transaction audit logs.
  3. **Data Visualization:** Built an admin portal with interactive charts and KPI metric cards using semantic design tokens and accessible data tables.

## ADR-021: Hardening, Supertest End-to-End User Journey Suite & Viva Defense Guide

- **Date:** 2026-09-27
- **Status:** Accepted
- **Context:** Prior to final capstone defense and production release, the monorepo required end-to-end integration validation across interconnected domains, code cleanliness verification (zero console logs, clean build output), and a comprehensive technical defense preparation guide.
- **Decision:**
  1. **Supertest E2E Journey Suite (`server/tests/e2e.journey.test.js`):** Engineered a multi-step user lifecycle test verifying the complete user progression in sequence:
     - User registration & starter credit provisioning (`POST /api/auth/register`)
     - Wallet balance verification (`GET /api/wallet`)
     - AI Chat creation and SSE streaming response with atomic credit deduction (`POST /api/chats`, `POST /api/chats/:id/messages`)
     - Suggest -> Review -> Confirm Library workflow (`POST /api/library/suggest`, `POST /api/library`)
     - AI Mock Interview lifecycle (`POST /api/interview/start` -> `POST /api/interview/:id/respond` -> `POST /api/interview/:id/conclude` with scorecard & auto-archival)
     - Wallet recharge order creation and cryptographic HMAC SHA-256 verification (`POST /api/wallet/orders`, `POST /api/wallet/verify`)
     - Admin verification of platform KPIs and completed transactions (`GET /api/admin/stats`, `GET /api/admin/transactions`)
     - Credit exhaustion gate (HTTP 402 `INSUFFICIENT_CREDITS`)
  2. **Code Cleanliness & Build Polish:** Fixed CSS property syntax warnings in `client/src/features/wallet/PlanCard.module.scss`, verified zero debug `console.log` in production runtime code, and ensured complete parity in `.env.example` configurations.
  3. **Viva Defense Guide (`docs/viva-prep.md`):** Authored an in-depth viva examination defense guide detailing system architecture diagrams, RAG pipeline mechanics, the 5 core moats explaining why NexAI is not an AI wrapper, and model answers for the top 10 toughest capstone defense questions.

## ADR-022: Formal 1-Page Academic & Executive Project Abstract

- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** Final diploma/capstone submission and examiner review require a formal, high-impact one-page project abstract articulating the real-world problem statement, the system architecture solution, and verified outcomes. The document must strictly adhere to a single-page printable constraint (A4) and be directly exportable or importable to Google Docs.
- **Decision:**
  1. Authored standard academic markdown abstract in `docs/ABSTRACT.md` conforming to capstone project submission standards.
  2. Created a dedicated print-optimized HTML interface (`docs/ABSTRACT.html`) with CSS `@page { size: A4; margin: 12mm 15mm; }`, professional typography, and a "Copy Formatted Text" clipboard engine allowing 1-click rich-text paste directly into Google Docs without formatting degradation.
  3. Structured the content into four distinct pillars: Project Metadata, Problem Statement (Real-World Inefficiencies), Proposed Solution (NexAI Subsystems), and Quantifiable Outcomes & Impact.

## ADR-023: Wallet Section Polish, Real-Time Sync, Itemized Receipts & Sandbox Helpers

- **Date:** 2026-09-29
- **Status:** Accepted
- **Context:** To ensure full alignment with `docs/BUILD_GUIDE.md` (Step 11), `docs/PRD.md` (Phase 2), and `docs/viva-prep.md` (Defense Demonstration Flow), the Wallet & Billing client feature suite required comprehensive loading, error/retry, and empty state handling (Rule 13), manual live balance synchronization, itemized transaction receipt dialogs, and a developer sandbox credential helper for seamless offline or viva test-mode checkout execution.
- **Decision:**
  1. **CreditBadge Export & Component Alignment:** Implemented and exported `CreditBadge` from `client/src/features/wallet/` in accordance with `docs/BUILD_GUIDE.md` specifications, with automatic low-balance visual cues.
  2. **Live Balance Sync:** Added a "Sync Balance" action on `WalletPage.jsx` with spinning refresh animation, allowing instant live balance reconciliation after AI token usage without full browser reloads.
  3. **Data View Completeness (Rule 13):**
     - Skeletons for stats and transaction table rows during network loads.
     - Global error banner with an explicit "Retry" action if fetching or verification encounters network failures.
     - Low-balance and zero-balance warning banners highlighting HTTP 402 AI request gatekeeping.
  4. **Itemized Transaction Receipt Modal (`TransactionReceiptModal.jsx`):** Allows users to click any ledger row or "Receipt" button to inspect detailed cryptographic proof, order references, Razorpay payment identifiers, and printable summaries.
## ADR-024: Consolidated Library Reliability, In-Chat Ingestion & Multi-Chunk Vector Indexing

- **Date:** 2026-10-01
- **Status:** Accepted
- **Context:** An internal audit and competitive knowledge management research revealed critical gaps in the existing Library implementation: (1) Vector embedding truncated content at 1,500 characters, blinding semantic search to deep sections of long documents; (2) Uploaded PDF documents were stored as placeholder text without text parsing or semantic vectorization; (3) Users had to copy-paste between Chat and Library because there was no direct "Save to Library" action on messages or code blocks; and (4) Developer file formats were restricted to basic extensions.
- **Decision:**
  1. **Multi-Chunk Semantic Vector Indexing:** Refactored `buildItemEmbeddingTexts` in `server/src/controllers/library.controller.js` to segment long notes, documents, and transcripts into overlapping 3,000-character chunks with shared metadata (`refId: item._id`, `chunkIndex`). Added `vectorIds` array in `LibraryItem.js` schema and `removeMany` in `vectorDb.service.js` to ensure clean lifecycle management for multi-vector items.
  2. **Multimodal PDF & Expanded Developer File Ingestion:** Updated `FileUploaderModal.jsx` to accept all common programming and configuration formats (`.sql`, `.sh`, `.env`, `.yaml`, `.rs`, `.go`, `.java`, `.cpp`, `.cs`, etc.) using direct text reading. For PDF uploads, base64 data is transmitted to `/api/library/suggest` where Gemini Flash natively parses the document, returning authentic summaries, tags, and extracted overviews for review before saving.
  3. **Bidirectional In-Chat & CodeBlock Capture:** Added a "Save to Library" button on both user and assistant chat message bubbles (`MessageThread.jsx`), and a "Save Snippet" button with language tagging on `CodeBlock.jsx`. Mounted `SaveItemModal` globally inside `AppLayout.jsx` with `addModalPrefill` state in `useLibraryStore`, maintaining the strict **Suggest &rarr; Review &rarr; Confirm** pattern without manual copy-pasting.

## ADR-025: Dedicated Engine Strategy, Web Speech API Architecture & Chat Telemetry Inspector

- **Date:** 2026-10-03
- **Status:** Accepted
- **Context:** Following evaluation of multimodal capabilities, rate limits, and latency targets, architectural decisions were needed regarding: (1) Default model specialization for cost-efficiency and quota longevity; (2) Audio processing strategy without burning precious API quotas; (3) Framework selection (evaluating LangChain vs native SDK); and (4) Chat UX enhancements (sticky code headers, scroll-to-bottom mechanics, message feedback, and telemetry inspection).
- **Decision:**
  1. **Primary AI Engine (`gemini-3.5-flash-lite`):** Selected `gemini-3.5-flash-lite` as the primary default model (`GEMINI_FLASH_MODEL`). Offers a 1,048,576-token context window, native multimodal input (text, images, OCR, PDF parsing, and audio understanding), low latency, generous free tier (1,500 RPD vs 20 RPD on 3.8 Flash), and the lowest token price ($0.30/1M input).
  2. **Zero-Quota Voice Processing via Web Speech API:** Client-side speech dictation (`SpeechRecognition`) and text-to-speech audio playback (`window.speechSynthesis`) handle conversational voice without consuming any backend Gemini API tokens or triggering rate limits. Server-side TTS (`gemini-3.8-flash-lite-tts`) is maintained as a future opt-in server enhancement.
  3. **Direct SDK Architecture (Zero-Dependency Independence):** Explicitly reject heavy orchestration frameworks (LangChain / LlamaIndex) in favor of the official `@google/genai` SDK. This eliminates 100+ nested npm dependencies, prevents cold-start delays on Render, and ensures the engineering logic (sliding window, hybrid Pinecone RAG, atomic credit deduction) remains authentic and defensible in viva examinations.
  4. **Chat UX & Telemetry Inspector Drawer:**
     - **Sticky CodeBlock Header:** Code block header topbars (`CodeBlock.module.scss`) pinned sticky (`top: 0`) so copy button and language badge remain accessible during long multi-line code scrolling.
     - **Floating Scroll-to-Bottom:** Automated down-arrow button displayed when the user scrolls away from the stream, smoothly snapping back to the newest incoming tokens.
     - **Telemetry Inspector Drawer:** Right-side sliding panel inspecting message metadata: model identifier, input/output/total token breakdown, credits deducted, response latency in ms, and internal reasoning/thinking steps.
    - **Message Feedback & Read Aloud:** Action buttons for Like/Dislike ratings and Web Speech audio playback on assistant message bubbles.
     - **Chat Branching:** Confirmed under Future Scope as per PRD Section 3 to preserve project completion timelines.

## ADR-026: Persistent Cross-Chat Long-Term Memory and Hybrid Context Retrieval

- **Date:** 2026-10-03
- **Status:** Accepted
- **Context:** Without cross-chat memory, users had to re-introduce their name, preferred tech stack, and personal development context in every new conversation session. A decoupled memory architecture was required to persist facts, preferences, background, and directives across chats while preserving user privacy, security, and manual transparency.
- **Decision:**
  1. **Dual-Tier Memory Structure:**
     - **Short-Term Memory (In-Chat):** Sliding turn-based context windowing (`formatConversationHistory`) with multimodal asset preservation and turn normalization for the active chat session.
     - **Long-Term Memory (Cross-Chat):** Dedicated `Memory` collection in MongoDB with 768-dim embeddings in `vectorDbService`. Scoped strictly to `userId` with categories (`identity`, `preference`, `project`, `instruction`, `fact`).
  2. **Hybrid Context Retrieval & Injection:**
     - Prioritizes core identity (e.g. user name, profession) and pinned memories.
     - Performs semantic vector similarity search via `vectorDbService.query` using the user's incoming query embedding to retrieve domain-relevant memories.
     - Injects formatted context into Gemini's `systemInstruction` across all chats (`[USER LONG-TERM MEMORY (CROSS-CHAT PERSISTENT CONTEXT)]`).
  3. **Zero-Latency Deterministic + Background AI Extraction:**
     - Deterministic fast-path regex captures explicit identity ("My name is...", "Call me...", "I work as...", "Remember that...") immediately.
     - Asynchronous Gemini Flash agent (`memory.service.js`) parses nuanced conversational statements without slowing down SSE token streaming.
  4. **User Agency & Settings Management (`MemoryManager`):**
     - Full CRUD API at `/api/memories` and interactive UI card in `/settings` allowing users to inspect what NexAI has remembered, toggle priority pinning, add custom memories manually, or wipe memory cleanly ("Clear All").

## ADR-027: Dual-Mode Quota Governance, 1,500 RPD Evaluation Mode & Admin Live Gemini Telemetry

- **Date:** 2026-10-03
- **Status:** Accepted (Documented & Ready for Implementation Approval)
- **Context:** During college viva evaluations and live testing, users and evaluators frequently hit the artificial 100 starter credit limit (~10,000 tokens), prematurely halting interactive feature demonstrations (Chat, Mock Interviews, Document generation) with HTTP 402 `INSUFFICIENT_CREDITS`. However, the underlying Google Gemini API free tier allows up to 1,500 Requests Per Day (RPD), 15 RPM, and 1,000,000 TPM without financial cost. A solution was needed to allow unconstrained college demonstrations while strictly preserving the commercial token-billing architecture and payment gateway for evaluators.
- **Decision:**
  1. **Dual-Mode System Setting (`systemConfig`):**
     - Introduce platform setting `billingEnforcementMode`: `'quota_free'` (Default for Academic/Demo) vs `'credit_strict'` (Commercial SaaS).
     - Environment variable fallback: `CREDIT_ENFORCEMENT_MODE=quota_free`.
     - In `quota_free` mode: `creditCheck.js` bypasses HTTP 402 rejection as long as daily Gemini requests remain under 1,500 RPD, while `credit.service.js` continues to atomically compute tokens, deduct simulated credits, and write `UsageLog` entries.
     - In `credit_strict` mode: standard 100 credit limit is enforced, blocking requests at 0 balance and requiring Razorpay test recharge.
  2. **1-Click Admin Mode Toggle:**
     - Exposed directly in the `/admin` header, allowing the presenter to flip between `Quota-Free Demo` and `Credit-Strict SaaS` modes with zero downtime or server restarts.
  3. **Live Gemini Quota Telemetry in Admin Dashboard:**
     - Visual progress meter for `Requests Today / 1,500 RPD` resetting at 00:00 UTC.
     - Rate-limit safety metrics: live RPM gauge (15 RPM limit) and TPM counter.
     - Real-time token consumption logs with per-call transparency.
  4. **Transparent Wallet & Topbar UI:**
     - Clearly communicates mode status: `⚡ Quota Mode: X / 1,500 Daily Calls Left`, allowing evaluators to see simulated credit deductions alongside real quota headroom.

## ADR-028: Dynamic Architecture & Flow Visualizer via Client-Side Mermaid.js Integration

- **Date:** 2026-10-04
- **Status:** Accepted (Implemented on `feature/mermaid-visualizer`)
- **Context:** Text-only explanations of complex software architectures, sequence flows, database schemas, and state transitions are difficult for students and developers to parse and lack visual impact during academic viva evaluations. A native diagramming solution was needed that renders declarative markdown diagrams directly inside chats, library notes, and documents with zero additional backend compute cost or server load.
- **Decision:**
  1. **Zero-Compute Client-Side Rendering (`mermaid`):**
     - Adopted `mermaid` directly on the client. Rendering happens entirely in the browser using SVG output with $0 backend compute cost and zero additional token overhead.
  2. **Dynamic Semantic Theme Adaptation:**
     - Re-initializes Mermaid dynamically upon theme toggles (`isDark` from `useTheme`), applying NexAI's semantic CSS design tokens (purple/violet primary `#8b5cf6`, dark blueprint `#1c2029`, light surface `#f7f7f9`, and custom fonts).
  3. **Streaming & Incomplete Syntax Resilience:**
     - Guards parsing with `mermaid.parse` and short debouncing (250ms during SSE streaming). During active token generation, incomplete syntax fails gracefully without error flickers. Only upon completed generation will syntax errors display a polite inspection banner.
  4. **Interactive Architecture Canvas (`MermaidBlock`):**
     - Pan & zoom controls (0.5x to 2.5x with percentage display and 1-click reset).
     - "Diagram" and "Code" tab toggle allowing users to view and copy the raw Mermaid source.
     - "Copy SVG" and "Export SVG" actions for instant integration into external documentation, LaTeX, and presentations.
     - "Save to Library" integration respecting the human-in-the-loop *Suggest → Review → Confirm* pattern by pre-populating an architectural note modal.
  5. **Prompt Engineering Alignment:**
     - Updated `CHAT_SYSTEM_PROMPT` in `server/src/agents/prompts/chat.prompt.js` guiding Gemini to produce structured Mermaid diagrams when explaining workflows, architectures, algorithms, sequence flows, or schemas.

## ADR-029: Dual-Mode Voice Architecture with Gemini 3.8 Flash-Lite TTS and Web Speech Fallback

- **Date:** 2026-10-08
- **Status:** Accepted
- **Context:** The AI Mock Interview Platform requires realistic voice readout for interviewer critiques and technical questions. However, high-throughput text-to-speech APIs have rate limits (e.g. 100 RPD on free tiers) and consume credits, while testing/demo modes require offline zero-cost execution.
- **Decision:**
  1. **Dual-Mode Voice Strategy:**
     - **Simulation Mode (isSimulation === true):** Employs browser-native Web Speech API (window.speechSynthesis). Consumes 0 API tokens, 0 user credits, and functions 100% offline.
     - **Live Mode (isSimulation === false):** Powered by Google's gemini-3.8-flash-lite-tts via @google/genai on POST /api/interview/tts. Returns natural, high-fidelity audio/wav audio with RIFF header directly to an HTML5 Audio player on the client.
  2. **Token Metering & Atomic Deductions:**
     - Tracks real Gemini token usage (promptTokenCount + audio candidatesTokenCount at 25 tokens/sec).
     - Deducts credits atomically according to the platform standard: credits = Math.ceil(totalTokens / 100).
     - Logs each generation into UsageLog with model: 'tts', feature: 'interview', and full audit timestamps.
  3. **Seamless Fault-Tolerant Fallback:**
     - If the Gemini TTS API encounters a rate limit (HTTP 429 RESOURCE_EXHAUSTED / 100 RPD cap) or insufficient credits (HTTP 402), the frontend automatically falls back to browser-side speechSynthesis with an informative toast notification, ensuring the interview assessment is never stalled or disrupted.
  4. **Visual Telemetry & Controls:**
     - InterviewArena presents engine status (Gemini 3.8 Flash-Lite TTS vs Simulation), animated loading pulse during audio synthesis, and single-click muting / replay.

## ADR-030: Dual-Engine Voice Architecture with Microsoft Edge Neural TTS and Gemini 3.8 Flash-Lite TTS

- **Date:** 2026-10-08
- **Status:** Accepted
- **Context:** Gemini 3.8 Flash-Lite TTS provides high quality audio but exhibits a 5–7 second cascade delay (LLM completion + TTS generation) and is constrained by Google's Free Tier 100 requests/day cap. For real-time technical interviews and live capstone viva evaluations, an ultra-fast, quota-free, studio-grade neural voice engine was needed as the default primary option, while retaining Gemini Flash-Lite TTS as an opt-in cloud engine.
- **Decision:**
  1. **Dual-Engine Architecture (`edge` vs `gemini`):**
     - **Engine 1: Microsoft Edge Neural TTS (`msedge-tts`) [Default / Primary]:**
       - Integrated lightweight Node.js service (`server/src/services/edgeTts.service.js`).
       - 100% Free, zero API key required, zero daily request ceiling.
       - Ultra-low latency (~400ms turnaround) with 24 kHz 96 kbps mono MP3 streaming.
       - Studio-grade examiner voices: `en-US-ChristopherNeural` (Male Tech Examiner Lead, default), `en-US-GuyNeural`, and `en-US-JennyNeural` (Female Tech Examiner).
       - Consumes 0 user credits and 0 Gemini quota.
     - **Engine 2: Google Gemini 3.8 Flash-Lite TTS (`gemini-3.8-flash-lite-tts`) [Opt-in via Toggle]:**
       - Cloud neural generation via `@google/genai` returning 24 kHz WAV audio with RIFF header.
       - Tracks real prompt and audio candidate tokens, deducts credits atomically (`ceil(totalTokens / 100)`), and records `UsageLog` with `model: 'tts'`.
  2. **Zero-Friction Credit Check Policy:**
     - When `engine === 'edge'`, `creditCheck` middleware allows execution regardless of wallet credit balance, ensuring students and examiners can run comprehensive voice interviews even with 0 credits.
  3. **Multi-Tier Fault Recovery:**
     - If the user selects Gemini TTS and exhausts their wallet credits (HTTP 402) or reaches Google's daily quota (HTTP 429), the client automatically recovers by falling back to Edge Neural TTS instantly, and subsequently to browser-side Web Speech synthesis if offline.
  4. **Accessible UI Voice Toggle:**
     - Integrated sleek pill-based voice engine selectors into both `InterviewSetup` and `InterviewArena` top action bars:
       - `⚡ Edge Neural (Fast & Free)` [Default]
       - `🎙️ Gemini 3.8 Flash-Lite TTS (Cloud)`
     - Dynamic telemetry badges and `VoiceRipple` visualizer status strings reflect the active voice engine in real time.


## ADR-032: Canonical Intermediate Representation (IR) Architecture, Deterministic Schema Linter, and Relational Seed Data Engine

- **Date:** 2026-10-12
- **Status:** Accepted
- **Context:** Previous iterations relied on parsing and synchronizing raw code strings across four distinct database dialects (Mongoose, PostgreSQL DDL, Prisma, TypeScript) and canvas states using regex heuristics. Treating code as the source of truth causes synchronization brittleness, loss of relational fidelity, and name collision bugs during renaming. Furthermore, developers need actionable architectural validation and reproducible mock data during database design.
- **Decision:**
  1. **Canonical Schema IR as Single Source of Truth (`schemaIR.js`):**
     - Established a single versioned `IR` (`version: 1`) holding `entities: Record<string, Entity>` and a decoupled `layout: Record<string, { x, y }>`.
     - Entities and fields use stable immutable identifiers (`ent_*`, `fld_*`). Renaming an entity or field updates its label without breaking links, foreign keys, or layout positioning.
     - Cardinality (`1:1`, `1:N`) is derived deterministically from Foreign Keys (`field.fk: { entityId, fieldId, onDelete }`) and unique constraints (`field.unique`).
  2. **Pure Projection Generators:**
     - All outputs are pure mathematical projections of the IR:
       - `generateSQL(ir)`: PostgreSQL DDL with table declarations, UUID defaults, foreign key constraints with ON DELETE rules, and automated foreign key indexes.
       - `generatePrisma(ir)`: Prisma schema with `@id`, `@relation`, `@unique`, and reverse relations.
       - `generateMongoose(ir)`: Mongoose models with `ObjectId` refs, timestamps, and indexes.
       - `generateTypeScript(ir)`: Clean TypeScript interfaces with nullability and relational typing.
       - `generateMermaid(ir)`: Standard crow's-foot ER diagram syntax (`||--||`, `||--o{`).
       - `generateDBML(ir)`: DBML export supporting the dbdiagram.io ecosystem.
  3. **Deterministic Schema Linter & Health Score Engine (`schemaLinter.js`):**
     - Runs 100% locally with $0 compute overhead.
     - Enforces production rules: missing Primary Keys (-15 pts), unindexed Foreign Keys (-8 pts), missing audit timestamps (`createdAt`/`updatedAt`), unbounded string types, and orphan tables.
     - Calculates a live Health Score (0–100%) with letter grades (`A+` to `F`), issue severity categorizations, and one-click interactive auto-fixes applied directly to the IR.
  4. **Topologically Sorted Relational Seed Data Generator (`schemaSeed.js`):**
     - Implements Kahn's topological sort algorithm over foreign key edges to resolve relational dependencies.
     - Generates valid relational mock records where child tables strictly reference existing parent primary keys.
  5. **Developer Workflows & UI Integration:**
     - `SchemaHeader.jsx`: Added real-time Health Score badge with diagnostics drawer, Auto-Arrange button, 1-click PostgreSQL `.sql` migration file download, and Seed Data generator modal.
     - `CodeInspector.jsx`: Added DBML tab for dbdiagram.io compatibility.

## ADR-033: Eraser-Style ER Diagram Studio with First-Class Relations and Deterministic Bi-directional Sync

- **Date:** 2026-10-12
- **Status:** Accepted
- **Context:** The Data Modeling studio suffered from UI clutter (health scores, telemetry drawers, seed data modals, simulation modes, and multiple dialect tabs) and relationship drift caused by storing relations as field attributes or separate unlinked manual links. Developers required a distraction-free ER Diagram experience inspired by Eraser.io: an intuitive declarative language (`users.orgId > organizations.id`), deterministic two-way sync, orthogonal connector lines with cardinality markers, and a clean workspace matching the Chat interface.
- **Decision:**
  1. **Canonical Relational Model (`erLang.js`):**
     - Canonical store model: `model: { entities: [{ id, name, color, fields }], relations: [{ id, from, to, type }], layout: Record<string, {x, y}> }`.
     - Relationships are first-class citizens (`many-to-one` `>`, `one-to-many` `<`, `one-to-one` `-`, `many-to-many` `<>`) rather than embedded field attributes.
  2. **Custom Eraser ER Language (`erLang.js`):**
     - Fast deterministic parser and serializer (`parse(text)`, `serialize(model)`).
     - Exports PostgreSQL DDL and Prisma schemas as pure functions of the model.
  3. **Robust Two-Way Sync:**
     - Canvas edits mutate the model, serialize into code, and update the editor.
     - Code edits debounce 400ms and parse back to the model. Syntax errors surface in an inline diagnostic banner while keeping the canvas diagram intact.
  4. **Orthogonal Connectors & Interactive Canvas:**
     - Field-to-field connection ports (EAST to WEST / WEST to EAST) with SVG orthogonal routing (rounded corners) and `1` / `*` cardinality labels.
     - Direct port drag-and-drop or click-to-connect interactions.
     - Selected entity dimming (`opacity: 0.45` on unrelated cards) for visual hierarchy.
  5. **Focused UI Scope:**
     - Renamed feature to **ER Diagram** (`/schema`).
     - Slim 48px top bar with inline title editing, `Split | Diagram | Code` segmented view, New canvas reset, and Save to Library.
     - Centered `SchemaHero` empty state matching Chat Hero styling.
     - Docked bottom `SchemaPromptBar` with Gemini model toggle and Suggest -> Review -> Confirm workflow.


## ADR-034: Memory Engine Phase 1 Overhaul: Strict Thresholds, ADD/UPDATE/DELETE Decision Pipeline, and Temporal Superseding

- **Date:** 2026-10-13
- **Status:** Accepted
- **Context:** Previously, NexAI's memory subsystem suffered from:
  1. Low-quality context pollution caused by random recency backfill.
  2. Fragile regex heuristics for updating or invalidating facts (e.g. failing to notice *"I moved to London"* conflicts with *"I live in New York"*).
  3. No temporal audit trail for past user state.
  4. Leakage of project-specific facts into unrelated global chats.
- **Decision:**
  1. **Strict Cosine Threshold Filtering & Weighted Ranking (`memory.service.js`):**
     - Hard cosine similarity cutoff at >= 0.75. Queries below threshold inject zero vector memories.
     - Weighted composite scoring formula: score = sim * 0.6 + recency * 0.2 + confidence * 0.1 + pinnedBoost.
     - Completely removed the unfiltered recency backfill.
     - Added telemetry tracking: updating `lastUsedAt` and incrementing `useCount` upon retrieval.
  2. **LLM ADD / UPDATE / DELETE / NONE Decision Pipeline (`memory.prompt.js` & `memory.service.js`):**
     - When candidate facts are extracted, vector search retrieves the top 3–5 similar active memories.
     - Gemini Flash evaluates candidate vs. existing memories and emits an explicit action (`ADD`, `UPDATE`, `DELETE`, `NONE`) with optional semantic slot keys (e.g. `user.location`).
  3. **Temporal Superseding (`Memory.js`):**
     - Outdated memories are not hard-deleted; they are marked `active = false`, `validTo = Date.now()`, and `supersededBy = newMemoryId`.
     - Outdated vector embeddings are purged from Pinecone to eliminate search noise while keeping historical audits in MongoDB.
  4. **Two-Layer Memory Scoping (`global` vs `project`):**
     - `scope: 'global' | 'project'` and `projectId`. Global memories are candidate context everywhere; project memories are bounded strictly to chats within that specific project.
  5. **Safety Guardrails:**
     - Extraction is strictly bypassed for temporary chats (`isTemporary === true`).
     - Sensitive credentials (passwords, API keys, cards, tokens) are filtered out unless explicitly accompanied by a `"remember that"` directive.
     - Per-user cap of 200 memories with automatic pruning of oldest unpinned, low-use records.
