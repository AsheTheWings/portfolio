-- ===== FUNCTIONS =====

-- Update slots updated_at
CREATE OR REPLACE FUNCTION update_slots_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql' SET search_path = public;

-- Update users updated_at
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Update session event count
CREATE OR REPLACE FUNCTION update_session_event_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE agent_sessions
    SET 
        event_count = (
            SELECT COUNT(*) 
            FROM agent_session_events 
            WHERE session_id = COALESCE(NEW.session_id, OLD.session_id)
        ),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.session_id, OLD.session_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Update agent sessions turns_count
CREATE OR REPLACE FUNCTION update_agent_sessions_turns_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF (NEW.event_type = 'user-turn-completed' OR NEW.event_type = 'agent-turn-completed') THEN
            UPDATE agent_sessions
            SET turns_count = (
                SELECT COUNT(*) 
                FROM agent_session_events 
                WHERE session_id = NEW.session_id
                    AND (event_type = 'user-turn-completed' OR event_type = 'agent-turn-completed')
            )
            WHERE id = NEW.session_id;
        END IF;
        RETURN NEW;
    END IF;
    IF (TG_OP = 'DELETE') THEN
        IF (OLD.event_type = 'user-turn-completed' OR OLD.event_type = 'agent-turn-completed') THEN
            UPDATE agent_sessions
            SET turns_count = (
                SELECT COUNT(*) 
                FROM agent_session_events 
                WHERE session_id = OLD.session_id
                    AND (event_type = 'user-turn-completed' OR event_type = 'agent-turn-completed')
            )
            WHERE id = OLD.session_id;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Update session is_head
CREATE OR REPLACE FUNCTION update_session_is_head()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.is_head = false) THEN
        UPDATE agent_sessions
        SET is_head = false
        WHERE (
            (root_session_id = COALESCE(NEW.root_session_id, NEW.id))
            OR (root_session_id IS NULL AND id = COALESCE(NEW.root_session_id, NEW.id))
        )
        AND id != NEW.id
        AND is_head = true;
        NEW.is_head := true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Update general updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Update folder assets count
CREATE OR REPLACE FUNCTION update_folder_assets_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.folder_id IS NOT NULL THEN
            UPDATE folders SET assets_count = assets_count + 1 WHERE id = NEW.folder_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.folder_id IS NOT NULL THEN
            UPDATE folders SET assets_count = assets_count - 1 WHERE id = OLD.folder_id;
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.folder_id IS DISTINCT FROM NEW.folder_id THEN
            IF OLD.folder_id IS NOT NULL THEN
                UPDATE folders SET assets_count = assets_count - 1 WHERE id = OLD.folder_id;
            END IF;
            IF NEW.folder_id IS NOT NULL THEN
                UPDATE folders SET assets_count = assets_count + 1 WHERE id = NEW.folder_id;
            END IF;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Get descendant folder IDs
CREATE OR REPLACE FUNCTION get_descendant_folder_ids(root_folder_ids uuid[])
RETURNS TABLE (id uuid) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE descendants AS (
        SELECT f.id
        FROM folders f
        WHERE f.parent_id = ANY(root_folder_ids)
        UNION ALL
        SELECT f.id
        FROM folders f
        INNER JOIN descendants d ON f.parent_id = d.id
    )
    SELECT descendants.id FROM descendants;
END;
$$ LANGUAGE plpgsql STABLE;
GRANT EXECUTE ON FUNCTION get_descendant_folder_ids(uuid[]) TO authenticated;

-- ===== TRIGGERS =====

CREATE TRIGGER update_slots_updated_at 
    BEFORE UPDATE ON slots 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_slots_updated_at_column();

CREATE TRIGGER trigger_update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();

CREATE TRIGGER trigger_update_session_event_count
    AFTER INSERT OR UPDATE OR DELETE ON agent_session_events
    FOR EACH ROW
    EXECUTE FUNCTION update_session_event_count();

CREATE TRIGGER trigger_update_turns_count
    AFTER INSERT OR UPDATE OR DELETE ON agent_session_events
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_sessions_turns_count();

CREATE TRIGGER session_is_head_update
    BEFORE INSERT OR UPDATE ON agent_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_session_is_head();

CREATE TRIGGER update_folders_updated_at
    BEFORE UPDATE ON folders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_folder_assets_count
    AFTER INSERT OR UPDATE OR DELETE ON assets
    FOR EACH ROW
    EXECUTE FUNCTION update_folder_assets_count();
