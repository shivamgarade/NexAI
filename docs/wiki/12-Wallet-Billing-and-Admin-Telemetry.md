# 12 — Wallet, Razorpay Billing & Admin Telemetry Dashboard

NexAI converts an ordinary LLM interface into a verifiable multi-tenant **micro-SaaS platform** using server-authoritative recharge packages, cryptographic Razorpay payment verification, atomic webhook idempotency, dual-mode quota governance, and a role-gated `/admin` analytics portal.

---

## 1. Server-Authoritative Recharge Plans (`server/src/config/plans.js`)

Clients **never** pass price or credit amounts—orders only pass `{ planId }` and are resolved strictly server-side from `PLANS`:

| Plan ID | Name | Price | Credits Added | Tier After Purchase | Badge |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`starter_pack`** | Starter Top-Up | ₹49 (`4900` paise) | `+500` credits (~50k tokens) | `free` | — |
| **`pro_pack`** | Pro Developer Pack | ₹99 (`9900` paise) | `+1,200` credits (~120k tokens) | `free` | `Popular` |
| **`power_pack`** | Power Studio Tier | ₹249 (`24900` paise) | `+3,500` credits (~350k tokens) | **`pro_monthly`** | `Best Value` |

---

## 2. Razorpay Checkout & Atomic Webhook Idempotency (`razorpay.service.js`)

Because Razorpay payments can trigger **both** a synchronous frontend callback (`POST /api/wallet/verify`) and an asynchronous server-to-server webhook (`POST /api/webhooks/razorpay`) within milliseconds of each other, double-crediting would happen without atomic locking.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as WalletPage / RazorpayPaymentModal
    participant WalletAPI as wallet.routes.js -> wallet.controller.js
    participant RzpSvc as razorpay.service.js
    participant RzpCloud as Razorpay API (or non-prod Test Fallback)
    participant Mongo as MongoDB (Transaction + User)

    User->>UI: Select Plan -> Click Recharge / Test Top-Up
    UI->>WalletAPI: POST /api/wallet/orders { planId }
    WalletAPI->>RzpSvc: createOrder(userId, planId)
    RzpSvc->>RzpCloud: Create Order (paise) [non-prod falls back to order_test_* if keys empty]
    RzpSvc->>Mongo: Insert pending Transaction { userId, orderId, amountINR, creditsAdded, status: 'pending' }
    RzpSvc-->>UI: { orderId, amount, currency: 'INR', keyId, isTestFallback }

    par Concurrent Verification Paths
        User->>UI: Complete QR/UPI Modal -> Authorize Test Payment
        UI->>WalletAPI: POST /api/wallet/verify { orderId, paymentId, signature }
        WalletAPI->>RzpSvc: verifyPaymentSignature (HMAC-SHA256 orderId|paymentId OR 'mock_valid_signature' in non-prod)
        RzpSvc->>RzpSvc: processSuccessfulPayment()
    and Asynchronous Server Webhook
        RzpCloud->>WalletAPI: POST /api/webhooks/razorpay (express.raw Buffer + X-Razorpay-Signature)
        WalletAPI->>RzpSvc: verifyWebhookSignature(rawBody, signature, RAZORPAY_WEBHOOK_SECRET)
        RzpSvc->>RzpSvc: processSuccessfulPayment() on event 'payment.captured' | 'order.paid'
    end

    Note over RzpSvc,Mongo: Idempotency Lock 1: Skip if paymentId already succeeded; atomic findOneAndUpdate(orderId, status != success)
    Note over RzpSvc,Mongo: Idempotency Lock 2: Unique index on paymentId catches E11000 races so only 1 caller credits User.$inc
