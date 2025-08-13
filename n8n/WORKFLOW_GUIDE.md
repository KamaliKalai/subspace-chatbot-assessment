# n8n/WORKFLOW_GUIDE.md

This guide walks you through building the workflow that the Hasura Action will call.

## Overview (6 nodes)
1. **Webhook (Trigger)** – receives Hasura Action payload.
2. **HTTP Request (GraphQL)** – fetch `messages_by_pk` for `message_id`.
3. **IF** – validate `message.user_id` equals `session_variables.x-hasura-user-id`.
4. **HTTP Request (OpenRouter)** – call LLM with the user message.
5. **HTTP Request (GraphQL)** – insert bot reply (`sender = "bot"`).
6. **Respond to Webhook** – return `{ success, reply_text, reply_message_id }`.

> Store `HASURA_ADMIN_SECRET` and `OPENROUTER_KEY` in n8n **Credentials**. Do not expose them client-side.

---

## Node A — Webhook (Trigger)
- **HTTP Method**: POST
- **Path**: `/hasura-sendMessage`
- **Respond**: When Last Node Finishes

Incoming JSON example:
```json
{
  "action": { "name": "sendMessage" },
  "input": { "chat_id": "UUID", "message_id": "UUID" },
  "session_variables": { "x-hasura-user-id": "USER_ID", "x-hasura-role": "user" }
}
```

## Node B — HTTP Request (GraphQL: Get message)
- **Method**: POST  
- **URL**: `https://<NHOST_BACKEND_URL>/v1/graphql`  
- **Headers**:
  - `Content-Type: application/json`
  - `x-hasura-admin-secret: <HASURA_ADMIN_SECRET>`
- **Body (JSON)**:
```json
{
  "query": "query GetMessage($id: uuid!){ messages_by_pk(id: $id){ id content chat_id user_id } }",
  "variables": { "id": "={{ $json[\"input\"][\"message_id\"] }}" }
}
```

## Node C — IF (ownership check)
- **Left**: `={{ $json["data"]["messages_by_pk"]["user_id"] }}`
- **Operator**: `equals (===)`
- **Right**: `={{ $json["session_variables"]["x-hasura-user-id"] }}`

**If false**: add a **Set** node with:
```json
{ "success": false, "error": "ownership_mismatch" }
```
Connect it to **Respond to Webhook** and finish.

## Node D — HTTP Request (OpenRouter)
- **Method**: POST  
- **URL**: `https://openrouter.ai/api/v1/chat/completions`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <OPENROUTER_KEY>`
- **Body (JSON)**:
```json
{
  "model": "deepseek/deepseek-r1:free",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "={{ $json[\"data\"][\"messages_by_pk\"][\"content\"] }}" }
  ]
}
```
- Add a **Set** node after it to extract the model reply into a field called `openrouter_reply`. For example (if response shape is OpenAI-compatible):
```json
{ "openrouter_reply": "={{ $json[\"choices\"][0][\"message\"][\"content\"] }}" }
```

## Node E — HTTP Request (GraphQL: Insert bot reply)
- **Method**: POST  
- **URL**: `https://<NHOST_BACKEND_URL>/v1/graphql`
- **Headers**:
  - `Content-Type: application/json`
  - `x-hasura-admin-secret: <HASURA_ADMIN_SECRET>`
- **Body (JSON)**:
```json
{
  "query":"mutation InsertBot($chat_id: uuid!, $content: String!, $user_id: String!){ insert_messages_one(object:{chat_id:$chat_id,content:$content,sender:\"bot\",user_id:$user_id}){ id } }",
  "variables": {
    "chat_id": "={{ $json[\"data\"][\"messages_by_pk\"][\"chat_id\"] }}",
    "content": "={{ $json[\"openrouter_reply\"] }}",
    "user_id": "={{ $json[\"session_variables\"][\"x-hasura-user-id\"] }}"
  }
}
```

## Node F — Respond to Webhook
Return JSON:
```json
{
  "success": true,
  "reply_text": "={{ $json[\"openrouter_reply\"] }}",
  "reply_message_id": "={{ $json[\"data\"][\"insert_messages_one\"][\"id\"] }}"
}
```

## Final steps
- **Activate** the workflow.
- Copy the **Production Webhook URL** from the Webhook node.
- Paste it into Hasura Action handler URL.
