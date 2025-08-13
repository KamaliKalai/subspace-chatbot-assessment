<<<<<<< HEAD
# Internship Assessment – Chatbot Application (No‑Code)  
**Stack:** Nhost (Auth + Hasura + Postgres), Hasura GraphQL (queries/mutations/subscriptions), n8n (workflow), OpenRouter (LLM), Bolt.new (UI), Netlify (hosting)

This repository contains a **step‑by‑step plan** (no‑code/low‑code) + copy‑pasteable snippets to build the required chatbot app. If you only need to submit your **approach**, you can submit this README plus the included files. If you also deploy, follow the steps exactly.

---

## Contents
- [0. What you will build](#0-what-you-will-build)
- [1. Accounts to create](#1-accounts-to-create)
- [2. Nhost project setup](#2-nhost-project-setup)
- [3. Database schema (Hasura)](#3-database-schema-hasura)
- [4. Row‑Level Security & Permissions](#4-row-level-security--permissions)
- [5. GraphQL operations](#5-graphql-operations)
- [6. Hasura Action `sendMessage`](#6-hasura-action-sendmessage)
- [7. n8n workflow](#7-n8n-workflow)
- [8. Bolt.new frontend (GraphQL‑only)](#8-boltnew-frontend-graphql-only)
- [9. Deploy to Netlify](#9-deploy-to-netlify)
- [10. Test checklist](#10-test-checklist)
- [11. Submission format](#11-submission-format)
- [12. Security notes](#12-security-notes)
- [Appendix: Links to included files](#appendix-links-to-included-files)

---

## 0. What you will build
A secure chat UI where:
1) User logs in via **Nhost Auth**.  
2) User creates a chat and sends messages (saved via **Hasura GraphQL**).  
3) Frontend calls a **Hasura Action** → **n8n** webhook → **OpenRouter** LLM.  
4) n8n writes the bot’s reply back to the DB via GraphQL.  
5) Frontend receives the reply in **real‑time** via GraphQL **subscription**.

**Rule compliance:** GraphQL‑only from frontend; permissions via RLS; all external API calls via n8n (not from frontend).

---

## 1. Accounts to create
- **Nhost** – backend (Auth + Hasura + Postgres)
- **n8n Cloud** – workflow automation
- **OpenRouter** – LLM API (get API key)
- **Bolt.new** – UI builder (low‑code)
- **Netlify** – hosting for final site

> If email verification is delayed, you can still submit this **approach repo**. When verification arrives, follow the remaining steps to deploy.

---

## 2. Nhost project setup
1. Create a new Nhost project (any region).  
2. In **Auth → Settings**, enable **Email / Password** sign‑in.  
3. Note these values for later:
   - `NHOST_BACKEND_URL` (project base URL)
   - `GRAPHQL_ENDPOINT` = `<NHOST_BACKEND_URL>/v1/graphql`
   - `HASURA_ADMIN_SECRET` (keep secret; use only inside n8n)

Open the Hasura Console from the Nhost project dashboard.

---

## 3. Database schema (Hasura)
Open **Hasura Console → Data → SQL** and run:  
(Also available at [`sql/schema.sql`](sql/schema.sql))

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  user_id text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  sender text NOT NULL DEFAULT 'user', -- 'user' or 'bot'
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

---

## 4. Row‑Level Security & Permissions
Enable RLS on both tables, set permissions for role **user** only.

### 4.1 `chats` (role = user)
- **SELECT** row check:
```json
{ "user_id": { "_eq": "X-Hasura-User-Id" } }
```
- **INSERT**: allow column `title`; Column preset → `user_id` := `X-Hasura-User-Id`
- **UPDATE**: allow `title` with same row check
- **DELETE**: same row check

### 4.2 `messages` (role = user)
- **SELECT** row check:
```json
{ "user_id": { "_eq": "X-Hasura-User-Id" } }
```
- **INSERT**: allow `chat_id`, `content`, `sender`; Column preset → `user_id` := `X-Hasura-User-Id`
- **UPDATE**/**DELETE**: same row check (optional if you allow edits)

> A printable copy of these rules is in [`hasura/permissions.md`](hasura/permissions.md).

---

## 5. GraphQL operations
Use only GraphQL from the frontend. All operations you need are compiled at [`graphql/operations.graphql`](graphql/operations.graphql). Highlights:

```graphql
# Create chat
mutation CreateChat($title: String!) {
  insert_chats_one(object: { title: $title }) { id title created_at }
}

# Insert (user) message
mutation InsertMessage($chat_id: uuid!, $content: String!) {
  insert_messages_one(object:{ chat_id:$chat_id, content:$content, sender:"user" }) { id }
}

# Subscribe to messages
subscription OnMessages($chat_id: uuid!) {
  messages(where:{ chat_id:{ _eq:$chat_id } }, order_by:{ created_at: asc }) {
    id content sender created_at user_id
  }
}
```

---

## 6. Hasura Action `sendMessage`
Create an Action (Hasura Console → **Actions → Create**). SDL is in [`hasura/actions.graphql`](hasura/actions.graphql).

```graphql
type Mutation {
  sendMessage(chat_id: uuid!, message_id: uuid!): SendMessageResponse!
}

type SendMessageResponse {
  success: Boolean!
  reply_text: String
  reply_message_id: uuid
}
```

- **Handler URL:** will be your **n8n Webhook** (Step 7).  
- **Permissions:** allow role `user` only.

Hasura forwards `session_variables` (including `x-hasura-user-id`) to the webhook for ownership checks.

---

## 7. n8n workflow
You’ll build a 6‑node flow:

1. **Webhook (Trigger)** – receives Hasura Action payload.  
2. **HTTP Request (GraphQL)** – fetch `messages_by_pk` for `message_id`.  
3. **IF** – validate `message.user_id` equals `session_variables.x-hasura-user-id`.  
4. **HTTP Request (OpenRouter)** – call LLM with the user message.  
5. **HTTP Request (GraphQL)** – insert bot reply (`sender = "bot"`) into `messages`.  
6. **Respond to Webhook** – return `{ success, reply_text, reply_message_id }`.

- A template export (`n8n/workflow.template.json`) and a click‑by‑click guide (`n8n/WORKFLOW_GUIDE.md`) are included.  
- Store **HASURA_ADMIN_SECRET** and **OPENROUTER_KEY** as **n8n Credentials** (never in frontend).  
- Use the **Production Webhook URL** as the Hasura Action handler URL.

---

## 8. Bolt.new frontend (GraphQL‑only)
Build three screens:

- **Auth** – email sign‑up/sign‑in using Nhost (no server code needed).  
- **Chats** – list chats (query) + “New Chat” (mutation).  
- **ChatView** – message list (subscription) + input: on Send →
  1) Insert user message (mutation),
  2) Call Action `sendMessage` (mutation),
  3) Display bot reply as it arrives via subscription.

A compact, copy‑paste playbook is in [`frontend/bolt_setup.md`](frontend/bolt_setup.md).

---

## 9. Deploy to Netlify
- Export your Bolt project (static).  
- Push to Git (GitHub).  
- In Netlify → **New site from Git** → select repo → Deploy.  
- Add frontend env var if needed: `REACT_APP_NHOST_BACKEND_URL`.  
- Do **NOT** put `HASURA_ADMIN_SECRET` or `OPENROUTER_KEY` in Netlify.

See [`deploy/netlify.md`](deploy/netlify.md).

---

## 10. Test checklist
- [ ] Sign up & sign in works (Nhost).  
- [ ] Create chat → row in `chats` has your `user_id`.  
- [ ] Send user message → row in `messages` (`sender="user"`).  
- [ ] Hasura Action `sendMessage` triggers n8n.  
- [ ] n8n validates ownership (IDs match).  
- [ ] n8n calls OpenRouter, gets reply.  
- [ ] n8n inserts bot message (`sender="bot"`).  
- [ ] Frontend subscription displays the bot reply.  
- [ ] Another user cannot read your chats (RLS).

---

## 11. Submission format
```
Name: <Your Name>
Contact: <Your number or email>
Deployed: https://<your-netlify-site>.netlify.app/
```
Attach:
- n8n workflow export JSON,
- `sql/schema.sql`,
- Short README (this file).

---

## 12. Security notes
- Keep `HASURA_ADMIN_SECRET` and `OPENROUTER_KEY` **only** in n8n credentials.  
- Frontend must call **GraphQL only** (mutations/queries/subscriptions).  
- All external API calls (OpenRouter) go through n8n.

---

## Appendix: Links to included files
- [`sql/schema.sql`](sql/schema.sql) – DB schema
- [`hasura/permissions.md`](hasura/permissions.md) – RLS/permissions
- [`graphql/operations.graphql`](graphql/operations.graphql) – GraphQL ops
- [`hasura/actions.graphql`](hasura/actions.graphql) – Action SDL
- [`n8n/workflow.template.json`](n8n/workflow.template.json) – workflow skeleton (import & edit)
- [`n8n/WORKFLOW_GUIDE.md`](n8n/WORKFLOW_GUIDE.md) – node‑by‑node setup
- [`frontend/bolt_setup.md`](frontend/bolt_setup.md) – Bolt UI steps
- [`deploy/netlify.md`](deploy/netlify.md) – deployment steps

=======
# subspace-chatbot-assessment
>>>>>>> 608e13129f150aba062f7aefb6eca3716236860d
