# NexAI — Master Changes & Application Specification

> **Purpose:** Living master specification and backlog of all architectural changes, UI refinements, feature updates, and bug fixes across the NexAI platform. Maintained with strict hierarchy, zero duplication, and clear file mappings to ensure high-fidelity execution.

---

## 1. Core Feature Offerings & Navigation Taxonomy

The application is structured around five core feature offerings. These form the primary navigation hierarchy across the platform:

| Feature Key | Display Label | Route Constant | Route Path | Current Status | Primary View Component |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `CHAT` | **Chat** | `ROUTES.CHAT` | `/chat` & `/chat/:id` | Existing | `client/src/features/chat/ChatContainer.jsx` |
| `LIBRARY` | **Library** | `ROUTES.LIBRARY` | `/library` | Existing | `client/src/pages/LibraryPage.jsx` |
| `SKILLS` | **Skills** | `ROUTES.SKILLS` | `/skills` | Existing | `client/src/pages/SkillsPage.jsx` |
| `INTERVIEW` | **Interview** | `ROUTES.INTERVIEW` | `/interview` | Existing | `client/src/pages/InterviewPage.jsx` |
| `DATA_MODELING`| **Data Modeling** | `ROUTES.SCHEMA` | `/schema-designer` | Existing | `client/src/pages/SchemaDesignerPage.jsx` |

---

## 2. Topbar & Header Specifications

