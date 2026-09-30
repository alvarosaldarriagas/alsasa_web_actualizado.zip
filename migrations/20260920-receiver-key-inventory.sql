-- Additive, inactive receiver roles and atomic key-inventory check.
BEGIN;
DO $roles$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='alsasa_capture_admit') THEN
  CREATE ROLE alsasa_capture_admit NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='alsasa_capture_exec') THEN
  CREATE ROLE alsasa_capture_exec NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
END $roles$;
CREATE FUNCTION alsasa_guard_v1.required_capture_keys(p_scope text)
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,alsasa_guard_v1,pg_temp SET lock_timeout='3s' SET statement_timeout='5s'
AS $inventory$
DECLARE g alsasa_guard_v1.gate%ROWTYPE; ids text[];
BEGIN
 SELECT * INTO g FROM alsasa_guard_v1.gate WHERE scope=p_scope FOR UPDATE;
 IF NOT FOUND OR session_user<>g.admission_role THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM alsasa_guard_v1.inbox WHERE scope=p_scope
   AND (jsonb_typeof(payload->'keyId') IS DISTINCT FROM 'string' OR coalesce(payload->>'keyId','') !~ '^[a-zA-Z0-9_-]{1,80}$'))
 THEN RAISE EXCEPTION 'invalid key inventory'; END IF;
 SELECT coalesce(array_agg(DISTINCT payload->>'keyId'),'{}'::text[]) INTO ids FROM alsasa_guard_v1.inbox WHERE scope=p_scope;
 IF cardinality(ids)>32 THEN RAISE EXCEPTION 'key inventory exceeds limit'; END IF;
 RETURN ids;
END;
$inventory$;
ALTER FUNCTION alsasa_guard_v1.required_capture_keys(text) OWNER TO alsasa_guard_owner;
REVOKE ALL ON FUNCTION alsasa_guard_v1.required_capture_keys(text) FROM PUBLIC;
GRANT USAGE ON SCHEMA alsasa_guard_v1 TO alsasa_capture_admit,alsasa_capture_exec;
GRANT EXECUTE ON FUNCTION alsasa_guard_v1.required_capture_keys(text),alsasa_guard_v1.capture(text,text,jsonb) TO alsasa_capture_admit;
GRANT EXECUTE ON FUNCTION alsasa_guard_v1.capture(text,text,jsonb),alsasa_guard_v1.operate(text,text,jsonb),
 alsasa_guard_v1.identity_guard(text,text,jsonb),alsasa_guard_v1.client_branch(text,jsonb),
 alsasa_guard_v1.commercial_control(text,text,jsonb) TO alsasa_capture_exec;
COMMIT;
