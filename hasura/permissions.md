# hasura/permissions.md

## Enable Row Level Security (RLS)
Enable RLS on both `public.chats` and `public.messages`.

## Role: user

### Table: chats
- SELECT (Row check)
```json
{ "user_id": { "_eq": "X-Hasura-User-Id" } }
```
- INSERT
  - Allowed columns: `title`
  - Column preset: `user_id` := `X-Hasura-User-Id`
- UPDATE
  - Allowed columns: `title`
  - Row check as SELECT
- DELETE
  - Row check as SELECT

### Table: messages
- SELECT (Row check)
```json
{ "user_id": { "_eq": "X-Hasura-User-Id" } }
```
- INSERT
  - Allowed: `chat_id`, `content`, `sender`
  - Column preset: `user_id` := `X-Hasura-User-Id`
- UPDATE / DELETE
  - Row check as SELECT

### Actions (sendMessage)
- Permissions: allow role `user` only.
