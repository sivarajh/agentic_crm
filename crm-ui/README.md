# crm-ui

React 18 frontend for the Agentic AI CRM platform.
Built on the A2UI protocol (v0.8) — agents return declarative component
descriptors; the UI renders from a safe, approved component catalog.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript 5 |
| Build | Vite 5 |
| State | Zustand + Immer |
| Data Fetching | TanStack Query v5 |
| HTTP | Axios |
| Styling | Tailwind CSS 3 |
| Streaming | Native `EventSource` (SSE) |
| Serve | Nginx 1.27 (multi-stage Docker) |

## Project Structure

```
src/
├── a2ui/
│   ├── A2UIRenderer.tsx          # Safe component renderer (switch-based catalog)
│   └── hooks/
│       └── useA2UIStream.ts      # SSE hook wiring agent events to store
├── api/
│   ├── client.ts                 # Axios instance (unwraps ApiResponse<T>)
│   ├── sessionApi.ts
│   ├── conversationApi.ts
│   ├── agentApi.ts
│   └── streamingApi.ts
├── components/
│   ├── chat/
│   │   ├── ChatWindow.tsx
│   │   ├── MessageBubble.tsx     # Renders A2UI or plain text
│   │   ├── MessageInput.tsx
│   │   └── AgentStatusIndicator.tsx
│   └── layout/
│       ├── AppShell.tsx
│       └── SessionPanel.tsx
├── store/
│   └── index.ts                  # SessionStore, ConversationStore, AgentStore
└── types/
    ├── session.ts
    ├── conversation.ts
    ├── agent.ts
    └── a2ui.ts
```

## A2UI Protocol

Agents return JSON component descriptors. The `A2UIRenderer` renders only
known types from a curated catalog — no arbitrary code execution.

Supported component types: `text`, `markdown`, `card`, `list`, `table`,
`badge`, `divider`.

Unknown types render as `null` (silent no-op) — this is a security property.

## Running Locally

### Prerequisites

Start shared infra and crm-backend first:

```bash
cd ../crm-infra && docker compose up -d
cd ../crm-backend && docker compose up -d
```

### Development server

```bash
npm install
npm run dev
# → http://localhost:5173
```

Vite proxies `/api` to `http://localhost:8080` in dev mode.

### Docker (production build)

```bash
docker compose up --build
# → http://localhost:3000
```

## SSE Streaming

The chat interface opens a persistent SSE connection to
`/api/v1/stream/session/{sessionId}` and maps events to Zustand store:

| SSE Event | Store Action |
|-----------|-------------|
| `agent.thinking` | `setAgentStatus('thinking')` |
| `agent.message` | append streaming content |
| `task.completed` | `setAgentStatus('done')`, add message |
| `task.failed` | `setAgentStatus('error')` |

## Building

```bash
npm run build   # outputs to dist/
npm run preview # preview production build locally
```

## Kubernetes Deployment

```bash
kubectl apply -f k8s/deployment.yaml
```

Nginx config (`nginx.conf`) proxies `/api/` to `crm-backend:8080`.
SSE endpoint (`/api/v1/stream/`) has `proxy_buffering off` and
`proxy_read_timeout 3600s`.
