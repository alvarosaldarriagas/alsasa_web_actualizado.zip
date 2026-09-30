-- Isolated technical database only. Durable rate limit before external challenge validation.
BEGIN;
CREATE TABLE alsasa_guard_v1.ingress_limits (
 scope text NOT NULL, window_id text NOT NULL, kind text NOT NULL CHECK(kind IN ('form','chat')),
 interval_seconds integer NOT NULL CHECK(interval_seconds BETWEEN 1 AND 3600),
 cap integer NOT NULL CHECK(cap BETWEEN 1 AND 100),
 PRIMARY KEY(scope,window_id,kind),
 FOREIGN KEY(scope,window_id) REFERENCES alsasa_guard_v1.windows
);
CREATE TABLE alsasa_guard_v1.ingress_attempts (
 scope text NOT NULL, window_id text NOT NULL, kind text NOT NULL,
 subject text NOT NULL CHECK(subject ~ '^[a-f0-9]{64}$'),
 operation_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(scope,operation_id),
 FOREIGN KEY(scope,window_id,kind) REFERENCES alsasa_guard_v1.ingress_limits
);
CREATE INDEX ingress_attempts_subject_time
 ON alsasa_guard_v1.ingress_attempts(scope,window_id,kind,subject,created_at DESC);
ALTER TABLE alsasa_guard_v1.ingress_limits OWNER TO alsasa_guard_owner;
ALTER TABLE alsasa_guard_v1.ingress_attempts OWNER TO alsasa_guard_owner;
REVOKE ALL ON alsasa_guard_v1.ingress_limits,alsasa_guard_v1.ingress_attempts FROM PUBLIC;

CREATE FUNCTION alsasa_guard_v1.consume_ingress(p_scope text,p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,alsasa_guard_v1,pg_temp SET lock_timeout='3s' SET statement_timeout='5s'
AS $rate$
DECLARE g alsasa_guard_v1.gate%ROWTYPE; w alsasa_guard_v1.windows%ROWTYPE;
 cfg alsasa_guard_v1.ingress_limits%ROWTYPE; used integer; op uuid;
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
 op:=(p->>'operation')::uuid;
 SELECT * INTO w FROM alsasa_guard_v1.windows WHERE scope=p_scope AND window_id=g.current_window;
 SELECT * INTO cfg FROM alsasa_guard_v1.ingress_limits WHERE scope=p_scope AND window_id=g.current_window AND kind=p->>'kind';
 IF NOT g.enabled OR w.window_id IS NULL OR cfg.kind IS NULL OR clock_timestamp()<w.starts_at OR clock_timestamp()>=w.ends_at
 THEN RETURN jsonb_build_object('allowed',false); END IF;
 -- Serialize the rolling counter for the exact privacy-preserving subject and kind.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_scope||E'\x1f'||g.current_window||E'\x1f'||(p->>'kind')||E'\x1f'||(p->>'subject'),0));
 IF EXISTS(SELECT 1 FROM alsasa_guard_v1.ingress_attempts WHERE scope=p_scope AND operation_id=op)
 THEN RETURN jsonb_build_object('allowed',false); END IF;
 SELECT count(*) INTO used FROM alsasa_guard_v1.ingress_attempts
  WHERE scope=p_scope AND window_id=g.current_window AND kind=p->>'kind' AND subject=p->>'subject'
  AND created_at>clock_timestamp()-make_interval(secs=>cfg.interval_seconds);
 IF used>=cfg.cap THEN RETURN jsonb_build_object('allowed',false); END IF;
 INSERT INTO alsasa_guard_v1.ingress_attempts(scope,window_id,kind,subject,operation_id)
 VALUES(p_scope,g.current_window,p->>'kind',p->>'subject',op);
 RETURN jsonb_build_object('allowed',true);
END;
$rate$;
ALTER FUNCTION alsasa_guard_v1.consume_ingress(text,jsonb) OWNER TO alsasa_guard_owner;
REVOKE ALL ON FUNCTION alsasa_guard_v1.consume_ingress(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION alsasa_guard_v1.consume_ingress(text,jsonb) TO tg_admit;
COMMIT;
