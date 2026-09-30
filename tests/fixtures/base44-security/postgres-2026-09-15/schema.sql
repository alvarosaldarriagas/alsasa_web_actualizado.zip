-- Inactive candidate. Apply ONLY to an empty, explicitly selected technical database.
-- No login roles, policies, production data or credentials are provisioned here.
BEGIN;
CREATE SCHEMA alsasa_guard_v1;
REVOKE ALL ON SCHEMA alsasa_guard_v1 FROM PUBLIC;
CREATE TABLE alsasa_guard_v1.gate (
 scope text PRIMARY KEY CHECK(length(scope) BETWEEN 1 AND 160),
 enabled boolean NOT NULL DEFAULT false,
 current_window text NOT NULL,
 admission_role name NOT NULL,
 execution_role name NOT NULL
);
CREATE TABLE alsasa_guard_v1.windows (
 scope text NOT NULL REFERENCES alsasa_guard_v1.gate(scope),
 window_id text NOT NULL,
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL CHECK(ends_at > starts_at),
 subject_limit bigint NOT NULL CHECK(subject_limit > 0),
 PRIMARY KEY(scope,window_id)
);
CREATE TABLE alsasa_guard_v1.channels (
 scope text NOT NULL, window_id text NOT NULL, channel text NOT NULL,
 plan jsonb NOT NULL CHECK(jsonb_typeof(plan)='array' AND jsonb_array_length(plan) BETWEEN 1 AND 32),
 PRIMARY KEY(scope,window_id,channel),
 FOREIGN KEY(scope,window_id) REFERENCES alsasa_guard_v1.windows
);
CREATE TABLE alsasa_guard_v1.buckets (
 scope text NOT NULL, window_id text NOT NULL,
 dimension text NOT NULL CHECK(dimension IN ('resource','channel','subject')),
 bucket text NOT NULL, cap bigint NOT NULL CHECK(cap >= 0),
 used bigint NOT NULL DEFAULT 0 CHECK(used >= 0 AND used <= cap),
 PRIMARY KEY(scope,window_id,dimension,bucket),
 FOREIGN KEY(scope,window_id) REFERENCES alsasa_guard_v1.windows
);
CREATE TABLE alsasa_guard_v1.operations (
 scope text NOT NULL, operation_id text NOT NULL CHECK(length(operation_id) BETWEEN 1 AND 160),
 window_id text NOT NULL, channel text NOT NULL,
 subject text NOT NULL CHECK(subject ~ '^[a-f0-9]{64}$'),
 body_tag text NOT NULL CHECK(body_tag ~ '^[a-f0-9]{64}$'),
 plan jsonb NOT NULL, expires_at timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','confirmed','held')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(scope,operation_id),
 FOREIGN KEY(scope,window_id,channel) REFERENCES alsasa_guard_v1.channels
);
CREATE TABLE alsasa_guard_v1.steps (
 scope text NOT NULL, operation_id text NOT NULL,
 step_id text NOT NULL CHECK(length(step_id) BETWEEN 1 AND 160),
 ordinal integer NOT NULL CHECK(ordinal BETWEEN 1 AND 32),
 state text NOT NULL DEFAULT 'ready' CHECK(state IN ('ready','started','confirmed')),
 attempt_id text,
 receipt_tag text CHECK(receipt_tag ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY(scope,operation_id,step_id),
 UNIQUE(scope,operation_id,ordinal),
 FOREIGN KEY(scope,operation_id) REFERENCES alsasa_guard_v1.operations
);
CREATE FUNCTION alsasa_guard_v1.operate(p_scope text,p_action text,p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, alsasa_guard_v1, pg_temp
SET lock_timeout = '3s'
AS $guard$
DECLARE
 g alsasa_guard_v1.gate%ROWTYPE;
 w alsasa_guard_v1.windows%ROWTYPE;
 o alsasa_guard_v1.operations%ROWTYPE;
 st alsasa_guard_v1.steps%ROWTYPE;
 plan_value jsonb; part jsonb; pair record; resource record;
 exp timestamptz; units bigint; count_used bigint; limit_value bigint; n integer;
BEGIN
 -- session_user is the actual authenticated DB login, not a caller-supplied identity.
 SELECT * INTO g FROM alsasa_guard_v1.gate WHERE scope=p_scope FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','closed'); END IF;
 IF (p_action='admit' AND session_user <> g.admission_role)
    OR (p_action IN ('begin','confirm','hold') AND session_user <> g.execution_role)
    OR p_action NOT IN ('admit','begin','confirm','hold') OR p_action IS NULL THEN
   RAISE EXCEPTION 'role/action denied' USING ERRCODE='42501';
 END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR octet_length(p::text)>65536
    OR p->>'operation' IS NULL OR length(p->>'operation') NOT BETWEEN 1 AND 160 THEN
   RETURN jsonb_build_object('status','closed');
 END IF;
 SELECT * INTO o FROM alsasa_guard_v1.operations
   WHERE scope=p_scope AND operation_id=p->>'operation' FOR UPDATE;

 IF p_action='admit' THEN
   SELECT * INTO w FROM alsasa_guard_v1.windows
     WHERE scope=p_scope AND window_id=g.current_window;
   IF NOT FOUND OR NOT g.enabled OR clock_timestamp()<w.starts_at OR clock_timestamp()>=w.ends_at
     OR p->>'policy' IS DISTINCT FROM g.current_window
     OR p->>'bodyTag' IS NULL OR p->>'bodyTag' !~ '^[a-f0-9]{64}$'
     OR p->>'subject' IS NULL OR p->>'subject' !~ '^[a-f0-9]{64}$'
     OR p->>'expiresAt' IS NULL OR p->>'expiresAt' !~ '^[0-9]{1,16}$' THEN
     RETURN jsonb_build_object('status','closed');
   END IF;
   exp := to_timestamp((p->>'expiresAt')::double precision/1000);
   IF exp<=clock_timestamp() OR exp>clock_timestamp()+interval '5 minutes' THEN
     RETURN jsonb_build_object('status','closed');
   END IF;
   SELECT plan INTO plan_value FROM alsasa_guard_v1.channels
     WHERE scope=p_scope AND window_id=w.window_id AND channel=p->>'channel';
   IF NOT FOUND OR plan_value IS DISTINCT FROM p->'plan' THEN
     RETURN jsonb_build_object('status','closed');
   END IF;
   IF o.operation_id IS NOT NULL THEN
     IF o.window_id=w.window_id AND o.channel=p->>'channel' AND o.subject=p->>'subject'
       AND o.body_tag=p->>'bodyTag' AND o.plan=plan_value THEN
       RETURN jsonb_build_object('status','duplicate');
     END IF;
     RETURN jsonb_build_object('status','conflict');
   END IF;
   -- Validate administrator-configured plans as well; reject invalid costs before any reservation.
   FOR part IN SELECT value FROM jsonb_array_elements(plan_value) LOOP
     IF part->>'id' IS NULL OR length(part->>'id') NOT BETWEEN 1 AND 160
       OR part->>'receiptSchema' IS NULL
       OR jsonb_typeof(part->'costs') IS DISTINCT FROM 'object'
       OR part->'costs'='{}'::jsonb THEN RETURN jsonb_build_object('status','closed'); END IF;
     FOR pair IN SELECT key,value FROM jsonb_each_text(part->'costs') LOOP
       IF pair.key NOT IN ('base44_sdk_attempt','openai_call','openai_input_token','openai_output_token')
         OR pair.value !~ '^[1-9][0-9]{0,9}$' OR pair.value::numeric>2147483647 THEN
         RETURN jsonb_build_object('status','closed');
       END IF;
     END LOOP;
   END LOOP;
   SELECT used,cap INTO count_used,limit_value FROM alsasa_guard_v1.buckets
     WHERE scope=p_scope AND window_id=w.window_id AND dimension='channel' AND bucket=p->>'channel';
   IF NOT FOUND OR count_used>=limit_value THEN RETURN jsonb_build_object('status','limited'); END IF;
   SELECT used INTO count_used FROM alsasa_guard_v1.buckets
     WHERE scope=p_scope AND window_id=w.window_id AND dimension='subject' AND bucket=p->>'subject';
   IF coalesce(count_used,0)>=w.subject_limit THEN RETURN jsonb_build_object('status','limited'); END IF;
   FOR resource IN
     SELECT costs.key,sum(costs.value::bigint)::bigint AS amount
       FROM jsonb_array_elements(plan_value) AS item
       CROSS JOIN LATERAL jsonb_each_text(item->'costs') AS costs GROUP BY costs.key ORDER BY costs.key
   LOOP
     SELECT used,cap INTO count_used,limit_value FROM alsasa_guard_v1.buckets
       WHERE scope=p_scope AND window_id=w.window_id AND dimension='resource' AND bucket=resource.key;
     IF NOT FOUND OR resource.amount>limit_value-count_used THEN
       RETURN jsonb_build_object('status','limited');
     END IF;
   END LOOP;
   -- All state changes below are in the caller's single SQL transaction. No provider request here.
   FOR resource IN
     SELECT costs.key,sum(costs.value::bigint)::bigint AS amount
       FROM jsonb_array_elements(plan_value) AS item
       CROSS JOIN LATERAL jsonb_each_text(item->'costs') AS costs GROUP BY costs.key ORDER BY costs.key
   LOOP
     UPDATE alsasa_guard_v1.buckets SET used=used+resource.amount
       WHERE scope=p_scope AND window_id=w.window_id AND dimension='resource' AND bucket=resource.key;
   END LOOP;
   UPDATE alsasa_guard_v1.buckets SET used=used+1
     WHERE scope=p_scope AND window_id=w.window_id AND dimension='channel' AND bucket=p->>'channel';
   INSERT INTO alsasa_guard_v1.buckets(scope,window_id,dimension,bucket,cap,used)
     VALUES(p_scope,w.window_id,'subject',p->>'subject',w.subject_limit,1)
     ON CONFLICT(scope,window_id,dimension,bucket) DO UPDATE SET used=alsasa_guard_v1.buckets.used+1;
   INSERT INTO alsasa_guard_v1.operations(scope,operation_id,window_id,channel,subject,body_tag,plan,expires_at)
     VALUES(p_scope,p->>'operation',w.window_id,p->>'channel',p->>'subject',p->>'bodyTag',plan_value,exp);
   n:=0;
   FOR part IN SELECT value FROM jsonb_array_elements(plan_value) LOOP
     n:=n+1;
     INSERT INTO alsasa_guard_v1.steps(scope,operation_id,step_id,ordinal)
       VALUES(p_scope,p->>'operation',part->>'id',n);
   END LOOP;
   RETURN jsonb_build_object('status','admitted');
 END IF;

 IF o.operation_id IS NULL OR p->>'step' IS NULL OR p->>'attempt' IS NULL
   OR length(p->>'attempt') NOT BETWEEN 1 AND 160 THEN RETURN jsonb_build_object('status','blocked'); END IF;
 SELECT * INTO st FROM alsasa_guard_v1.steps WHERE scope=p_scope
   AND operation_id=o.operation_id AND step_id=p->>'step' FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','blocked'); END IF;
 IF p_action='hold' THEN
   IF st.attempt_id IS DISTINCT FROM p->>'attempt' THEN
     RETURN jsonb_build_object('status','blocked');
   END IF;
   UPDATE alsasa_guard_v1.operations SET state='held'
     WHERE scope=p_scope AND operation_id=o.operation_id;
   RETURN jsonb_build_object('status','held');
 END IF;
 IF o.state='held' THEN RETURN jsonb_build_object('status','blocked'); END IF;
 IF p_action='confirm' THEN
   IF st.state<>'started' OR st.attempt_id IS DISTINCT FROM p->>'attempt'
     OR p->>'receiptTag' IS NULL OR p->>'receiptTag' !~ '^[a-f0-9]{64}$' THEN
     RETURN jsonb_build_object('status','blocked');
   END IF;
   UPDATE alsasa_guard_v1.steps SET state='confirmed',receipt_tag=p->>'receiptTag'
     WHERE scope=p_scope AND operation_id=o.operation_id AND step_id=st.step_id;
   IF NOT EXISTS(SELECT 1 FROM alsasa_guard_v1.steps
     WHERE scope=p_scope AND operation_id=o.operation_id AND state<>'confirmed') THEN
     UPDATE alsasa_guard_v1.operations SET state='confirmed'
       WHERE scope=p_scope AND operation_id=o.operation_id;
   END IF;
   RETURN jsonb_build_object('status','confirmed');
 END IF;
 SELECT * INTO w FROM alsasa_guard_v1.windows WHERE scope=p_scope AND window_id=g.current_window;
 IF NOT FOUND OR NOT g.enabled OR o.window_id<>g.current_window
   OR clock_timestamp()<w.starts_at OR clock_timestamp()>=w.ends_at OR clock_timestamp()>=o.expires_at
   OR o.body_tag IS DISTINCT FROM p->>'bodyTag' THEN RETURN jsonb_build_object('status','blocked'); END IF;
 IF st.state='confirmed' THEN RETURN jsonb_build_object('status','confirmed'); END IF;
 IF st.state<>'ready' OR EXISTS(SELECT 1 FROM alsasa_guard_v1.steps WHERE scope=p_scope
   AND operation_id=o.operation_id AND ordinal<st.ordinal AND state<>'confirmed') THEN
   RETURN jsonb_build_object('status','blocked');
 END IF;
 UPDATE alsasa_guard_v1.steps SET state='started',attempt_id=p->>'attempt'
   WHERE scope=p_scope AND operation_id=o.operation_id AND step_id=st.step_id;
 RETURN jsonb_build_object('status','claimed','operation',o.operation_id,'step',st.step_id,'attempt',p->>'attempt');
END;
$guard$;
REVOKE ALL ON ALL TABLES IN SCHEMA alsasa_guard_v1 FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA alsasa_guard_v1 FROM PUBLIC;
COMMIT;
