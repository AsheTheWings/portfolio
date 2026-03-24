-- ===== INDEXES =====

-- Users
CREATE INDEX idx_users_username ON public.users(username);
CREATE INDEX idx_users_email ON public.users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_is_active ON public.users(is_active) WHERE is_active = true;

-- Workloads
CREATE UNIQUE INDEX idx_workloads_user_name_unique_ci ON public.workloads (user_id, lower((name)::text));
CREATE INDEX idx_workloads_user_id ON public.workloads(user_id);

-- Slots
CREATE INDEX idx_slots_workload_id ON public.slots(workload_id);
CREATE INDEX idx_slots_start_time ON public.slots(start_time);
CREATE INDEX idx_slots_updated_at ON public.slots(updated_at);
CREATE INDEX idx_slots_user_id ON public.slots(user_id);

-- Agent sessions
CREATE INDEX idx_agent_sessions_user_id ON public.agent_sessions(user_id);
CREATE INDEX idx_agent_sessions_created_at ON public.agent_sessions(created_at DESC);
CREATE INDEX idx_agent_sessions_agent_name ON public.agent_sessions(agent_name);
CREATE INDEX idx_agent_sessions_is_head ON public.agent_sessions(user_id, is_head, updated_at DESC) WHERE is_head = true;
CREATE INDEX idx_agent_sessions_root ON public.agent_sessions(root_session_id) WHERE root_session_id IS NOT NULL;

-- Agent session events
CREATE INDEX idx_agent_session_events_session ON public.agent_session_events(session_id, created_at);
CREATE INDEX idx_agent_session_events_sequence ON public.agent_session_events(session_id, sequence);
CREATE INDEX idx_agent_session_events_type ON public.agent_session_events(session_id, event_type);
CREATE INDEX idx_agent_session_events_component ON public.agent_session_events(component_id, created_at);
CREATE INDEX idx_agent_session_events_turn_id ON public.agent_session_events(turn_id);
CREATE INDEX idx_agent_session_events_role ON public.agent_session_events(role);

-- Folders
CREATE INDEX idx_folders_user_id ON public.folders(user_id);
CREATE INDEX idx_folders_parent_id ON public.folders(parent_id);
CREATE INDEX idx_folders_path ON public.folders(path);

-- Assets
CREATE INDEX idx_assets_file_type ON public.assets(file_type);
CREATE INDEX idx_assets_created_at ON public.assets(created_at DESC);
CREATE INDEX idx_assets_user_id ON public.assets(user_id);
CREATE INDEX idx_assets_folder_id ON public.assets(folder_id);

-- Asset tags
CREATE INDEX idx_asset_tags_tag ON public.asset_tags(tag);
CREATE INDEX idx_asset_tags_user_id ON public.asset_tags(user_id);

-- Asset item tags
CREATE INDEX idx_asset_item_tags_asset ON public.asset_item_tags(asset_id);
CREATE INDEX idx_asset_item_tags_tag ON public.asset_item_tags(tag_id);

-- Tweets
CREATE INDEX tweets_user_id_idx ON public.tweets(user_id);
CREATE INDEX tweets_author_username_idx ON public.tweets(author_username);
CREATE INDEX tweets_created_at_idx ON public.tweets(created_at DESC);
CREATE INDEX tweets_scraped_at_idx ON public.tweets(scraped_at DESC);
