# Slack Archiver & Viewer

A lightweight, self-contained system for archiving Slack workspaces—conversations, direct messages, threads, member directories, and private media attachments—and viewing them offline through a zero-build browser interface.

---

## Archiving Implementation

The archiver operates via Node.js and orchestrates full workspace extraction into structured directories:

### 1. Authentication & Channels Discovery
- Uses bot and user OAuth tokens (`tokens.json`) to access channels and conversations.
- [`labelChannel()`](file:///C:/Users/fiery/GitHub/slack-archiver/apiTools.js#L90) categorizes conversations into `channel`, `channel-private`, or `dm`.
- Resolves member metadata using `conversations.members` and `users.list`.

### 2. Paginated Message Extraction & Recursive Thread Traversal
- [`fetchAndWriteMessages()`](file:///C:/Users/fiery/GitHub/slack-archiver/apiTools.js#L171) recursively pulls historical messages in timestamp-ordered chunks via `conversations.history`.
- Inspects every message payload for `thread_ts`. When replies exist, it recursively branches to fetch the entire thread via `conversations.replies`, archiving threads into their own subdirectories.

### 3. Media & Attachment Harvesting
- Inspects Slack file objects and downloads private attachments directly using Bearer authentication via [`downloadAttatchment()`](file:///C:/Users/fiery/GitHub/slack-archiver/apiTools.js#L105).
- Maintains a local index (`files/index.mjs`) to support resuming runs without re-downloading existing media assets.

### 4. Conversation Bursts & Inactivity Analysis
- [`analyzer()`](file:///C:/Users/fiery/GitHub/slack-archiver/index.js#L6) in `index.js` inspects timestamps between consecutive messages (`ts - latest > 600.0s`) to identify activity clusters, calculating conversation burst durations and message volumes.

---

## Viewing Implementation

The viewer provides an offline exploration experience for both raw channel archives and full Slack export folders.

### 1. Data Mapping & Local Serving
- [`mapViewerData.mjs`](file:///C:/Users/fiery/GitHub/slack-archiver/mapViewerData.mjs) validates archive structures (confirming `channels.json`, `users.json`, and daily JSON logs).
- [`build.mjs`](file:///C:/Users/fiery/GitHub/slack-archiver/build.mjs) generates a `VIEWERDATA_MAP.json` catalog, starts a local `http-server` instance rooted at `./viewer`, and opens the default browser.

### 2. Channel Hub (`viewer/index.htm`)
- Reads route query parameters (`type` and `id`).
- Dynamically imports [`viewer/dateWidget.mjs`](file:///C:/Users/fiery/GitHub/slack-archiver/viewer/dateWidget.mjs) to aggregate message activity across time into expandable Year/Month/Day hierarchies with message counters.
- Dynamically imports [`viewer/memberWidget.mjs`](file:///C:/Users/fiery/GitHub/slack-archiver/viewer/memberWidget.mjs) to display participant cards with avatars, real names, handles, and role titles.

### 3. Message Stream (`viewer/viewer.htm`)
- Parses Slack Block Kit rich text representations:
  - Extracts nested section and element blocks.
  - Converts Slack unicode code points into native emojis (`String.fromCodePoint`).
  - Highlights inline code, URLs, and edited tags.
- Renders inline image attachments directly from local archived assets.
- Applies "sequel" styling to group consecutive posts from the same author.

---

## Architectural Philosophy & Intentional Design Choices

Rather than relying on heavy modern frameworks, off-the-shelf SDKs, or database engines, this project was developed from first principles as an intentional exercise in raw browser standards, native DOM manipulation, and bespoke API pipelines:

- **`jml` (JS Markup Language) over React / Virtual DOM**:
  Instead of pulling in React, ReactDOM, JSX precompilers, and Babel, the UI is built entirely using [`viewer/jml.mjs`](file:///C:/Users/fiery/GitHub/slack-archiver/viewer/jml.mjs)—a custom 35-line hyperscript-style micro-library. It constructs native DOM elements directly (`document.createElement`, `setAttribute`, `addEventListener`, `appendChild`). This avoids runtime overhead, eliminates bundling pipelines, and provides direct control over DOM lifecycle and rendering performance.

- **Executable `.mjs` Modules as a Data Store**:
  Instead of writing static JSON dumps or persisting to SQLite, the archiver serializes structured conversation data directly into executable JavaScript ES modules (`export function messages() { return data_messages; }`). This allows the browser client to ingest archive datasets on-demand via native dynamic `import()`, avoiding manual AJAX/`fetch()` plumbing and sidestepping local `file://` fetch restrictions.

- **Zero-Build, Native Browser Runtime**:
  The viewer has no Webpack, Vite, Rollup, or transpilation layer. It runs on pure HTML5, vanilla CSS, and browser-standard ES modules. Long-term archival tools benefit from zero-dependency UI runtimes, ensuring that archives remain readable decades later without worrying about stale build tooling.

- **Bespoke REST Pipeline over Official Slack SDKs**:
  Rather than abstracting API calls away behind `@slack/web-api`, [`apiTools.js`](file:///C:/Users/fiery/GitHub/slack-archiver/apiTools.js) implements custom HTTP request handling, token management, and a reusable cursor-based paginator (`paginatedRequest`). Rate-limiting cooldowns are tuned per method (channel info, message history, thread replies, and binary asset streaming).

- **Table-Driven Chat Layout**:
  Message rendering in [`viewer/viewer.htm`](file:///C:/Users/fiery/GitHub/slack-archiver/viewer/viewer.htm) uses a fixed-layout HTML `<table>` rather than flexbox/grid lists. This guarantees strict columnar alignment between timestamps, author names, and message payloads across wide viewports, while supporting "sequel" grouping (collapsing consecutive sender tags from the same author).

---

## Repository Structure

```
slack-archiver/
├── apiTools.js           # Core Slack API interactions, pagination, serialization
├── requests.js           # Modularized HTTP request helpers
├── index.js              # Archival orchestrator and conversation analyzer
├── build.mjs             # Viewer data mapper & local HTTP server launcher
├── mapViewerData.mjs     # Validator & directory tree scanner for Slack exports
├── package.json          # Project configuration, scripts, and dependencies
│
└── viewer/               # Zero-build browser viewer
    ├── index.htm         # Channel hub & navigation dashboard
    ├── viewer.htm        # Core message stream & thread viewer
    ├── jml.mjs           # Custom native DOM builder micro-library
    ├── main.css          # Viewer stylesheet (collapsible accordions, chat tables)
    ├── dateWidget.mjs    # Hierarchical Year/Month/Day accordion navigation
    ├── memberWidget.mjs  # Channel member directory rendering
    └── VIEWERDATA/       # Directory for Slack exports & archive datasets
        └── placeholder.txt
```

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- A Slack Bot or User Token with relevant OAuth scopes (`channels:history`, `groups:history`, `im:history`, `files:read`, `users:read`).

### Installation
```bash
git clone https://github.com/p-Lennart/slack-archiver.git
cd slack-archiver
npm install
```

### Configuring Archiver Tokens
Create a `tokens.json` file in the root directory (or in `archiver/`):
```json
{
  "bot": "xoxb-your-bot-token",
  "user": "xoxp-your-user-token"
}
```

### Running the Archiver
Configure target channel IDs in [`index.js`](file:///C:/Users/fiery/GitHub/slack-archiver/index.js) and run:
```bash
node index.js
```

### Launching the Archive Viewer
Place an archive folder or Slack export inside [`viewer/VIEWERDATA/`](file:///C:/Users/fiery/GitHub/slack-archiver/viewer/VIEWERDATA), then run:
```bash
npm run viewer
```
This maps the archive directory, launches a local HTTP server on port 8080, and opens `viewer.htm` in your browser.
