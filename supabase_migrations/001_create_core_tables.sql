-- ===== USERS TABLE =====
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(255),
    hashed_password TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_superuser BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_login TIMESTAMPTZ,
    CONSTRAINT username_length CHECK (char_length(username) >= 3),
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR email IS NULL),
    CONSTRAINT users_auth_user_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ===== WORKLOADS TABLE =====
CREATE TABLE public.workloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(40) NOT NULL,
    description VARCHAR(200),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT workloads_name_not_empty CHECK (char_length(name) > 0)
);

-- ===== SLOTS TABLE =====
CREATE TABLE public.slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workload_id UUID NOT NULL REFERENCES public.workloads(id),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== AGENT SESSIONS TABLE =====
CREATE TABLE public.agent_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT,
    agent_name TEXT,
    event_count INTEGER NOT NULL DEFAULT 0,
    turns_count INTEGER NOT NULL DEFAULT 0,
    title_locked BOOLEAN NOT NULL DEFAULT false,
    root_session_id UUID REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
    is_head BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- ===== AGENT SESSION EVENTS TABLE =====
CREATE TABLE public.agent_session_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
    component_id UUID NOT NULL,
    turn_id UUID,
    event_type TEXT NOT NULL,
    data JSONB NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'agent', 'system')),
    sequence INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== FOLDERS TABLE =====
CREATE TABLE public.folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(name) > 0 AND char_length(name) <= 255),
    parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    depth INTEGER NOT NULL DEFAULT 0,
    is_system BOOLEAN NOT NULL DEFAULT false,
    assets_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT folders_unique_name_in_parent UNIQUE(user_id, parent_id, name),
    CONSTRAINT folders_unique_path UNIQUE(user_id, path)
);

-- ===== ASSETS TABLE =====
CREATE TABLE public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    mime_type TEXT,
    size_kb INTEGER,
    alt_text TEXT,
    thumbnail_url TEXT,
    metadata JSONB DEFAULT '{}',
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    folder_id UUID NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== ASSET TAGS TABLE =====
CREATE TABLE public.asset_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT asset_tags_unique_user_tag UNIQUE(user_id, tag)
);

-- ===== ASSET ITEM TAGS TABLE =====
CREATE TABLE public.asset_item_tags (
    asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.asset_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (asset_id, tag_id)
);

-- ===== TWEETS TABLE =====
CREATE TABLE public.tweets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tweet_id TEXT NOT NULL UNIQUE,
    author_username TEXT NOT NULL,
    author_display_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ,
    likes_count INTEGER NOT NULL DEFAULT 0,
    retweets_count INTEGER NOT NULL DEFAULT 0,
    replies_count INTEGER NOT NULL DEFAULT 0,
    views_count INTEGER NOT NULL DEFAULT 0,
    is_retweet BOOLEAN NOT NULL DEFAULT FALSE,
    is_quote BOOLEAN NOT NULL DEFAULT FALSE,
    is_reply BOOLEAN NOT NULL DEFAULT FALSE,
    quoted_tweet_id TEXT,
    reply_to_tweet_id TEXT,
    reply_to_username TEXT,
    media_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    hashtags JSONB NOT NULL DEFAULT '[]'::jsonb,
    mentions JSONB NOT NULL DEFAULT '[]'::jsonb,
    url TEXT NOT NULL DEFAULT '',
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT tweets_tweet_id_check CHECK (char_length(tweet_id) > 0)
);
