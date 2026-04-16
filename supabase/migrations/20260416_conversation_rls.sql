-- T6: RLS policies for ai_conversations + ai_messages
-- user_id is VARCHAR(255), auth.uid() returns UUID — cast to text for comparison

-- Enable RLS on both tables
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

-- ai_conversations: users can only access their own conversations
CREATE POLICY "users_select_own_conversations"
  ON ai_conversations FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "users_insert_own_conversations"
  ON ai_conversations FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "users_update_own_conversations"
  ON ai_conversations FOR UPDATE
  USING (user_id = auth.uid()::text);

CREATE POLICY "users_delete_own_conversations"
  ON ai_conversations FOR DELETE
  USING (user_id = auth.uid()::text);

-- ai_messages: users can access messages in their own conversations
CREATE POLICY "users_select_own_messages"
  ON ai_messages FOR SELECT
  USING (conversation_id IN (
    SELECT id FROM ai_conversations WHERE user_id = auth.uid()::text
  ));

CREATE POLICY "users_insert_own_messages"
  ON ai_messages FOR INSERT
  WITH CHECK (conversation_id IN (
    SELECT id FROM ai_conversations WHERE user_id = auth.uid()::text
  ));

-- Service role bypass: full access for backend operations
CREATE POLICY "service_role_all_conversations"
  ON ai_conversations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_all_messages"
  ON ai_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
