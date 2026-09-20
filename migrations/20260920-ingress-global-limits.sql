-- Prerequisite: existing alsasa_guard_v1 ingress schema from the technical candidate.
-- Migration closes all existing ingress scopes until explicit global limits are set.
-- Apply to the isolated branch first. No policies or logins are activated here.
BEGIN;
ALTER TABLE alsasa_guard_v1.ingress_limits
 ADD COLUMN global_cap integer NOT NULL DEFAULT 0 CHECK(global_cap BETWEEN 0 AND 10000),
 ADD COLUMN window_cap integer NOT NULL DEFAULT 0 CHECK(window_cap BETWEEN 0 AND 100000);
CREATE INDEX ingress_attempts_channel_time ON alsasa_guard_v1.ingress_attempts(scope,window_id,kind,created_at DESC);
CREATE OR REPLACE FUNCTION alsasa_guard_v1.consume_ingress(p_scope text,p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,alsasa_guard_v1,pg_temp SET lock_timeout='3s' SET statement_timeout='5s'
AS $rate$
DECLARE g alsasa_guard_v1.gate%ROWTYPE; w alsasa_guard_v1.windows%ROWTYPE;
 cfg alsasa_guard_v1.ingress_limits%ROWTYPE; used integer; total_used integer; rolling_used integer; op uuid; current_time_at timestamptz;
BEGIN
 SELECT * INTO g FROM alsasa_guard_v1.gate WHERE scope=p_scope FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('allowed',false); END IF;
 IF session_user<>g.admission_role THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR octet_length(p::text)>1000
 OR p - ARRAY['subject','kind','operation'] <> '{}'::jsonb
 OR coalesce(p->>'subject','') !~ '^[a-f0-9]{64}$'
 OR coalesce(p->>'kind','') NOT IN ('form','chat')
 OR coalesce(p->>'operation','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
 THEN RETURN jsonb_build_object('allowed',false); END IF;
 IF jsonb_typeof(p->'subject') IS DISTINCT FROM 'string' OR jsonb_typeof(p->'kind') IS DISTINCT FROM 'string' OR jsonb_typeof(p->'operation') IS DISTINCT FROM 'string' THEN RETURN jsonb_build_object('allowed',false); END IF;
 op:=(p->>'operation')::uuid;
 SELECT * INTO w FROM alsasa_guard_v1.windows WHERE scope=p_scope AND window_id=g.current_window;
 SELECT * INTO cfg FROM alsasa_guard_v1.ingress_limits WHERE scope=p_scope AND window_id=g.current_window AND kind=p->>'kind';
 IF NOT g.enabled OR w.window_id IS NULL OR cfg.kind IS NULL OR cfg.global_cap<=0 OR cfg.window_cap<=0 OR clock_timestamp()<w.starts_at OR clock_timestamp()>=w.ends_at
 THEN RETURN jsonb_build_object('allowed',false); END IF;
 -- Serialize the rolling counter for the exact privacy-preserving subject and kind.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_scope||E'\x1f'||g.current_window||E'\x1f'||(p->>'kind')||E'\x1f'||(p->>'subject'),0));
 IF EXISTS(SELECT 1 FROM alsasa_guard_v1.ingress_attempts WHERE scope=p_scope AND operation_id=op)
 THEN RETURN jsonb_build_object('allowed',false); END IF;
 current_time_at:=clock_timestamp();
 SELECT count(*),count(*) FILTER (WHERE created_at>current_time_at-make_interval(secs=>cfg.interval_seconds))
 INTO total_used,rolling_used FROM alsasa_guard_v1.ingress_attempts
 WHERE scope=p_scope AND window_id=g.current_window AND kind=p->>'kind';
 IF total_used>=cfg.window_cap OR rolling_used>=cfg.global_cap THEN RETURN jsonb_build_object('allowed',false); END IF;
 SELECT count(*) INTO used FROM alsasa_guard_v1.ingress_attempts
  WHERE scope=p_scope AND window_id=g.current_window AND kind=p->>'kind' AND subject=p->>'subject'
  AND created_at>current_time_at-make_interval(secs=>cfg.interval_seconds);
 IF used>=cfg.cap THEN RETURN jsonb_build_object('allowed',false); END IF;
 INSERT INTO alsasa_guard_v1.ingress_attempts(scope,window_id,kind,subject,operation_id)
 VALUES(p_scope,g.current_window,p->>'kind',p->>'subject',op);
 RETURN jsonb_build_object('allowed',true);
END;
$rate$;
ALTER FUNCTION alsasa_guard_v1.consume_ingress(text,jsonb) OWNER TO alsasa_guard_owner;
REVOKE ALL ON FUNCTION alsasa_guard_v1.consume_ingress(text,jsonb) FROM PUBLIC;
DO $role$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='alsasa_web_ingress') THEN
  CREATE ROLE alsasa_web_ingress NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
END $role$;
GRANT USAGE ON SCHEMA alsasa_guard_v1 TO alsasa_web_ingress;
GRANT EXECUTE ON FUNCTION alsasa_guard_v1.consume_ingress(text,jsonb) TO alsasa_web_ingress;
COMMIT;