```

### Wallet Frontend Features (`client/src/pages/Wallet/WalletPage.jsx` & `features/wallet/`)
- **Balance Overview & Live Sync:** Displays remaining credits, cumulative tokens burned, membership tier (`free` / `pro_monthly`), current quota governance status, **Sync Balance** manual refresh trigger, and warning banners at low (`<= 10`) or zero balance.
- **Recharge Cards (`PlanCard.jsx`):** Standard Checkout button (attempts live Razorpay SDK `window.Razorpay` or opens `RazorpayPaymentModal.jsx`) plus **Instant 1-Click Test Top-Up** (`simulateTestRecharge`) for rapid testing/viva demonstrations.
- **`RazorpayPaymentModal.jsx`:** Deterministic SVG 29×29 UPI QR matrix (`generateQrMatrix(plan.id)`), countdown timer, sandbox VPA (`success@razorpay`), animated 3-stage checkout (`checkout` → `processing` → `success`), and instant receipt confirmation.
- **Paginated Ledger & Printable Receipts (`TransactionTable.jsx`, `TransactionReceiptModal.jsx`):** Filterable (`All`, `Success`, `Pending`), 1-click copy Payment ID, and detailed modal receipt with HMAC SHA-256 audit summary and browser print action.

---

## 3. Dual-Mode Billing Governance & Live Quota Telemetry

Configured in `SystemConfig` (`_id: 'global_config'`) via `systemConfig.service.js`:
- **Mode 1 — `quota_free` (Default in Dev/Prod Demos):** Allows AI requests even when `user.wallet.creditsRemaining === 0`, up to `dailyGeminiQuotaLimit` (`1,500` requests/day resetting at `00:00 UTC`), while continuing to count exact tokens, compute `credits = ceil(tokens / 100)`, clamp wallet balance safely at `>= 0`, and write `UsageLog` entries.
- **Mode 2 — `credit_strict` (Default in `NODE_ENV=test` & SaaS Enforcement):** Rejects any metered AI request when `creditsRemaining <= 0` with HTTP `402 INSUFFICIENT_CREDITS` until the user recharges.
- **Live Telemetry Computed by `systemConfigService.getGeminiTelemetry()`:**
  - `requestsToday` / `dailyLimit` (`1500` RPD) + `quotaUsedPercentage`
  - `rpm` (last 60s `UsageLog` count vs `15` RPM) and `tpm` (last 60s `tokensUsed` sum vs `1,000,000` TPM)
  - `tokensToday` breakdown (`total`, estimated 40/60 input/output split, `avgTokensPerRequest`)
  - Flash vs Pro request counts and active model identifier.

---

## 4. Role-Gated Admin Analytics Dashboard (`/admin`, `AdminPage.jsx`)

Strictly gated by `AdminRoute.jsx` (client) and `router.use(auth, requireRole('admin'))` in `admin.routes.js` (HTTP `403 FORBIDDEN` for standard users):

| Admin Panel Component | API Endpoint | Visualization & Metrics |
| :--- | :--- | :--- |
| **Governance Mode Toggle Header** | `GET /api/admin/config`, `PATCH /api/admin/config` | 1-click toggle between `quota_free` and `credit_strict` + daily RPD limit control without restarting Express. |
| **`QuotaTelemetryCard.jsx`** | `GET /api/admin/config` | Progress bar for `Requests Today / 1,500 RPD`, `15 RPM` & `1M TPM` rate safety gauges, daily token consumption, and active engine pill. |
| **KPI Grid (`StatCard.jsx`)** | `GET /api/admin/stats` | Total Tokens Consumed, Mock Revenue (₹ from successful `Transaction`s), Active Users, System Error Count, and Average API Latency (`ms` from `requestLogger.js`). |
| **`UsageChart.jsx`** | `GET /api/admin/usage?range=7d\|30d` | Recharts `AreaChart` displaying daily token consumption trends over 7 or 30 days. |
| **`ModelSplitChart.jsx`** | `GET /api/admin/usage` | Recharts donut `PieChart` showing token distribution by feature (`chat`, `library`, `docgen`/`document`, `interview`) and Flash vs Pro model split. |
| **`RecentTransactionsTable.jsx`** | `GET /api/admin/transactions?page=` | Paginated platform-wide Razorpay ledger showing user email, Order/Payment ID, ₹ INR, credits, and status badges. |
| **`ErrorLogsTable.jsx`** | `GET /api/admin/errors?page=` | Paginated server `ErrorLog` feed with HTTP method/status badges and expandable **Trace** stack-trace viewer. |