### [TOP-001] Remove Redundant "Search Workspace" Input from Topbar
- **Status:** `IMPLEMENTED`
- **Impacted Files:**
  - [`client/src/layouts/AppLayout/Topbar.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/layouts/AppLayout/Topbar.jsx)
  - [`client/src/layouts/AppLayout/Topbar.module.scss`](file:///d:/1_projects/Production_ready/NexAI/client/src/layouts/AppLayout/Topbar.module.scss)
- **Specification:**
  - Removed large `searchTrigger` button with `"Search workspace..."` text from `Topbar.jsx`.
  - Search remains universally accessible via `Ctrl+K` shortcut and the sidebar search button.
  - Maintains responsive drawer menu toggle on mobile.

### [TOP-002] Borderless Top Level with Floating Round Action Icons
- **Status:** `IMPLEMENTED`
- **Impacted Files:**
  - [`client/src/layouts/AppLayout/Topbar.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/layouts/AppLayout/Topbar.jsx)
  - [`client/src/layouts/AppLayout/Topbar.module.scss`](file:///d:/1_projects/Production_ready/NexAI/client/src/layouts/AppLayout/Topbar.module.scss)
- **Specification:**
  - Removed the solid background strip and bottom border from the top bar (`background: transparent; border: none`).
  - Topbar right section strictly displays two **separate floating round circular buttons**:
    1. **Temporary Chat Circular Button:** (`MessageSquareDashed`) toggles ephemeral session without chat history persistence.
    2. **Theme Switcher Circular Button:** (`Sun` / `Moon`) circular button to toggle light / dark mode.
  - No combining wrapper; both are standalone floating circles with subtle elevation.

### [TOP-003] Chat Title Capsule on the Same Top Level (Eliminating Stacked Header Strip)
- **Status:** `IMPLEMENTED`
- **Impacted Files:**
  - [`client/src/layouts/AppLayout/Topbar.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/layouts/AppLayout/Topbar.jsx)
  - [`client/src/layouts/AppLayout/Topbar.module.scss`](file:///d:/1_projects/Production_ready/NexAI/client/src/layouts/AppLayout/Topbar.module.scss)
  - [`client/src/pages/Chat/ChatPage.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/pages/Chat/ChatPage.jsx)
- **Specification:**
  - Removed the separate `<header className={styles.chatHeader}>` strip from `ChatPage.jsx` that previously stacked underneath the topbar.
  - Active conversation title is rendered directly in `Topbar.jsx` on the **exact same horizontal level** as the floating round buttons as a separate floating capsule (`chatTitleCapsule`).
  - Yields maximum vertical viewing area for conversation content.

### [TOP-004] Silent Visual Mode Transition for Temporary Chat (No Toast Popups)
- **Status:** `IMPLEMENTED`
- **Impacted Files:**
  - [`client/src/layouts/AppLayout/Topbar.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/layouts/AppLayout/Topbar.jsx)
  - [`client/src/layouts/AppLayout/Topbar.module.scss`](file:///d:/1_projects/Production_ready/NexAI/client/src/layouts/AppLayout/Topbar.module.scss)
- **Specification:**
  - Removed noisy `toast.info(...)` popups on entering and exiting Temporary Chat.
  - Switched mode transition feedback strictly to elegant in-UI visual indicators:
    1. Active round button state with luminous glowing border and accent fill (`.temporaryActive`).
    2. Dashed accent border on the topbar chat title capsule (`.temporaryCapsule`).
    3. Prominent `Ephemeral` badge pill rendered inside the title capsule.
    4. Dashed border accentuating the input composer during temporary mode.

---

## 3. Sidebar Architecture & Collapsible Rail Specifications

### [SIDE-001] Strict Sequence Parity Between Open and Collapsed States
- **Status:** `IMPLEMENTED`
- **Impacted Files:**
  - [`client/src/layouts/AppLayout/Sidebar.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/layouts/AppLayout/Sidebar.jsx)
  - [`client/src/layouts/AppLayout/Sidebar.module.scss`](file:///d:/1_projects/Production_ready/NexAI/client/src/layouts/AppLayout/Sidebar.module.scss)
- **Specification:**
  - Collapsed rail follows the exact visual sequence as the expanded state by hiding `.navLabel` and centering the 40px icon.
  - Order:
    1. **Brand Logo / Header**
    2. **New Chat** icon (`SquarePen`)
    3. **Primary Offerings:** Library, Skills, Interview, Data Modeling
    4. **Pinned Bottom:** Single unified Settings & Profile entry (`Settings`)

### [SIDE-002] Collapsed State Exclusions (Projects & Chat Lists)
- **Status:** `IMPLEMENTED`
- **Impacted Files:**
  - [`client/src/layouts/AppLayout/Sidebar.jsx`](file:///d:/1_projects/Production_ready\NexAI/client/src/layouts/AppLayout/Sidebar.jsx)
- **Specification:**
  - Projects and Chat history lists are hidden in the closed/collapsed rail view.

### [SIDE-003] Profile & Settings Vertical Pinning (Prevent Floating Upward)
- **Status:** `IMPLEMENTED`
- **Impacted Files:**
  - [`client/src/layouts/AppLayout/Sidebar.module.scss`](file:///d:/1_projects/Production_ready/NexAI/client/src/layouts/AppLayout/Sidebar.module.scss)
- **Specification:**
  - Set `margin-top: auto` on `.footerSection` so Profile and Settings remain firmly anchored to the bottom in both open and collapsed modes.

### [SIDE-004] Merged Single Footer Settings & Profile Control (Zero Duplicate Popovers)
- **Status:** `IMPLEMENTED`
- **Impacted Files:**
  - [`client/src/layouts/AppLayout/Sidebar.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/layouts/AppLayout/Sidebar.jsx)
  - [`client/src/layouts/AppLayout/Sidebar.module.scss`](file:///d:/1_projects/Production_ready/NexAI/client/src/layouts/AppLayout/Sidebar.module.scss)
  - [`client/src/features/settings/SettingsModal/SettingsModal.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/features/settings/SettingsModal/SettingsModal.jsx)
- **Specification:**
  - Completely merged the redundant Profile avatar dropdown and Settings gear into a **single unified entry** at the bottom of the sidebar.
  - **Collapsed State:** Exactly one round icon button (`Settings size={18}`) at the bottom rail. Clicking it directly opens the full Settings & Profile modal dialog on the right side.
  - **Expanded State:** Single unified footer card displaying User Avatar, display name, plan badge, quota chip, and settings indicator. Clicking it directly opens the Settings & Profile modal dialog.
  - Eliminated redundant `userMenuItems` and all flyout popup dropdowns from the sidebar footer.

---

## 4. Brand Identity & Vector System

### [LOGO-001] SVG Vector Monogram & Dynamic Theme Color Tokens
- **Status:** `IMPLEMENTED`
- **Impacted Files:**
  - [`client/src/components/ui/NexAiLogo/NexAiLogo.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/components/ui/NexAiLogo/NexAiLogo.jsx)
  - [`client/src/components/ui/NexAiLogo/index.js`](file:///d:/1_projects/Production_ready/NexAI/client/src/components/ui/NexAiLogo/index.js)
  - [`client/src/components/ui/NexAiLogo/NexAiLogo.test.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/components/ui/NexAiLogo/NexAiLogo.test.jsx)
  - [`client/src/assets/logo.svg`](file:///d:/1_projects/Production_ready/NexAI/client/src/assets/logo.svg)
  - [`client/src/styles/tokens/_semantic.scss`](file:///d:/1_projects/Production_ready/NexAI/client/src/styles/tokens/_semantic.scss)
  - [`client/src/styles/themes/_dark.scss`](file:///d:/1_projects/Production_ready/NexAI/client/src/styles/themes/_dark.scss)
  - [`client/src/styles/themes/_light.scss`](file:///d:/1_projects/Production_ready/NexAI/client/src/styles/themes/_light.scss)
- **Specification:**
  - Faithfully converted the 1254x1254 NexAI geometric monogram "N" into an exact, resolution-independent SVG vector asset with sub-pixel Bézier curve fidelity.
  - Created reusable `<NexAiLogo size={24} glow ... />` component.
  - Tied all logo fills dynamically to new global CSS theme variables:
    - `--color-logo-primary`
    - `--color-logo-accent`
    - `--color-logo-glow`
    - `--color-logo-gradient`
  - Modifying these theme variables or switching dark/light appearance updates the logo dynamically across all UI surfaces without re-rendering raster bitmaps.
  - Replaced legacy raster `logo.png` across `Sidebar.jsx`, `AuthLayout.jsx`, `ThinkingIndicator.jsx`, `ChatHero.jsx`, and `MessageThread.jsx`.

---

## 5. Settings Architecture & Full Settings Modal

### [SETT-001] Move Wallet and Design System Under Settings
- **Status:** `IMPLEMENTED`
- **Impacted Files:**
  - [`client/src/layouts/AppLayout/Sidebar.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/layouts/AppLayout/Sidebar.jsx)
- **Specification:**
  - Removed `Wallet` and `Design System` from floating navigation rows.
  - Consolidated access into the Settings ecosystem.

### [SETT-002] Two-Column Settings Modal Dialog (Eliminating Sidebar Flyout Breakage)
- **Status:** `IMPLEMENTED`
- **Impacted Files:**
  - [`client/src/features/settings/SettingsModal/SettingsModal.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/features/settings/SettingsModal/SettingsModal.jsx)
  - [`client/src/features/settings/SettingsModal/SettingsModal.module.scss`](file:///d:/1_projects/Production_ready/NexAI/client/src/features/settings/SettingsModal/SettingsModal.module.scss)
  - [`client/src/features/settings/SettingsModal/index.js`](file:///d:/1_projects/Production_ready/NexAI/client/src/features/settings/SettingsModal/index.js)
  - [`client/src/layouts/AppLayout/Sidebar.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/layouts/AppLayout/Sidebar.jsx)
  - [`client/src/layouts/AppLayout/AppLayout.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/layouts/AppLayout/AppLayout.jsx)
  - [`client/src/store/uiStore.js`](file:///d:/1_projects/Production_ready/NexAI/client/src/store/uiStore.js)
- **Problem Fixed:**
  - Previously, clicking the Settings gear in the expanded or collapsed sidebar spawned a broken 3-icon flyout popup menu (`[gear] [wallet] [layers]`) overlapping the sidebar rail edge (`media_1793891402830_e298ba01.png`).
- **Solution & UX Architecture:**
  - Replaced flyout dropdown completely with direct trigger opening a sleek, two-column pop-up modal dialog matching the reference standard (`media_1793891485449_4dcee797.jpg`):
    - **Left Column (Inner Sidebar):**
      - Header: "Settings".
      - Nav categories: `General`, `Appearance`, `AI Memory & Tuning`, `Wallet & Quota`, `Design System` (DEV only), `Admin Console` (admin only).
      - Footer: Mini user profile card with user avatar, display name, and email.
    - **Right Column (Active Panel):**
      - Header & category subtitle with sleek `(X)` close button.
      - **General:** Model selection, thinking level, simulation mode toggle, web search toggle.
      - **Appearance:** Theme mode cards (Dark / Light / System auto).
      - **AI Memory & Tuning:** Embedded live `<MemoryManager />` component for managing long-term and short-term knowledge facts.
      - **Wallet & Quota:** Real-time quota gauges, credit balance, usage telemetry, and "Add Credits" button opening `RazorpayPaymentModal`.
      - **Design System & Admin:** Direct navigation actions.

---

## 5. Chat Input, Composer & Context Attachment Specifications

### [INP-001] Remove Redundant Skill Arrow Button
- **Status:** `IMPLEMENTED`
- **Impacted Files:**
  - [`client/src/features/chat/ChatInput/ChatInput.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/features/chat/ChatInput/ChatInput.jsx)
  - [`client/src/features/chat/ChatHero/ChatHero.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/features/chat/ChatHero/ChatHero.jsx)
- **Specification:**
  - Redundant skill arrow/zap button next to textarea removed. Skills are invoked via `/` or via the `+` menu.

### [INP-002] Compact Vertical Input Box Height with Auto-Growth
- **Status:** `IMPLEMENTED`
- **Impacted Files:**
  - [`client/src/features/chat/ChatInput/ChatInput.module.scss`](file:///d:/1_projects/Production_ready/NexAI/client/src/features/chat/ChatInput/ChatInput.module.scss)
  - [`client/src/features/chat/ChatHero/ChatHero.module.scss`](file:///d:/1_projects/Production_ready/NexAI/client/src/features/chat/ChatHero/ChatHero.module.scss)
- **Specification:**
  - Compact vertical padding and min-height for lean appearance, preserving elastic auto-expansion on multi-line text input.

### [INP-003] Hero Cleanups (Temporary Chat Tube & Static Prompts Removal)
- **Status:** `IMPLEMENTED`
- **Impacted Files:**
  - [`client/src/features/chat/ChatHero/ChatHero.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/features/chat/ChatHero/ChatHero.jsx)
- **Specification:**
  - Removed redundant `tempModeBar` ("Temporary chat" tube/pill below tagline) since Temporary Chat toggle exists on the top floating bar.
  - Removed static starter prompt chips; documented future memory-driven prompt suggestions.

### [INP-004] Attach Context Popover Library View Cleanup
- **Status:** `IMPLEMENTED`
- **Impacted Files:**
  - [`client/src/features/chat/ChatInput/AttachContextPopover.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/features/chat/ChatInput/AttachContextPopover.jsx)
- **Specification:**
  - In the Library sub-view of the attachment popover, removed the redundant `"Upload file"` action since the user can use the back button to select "Upload from Device".

### [INP-005] Clean Attached Context Preview (Ultra-Minimalist Chips & Images)
- **Status:** `IMPLEMENTED`
- **Impacted Files:**
  - [`client/src/features/chat/ChatInput/AttachedContextPreview.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/features/chat/ChatInput/AttachedContextPreview.jsx)
  - [`client/src/features/chat/ChatInput/AttachedContextPreview.module.scss`](file:///d:/1_projects/Production_ready/NexAI/client/src/features/chat/ChatInput/AttachedContextPreview.module.scss)
- **Specification:**
  - **Images:** Pure standalone thumbnail (`58x58px`) with rounded corners and a top-right floating circular cancel `(x)` button. No text metadata, size labels, or outer wrapper cards cluttering the input.
  - **Library Items, Documents, Notes, Files:** Single-line slim horizontal chip (icon + concise title + remove `(x)` button). No multi-line descriptions, snippet previews, or "Knowledge Source" tags.

### [INP-006] Skills in `+` Menu & Inline Horizontal Input-Attached Skill Picker
- **Status:** `IMPLEMENTED`
- **Impacted Files:**
  - [`client/src/features/chat/ChatInput/AttachContextPopover.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/features/chat/ChatInput/AttachContextPopover.jsx)
  - [`client/src/features/skills/SkillPickerModal/SkillPickerModal.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/features/skills/SkillPickerModal/SkillPickerModal.jsx)
  - [`client/src/features/skills/SkillPickerModal/SkillPickerModal.module.scss`](file:///d:/1_projects/Production_ready/NexAI/client/src/features/skills/SkillPickerModal/SkillPickerModal.module.scss)
  - [`client/src/features/chat/ChatInput/ChatInput.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/features/chat/ChatInput/ChatInput.jsx)
  - [`client/src/features/chat/ChatHero/ChatHero.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/features/chat/ChatHero/ChatHero.jsx)
- **Specification:**
  - Added `"Agent Skills"` entry to the `+` attachment menu.
  - Both `/` and the `+` menu trigger skills.
  - Replaced the full-screen modal overlay with an **inline horizontal panel** attached directly to the top edge of the input card, matching its width with compact horizontal-scrollable skill chips.

### [INP-012] Thumbnail Hover Overflow Fix (Eliminated Vertical Text Wrapping)
- **Status:** `IMPLEMENTED`
- **Impacted Files:**
  - [`client/src/features/chat/MessageThread/MessageAttachments.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/features/chat/MessageThread/MessageAttachments.jsx)
  - [`client/src/features/chat/MessageThread/MessageAttachments.module.scss`](file:///d:/1_projects/Production_ready/NexAI/client/src/features/chat/MessageThread/MessageAttachments.module.scss)
- **Problem Fixed:**
  - On 58x58px image thumbnails, hovering previously revealed a crowded text overlay with file name, file size, and an "Expand" badge. The narrow 34px content area forced the text to break character-by-character into vertical letters (`media_1793891722138_58c147ea.png`).
- **Solution:**
  - Replaced text overlay with a clean, centered translucent `<Maximize2 size={16} />` icon overlay with backdrop blur.
  - File name and size remain accessible via `.srOnly` for assistive technologies and screen readers.
  - Full metadata and download actions are displayed inside the lightbox on click.

### [INP-013] Full-Viewport Portal-Anchored Lightbox
- **Status:** `IMPLEMENTED`
- **Impacted Files:**
  - [`client/src/features/chat/AttachmentLightbox/AttachmentLightbox.jsx`](file:///d:/1_projects/Production_ready/NexAI/client/src/features/chat/AttachmentLightbox/AttachmentLightbox.jsx)
  - [`client/src/features/chat/AttachmentLightbox/AttachmentLightbox.module.scss`](file:///d:/1_projects/Production_ready/NexAI/client/src/features/chat/AttachmentLightbox/AttachmentLightbox.module.scss)
- **Problem Fixed:**
  - Previously, clicking an image thumbnail inside the composer card or chat hero caused the lightbox backdrop to be trapped inside ancestor elements having `transform` or `backdrop-filter`. This caused the backdrop blur to glitch across the input tube and positioned the popup low on the screen (`media_1793891783898_0a15fdda.jpg`).
- **Solution:**
  - Rendered `AttachmentLightbox` directly into `document.body` via `createPortal`.
  - Added body scroll locking (`overflow: hidden`) during preview.
  - Configured full-viewport backdrop (`100vw`, `100vh`, `z-index: 2000`) with centered media alignment across the entire browser viewport.

---

## 6. Advanced Memory & Context System Architecture

### [MEM-001] Dual-Layer Memory Management System
- **Status:** `PLANNED / ARCHITECTURAL SPECIFICATION`
- **Target Subsystems:**
  - Server: `server/src/services/memory.service.js`, `server/src/models/Memory.js`, `server/src/agents/prompts/memory.prompt.js`
  - Client: `client/src/features/memory/MemoryManager/`, `client/src/pages/Settings/SettingsPage.jsx`
- **Architectural Pillars:**
  1. **Short-Term Memory (Working Session Context):**
     - Sliding conversation token budget with message windowing.
     - Ephemeral scratchpad storing active context during agent tool execution.
  2. **Long-Term Memory (Persistent Semantic Knowledge):**
     - Automatic extraction of high-confidence user facts, preferences, project details, and coding constraints.
     - Vector indexing via Pinecone with metadata scoping (`userId`, `category`, `pinned`, `active`).
  3. **Explicit Memory Control ("Remember this"):**
     - User can explicitly instruct the AI: *"Remember that I work with Vite and SCSS modules"* or click a memory button on any message to commit a fact card.
  4. **Settings & AI Tuning Dashboard:**
     - Full management view in Settings:
       - Memory status toggle (Enable/Disable memory injection).
       - Fact table categorized into `Identity`, `Preferences`, `Projects`, `Instructions`.
       - Inline editing, pinning, and deletion of facts.
       - "Clear Memory" safe action.

---

## 7. Automated Task & Prompt Scheduling Architecture

### [SCHED-001] Background Automation & Prompt Scheduling Engine
- **Status:** `PLANNED / ARCHITECTURAL SPECIFICATION`
- **Target Subsystems:**
  - Server: `server/src/services/scheduler.service.js`, `server/src/models/Schedule.js`
  - Client: `client/src/features/scheduler/`, `client/src/pages/Settings/`
- **Architectural Pillars:**
  1. **Recurring Prompts & Tasks:**
     - Daily tech summaries, recurring code quality audits, periodic mock interview reminders.
  2. **Execution Worker:**
     - Node.js background scheduler executing scheduled Gemini prompts at specified cron intervals.
     - Output routing: Saved directly into user's Library (`type: 'document' | 'note'`) or delivered as a new unread conversation in Chat.
  3. **Credit Governance:**
     - Deducts credits according to standard token consumption rules (`ceil(totalTokens / 100)`).
     - If credits are insufficient, scheduler pauses and notifies the user rather than failing silently.

---

## 8. Library Document Workspace Reader (Full-Window View)

### [LIB-001] Dedicated Full-Window Document Workspace
- **Status:** `PLANNED / ARCHITECTURAL SPECIFICATION`
- **Target Subsystems:**
  - Client: `client/src/features/library/DocumentReader/`, `client/src/pages/Library/`
- **Current Problem:**
  - Viewing generated documents opens a pop-up modal (`DocumentViewModal`) with restricted height/width and double scrollbars.
- **Architectural Solution:**
  1. **Full Workspace Window / Reader View:**
     - Replaces popup dialog with a dedicated full-window reader route (`/library/doc/:id`) or an expansive side-by-side workspace split.
     - Full viewport width and height utilization, eliminating scroll breakage.
  2. **Core Capabilities:**
     - Sticky document header (Title, Date, Category, Word count, Status).
     - Clean actions toolbar: Edit sections, Export to PDF (`pdf-lib`), Copy Markdown, Print view.
     - Responsive typography with customizable reading width (Optimal 750px text measure with full-width diagram capabilities).
     - Outline / Table of Contents sidebar for long technical specifications.

---

## 9. Interactive Mind Map & Multi-Diagram Learning Engine

### [MAP-001] Google NotebookLM-Inspired Interactive Mind Map
- **Status:** `PLANNED / ARCHITECTURAL SPECIFICATION`
- **Target Subsystems:**
  - Client: `client/src/features/mindmap/`, `client/src/features/chat/MindMapBlock/`, `client/src/features/chat/MarkdownRenderer/`
  - Server / AI Prompts: `server/src/agents/prompts/mindmap.prompt.js`
- **Architectural Benchmark & How NotebookLM Operates:**
  - **Dynamic Tree Hierarchy:** Nodes are structured in a Left-to-Right (horizontal) directed tree with organic cubic Bézier connector curves (`M x0 y0 C (x0+x1)/2 y0, (x0+x1)/2 y1, x1 y1`).
  - **Expand/Collapse Pill Controls:** Each non-leaf node features a sleek chevron indicator pill (`>` when collapsed, `<` when expanded).
  - **NexAI Enhanced Auto-Focus & Centering Engine:**
    - When a user clicks the expand chevron on a node, the canvas does **not** remain static: it computes the bounding box of the newly expanded branch and smoothly glides/pans the SVG camera transform (`translate(tx, ty) scale(k)`) over 350ms, centering the active branch in view.
    - Active node receives an illuminated accent pulse ring (`--color-accent`).
  - **Floating Viewport Controls (Bottom-Right Dock):**
    - Recenter / Fit View (`Fit` / `<>`)
    - Zoom In (`+`) and Zoom Out (`-`)
    - Export / Download (High-resolution SVG & PNG export)
    - Full pan & zoom canvas via drag or mouse wheel.
  - **Contextual Node Actions (AI Tutor Interaction for Students & Developers):**
    - Clicking the node text (separate from the expand chevron) triggers an inline micro-action popover:
      1. *"Explain in Chat"* — Sends a focused query to Gemini about that sub-topic.
      2. *"Branch Out (Deepen)"* — Asks AI to generate 3–5 sub-nodes under this topic.
      3. *"Save as Note"* — Instantly saves this concept directly into the user's Library.

### [MAP-002] Multi-Diagram Ecosystem for Developers & Students
- **Status:** `PLANNED / ARCHITECTURAL SPECIFICATION`
- **Supported Diagram Types in NexAI:**
  1. **Interactive Mind Map (`mindmap`):** Expandable/collapsible concept explorer with auto-focus centering (book summaries, syllabus planning, project breakdown).
  2. **Technical Architecture & Flowcharts (`mermaid`):** System architectures, sequence diagrams, class diagrams, state machines, git graphs (implemented via `MermaidBlock.jsx`).
  3. **Visual Database Modeling (`schema`):** Interactive ERD canvas with live SQL generation and relational table links (implemented via `VisualErdCanvas.jsx`).
  4. **Algorithmic Step Flowchart (`flow`):** Step-by-step logic runner for interview preparation, showing active execution step state.

---

## 10. AI Technical Interview Simulation Arena Enhancements

### [INTV-001] Unified Real-Time Voice Typing in Interview Input
- **Status:** `PLANNED / ARCHITECTURAL SPECIFICATION`
- **Target Subsystems:**
  - Client: `client/src/features/interview/InterviewArena/InterviewArena.jsx`, `client/src/features/interview/InterviewArena/InterviewArena.module.scss`
  - Reusable Hook: `client/src/hooks/useSpeechRecognition.js`
- **Current State:**
  - `InterviewArena` currently contains a legacy inline SpeechRecognition implementation with isolated event handling.
- **Architectural Specification & Parity with Chat Composer:**
  1. **Adopt Reusable `useSpeechRecognition` Hook:**
     - Replace legacy inline recognition boilerplate with the unified `useSpeechRecognition({ continuous: true, interimResults: true })` hook established in the chat composer.
  2. **Interim Real-Time Speech-to-Text Streaming:**
     - Stream transcribed words directly into the response textarea in real-time as the candidate speaks their technical answer.
     - Automatically preserve existing typed text (`baseTextRef` preservation) so candidates can fluidly switch between voice dictation and keyboard typing without losing partial responses.
  3. **Visual Feedback & Mic State Synchronization:**
     - Animated microphone button matching the chat composer with pulsing recording glow, clear recording timer/status, and graceful fallback when browser microphone permissions or Web Speech API are unavailable.
  4. **Elastic Auto-Growth Textarea Synchronization:**
     - Dynamically expand the interview input textarea as spoken words stream in (up to 220px), preventing awkward internal scroll jumps during live interview responses.

---

## 11. Phased Implementation Roadmap & Branching Strategy

To maintain velocity while ensuring stability and test coverage, features are divided into structured milestones:

```
┌─────────────────────────────────────────────────────────────┐
│ Milestone 1: Composer, Parity & Bug Fixes (COMPLETED)       │
│ - Topbar floating capsules & separate round buttons         │
│ - Sidebar collapse sequence parity & bottom pinning         │
│ - Minimalist chips for attached files & image thumbnail     │
│ - Inline horizontal skill picker attached to input          │
│ - [BUG-001] Mermaid diagram zoom height reflow fix          │
│ - [BUG-002] MessageItem memoization & scroll flicker fix    │
│ - [BUG-003] In-place response regeneration (no user repeats)│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Milestone 2: Interactive Mind Map Engine (NotebookLM-Style) │
│ - Branch: feature/interactive-mindmap                       │
│ - Horizontal tree SVG with cubic bezier connectors          │
│ - Expand/collapse toggles with auto-centering camera glide  │
│ - Floating viewport dock & contextual node AI query         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Milestone 3: Full-Window Library Document Workspace         │
│ - Branch: feature/library-document-reader                   │
│ - Full-page DocumentReader page/pane replacing modal dialog │
│ - Markdown rendering, PDF export, TOC sidebar               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Milestone 4: Advanced Dual-Layer Memory & AI Tuning         │
│ - Branch: feature/memory-management-tuning                  │
│ - Short-term working context + Long-term Pinecone vector    │
│ - Settings Memory Manager dashboard                         │
│ - Explicit "Remember this" prompt interception              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Milestone 5: Background Automations & Task Scheduling       │
│ - Branch: feature/automated-scheduler                       │
│ - Node scheduler worker + Schedule model                    │
│ - UI management for recurring prompt jobs                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Milestone 6: Unified Voice Typing in Interview Arena        │
│ - Branch: feature/interview-voice-dictation                 │
│ - useSpeechRecognition hook integration into InterviewArena │
│ - Fluid interim streaming + keyboard typing hybrid          │
└─────────────────────────────────────────────────────────────┘
```

---

## 12. Traceability & Implementation Matrix

| Change ID | Category | Target Component/File | Scope | Status |
| :--- | :--- | :--- | :--- | :--- |
| `TOP-001` | Topbar | `Topbar.jsx` | Remove Search Workspace input | Done |
| `TOP-002` | Topbar | `Topbar.jsx` | Borderless top level with separate round floating icons | Done |
| `TOP-003` | Topbar / Chat | `Topbar.jsx`, `ChatPage.jsx` | Chat title capsule on same top level; eliminate double strip | Done |
| `TOP-004` | Topbar / Temporary Chat | `Topbar.jsx`, `Topbar.module.scss` | Silent visual mode indicators; eliminated noisy toast popups | Done |
| `SIDE-001`| Sidebar | `Sidebar.jsx` | Sequence parity on collapse | Done |
| `SIDE-002`| Sidebar | `Sidebar.jsx` | Exclude Projects and Chats in closed rail | Done |
| `SIDE-003`| Sidebar | `Sidebar.module.scss` | Anchor Profile & Settings to bottom | Done |
| `SIDE-004`| Sidebar | `Sidebar.jsx`, `Sidebar.module.scss` | Merged single Settings & Profile control; zero duplicate popovers | Done |
| `LOGO-001`| Brand Identity | `NexAiLogo/`, `_dark.scss`, `_light.scss` | SVG vector monogram with dynamic CSS theme color tokens | Done |
| `SETT-001`| Settings | `Sidebar.jsx` | Move Wallet & Design System under Settings | Done |
| `SETT-002`| Settings Modal | `SettingsModal/`, `Sidebar.jsx` | Two-column settings modal dialog replacing sidebar flyout breakage | Done |
| `INP-001` | Chat Input | `ChatInput.jsx`, `ChatHero.jsx` | Remove redundant skill trigger button | Done |
| `INP-002` | Chat Input | `ChatInput.module.scss` | Compact vertical height with dynamic auto-growth | Done |
| `INP-003` | Chat Hero | `ChatHero.jsx` | Remove redundant temporary tube & static prompt pills | Done |
| `INP-004` | Attachments | `AttachContextPopover.jsx` | Remove "Upload file" inside Library sub-view | Done |
| `INP-005` | Attachments | `AttachedContextPreview.jsx` | Standalone image thumbnail & slim single-line chips | Done |
| `INP-006` | Skills | `SkillPickerModal.jsx` | Skills in `+` menu & inline horizontal input dock | Done |
| `BUG-001` | Architecture Diagrams | `MermaidBlock.jsx`, `.module.scss` | Prevent zoom height inflation; scrollbars pan inside diagram | Done |
| `BUG-002` | Thread Rendering | `MessageThread.jsx`, `MarkdownRenderer.jsx` | Fix scroll blinking: memoized `MessageItem`, RAF throttle, GPU isolation | Done |
| `BUG-003` | Prompt / Response Regeneration | `chatStore.js`, `chat.controller.js`, `MessageThread.jsx` | In-place assistant regeneration without repeating/duplicating user prompts | Done |
| `INP-007` | Skills Autocomplete | `SkillPickerModal.jsx`, `.module.scss` | Compact vertical autocomplete matching Antigravity slash-command menu | Done |
| `INP-008` | Attachments | `ChatHero.jsx`, `ChatInput.jsx` | Multi-file appending (array state, multi-select, multiple attribute) | Done |
| `INP-009` | Composer Height | `ChatHero.module.scss`, `ChatHero.jsx` | Collapsed dead vertical empty gap: 1-line 24px initial height, tight padding | Done |
| `INP-010` | Topbar Canvas | `Topbar.module.scss`, `ChatPage.jsx` | 100% transparent topbar canvas; removed horizontal colored strip | Done |
| `INP-011` | Media Lightbox | `AttachmentLightbox/`, `AttachedContextPreview.jsx` | Sleek overlay lightbox for image/PDF previews without bulky modal header | Done |
| `INP-012` | Image Preview Hover | `MessageAttachments.jsx`, `.module.scss` | Replaced crowded text overlay with centered `<Maximize2 />` icon overlay | Done |
| `INP-013` | Full-Viewport Lightbox | `AttachmentLightbox.jsx`, `.module.scss` | `createPortal` to body; eliminates ancestor transform & blur clipping | Done |
| `INP-014` | Skills Autocomplete Float | `SkillPickerModal.module.scss`, `ChatHero.jsx`, `ChatInput.jsx` | Matched input surface background (`--color-bg-surface`), rounded corners (`--radius-xl`), and 12px floating gap | Done |
| `AI-001`  | AI Prompt Discipline | `chat.prompt.js` | Restrict diagrams to explicit user requests or required spatial topology | Done |
| `AI-002`  | Strict Negative Constraints | `chat.prompt.js` | Forbid unprompted diagrams and prompt blocks; default strictly to clean text | Done |
| `BUG-004` | Thread Rendering | `MessageThread.jsx` | Fixed `logoImg is not defined` crash; replaced with `<NexAiLogo />` | Done |
| `VOICE-001`| Voice Mode | `chatStore.js`, `speechSynthesis.js`, `ChatInput.jsx`, `ChatHero.jsx` | Hands-free continuous voice conversation with real Microsoft Edge Neural TTS | Done |
| `INP-015` | Skills Autocomplete | `ChatInput.jsx`, `ChatHero.jsx`, `SkillPickerModal.jsx` | Slash retained in input; backspace/click-outside dismissal | Done |
| `INP-016` | Media Lightbox | `AttachmentLightbox.module.scss` | High-contrast solid dark backdrop; eliminates Chromium GPU blur clipping | Done |
| `MAP-001` | Mind Map Engine | `MindMapBlock/`, `MarkdownRenderer.jsx` | NotebookLM-style interactive mind map with auto-focus centering | Planned |
| `MAP-002` | Multi-Diagram Ecosystem | Architecture & Docs | Multi-diagram suite for developers & students (Mermaid, MindMap, ERD) | Planned |
| `LIB-001` | Library | `DocumentViewModal.jsx` / Reader | Full-window Document Reader replacing modal | Planned |
| `MEM-001` | Core AI | Server & Settings Memory | Dual-layer memory & AI tuning in Settings | Planned |
| `SCHED-001`| Automations | Server scheduler & Client | Background prompt scheduling engine | Planned |
| `INTV-001`| Interview Input | `InterviewArena.jsx`, `useSpeechRecognition.js` | Real-time voice typing parity with chat in technical interview input | Planned |

---

## 13. Execution Log & History

- **2026-11-05 (Batch 1):** Initialized master specification with 5 core offerings, topbar search removal, collapsed rail parity, and bottom footer anchoring.
- **2026-11-05 (Batch 2):** Cataloged topbar quota removal, side-by-side temporary chat & theme buttons, chat input height squeezing, skill arrow button removal, and prompt memory strategy.
- **2026-11-05 (Batch 3):** Implemented library attachment popover cleanup, ultra-minimalist image thumbnails and compact attachment chips, inline horizontal input-attached skill picker, and added architectural blueprints for Memory, Scheduling, and Full-Window Document Workspace.
- **2026-11-05 (Batch 4):** Completely eliminated double stacked header strips. Topbar made transparent and borderless with separate round floating icons; chat title placed in a floating capsule on the exact same row; removed redundant temporary chat tube below hero headline.
- **2026-11-05 (Batch 5):** Fixed Mermaid diagram zoom height bug (`BUG-001`) by removing dynamic height inflation so zoom scrolls internally without pushing content down. Fixed scroll flickering/blinking (`BUG-002`) by extracting memoized `MessageItem`, stabilizing callbacks to prevent MarkdownRenderer unmounting/remounting Prism & Mermaid, throttling scroll with RAF, and adding GPU layer isolation (`transform: translateZ(0)`). Verified with 39 test suites (177 tests) and 100% clean production build.
- **2026-11-05 (Batch 6):** Researched Google NotebookLM Mind Map UX mechanics (expand/collapse pills, organic horizontal bezier links, viewport docking, and camera auto-focus centering). Formulated specification for `MAP-001` (Interactive Mind Map with smooth branch camera glide) and `MAP-002` (Multi-Diagram suite for students and developers). Integrated into roadmap Milestone 2.
- **2026-11-05 (Batch 7):**
  - **Skill Autocomplete UI (`INP-007`):** Transformed inline skill picker into vertical compact slash-command dropdown matching Gemini Antigravity (sleek single-line rows with icon, bold title, muted description, arrow key navigation, enter to select, scroll wheel support, no search input header).
  - **Full-Width Transparent Topbar (`INP-010`):** Removed the dark horizontal strip from behind the capsules. The top level is 100% transparent and borderless across the full width of the device so only the chat title capsule and round floating buttons float over the canvas.
  - **Multiple Attachments (`INP-008`):** Converted attachment states in both `ChatHero.jsx` and `ChatInput.jsx` to arrays. Selecting additional files/images/PDFs via `+` or drag-and-drop appends them instead of replacing previous attachments.
  - **Input Composer Dead Space Reduction (`INP-009`):** Collapsed the large empty space below the placeholder text in `ChatHero` and `ChatInput`. Switched textarea to 1 initial row, `min-height: 24px`, tightened card padding, and eliminated dead gaps between placeholder and bottom action bar.
  - **Overlay Media Lightbox (`INP-011`):** Created `AttachmentLightbox` with translucent overlay controls (download, close, meta chip). Images and PDFs in input preview and message thread open in this sleek lightbox without any bulky outer dialog frames. Thread image blocks reduced to compact thumbnails matching the input composer.
  - **AI Response & Diagram Discipline (`AI-001`):** Updated `server/src/agents/prompts/chat.prompt.js` so Gemini only generates Mermaid or Mindmap diagrams when explicitly requested or fundamentally required for visual system architecture, keeping normal technical responses clean, concise, and direct.
  - **Verification:** All 39 test suites (177 tests) passing; client builds with 0 errors.
- **2026-11-05 (Batch 8):**
  - **In-Place Response Regeneration (`BUG-003`):** Fixed repeating user message bug (`media_1793891144941_6ef8d3d2.jpg`). Previously, retrying or resending a prompt called `sendMessage()`, appending duplicate copies of the same user message to the thread and MongoDB. Implemented `regenerateResponse(targetIndex)` in `chatStore.js` and `regenerate: true` in `chat.controller.js` and `chat.validator.js`:
    - The existing user prompt is preserved without duplication.
    - The corresponding assistant response is reset and regenerated in place, smoothly replacing the old response or error card.
    - Verified with client test suite (39 files, 178 tests) and server integration suite (16 files, 172 tests).
- **2026-11-05 (Batch 9):**
  - **Interview Voice Dictation Parity Plan (`INTV-001`):** Added architectural specification to bring the real-time interim voice typing and auto-growth experience from the chat composer into the technical interview arena (`InterviewArena.jsx`). Integrated into Milestone 6 of the Phased Implementation Roadmap and mapped in the Traceability Matrix.
- **2026-11-05 (Batch 10):**
  - **Temporary Chat Silent Visual Mode (`TOP-004`):** Removed noisy developer toast notifications (`toast.info`) upon entering or leaving Temporary Chat. Replaced with clear in-UI visual indicators (luminous active icon border, dashed capsule border with an "Ephemeral" badge pill, and dashed composer highlight).
  - **Two-Column Settings Modal Dialog (`SETT-002`):** Fixed the sidebar UI breakage where clicking Settings spawned an awkward 3-icon flyout menu overlapping the rail. Created a sleek two-column popup Settings Modal dialog matching the user's reference specification (`media_1793891485449_4dcee797.jpg`):
    - Left inner navigation bar with categorized tabs (`General`, `Appearance`, `AI Memory & Tuning`, `Wallet & Quota`, `Design System`, `Admin Console`) and bottom user profile card.
    - Right panel with categorized controls, embedded live `<MemoryManager />` tab, wallet telemetry, and credit top-up trigger.
    - Wireframe seamlessly integrated into `AppLayout.jsx` and triggered directly from both expanded and collapsed footer Settings buttons.
  - **Verification:** All 39 test suites (178 tests) passing; client builds with 0 errors.
- **2026-11-05 (Batch 11):**
  - **NexAI SVG Vector Logo & Dynamic Theme Variables (`LOGO-001`):** Vectorized the NexAI monogram into an SVG component (`NexAiLogo.jsx`) and `logo.svg`. Added global theme variables (`--color-logo-primary`, `--color-logo-accent`, `--color-logo-glow`, `--color-logo-gradient`) across semantic tokens, dark theme, and light theme. Changing theme tokens instantly updates the brand emblem everywhere in real-time. Replaced legacy raster images across Sidebar, AuthLayout, ThinkingIndicator, ChatHero, and MessageThread.
  - **Merged Settings & Profile Footer Entry (`SIDE-004`):** Consolidated the Profile avatar and Settings button in the sidebar footer into a single unified entry in both expanded and collapsed modes. Clicking it directly opens the two-column Settings Modal with a dedicated Profile & Account tab, wallet, billing, general settings, and appearance. Eliminated duplicate flyout popovers and redundant action triggers.
  - **Verification:** All 40 client test suites (181 tests) passing; client builds with 0 errors in 26.8s.
- **2026-11-05 (Batch 12):**
  - **Thumbnail Hover UI Breakage Fix (`INP-012`):** Removed the crowded multi-line file metadata and "Expand" text badge that broke vertically character-by-character on 58x58px thumbnail cards (`media_1793891722138_58c147ea.png`). Replaced with a clean, centered translucent `<Maximize2 size={16} />` icon overlay with backdrop blur. Retained screen-reader accessibility via `.srOnly`.
  - **Portal-Anchored Full-Screen Lightbox (`INP-013`):** Fixed image preview pop-up containment glitch where parent `transform` or `backdrop-filter` in the chat input or composer trapped the lightbox inside the bottom input tube (`media_1793891783898_0a15fdda.jpg`). Mounted `AttachmentLightbox` directly into `document.body` via `createPortal`, applied full-screen backdrop blurring (`100vw`, `100vh`, `z-index: 2000`), and locked body scrolling while open.
  - **Verification:** All 41 client test suites (184 tests) passing; client builds with 0 errors in 27.3s.
- **2026-11-05 (Batch 13):**
  - **Floating Skill Container with Gap & Matched Surface Background (`INP-014`):** Fixed skill autocomplete styling based on `media_1793891858074_b095ab9d.png` and `media_1793892708717_8ebde790.png`:
    - Matched `.inlineContainer` background color to `var(--color-bg-surface)` (the darker surface token used by the input tube, replacing the lighter `var(--color-bg-elevated)`).
    - Added a clear 12px floating gap (`margin-bottom: var(--space-3)`) above the input tube to eliminate visual collision.
    - Set `border-radius: var(--radius-xl)` (24px) on `.inlineContainer` matching the composer's curvature.
    - Completely removed `z-index` and switched to natural vertical y-axis flex positioning with `gap: var(--space-3)` (12px) on `.composerWrapper` and `.inputContainer`.
    - Completely removed `composerFormWithInlinePicker` and `composerCardWithInlinePicker` classes so both the floating skill container and input tube preserve their own distinct, fully rounded corners on all sides without any overlap or cutting.
    - Wrapped `SkillPickerModal` and `composerCard` in `ChatHero` with `.composerWrapper` for identical vertical spacing in both empty and active thread views.
  - **Strict AI Negative Constraints (`AI-002`):** Updated `server/src/agents/prompts/chat.prompt.js` with explicit negative constraints:
    - Default strictly to clear, direct markdown text, bullet points, and code snippets.
    - Strictly forbid unprompted Mermaid or Mindmap diagrams unless the user explicitly requests one using keywords like "diagram", "flowchart", "mindmap", "visualize", "draw", or "architecture".
    - Strictly forbid unsolicited ````prompt ... ```` template blocks in regular answers unless explicitly requested.
  - **Verification:** All 41 client test suites (184 tests) passing; production bundle built cleanly in 25.8s with 0 errors.
- **2026-11-05 (Batch 14):**
  - **MessageThread ReferenceError Fix (`BUG-004`):** Resolved runtime crash `ReferenceError: logoImg is not defined` in `MessageThread.jsx:293` (`media_1793896681123_86d5a1d7.jpg`). Replaced legacy `logoImg` raster reference with `<NexAiLogo size={22} className={styles.avatarLogo} />`, connecting the message thread AI avatar to the vector logo and theme variables.
  - **Verification:** All 41 client test suites (184 tests) passing; production bundle compiled in 21.02s with 0 errors.
- **2026-11-05 (Batch 15):**
  - **Slash Autocomplete Retention & Dismissal (`INP-015`):** Retained slash character in the input during typing, added live query filtering, immediate Backspace dismissal when removing `/` or `@`, and instant dismissal when clicking on the input tube or outside the modal.
  - **Lightbox Composite Bug Fix (`INP-016`):** Replaced nested `backdrop-filter: blur` on the fixed overlay with a solid high-contrast `rgba(3, 4, 8, 0.92)` dark backdrop to eliminate black/grey blur rectangle GPU artifacts over the input tube.
  - **Removed Developer Toast Spam:** Silenced toast notifications on voice mode toggle and temporary chat mode, relying strictly on clean in-UI visual indicators.
- **2026-11-05 (Batch 16):**
  - **Hands-Free Conversational Voice Mode with Server Edge Neural TTS (`VOICE-001`):** Integrated the exact same studio-grade Microsoft Edge Neural voice engine (`msedge-tts` with `en-US-ChristopherNeural` at 0 credits / free tier) used in the interview section and "Read aloud" feature. Completely eliminated robotic sounding browser speech synthesis.
  - **Hands-Free Conversational Turn-Taking Loop:** Implemented a 1.4-second silence detection timer that automatically sends the prompt when the user stops speaking. Mic mutes while AI replies and reads aloud via Edge Neural audio, then automatically re-arms when AI finishes speaking so the user can continue speaking hands-free without clicking Send or Mic. Supported instant barge-in to interrupt AI speech.
  - **Verification:** 42 test suites (193 tests) passing; production build passed in 22.22s with 0 errors.
