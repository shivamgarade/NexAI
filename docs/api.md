# NexAI API Documentation

All routes are prefixed with `/api` and require authentication unless explicitly marked as public.

## Standard Response Formats

### Success Response

```json
{
  "data": { ... },
  "meta": { ... } // optional
}
```

### Error Response

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human-readable description",
    "details": null // optional extra data or validation errors
  }
}
```

---

## Health & System

### GET `/api/health`

Check backend server status and database connectivity.

- **Auth:** Public
- **Method:** `GET`
- **Response `200 OK` (when database is connected)**:

```json
{
  "data": {
    "status": "ok",
    "db": "connected",
    "uptime": 12.34
  }
}
```

- **Response `503 Service Unavailable` (when database is disconnected)**:

```json
{
  "data": {
    "status": "degraded",
    "db": "disconnected",
    "uptime": 12.34
  }
}
```

---

## Authentication & Authorization

### POST `/api/auth/register`

Register a new user account with email and password. Assigns 100 starter credits.

- **Auth:** Public (Rate-limited: 30 requests/15 min)
- **Method:** `POST`
- **Request Body:**

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

- **Response `201 Created`**:

```json
{
  "data": {
    "user": {
      "_id": "673f1234...",
      "email": "user@example.com",
      "role": "user",
      "wallet": {
        "creditsRemaining": 100,
        "tier": "free",
        "totalTokensConsumed": 0
      },
      "settings": {
        "theme": "dark",
        "defaultModel": "flash",
        "webSearchDefaultOn": false
      },
      "createdAt": "2026-09-25T12:00:00.000Z",
      "updatedAt": "2026-09-25T12:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1Ni..."
  }
}
```

_Note: Sets `refreshToken` in an httpOnly cookie (7-day duration)._

### POST `/api/auth/login`

Authenticate an existing user with email and password.

- **Auth:** Public (Rate-limited: 30 requests/15 min)
- **Method:** `POST`
- **Request Body:**

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

- **Response `200 OK`**:

```json
{
  "data": {
    "user": { ... },
    "accessToken": "eyJhbGciOiJIUzI1Ni..."
  }
}
```

_Note: Sets `refreshToken` in an httpOnly cookie._

### POST `/api/auth/google`

Authenticate or register a user via Google OAuth ID token.

- **Auth:** Public (Rate-limited: 30 requests/15 min)
- **Method:** `POST`
- **Request Body:**

```json
{
  "credential": "google_id_token_jwt..."
}
```

- **Response `200 OK`**:

```json
{
  "data": {
    "user": { ... },
    "accessToken": "eyJhbGciOiJIUzI1Ni..."
  }
}
```

### POST `/api/auth/refresh`

Generate a new short-lived access token using the httpOnly refresh cookie.

- **Auth:** Public (uses `refreshToken` cookie)
- **Method:** `POST`
- **Response `200 OK`**:

```json
{
  "data": {
    "user": { ... },
    "accessToken": "eyJhbGciOiJIUzI1Ni..."
  }
}
```

### POST `/api/auth/logout`

Log out and clear the httpOnly refresh cookie.

- **Auth:** Public
- **Method:** `POST`
- **Response `200 OK`**:

```json
{
  "data": {
    "message": "Logged out successfully"
  }
}
```

### GET `/api/auth/me`

Retrieve the authenticated user's profile and credit status.

- **Auth:** Bearer Token
- **Method:** `GET`
- **Header:** `Authorization: Bearer <accessToken>`
- **Response `200 OK`**:

```json
{
  "data": {
    "user": { ... }
  }
}
```

---

## User Settings

### PATCH `/api/users/me/settings`

Update appearance and default preferences for the authenticated user.

- **Auth:** Bearer Token
- **Method:** `PATCH`
- **Request Body:**

```json
{
  "theme": "light", // "dark" | "light"
  "defaultModel": "pro", // "flash" | "pro"
  "webSearchDefaultOn": true
}
```

- **Response `200 OK`**:

```json
{
  "data": {
    "user": { ... }
  }
}
```

---

## Admin

### GET `/api/admin/stats`

Telemetry and metrics endpoint restricted to admin users.

- **Auth:** Bearer Token + Role `admin`
- **Method:** `GET`
- **Response `200 OK`**:

```json
{
  "data": {
    "message": "Admin authorization verified"
  }
}
```

- **Response `403 Forbidden` (for non-admin users)**:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions to access this resource",
    "details": null
  }
}
```

---

## Chat & Messaging (Step 3 & Step 6)

### GET `/api/chats`

Retrieve chat sessions belonging to the authenticated user, ordered by most recently updated. Supports filtering by project.

- **Auth:** Bearer Token
- **Method:** `GET`
- **Query Params:**
  - `projectId` *(optional, string)*: Filter chats belonging to a specific Project Workspace.
- **Response `200 OK`**:

```json
{
  "data": [
    {
      "_id": "673f5678...",
      "userId": "673f1234...",
      "projectId": "67401122...", // or null
      "title": "React Architecture Discussion",
      "pinned": false,
      "createdAt": "2026-09-25T12:30:00.000Z",
      "updatedAt": "2026-09-25T12:35:00.000Z"
    }
  ]
}
```

### POST `/api/chats`

Create a new chat conversation, optionally associated with a Project Workspace.

- **Auth:** Bearer Token
- **Method:** `POST`
- **Request Body:**

```json
{
  "title": "My New Chat", // optional, defaults to "New Chat"
  "projectId": "67401122..." // optional project ObjectId
}
```

- **Response `201 Created`**:

```json
{
  "data": {
    "_id": "673f5678...",
    "userId": "673f1234...",
    "projectId": "67401122...",
    "title": "My New Chat",
    "pinned": false,
    "createdAt": "2026-09-25T12:30:00.000Z",
    "updatedAt": "2026-09-25T12:30:00.000Z"
  }
}
```

### PATCH `/api/chats/:id`

Update an existing chat session (title, project association, or pin status).

- **Auth:** Bearer Token
- **Method:** `PATCH`
- **Request Body:**

```json
{
  "title": "Updated Chat Title", // optional
  "projectId": "67401122...", // optional (pass null to detach from project)
  "pinned": true // optional
}
```

- **Response `200 OK`**:

```json
{
  "data": {
    "_id": "673f5678...",
    "userId": "673f1234...",
    "projectId": "67401122...",
    "title": "Updated Chat Title",
    "pinned": true,
    "updatedAt": "2026-09-25T12:40:00.000Z"
  }
}
```

- **Response `200 OK`**:

```json
{
  "data": {
    "_id": "673f5678...",
    "userId": "673f1234...",
    "title": "Updated Chat Title",
    "updatedAt": "2026-09-25T12:36:00.000Z"
  }
}
```

### DELETE `/api/chats/:id`

Delete a chat session and all messages associated with it.

- **Auth:** Bearer Token
- **Method:** `DELETE`
- **Response `200 OK`**:

```json
{
  "data": {
    "message": "Chat deleted successfully"
  }
}
```

### GET `/api/chats/:id/messages`

Retrieve message history for a specific chat owned by the authenticated user in chronological order.

- **Auth:** Bearer Token
- **Method:** `GET`
- **Response `200 OK`**:

```json
{
  "data": [
    {
      "_id": "673f9012...",
      "chatId": "673f5678...",
      "role": "user",
      "content": "What is the difference between state and props?",
      "tokensUsed": 0,
      "createdAt": "2026-09-25T12:31:00.000Z"
    },
    {
      "_id": "673f9013...",
      "chatId": "673f5678...",
      "role": "assistant",
      "content": "In React, **props** are inputs passed down...",
      "tokensUsed": 184,
      "createdAt": "2026-09-25T12:31:02.000Z"
    }
  ]
}
```

### POST `/api/chats/:id/messages` (SSE Streaming)

Send a prompt message into a chat and receive the AI response streamed in real time via Server-Sent Events (SSE).

- **Auth:** Bearer Token (Credit Check required: `creditsRemaining > 0`)
- **Rate-limit:** 30 requests / minute per IP
- **Method:** `POST`
- **Request Body:**

```json
{
  "content": "Explain vector embeddings concisely.",
  "model": "flash" // optional: "flash" | "pro" (defaults to user settings or flash)
}
```

- **Response Stream (`200 OK`, `Content-Type: text/event-stream`):**
  - **`event: token`**
    ```json
    data: {"text":"Vector "}
    data: {"text":"embeddings "}
    data: {"text":"are numerical arrays..."}
    ```
  - **`event: done`**
    ```json
    data: {"messageId":"673f9013...","tokensUsed":120,"creditsDeducted":2,"creditsRemaining":98,"chatTitle":"Vector Embeddings Explained"}
    ```
  - **`event: error`** (emitted if stream fails prematurely)
    ```json
    data: {"code":"GEMINI_API_ERROR","message":"Stream failed to complete"}
    ```

- **Insufficient Credits (`402 Payment Required`):**
  If `wallet.creditsRemaining <= 0` prior to initiating the call:

```json
{
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "Recharge to continue",
    "details": null
  }
}
```

### Frontend Streaming Client (`lib/sse.js`)

Because standard `EventSource` cannot send `POST` request bodies or `Authorization: Bearer <token>` headers, the frontend consumes this endpoint using `fetch` with `ReadableStream` (`client/src/lib/sse.js`).

- **Stream Parser:** `parseSseStream(readableStream, { onToken, onDone, onError })` safely decodes UTF-8 Uint8Array chunks, buffers network fragment boundaries, and dispatches SSE events.
- **Client Method:** `streamChatMessage({ chatId, content, model, signal, onToken, onDone, onError })` connects to `/api/chats/:id/messages`, handles 402 HTTP status with `insufficientCredits` activation, and executes the parser.
- **Credit Sync:** On receiving the `done` event, `chatStore` atomically dispatches `useAuthStore.getState().updateCredits(creditsRemaining)`, updating the Topbar and Sidebar `CreditBadge` without a page refresh.

---

## Personal Library (Step 5: Library & Semantic Search)

### POST `/api/library/suggest`

Analyzes article content or user notes and generates an AI-suggested title, summary, and tags with Gemini. Does **NOT** save the item to the database (Suggest &rarr; Review &rarr; Confirm pattern).

- **Auth:** Bearer Token (Credit Check required: `creditsRemaining > 0`)
- **Rate-limit:** 30 requests / minute per IP
- **Method:** `POST`
- **Request Body (for link):**

```json
{
  "type": "link",
  "url": "https://example.com/guide-to-react"
}
```

- **Request Body (for note):**

```json
{
  "type": "note",
  "content": "Docker multi-stage builds help create smaller container images by separating build dependencies from runtime..."
}
```

- **Response `200 OK`**:

```json
{
  "data": {
    "type": "link",
    "url": "https://example.com/guide-to-react",
    "title": "A Modern Guide to React Architecture",
    "summary": "Explores component composition, custom hooks, and server-side rendering patterns in modern web applications.",
    "tags": ["react", "architecture", "frontend", "javascript"],
    "content": "Extracted text content...",
    "tokensUsed": 160,
    "creditsDeducted": 2,
    "creditsRemaining": 98
  }
}
```

- **Response `402 Payment Required` (when credit balance is 0):**

```json
{
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "Recharge to continue",
    "details": null
  }
}
```

---

### POST `/api/library/documents/generate`

Generates an AI-drafted structured document (resume, technical spec, analysis report, study notes) using Gemini Flash JSON mode. Returns a draft with structured sections (`title`, `category`, `summary`, `sections: [{ heading, body }]`) without auto-saving to the database (Suggest &rarr; Review &rarr; Confirm pattern).

- **Auth:** Bearer Token (Credit Check required: `creditsRemaining > 0`)
- **Rate-limit:** 30 requests / minute per IP
- **Method:** `POST`
- **Request Body:**

```json
{
  "prompt": "Write a senior full-stack engineer resume with React, Node.js, and cloud systems",
  "category": "resume"
}
```

- **Response `200 OK`**:

```json
{
  "data": {
    "title": "Senior Full-Stack Software Engineer Resume",
    "category": "resume",
    "summary": "Experienced engineer with 5+ years building scalable distributed web applications.",
    "sections": [
      { "heading": "Professional Summary", "body": "Proven track record in high-concurrency systems..." },
      { "heading": "Technical Skills", "body": "- **Frontend:** React 18, Vite, TypeScript\n- **Backend:** Node.js, Express, MongoDB" },
      { "heading": "Work Experience", "body": "**Senior Engineer** @ Acme Corp (2022-Present)..." }
    ],
    "tokensUsed": 350,
    "creditsDeducted": 4,
    "creditsRemaining": 96
  }
}
```

- **Response `402 Payment Required` (when credit balance is 0):**

```json
{
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "Recharge to continue",
    "details": null
  }
}
```

---

### GET `/api/library/documents/:id/export.pdf`

Generates and streams a styled, multi-page PDF document server-side using `pdf-lib` with automatic text wrapping, pagination, headers/footers, and page numbers.

- **Auth:** Bearer Token
- **Method:** `GET`
- **Response `200 OK`**:
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="document_title.pdf"`
  - Binary stream of styled PDF bytes.


### POST `/api/library`

Saves a confirmed library item into MongoDB and generates dense vector embeddings stored in the vector database for semantic search.

- **Auth:** Bearer Token
- **Method:** `POST`
- **Request Body:**

```json
{
  "type": "link",
  "url": "https://example.com/guide-to-react",
  "title": "A Modern Guide to React Architecture",
  "summary": "Explores component composition and state management.",
  "tags": ["react", "architecture", "frontend"],
  "content": "Article body text..."
}
```

- **Response `201 Created`**:

```json
{
  "data": {
    "_id": "673fa001...",
    "userId": "673f1234...",
    "type": "link",
    "url": "https://example.com/guide-to-react",
    "title": "A Modern Guide to React Architecture",
    "summary": "Explores component composition and state management.",
    "tags": ["react", "architecture", "frontend"],
    "content": "Article body text...",
    "vectorId": "673fa001...",
    "createdAt": "2026-09-25T13:00:00.000Z",
    "updatedAt": "2026-09-25T13:00:00.000Z"
  }
}
```

---

### GET `/api/library`

Retrieves paginated library items owned by the authenticated user, optionally filtered by tag. Includes all unique user tags in metadata.

- **Auth:** Bearer Token
- **Method:** `GET`
- **Query Parameters:**
  - `tag` (optional string): Filter items matching this tag
  - `page` (optional integer, default `1`)
  - `limit` (optional integer, default `20`, max `100`)

- **Response `200 OK`**:

```json
{
  "data": [
    {
      "_id": "673fa001...",
      "userId": "673f1234...",
      "type": "link",
      "url": "https://example.com/guide-to-react",
      "title": "A Modern Guide to React Architecture",
      "summary": "Explores component composition and state management.",
      "tags": ["react", "architecture", "frontend"],
      "createdAt": "2026-09-25T13:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "tags": ["architecture", "frontend", "react"]
  }
}
```

---

### GET `/api/library/search`

Executes semantic search over the authenticated user's library items by conceptual meaning using vector embeddings with MongoDB text-ranking fallback.

- **Auth:** Bearer Token
- **Method:** `GET`
- **Query Parameters:**
  - `q` (required string): Natural language query or concept

- **Response `200 OK`**:

```json
{
  "data": [
    {
      "_id": "673fa001...",
      "title": "A Modern Guide to React Architecture",
      "summary": "Explores component composition and state management.",
      "tags": ["react", "architecture", "frontend"],
      "type": "link",
      "url": "https://example.com/guide-to-react",
      "createdAt": "2026-09-25T13:00:00.000Z"
    }
  ]
}
```

---

### GET `/api/library/:id`

Retrieves a single library item by ID owned by the authenticated user.

- **Auth:** Bearer Token
- **Method:** `GET`
- **Response `200 OK`**:

```json
{
  "data": {
    "_id": "673fa001...",
    "userId": "673f1234...",
    "type": "link",
    "title": "A Modern Guide to React Architecture",
    "summary": "Explores component composition...",
    "tags": ["react", "architecture"],
    "createdAt": "2026-09-25T13:00:00.000Z"
  }
}
```

---

### PATCH `/api/library/:id`

Updates title, summary, tags, or content for an existing library item. Automatically regenerates and updates the vector embedding if text attributes changed.

- **Auth:** Bearer Token
- **Method:** `PATCH`
- **Request Body:**

```json
{
  "title": "Updated Title",
  "summary": "Updated summary text",
  "tags": ["react", "frontend", "web-dev"]
}
```

- **Response `200 OK`**:

```json
{
  "data": {
    "_id": "673fa001...",
    "title": "Updated Title",
    "summary": "Updated summary text",
    "tags": ["react", "frontend", "web-dev"],
    "updatedAt": "2026-09-25T13:05:00.000Z"
  }
}
```

---

### DELETE `/api/library/:id`

Deletes a library item from MongoDB and purges its vector embedding from the vector index.

- **Auth:** Bearer Token
- **Method:** `DELETE`
- **Response `200 OK`**:

```json
{
  "data": {
    "message": "Library item deleted successfully"
  }
}
```

---

## Project Workspaces (Step 6 / Projects)

### GET `/api/projects`

Retrieve all project workspaces created by the authenticated user, complete with real-time associated chat counts.

- **Auth:** Bearer Token
- **Method:** `GET`
- **Response `200 OK`**:

```json
{
  "data": [
    {
      "_id": "67401122...",
      "userId": "673f1234...",
      "name": "AI Viva Preparation",
      "description": "Viva prep for diploma capstone project",
      "color": "#8b5cf6",
      "customInstructions": "Act as an experienced MSBTE Viva Examiner...",
      "sources": [
        {
          "_id": "67402233...",
          "name": "PRD.md",
          "size": 27411,
          "mimeType": "text/markdown",
          "createdAt": "2026-09-26T10:00:00.000Z"
        }
      ],
      "chatCount": 3,
      "createdAt": "2026-09-26T09:00:00.000Z",
      "updatedAt": "2026-09-26T10:00:00.000Z"
    }
  ]
}
```

### POST `/api/projects`

Create a new project workspace.

- **Auth:** Bearer Token
- **Method:** `POST`
- **Request Body:**

```json
{
  "name": "Full-Stack System Architecture",
  "description": "Design docs and RFC discussions",
  "color": "#10b981",
  "customInstructions": "Always reply with architectural diagrams and clean modular code."
}
```

- **Response `201 Created`**:

```json
{
  "data": {
    "_id": "67403344...",
    "userId": "673f1234...",
    "name": "Full-Stack System Architecture",
    "description": "Design docs and RFC discussions",
    "color": "#10b981",
    "customInstructions": "Always reply with architectural diagrams and clean modular code.",
    "sources": [],
    "createdAt": "2026-09-26T12:00:00.000Z",
    "updatedAt": "2026-09-26T12:00:00.000Z"
  }
}
```

### GET `/api/projects/:id`

Retrieve details of a single project workspace, including its sources and associated chat sessions.

- **Auth:** Bearer Token
- **Method:** `GET`
- **Response `200 OK`**:

```json
{
  "data": {
    "_id": "67403344...",
    "userId": "673f1234...",
    "name": "Full-Stack System Architecture",
    "description": "Design docs and RFC discussions",
    "color": "#10b981",
    "customInstructions": "...",
    "sources": [],
    "chats": [
      {
        "_id": "67404455...",
        "title": "Database Schema Discussion",
        "pinned": true,
        "updatedAt": "2026-09-26T12:15:00.000Z"
      }
    ]
  }
}
```

### PATCH `/api/projects/:id`

Update project name, description, color, or custom instructions.

- **Auth:** Bearer Token
- **Method:** `PATCH`
- **Request Body:**

```json
{
  "name": "Updated Project Name",
  "customInstructions": "New persona instructions..."
}
```

- **Response `200 OK`**:

```json
{
  "data": {
    "_id": "67403344...",
    "name": "Updated Project Name",
    "customInstructions": "New persona instructions...",
    "updatedAt": "2026-09-26T12:30:00.000Z"
  }
}
```

### DELETE `/api/projects/:id`

Delete a project workspace. Automatically unlinks (detaches) all associated chats (`projectId: null`) without deleting conversation history.

- **Auth:** Bearer Token
- **Method:** `DELETE`
- **Response `200 OK`**:

```json
{
  "data": {
    "message": "Project deleted and associated chats unlinked"
  }
}
```

### POST `/api/projects/:id/sources`

Add a local file source (Markdown, code, text, PDF, JSON) to the project knowledge base. Injects into chat context for all conversations in this project.

- **Auth:** Bearer Token
- **Method:** `POST`
- **Request Body:**

```json
{
  "name": "schema.prisma",
  "content": "datasource db { provider = \"postgresql\" ... }",
  "size": 1420,
  "mimeType": "text/plain"
}
```

- **Response `201 Created`**:

```json
{
  "data": {
    "_id": "67405566...",
    "name": "schema.prisma",
    "size": 1420,
    "mimeType": "text/plain",
    "createdAt": "2026-09-26T12:45:00.000Z"
  }
}
```

### DELETE `/api/projects/:id/sources/:sourceId`

Remove a source file from the project workspace.

- **Auth:** Bearer Token
- **Method:** `DELETE`
- **Response `200 OK`**:

```json
{
  "data": {
    "message": "Source deleted from project"
  }
}
```

---

## Prompt Vault (Step 7 / Prompts)

Reusable prompt templates with variable extraction and dynamic in-chat parameter substitution.

### GET `/api/prompts`

Retrieve all prompt templates created by the authenticated user, sorted by favorites first.

- **Auth:** Bearer Token
- **Method:** `GET`
- **Query Parameters:**
  - `tag` (optional): Filter prompts containing a specific tag.
  - `search` (optional): Case-insensitive search on title, description, template, and tags.
  - `isFavorite` (optional, `'true' | 'false'`): Filter favorites.
- **Response `200 OK`**:

```json
{
  "data": [
    {
      "_id": "67406677...",
      "userId": "673f1122...",
      "title": "Code Reviewer",
      "description": "Reviews code against standard engineering guidelines",
      "template": "Analyze the following {{language}} code:\n\n{{code}}\n\nFocus on: {{focus_areas}}",
      "variables": ["language", "code", "focus_areas"],
      "tags": ["engineering", "review"],
      "isFavorite": true,
      "createdAt": "2026-09-26T14:30:00.000Z",
      "updatedAt": "2026-09-26T14:30:00.000Z"
    }
  ]
}
```

### POST `/api/prompts`

Create a new prompt template. Variables with `{{variable_name}}` syntax are automatically extracted, trimmed, and deduplicated.

- **Auth:** Bearer Token
- **Method:** `POST`
- **Request Body:**

```json
{
  "title": "Code Reviewer",
  "description": "Reviews code against standard engineering guidelines",
  "template": "Analyze the following {{language}} code:\n\n{{code}}",
  "tags": ["engineering", "review"],
  "isFavorite": true
}
```

- **Response `201 Created`**:

```json
{
  "data": {
    "_id": "67406677...",
    "userId": "673f1122...",
    "title": "Code Reviewer",
    "description": "Reviews code against standard engineering guidelines",
    "template": "Analyze the following {{language}} code:\n\n{{code}}",
    "variables": ["language", "code"],
    "tags": ["engineering", "review"],
    "isFavorite": true,
    "createdAt": "2026-09-26T14:30:00.000Z",
    "updatedAt": "2026-09-26T14:30:00.000Z"
  }
}
```

### GET `/api/prompts/:id`

Retrieve details of a single prompt template owned by the authenticated user.

- **Auth:** Bearer Token
- **Method:** `GET`
- **Response `200 OK`**:

```json
{
  "data": {
    "_id": "67406677...",
    "title": "Code Reviewer",
    "template": "Analyze the following {{language}} code:\n\n{{code}}",
    "variables": ["language", "code"],
    "tags": ["engineering"],
    "isFavorite": true
  }
}
```

### PATCH `/api/prompts/:id`

Update prompt title, description, template, tags, or favorite flag. Re-extracts variables automatically if the template changes.

- **Auth:** Bearer Token
- **Method:** `PATCH`
- **Request Body (partial update):**

```json
{
  "title": "Senior Code Reviewer",
  "template": "Analyze the following {{language}} code with strict type-safety:\n\n{{code}}"
}
```

- **Response `200 OK`**:

```json
{
  "data": {
    "_id": "67406677...",
    "title": "Senior Code Reviewer",
    "variables": ["language", "code"]
  }
}
```

### DELETE `/api/prompts/:id`

Delete a prompt template strictly isolated to the authenticated owner.

- **Auth:** Bearer Token
- **Method:** `DELETE`
- **Response `200 OK`**:

```json
{
  "data": {
    "message": "Prompt deleted successfully",
    "id": "67406677..."
  }
}
```

---

## AI Mock Interview Platform (Step 9)

### POST `/api/interview/start`

Initiate a new interactive mock interview session with persona-calibrated greeting and initial scenario question.

- **Auth:** Bearer Token
- **Rate Limit:** 30 req/min
- **Credit Metering:** Enabled via `creditCheck` & `deductCredits` ($\lceil \text{totalTokens} / 100 \rceil$)
- **Method:** `POST`
- **Request Body:**

```json
{
  "role": "Full-Stack Engineer",
  "difficulty": "mid",
  "topic": "MERN Stack Architecture & REST/WebSocket APIs",
  "model": "flash",
  "isSimulation": false
}
```

> **Simulation Mode**: Set `"isSimulation": true` (or pass header `x-simulation: true`) to bypass credit requirements and run a free interactive simulation without contacting Gemini or deducting credits.

- **Response `201 Created`:**

```json
{
  "session": {
    "_id": "67408899aabbccddeeff0011",
    "userId": "67401122aabbccddeeff0011",
    "role": "Full-Stack Engineer",
    "difficulty": "mid",
    "topic": "MERN Stack Architecture & REST/WebSocket APIs",
    "status": "in_progress",
    "messages": [
      {
        "role": "assistant",
        "content": "Welcome! Let's begin by discussing how you would architect real-time updates in a Node.js and MongoDB system.",
        "tokensUsed": 120,
        "timestamp": "2026-09-26T10:00:00.000Z"
      }
    ],
    "scorecard": null,
    "totalTokensUsed": 120,
    "createdAt": "2026-09-26T10:00:00.000Z",
    "updatedAt": "2026-09-26T10:00:00.000Z"
  },
  "creditsDeducted": 2,
  "creditsRemaining": 98
}
```

### POST `/api/interview/:id/respond`

Submit candidate answer (dictated or typed) and stream interviewer critique and next technical scenario question via Server-Sent Events (SSE).

- **Auth:** Bearer Token
- **Rate Limit:** 30 req/min
- **Credit Metering:** Enabled via `creditCheck` & `deductCredits`
- **Method:** `POST`
- **Request Body:**

```json
{
  "content": "I would use Socket.io or native WebSockets backed by Redis pub/sub for cross-node message broadcasting.",
  "model": "flash"
}
```

- **Response `200 OK` (Stream: `text/event-stream`):**

```text
event: token
data: {"text":"That's a solid architectural pattern. "}

event: token
data: {"text":"How would you handle backpressure if a slow consumer falls behind?"}

event: done
data: {"message":{"role":"assistant","content":"...","tokensUsed":180},"tokensUsed":180,"creditsDeducted":2,"creditsRemaining":96}
```

### POST `/api/interview/:id/conclude`

Conclude the interview, evaluate candidate responses against technical benchmarks, generate a comprehensive JSON scorecard, and auto-archive the completed interview and transcript into the Library (`type: 'interview'`).

- **Auth:** Bearer Token
- **Rate Limit:** 30 req/min
- **Credit Metering:** Enabled via `creditCheck` & `deductCredits`
- **Method:** `POST`
- **Response `200 OK`:**

```json
{
  "session": {
    "_id": "67408899aabbccddeeff0011",
    "status": "completed",
    "scorecard": {
      "overallScore": 88,
      "rating": "Strong Hire",
      "categories": {
        "technicalAccuracy": 90,
        "problemSolving": 88,
        "communication": 90,
        "systemDesign": 85
      },
      "strengths": [
        "Clear articulation of WebSocket pub/sub architecture",
        "Deep understanding of Redis scalability and buffering"
      ],
      "improvements": [
        "Further elaborate on database replica set failover strategies"
      ],
      "summary": "Excellent technical competence across full-stack architecture with structured communication.",
      "recommendedTopics": ["Redis Streams", "MongoDB Change Streams"]
    }
  },
  "libraryItem": {
    "_id": "674099aabbccddeeff0022",
    "type": "interview",
    "title": "Mock Interview: Full-Stack Engineer (MERN Stack Architecture & REST/WebSocket APIs)",
    "summary": "Excellent technical competence across full-stack architecture with structured communication.",
    "role": "Full-Stack Engineer",
    "difficulty": "mid",
    "topic": "MERN Stack Architecture & REST/WebSocket APIs",
    "scorecard": { ... },
    "transcript": [ ... ]
  },
  "creditsDeducted": 3,
  "creditsRemaining": 93
}
```

### GET `/api/interview`

List all interview sessions for the authenticated user sorted newest first.

- **Auth:** Bearer Token
- **Method:** `GET`
- **Response `200 OK`:**

```json
{
  "interviews": [
    {
      "_id": "67408899aabbccddeeff0011",
      "role": "Full-Stack Engineer",
      "difficulty": "mid",
      "topic": "MERN Stack Architecture",
      "status": "completed",
      "scorecard": { "overallScore": 88, "rating": "Strong Hire" },
      "createdAt": "2026-09-26T10:00:00.000Z"
    }
  ]
}
```

### GET `/api/interview/:id`

Retrieve details and transcript of a single interview session isolated to the user.

- **Auth:** Bearer Token
- **Method:** `GET`
- **Response `200 OK`:**

```json
{
  "interview": {
    "_id": "67408899aabbccddeeff0011",
    "role": "Full-Stack Engineer",
    "difficulty": "mid",
    "topic": "MERN Stack Architecture",
    "status": "completed",
    "messages": [ ... ],
    "scorecard": { ... }
  }
}
```

---

## Unified Hybrid Search (Step 10)

### GET `/api/search`

Executes cross-domain hybrid semantic and full-text search across Personal Library, Prompt Vault, and Conversations. Scoped strictly to the authenticated user.

- **Auth:** Bearer Token
- **Method:** `GET`
- **Query Parameters:**
  - `q` (required, string 1-200 chars): Search keyword or natural language query
  - `type` (optional, enum: `'all' | 'library' | 'prompts' | 'chats'`, default: `'all'`): Target domain filter
  - `limit` (optional, number 1-50, default: `20`): Maximum results per category

- **Response `200 OK`:**

```json
{
  "data": {
    "query": "Docker",
    "type": "all",
    "counts": {
      "total": 3,
      "library": 1,
      "prompts": 1,
      "chats": 1
    },
    "library": [
      {
        "_id": "674099aabbccddeeff0011",
        "userId": "67401122aabbccddeeff0011",
        "type": "note",
        "title": "Microservices Architecture with Docker",
        "summary": "Deep dive into container orchestration and service mesh pattern",
        "tags": ["docker", "microservices", "devops"],
        "category": "other",
        "matchSource": "text",
        "similarityScore": 0.88,
        "createdAt": "2026-09-26T12:00:00.000Z"
      }
    ],
    "prompts": [
      {
        "_id": "674099aabbccddeeff0022",
        "userId": "67401122aabbccddeeff0011",
        "title": "Docker Compose Generator",
        "description": "Generates multi-container docker compose configuration",
        "template": "Create a docker-compose.yml for {{service_name}} using {{db_type}}",
        "variables": ["service_name", "db_type"],
        "tags": ["docker", "devops"],
        "isFavorite": true,
        "createdAt": "2026-09-26T12:00:00.000Z"
      }
    ],
    "chats": [
      {
        "_id": "674099aabbccddeeff0033",
        "chatId": "674099aabbccddeeff0044",
        "title": "Docker Deployment Debugging",
        "pinned": false,
        "matchType": "message",
        "role": "assistant",
        "snippet": "...Use an Alpine base image and separate dependency installation layers...",
        "createdAt": "2026-09-26T12:00:00.000Z",
        "updatedAt": "2026-09-26T12:05:00.000Z"
      }
    ]
  }
}
```

---

## Wallet & Billing (Step 11)

### GET `/api/wallet`

Retrieves current credit balance, membership tier, and cumulative token consumption for the authenticated user.

- **Auth:** Bearer Token
- **Method:** `GET`
- **Response `200 OK`:**

```json
{
  "data": {
    "wallet": {
      "creditsRemaining": 1300,
      "tier": "free",
      "totalTokensConsumed": 45200
    }
  }
}
```

---

### GET `/api/wallet/plans`

Fetches active recharge packages strictly from server configuration. Prices and credit allocations are never determined by the client.

- **Auth:** Bearer Token
- **Method:** `GET`
- **Response `200 OK`:**

```json
{
  "data": {
    "plans": [
      {
        "id": "starter_pack",
        "name": "Starter Top-Up",
        "description": "Perfect for quick tests, assignments, and light chat sessions",
        "amountINR": 49,
        "amountPaise": 4900,
        "credits": 500,
        "tier": "free",
        "badge": null,
        "popular": false,
        "features": [
          "500 AI credits (~50,000 tokens)",
          "Gemini 3.8 Flash access",
          "Personal Library storage",
          "PDF & Document export"
        ]
      },
      {
        "id": "pro_pack",
        "name": "Pro Developer Pack",
        "description": "Best value for active development, mock interviews, and project workspaces",
        "amountINR": 99,
        "amountPaise": 9900,
        "credits": 1200,
        "tier": "free",
        "badge": "Popular",
        "popular": true,
        "features": [
          "1,200 AI credits (~120,000 tokens)",
          "Gemini Flash & Pro models",
          "Priority SSE streaming",
          "AI Mock Interview simulations",
          "Full Library & Hybrid Search"
        ]
      },
      {
        "id": "power_pack",
        "name": "Power Studio Tier",
        "description": "Massive capacity for extensive document drafting, capstone prep, and heavy usage",
        "amountINR": 249,
        "amountPaise": 24900,
        "credits": 3500,
        "tier": "pro_monthly",
        "badge": "Best Value",
        "popular": false,
        "features": [
          "3,500 AI credits (~350,000 tokens)",
          "Pro Monthly tier upgrade",
          "Unlimited project workspaces",
          "Comprehensive interview analytics",
          "Full cross-domain vector search"
        ]
      }
    ]
  }
}
```

---

### POST `/api/wallet/orders`

Creates a Razorpay checkout order and registers a pending transaction in the billing ledger.

- **Auth:** Bearer Token
- **Method:** `POST`
- **Request Body:**

```json
{
  "planId": "pro_pack"
}
```

- **Response `201 Created`:**

```json
{
  "data": {
    "orderId": "order_NX12345678",
    "amount": 9900,
    "currency": "INR",
    "keyId": "rzp_test_..."
  }
}
```

---

### POST `/api/wallet/verify`

Verifies the Razorpay Checkout HMAC SHA256 signature and atomically credits the wallet ledger. Operates idempotently to guarantee credits are added only once.

- **Auth:** Bearer Token
- **Method:** `POST`
- **Request Body:**

```json
{
  "razorpay_order_id": "order_NX12345678",
  "razorpay_payment_id": "pay_NX87654321",
  "razorpay_signature": "0a1b2c3d4e5f6g7h8i9j..."
}
```

- **Response `200 OK`:**

```json
{
  "data": {
    "success": true,
    "credited": true,
    "alreadyProcessed": false,
    "creditsRemaining": 1300,
    "transaction": {
      "_id": "674100aabbccddeeff0011",
      "userId": "67401122aabbccddeeff0011",
      "amountINR": 99,
      "creditsAdded": 1200,
      "orderId": "order_NX12345678",
      "paymentId": "pay_NX87654321",
      "planId": "pro_pack",
      "status": "success",
      "createdAt": "2026-09-26T17:30:00.000Z"
    }
  }
}
```

---

### GET `/api/wallet/transactions`

Returns paginated billing ledger transactions scoped strictly to the authenticated user.

- **Auth:** Bearer Token
- **Method:** `GET`
- **Query Parameters:**
  - `page` (optional, default: 1): Page number
  - `limit` (optional, default: 10, max: 50): Items per page

- **Response `200 OK`:**

```json
{
  "data": {
    "transactions": [
      {
        "_id": "674100aabbccddeeff0011",
        "userId": "67401122aabbccddeeff0011",
        "amountINR": 99,
        "creditsAdded": 1200,
        "orderId": "order_NX12345678",
        "paymentId": "pay_NX87654321",
        "planId": "pro_pack",
        "status": "success",
        "createdAt": "2026-09-26T17:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "pages": 1
    }
  }
}
```

---

### POST `/api/webhooks/razorpay`

Public webhook endpoint for asynchronous payment notifications from Razorpay servers. Uses raw request body buffer to verify HMAC SHA256 signature against `RAZORPAY_WEBHOOK_SECRET`.

- **Auth:** Public (HMAC Verified via `X-Razorpay-Signature`)
- **Method:** `POST`
- **Headers:**
  - `X-Razorpay-Signature`: HMAC SHA256 hex digest of raw request body
- **Request Body (Raw JSON Buffer):**

```json
{
  "event": "payment.captured",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_NX87654321",
        "order_id": "order_NX12345678",
        "amount": 9900,
        "notes": {
          "userId": "67401122aabbccddeeff0011",
          "planId": "pro_pack"
        }
      }
    }
  }
}
```

- **Response `200 OK`:**

```json
{
  "status": "ok",
  "received": true
}
```

---

## 9. Admin Analytics & Telemetry (Step 12)

All admin endpoints require an authenticated JWT bearer token and `role: 'admin'` on the user account. Non-admin users receive `403 FORBIDDEN`.

### GET `/api/admin/stats`

Returns aggregated platform KPI metrics including tokens consumed, revenue, active accounts, and telemetry.

- **Auth:** Bearer Token (`role: 'admin'`)
- **Method:** `GET`
- **Response `200 OK`:**

```json
{
  "data": {
    "message": "Admin authorization verified",
    "totalTokens": 145020,
    "totalCreditsDeducted": 1452,
    "activeUsers": 48,
    "totalRevenue": 4990,
    "totalCreditsAdded": 5000,
    "successfulTransactions": 10,
    "totalErrors": 2,
    "usageCallCount": 35
  }
}
```

---

### GET `/api/admin/usage`

Returns daily token consumption time-series and Flash vs Pro model distribution split.

- **Auth:** Bearer Token (`role: 'admin'`)
- **Method:** `GET`
- **Query Parameters:**
  - `range` (optional, default `'7d'`): `'7d'` | `'30d'`
- **Response `200 OK`:**

```json
{
  "data": {
    "range": "7d",
    "timeSeries": [
      {
        "date": "2026-09-21",
        "totalTokens": 12500,
        "flashTokens": 10000,
        "proTokens": 2500,
        "requestCount": 8
      }
    ],
    "modelSplit": [
      {
        "name": "Gemini Flash",
        "model": "flash",
        "tokens": 100000,
        "count": 45,
        "percentage": 80
      },
      {
        "name": "Gemini Pro",
        "model": "pro",
        "tokens": 25000,
        "count": 10,
        "percentage": 20
      }
    ],
    "featureSplit": [
      { "feature": "chat", "tokens": 80000, "count": 30 },
      { "feature": "interview", "tokens": 30000, "count": 15 },
      { "feature": "docgen", "tokens": 15000, "count": 10 }
    ]
  }
}
```

---

### GET `/api/admin/transactions`

Returns a paginated list of all platform recharges and Razorpay top-ups.

- **Auth:** Bearer Token (`role: 'admin'`)
- **Method:** `GET`
- **Query Parameters:**
  - `page` (optional, default `1`)
  - `limit` (optional, default `20`)
- **Response `200 OK`:**

```json
{
  "data": {
    "transactions": [
      {
        "_id": "67401122aabbccddeeff0011",
        "userId": {
          "_id": "67401122aabbccddeeff0001",
          "email": "user@example.com",
          "role": "user"
        },
        "amountINR": 499,
        "creditsAdded": 500,
        "paymentGateway": "razorpay_test",
        "orderId": "order_NX12345678",
        "paymentId": "pay_NX87654321",
        "status": "success",
        "createdAt": "2026-09-27T10:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### GET `/api/admin/errors`

Returns a paginated list from the `ErrorLog` collection for operational monitoring.

- **Auth:** Bearer Token (`role: 'admin'`)
- **Method:** `GET`
- **Query Parameters:**
  - `page` (optional, default `1`)
  - `limit` (optional, default `20`)
- **Response `200 OK`:**

```json
{
  "data": {
    "errors": [
      {
        "_id": "67401122aabbccddeeff0099",
        "route": "/api/chat",
        "method": "POST",
        "status": 500,
        "message": "AI generation service timeout",
        "stack": "Error: AI generation service timeout\n    at gemini.service.js:42:11",
        "userId": "67401122aabbccddeeff0001",
        "createdAt": "2026-09-27T12:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

## Long-Term Memory & Personalization

Endpoints for persistent memory across conversations. Memories are automatically extracted during chats and can be managed manually by the user.

### GET `/api/memories`

Returns all active long-term memories for the authenticated user.

- **Auth:** Bearer Token
- **Method:** `GET`
- **Response `200 OK`:**

```json
{
  "data": [
    {
      "_id": "67401122aabbccddeeff1122",
      "userId": "67401122aabbccddeeff0001",
      "fact": "User's name is Rewan",
      "category": "identity",
      "confidence": 0.98,
      "pinned": true,
      "active": true,
      "createdAt": "2026-10-03T10:00:00.000Z",
      "updatedAt": "2026-10-03T10:00:00.000Z"
    }
  ]
}
```

### POST `/api/memories`

Manually creates a new persistent memory. Automatically indexes a 768-dim vector embedding in `vectorDbService`.

- **Auth:** Bearer Token
- **Method:** `POST`
- **Request Body:**

```json
{
  "fact": "Prefers TypeScript, React, and Node.js",
  "category": "preference",
  "pinned": false
}
```

- **Response `201 Created`:**

```json
{
  "data": {
    "_id": "67401122aabbccddeeff1123",
    "userId": "67401122aabbccddeeff0001",
    "fact": "Prefers TypeScript, React, and Node.js",
    "category": "preference",
    "pinned": false,
    "active": true,
    "vectorId": "mem_67401122aabbccddeeff1123"
  }
}
```

### PATCH `/api/memories/:id`

Updates a memory's fact, category, or pinned status.

- **Auth:** Bearer Token
- **Method:** `PATCH`
- **Request Body:**

```json
{
  "fact": "Updated fact string",
  "pinned": true
}
```

- **Response `200 OK`:**

```json
{
  "data": {
    "_id": "67401122aabbccddeeff1123",
    "fact": "Updated fact string",
    "pinned": true
  }
}
```

### DELETE `/api/memories/:id`

Deletes a single memory and removes its vector embedding from the vector store.

- **Auth:** Bearer Token
- **Method:** `DELETE`
- **Response `200 OK`:**

```json
{
  "data": {
    "message": "Memory deleted successfully"
  }
}
```

### DELETE `/api/memories`

Clears all memories for the authenticated user.

- **Auth:** Bearer Token
- **Method:** `DELETE`
- **Response `200 OK`:**

```json
{
  "data": {
    "message": "Cleared 5 memories successfully",
    "deletedCount": 5
  }
}
```

---

## Library Management

### GET `/api/library`

Lists library items scoped to the authenticated user with filtering, pagination, and sorting. Pinned items are always ordered first.

- **Auth:** Bearer Token
- **Method:** `GET`
- **Query Parameters:**
  - `type` (optional): `note` | `link` | `document` | `file` | `interview`
  - `tab` (optional): `all` | `notes_links` | `documents` | `files` | `interviews`
  - `tags` (optional): comma-separated string of tags
  - `pinned` (optional): boolean
  - `sortBy` (optional): `createdAt` | `title` | `score` (default: `createdAt`)
  - `sortOrder` (optional): `asc` | `desc` (default: `desc`)
  - `page` (optional): integer (default: 1)
  - `limit` (optional): integer (default: 20)
- **Response `200 OK`:**

```json
{
  "data": {
    "items": [
      {
        "_id": "67401122aabbccddeeff2233",
        "userId": "673f1234...",
        "type": "interview",
        "title": "Senior Frontend Engineer Mock Interview",
        "pinned": true,
        "metadata": {
          "score": 88,
          "role": "Frontend",
          "competencies": { "technical": 85, "communication": 90 }
        },
        "createdAt": "2026-10-04T10:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### GET `/api/library/search`

Full-text search across library items with tab filtering.

- **Auth:** Bearer Token
- **Method:** `GET`
- **Query Parameters:**
  - `q` (required): search string
  - `tab` (optional): `all` | `notes_links` | `documents` | `files` | `interviews`
  - `type` (optional): `note` | `link` | `document` | `file` | `interview`
  - `limit` (optional): integer (default: 20)
- **Response `200 OK`:**

```json
{
  "data": {
    "items": [ ... ],
    "total": 1
  }
}
```

### PATCH `/api/library/:id`

Updates item metadata, title, content, or toggles pinned status.

- **Auth:** Bearer Token
- **Method:** `PATCH`
- **Request Body:**
```json
{
  "title": "Updated Title",
  "pinned": true
}
```
- **Response `200 OK`:**
```json
{
  "data": {
    "_id": "67401122aabbccddeeff2233",
    "title": "Updated Title",
    "pinned": true
  }
}
```

## Mock Interview Platform

### POST `/api/interview/tts`

Synthesizes interview speech using **Microsoft Edge Neural TTS** (default, ~400ms ultra-low latency, 100% free, 0 credits) or **Gemini 3.8 Flash-Lite TTS** (cloud metered, token charges), or returns 204 for client-side Web Speech simulation.

- **Auth:** Bearer Token (requires authenticated user session)
- **Rate Limit:** 30 req / min (bypassed in simulation mode)
- **Credit Check:** Enforced for `engine: 'gemini'` only; bypassed for `engine: 'edge'` and `isSimulation: true`
- **Request Body:**
```json
{
  "text": "Welcome to your technical screening.",
  "engine": "edge",
  "voice": "en-US-ChristopherNeural",
  "style": "professional and engaging interviewer",
  "isSimulation": false
}
```

- **Parameters:**
  - `text` (required, string, 1–5000 chars): Interviewer question or critique text.
  - `engine` (optional, `"edge"` | `"gemini"`, default: `"edge"`): Selected voice engine.
  - `voice` (optional, string):
    - For Edge: `"en-US-ChristopherNeural"` (Male Lead, default), `"en-US-GuyNeural"`, `"en-US-JennyNeural"` (Female Lead), etc.
    - For Gemini: `"Kore"` (default), `"Puck"`, `"Fenrir"`, `"Aoede"`, etc.
  - `style` (optional, string): Style description for Gemini TTS.
  - `isSimulation` (optional, boolean): If true, returns 204 for offline Web Speech synthesis.

- **Response `200 OK` (Edge Neural Engine — Default):**
  - **Content-Type:** `audio/mpeg`
  - **Headers:**
    - `X-Engine`: `edge`
    - `X-Voice`: Selected Edge voice name
    - `X-Credits-Remaining`: Unchanged user credit balance
    - `X-Credits-Deducted`: `0`
    - `X-Tokens-Used`: `0`
  - **Body:** Binary MP3 audio buffer (24 kHz, 96 kbps mono MP3)

- **Response `200 OK` (Gemini Flash-Lite Engine — Cloud Metered):**
  - **Content-Type:** `audio/wav`
  - **Headers:**
    - `X-Engine`: `gemini`
    - `X-Voice`: Selected Gemini voice name
    - `X-Credits-Remaining`: Updated user credit balance
    - `X-Credits-Deducted`: Credits deducted (`ceil(totalTokens / 100)`)
    - `X-Tokens-Used`: Total prompt and audio candidate tokens
    - `X-Usage-Log-Id`: MongoDB audit log ID
  - **Body:** Binary WAV audio buffer with standard RIFF header (24 kHz, 16-bit mono PCM)

- **Response `204 No Content` (Simulation Mode):**
  - Returned when `isSimulation: true` or `x-simulation: true` header is provided.

---

## Agent Skills & Autonomous Tools

### GET `/api/skills`

List available skills (seeded system skills and user custom skills), with filtering by category or favorites.

- **Auth:** Bearer Token
- **Query Params:**
  - `category` (optional, string): e.g. `'web'`, `'coding'`, `'writing'`, `'analysis'`, `'general'`
  - `favorite` (optional, boolean): filter to user favorited skills only
- **Response `200 OK`:**
```json
{
  "data": [
    {
      "_id": "67401122aabbccddeeff2244",
      "title": "Web Deep Researcher",
      "description": "Autonomous web searching, multi-source fact retrieval, and page inspection",
      "category": "web",
      "tools": ["web_search", "fetch_url"],
      "instructions": "Search the web for up-to-date facts...",
      "variables": [],
      "isSystem": true,
      "isFavorite": false
    }
  ]
}
```

### POST `/api/skills`

Create a new custom tool-enabled skill.

- **Auth:** Bearer Token
- **Request Body:**
```json
{
  "title": "Data Pipeline Debugger",
  "description": "Inspect ETL scripts and test sandbox snippets",
  "category": "coding",
  "tools": ["code_execution", "web_search"],
  "instructions": "Diagnose the error in {{error_message}} for {{language}}",
  "tags": ["pipeline", "debug"]
}
```
- **Response `201 Created`:** Returns created skill object with automatically extracted variables (`["error_message", "language"]`).

### GET `/api/skills/:id`

Retrieve a single skill by ID.

### PATCH `/api/skills/:id`

Update a user custom skill (system skills are protected from edit).

### DELETE `/api/skills/:id`

Delete a user custom skill.

### POST `/api/skills/:id/favorite`

Toggle favorite state for a skill.

### Chat Integration: Tools & Steps in `/api/chats/:id/messages`

- **Request Body Extra Options:**
  - `skillId` (optional, ObjectId string): Active skill ID.
  - `enabledTools` (optional, array of string): Explicitly enabled tools (`"web_search"`, `"fetch_url"`, `"workspace_search"`, `"memory_search"`, `"code_execution"`).
- **SSE Events:**
  - `event: step`: Real-time agent progress (`{ id, tool, type, title, status: 'running' | 'completed' | 'failed', output, mode }`).
  - `event: grounding`: Web citation sources (`{ webSearchQueries: [...], sources: [{ title, url }] }`).

---

## Automations Hub & Schedules

### GET `/api/schedules`
- **Auth:** Bearer Token
- **Response `200 OK`:** Returns list of schedules for the current user.

### POST `/api/schedules`
- **Auth:** Bearer Token
- **Request Body:**
```json
{
  "title": "Daily Tech Digest",
  "instructions": "Summarize top 3 AI and dev breakthroughs today.",
  "frequency": "daily",
  "weeklyDays": [1, 2, 3, 4, 5],
  "runTime": "09:00",
  "deliveryTarget": "chat",
  "model": "flash"
}
```
- **Response `201 Created`:** Returns created Schedule document.

### PATCH `/api/schedules/:id`
- **Auth:** Bearer Token
- **Response `200 OK`:** Updates schedule properties.

### PATCH `/api/schedules/:id/toggle`
- **Auth:** Bearer Token
- **Response `200 OK`:** Toggles schedule `isActive` status between active and paused.

### POST `/api/schedules/:id/run-now`
- **Auth:** Bearer Token
- **Description:** Instantly executes the schedule (ideal for live examiner viva demonstrations). Verifies credits, calls Gemini, meters and deducts tokens, saves results to Chat or Library, and logs telemetry.
- **Response `200 OK`:** `{ success: true, data: { schedule, resultText, tokensUsed, chatId } }`.

### DELETE `/api/schedules/:id`
- **Auth:** Bearer Token
- **Response `200 OK`:** Deletes schedule.

---

## Connected Apps & Ecosystem Integrations

### GET `/api/connected-apps`
- **Auth:** Bearer Token
- **Response `200 OK`:** Returns all ecosystem integrations (`web-search`, `github`, `google-drive`, `notion`, `figma`) with current connection statuses.

### PATCH `/api/connected-apps/:slug`
- **Auth:** Bearer Token
- **Request Body:**
```json
{
  "isConnected": true,
  "accountName": "developer-org",
  "webhookUrl": "https://...",
  "apiKey": "token_..."
}
```
- **Response `200 OK`:** Returns updated connected app state.

