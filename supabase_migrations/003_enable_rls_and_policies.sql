-- ===== ENABLE RLS =====
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_session_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_item_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tweets ENABLE ROW LEVEL SECURITY;

-- ===== AGENT_SESSIONS POLICIES =====
CREATE POLICY "agent_sessions_select_own" ON public.agent_sessions
    FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY "agent_sessions_insert_own" ON public.agent_sessions
    FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "agent_sessions_update_own" ON public.agent_sessions
    FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "agent_sessions_delete_own" ON public.agent_sessions
    FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

-- ===== AGENT_SESSION_EVENTS POLICIES =====
CREATE POLICY "agent_session_events_select_own" ON public.agent_session_events
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_session_events.session_id AND agent_sessions.user_id = (select auth.uid())));
CREATE POLICY "agent_session_events_insert_own" ON public.agent_session_events
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_session_events.session_id AND agent_sessions.user_id = (select auth.uid())));
CREATE POLICY "agent_session_events_update_own" ON public.agent_session_events
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_session_events.session_id AND agent_sessions.user_id = (select auth.uid())))
    WITH CHECK (EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_session_events.session_id AND agent_sessions.user_id = (select auth.uid())));
CREATE POLICY "agent_session_events_delete_own" ON public.agent_session_events
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_session_events.session_id AND agent_sessions.user_id = (select auth.uid())));

-- ===== FOLDERS POLICIES =====
CREATE POLICY "folders_select_own" ON public.folders
    FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY "folders_insert_own" ON public.folders
    FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "folders_update_own" ON public.folders
    FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "folders_delete_own" ON public.folders
    FOR DELETE TO authenticated USING (user_id = (select auth.uid()) AND is_system = false);

-- ===== ASSETS POLICIES =====
CREATE POLICY "assets_select_own" ON public.assets
    FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY "assets_insert_own" ON public.assets
    FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "assets_update_own" ON public.assets
    FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "assets_delete_own" ON public.assets
    FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

-- ===== ASSET_TAGS POLICIES =====
CREATE POLICY "asset_tags_select_own" ON public.asset_tags
    FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY "asset_tags_insert_own" ON public.asset_tags
    FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "asset_tags_update_own" ON public.asset_tags
    FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "asset_tags_delete_own" ON public.asset_tags
    FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

-- ===== ASSET_ITEM_TAGS POLICIES =====
CREATE POLICY "asset_item_tags_select_own" ON public.asset_item_tags
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_item_tags.asset_id AND assets.user_id = (select auth.uid())));
CREATE POLICY "asset_item_tags_insert_own" ON public.asset_item_tags
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_item_tags.asset_id AND assets.user_id = (select auth.uid())));
CREATE POLICY "asset_item_tags_delete_own" ON public.asset_item_tags
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_item_tags.asset_id AND assets.user_id = (select auth.uid())));

-- ===== TWEETS POLICIES =====
CREATE POLICY "tweets_select_own" ON public.tweets
    FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY "tweets_insert_own" ON public.tweets
    FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "tweets_update_own" ON public.tweets
    FOR UPDATE TO authenticated USING (user_id = (select auth.uid()));
