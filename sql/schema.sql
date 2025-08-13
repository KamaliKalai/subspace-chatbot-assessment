-- sql/schema.sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  user_id text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  sender text NOT NULL DEFAULT 'user', -- 'user' or 'bot'
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
