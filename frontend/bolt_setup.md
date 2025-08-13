# frontend/bolt_setup.md

This document shows how to build the UI in Bolt.new with **only GraphQL**.

## Screens
1. **Auth** – Email + Password forms (Sign Up / Sign In).  
2. **Chats** – List chats, button to create a chat.  
3. **ChatView** – Messages list (subscription) + input to send message.

## Connect Nhost
In Bolt, add a Code block (HTML/JS) and paste:

```html
<script type="module">
import { NhostClient } from 'https://cdn.jsdelivr.net/npm/@nhost/nhost-js/+esm';

window.nhost = new NhostClient({ backendUrl: 'https://YOUR_NHOST_BACKEND_URL' });

window.gql = async (query, variables) => {
  const res = await window.nhost.graphql.request(query, variables);
  if (res.error) throw res.error;
  return res;
};

window.signup = async (email, password) => {
  const { error } = await window.nhost.auth.signUp({ email, password });
  if (error) throw error;
};

window.signin = async (email, password) => {
  const { error } = await window.nhost.auth.signIn({ email, password });
  if (error) throw error;
};

window.signout = async () => { await window.nhost.auth.signOut(); };

window.createChat = async (title) => {
  const q = `mutation ($title:String!){ insert_chats_one(object:{title:$title}){ id title } }`;
  const r = await window.gql(q, { title });
  return r.insert_chats_one;
};

window.sendMessageFlow = async (chatId, content) => {
  const insertQ = `mutation ($chat_id: uuid!, $content: String!){
    insert_messages_one(object:{chat_id:$chat_id, content:$content, sender:"user"}){ id }
  }`;
  const r1 = await window.gql(insertQ, { chat_id: chatId, content });
  const messageId = r1.insert_messages_one.id;

  const actionQ = `mutation ($chat_id: uuid!, $message_id: uuid!){
    sendMessage(chat_id:$chat_id, message_id:$message_id){ success reply_text reply_message_id }
  }`;
  const r2 = await window.gql(actionQ, { chat_id: chatId, message_id: messageId });
  return r2.sendMessage;
};
</script>
```

Replace `YOUR_NHOST_BACKEND_URL`.

## Queries/Mutations/Subscription
Use `graphql/operations.graphql` from the repo. In Bolt, create GraphQL blocks using those texts.

- **Messages subscription** renders the live chat.
- The **Send** button calls `window.sendMessageFlow(chatId, inputValue)`.

## Important
- Only GraphQL from the frontend (no REST).  
- Do not expose admin secrets here.  
- n8n webhook is called **via Hasura Action**, not from the browser.
