-- MANILA AUTO PROS PHASE 4 ADMIN SECURITY
-- Prepared for review. DO NOT APPLY without explicit approval.

CREATE TABLE public.admin_memberships (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (pg_catalog.char_length(pg_catalog.btrim(display_name)) BETWEEN 2 AND 100),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

CREATE TRIGGER trg_admin_memberships_updated_at BEFORE UPDATE ON public.admin_memberships
FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

CREATE TABLE public.admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Preserve attribution even if the Auth identity is later removed.
  actor_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp()
);
CREATE INDEX idx_admin_activity_logs_created_at ON public.admin_activity_logs(created_at DESC);
CREATE INDEX idx_admin_activity_logs_target ON public.admin_activity_logs(target_type, target_id, created_at DESC);

ALTER TABLE public.admin_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_memberships, public.admin_activity_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_memberships TO service_role;
GRANT SELECT, INSERT ON public.admin_activity_logs TO service_role;

-- Coordinate booking inserts/reschedules with administrative schedule changes.
-- The row locks pair with the FOR UPDATE locks in the settings RPC below.
CREATE OR REPLACE FUNCTION public.guard_booking_current_configuration()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  v_service public.services%ROWTYPE;
  v_resource public.booking_resources%ROWTYPE;
  v_hours public.business_hours%ROWTYPE;
BEGIN
  SELECT * INTO v_service FROM public.services WHERE id=NEW.service_id FOR KEY SHARE;
  SELECT * INTO v_resource FROM public.booking_resources WHERE id=NEW.resource_id FOR KEY SHARE;
  SELECT * INTO v_hours FROM public.business_hours
    WHERE day_of_week=EXTRACT(DOW FROM NEW.appointment_date)::smallint
    FOR KEY SHARE;

  IF v_service.id IS NULL OR v_resource.id IS NULL OR v_hours.id IS NULL
     OR NOT v_service.is_active OR NOT v_resource.is_active
     OR v_hours.is_closed OR NEW.start_time_local<v_hours.open_time
     OR NEW.end_time_local>v_hours.close_time THEN
    RAISE EXCEPTION 'Booking conflicts with current service, resource, or operating-hours configuration.'
      USING ERRCODE='check_violation';
  END IF;
  IF TG_OP='INSERT' AND (
    NEW.duration_minutes<>v_service.duration_minutes
    OR NEW.buffer_minutes<>v_service.buffer_minutes
    OR NEW.confirmation_mode<>v_service.confirmation_mode
  ) THEN
    RAISE EXCEPTION 'Booking snapshot does not match current service configuration.'
      USING ERRCODE='check_violation';
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.blocked_dates d
    WHERE d.blocked_date=NEW.appointment_date AND d.is_active
      AND (d.resource_id IS NULL OR d.resource_id=NEW.resource_id)
      AND ((d.start_time IS NULL AND d.end_time IS NULL)
        OR (NEW.start_time_local<d.end_time AND NEW.end_time_local>d.start_time))
  ) THEN
    RAISE EXCEPTION 'Booking conflicts with a blocked date or time.'
      USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.guard_booking_current_configuration()
  FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_bookings_current_configuration
  BEFORE INSERT OR UPDATE OF appointment_date,start_time_local,end_time_local,service_id,resource_id
  ON public.bookings FOR EACH ROW
  EXECUTE FUNCTION public.guard_booking_current_configuration();

CREATE OR REPLACE FUNCTION public.admin_transition_booking_atomic(
  p_booking_id UUID,
  p_operation TEXT,
  p_reason TEXT DEFAULT NULL,
  p_new_appointment_date DATE DEFAULT NULL,
  p_new_start_time_local TIME DEFAULT NULL,
  p_admin_user_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_resource public.booking_resources%ROWTYPE;
  v_service public.services%ROWTYPE;
  v_hours public.business_hours%ROWTYPE;
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_new_start TIMESTAMPTZ;
  v_new_end TIMESTAMPTZ;
  v_effective_end TIMESTAMPTZ;
  v_new_end_local TIME;
  v_used INTEGER;
  v_new_status public.booking_status_enum;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_memberships m WHERE m.user_id=p_admin_user_id AND m.is_active) THEN
    RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','Administrator authorization failed.');
  END IF;
  IF p_operation NOT IN ('approve','reject','cancel','complete','reschedule') THEN
    RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','Unsupported booking operation.');
  END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','Booking not found.'); END IF;

  -- Retried requests are successful no-ops and never duplicate audit records.
  IF (p_operation='approve' AND v_booking.status='confirmed')
     OR (p_operation='reject' AND v_booking.status='rejected')
     OR (p_operation='cancel' AND v_booking.status='cancelled')
     OR (p_operation='complete' AND v_booking.status='completed')
     OR (p_operation='reschedule' AND v_booking.status IN ('pending','confirmed')
         AND (v_booking.status='confirmed' OR v_booking.pending_expires_at>v_now)
         AND v_booking.appointment_date=p_new_appointment_date
         AND v_booking.start_time_local=p_new_start_time_local) THEN
    RETURN pg_catalog.jsonb_build_object('ok',TRUE,'booking_id',v_booking.id,'status',v_booking.status,'idempotent',TRUE);
  END IF;

  IF v_booking.status='pending' AND v_booking.pending_expires_at <= v_now THEN
    UPDATE public.bookings SET status='expired',pending_expires_at=NULL WHERE id=v_booking.id;
    UPDATE public.booking_tokens SET revoked_at=v_now WHERE booking_id=v_booking.id AND used_at IS NULL AND revoked_at IS NULL;
    INSERT INTO public.booking_audit_logs(booking_id,actor_type,action,previous_status,new_status,metadata)
      VALUES(v_booking.id,'system','BOOKING_PENDING_EXPIRED','pending','expired',pg_catalog.jsonb_build_object('expired_at',v_now));
    RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','The pending hold has expired and cannot be approved.');
  END IF;

  IF p_operation='approve' THEN
    IF v_booking.status<>'pending' THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','Only pending bookings can be approved.'); END IF;
    v_new_status := 'confirmed';
    UPDATE public.bookings SET status=v_new_status,pending_expires_at=NULL WHERE id=v_booking.id;
  ELSIF p_operation='reject' THEN
    IF v_booking.status<>'pending' OR pg_catalog.char_length(pg_catalog.btrim(COALESCE(p_reason,'')))<3 THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','A pending booking and rejection reason are required.'); END IF;
    v_new_status := 'rejected';
    UPDATE public.bookings SET status=v_new_status,pending_expires_at=NULL WHERE id=v_booking.id;
    UPDATE public.booking_tokens SET revoked_at=v_now WHERE booking_id=v_booking.id AND used_at IS NULL AND revoked_at IS NULL;
  ELSIF p_operation='cancel' THEN
    IF v_booking.status NOT IN ('pending','confirmed') OR pg_catalog.char_length(pg_catalog.btrim(COALESCE(p_reason,'')))<3 THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','Only active bookings can be cancelled and a reason is required.'); END IF;
    v_new_status := 'cancelled';
    UPDATE public.bookings SET status=v_new_status,pending_expires_at=NULL,cancellation_reason=pg_catalog.btrim(p_reason),cancelled_at=v_now WHERE id=v_booking.id;
    UPDATE public.booking_tokens SET revoked_at=v_now WHERE booking_id=v_booking.id AND used_at IS NULL AND revoked_at IS NULL;
  ELSIF p_operation='complete' THEN
    IF v_booking.status<>'confirmed' OR v_booking.end_at>v_now THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','Only finished confirmed appointments can be completed.'); END IF;
    v_new_status := 'completed';
    UPDATE public.bookings SET status=v_new_status WHERE id=v_booking.id;
    UPDATE public.booking_tokens SET revoked_at=v_now WHERE booking_id=v_booking.id AND used_at IS NULL AND revoked_at IS NULL;
  ELSE
    IF v_booking.status NOT IN ('pending','confirmed') OR p_new_appointment_date IS NULL OR p_new_start_time_local IS NULL THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','An active booking, date, and time are required.'); END IF;
    SELECT * INTO v_service FROM public.services WHERE id=v_booking.service_id AND is_active;
    IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','Booking service is unavailable.'); END IF;
    SELECT * INTO v_resource FROM public.booking_resources WHERE id=v_booking.resource_id AND is_active FOR UPDATE;
    IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','Booking resource is unavailable.'); END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_resource.id::text||':'||p_new_appointment_date::text,0));
    SELECT * INTO v_hours FROM public.business_hours WHERE day_of_week=EXTRACT(DOW FROM p_new_appointment_date)::smallint;
    v_new_end_local := p_new_start_time_local + pg_catalog.make_interval(mins=>v_booking.duration_minutes);
    IF NOT FOUND OR v_hours.is_closed OR p_new_start_time_local<v_hours.open_time OR v_new_end_local>v_hours.close_time THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','Requested time is outside operating hours.'); END IF;
    v_new_start := (p_new_appointment_date::text||' '||p_new_start_time_local::text)::timestamp AT TIME ZONE 'Asia/Manila';
    v_new_end := v_new_start + pg_catalog.make_interval(mins=>v_booking.duration_minutes);
    v_effective_end := v_new_end + pg_catalog.make_interval(mins=>v_booking.buffer_minutes);
    IF v_new_start < v_now + pg_catalog.make_interval(hours=>v_service.min_notice_hours)
       OR p_new_appointment_date > (v_now AT TIME ZONE 'Asia/Manila')::date + v_service.max_advance_days
       OR EXISTS(SELECT 1 FROM public.blocked_dates d WHERE d.blocked_date=p_new_appointment_date AND d.is_active AND (d.resource_id IS NULL OR d.resource_id=v_resource.id) AND ((d.start_time IS NULL AND d.end_time IS NULL) OR (p_new_start_time_local<d.end_time AND v_new_end_local>d.start_time)))
    THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','Requested time is unavailable or outside the booking window.'); END IF;
    SELECT COALESCE(MAX(x.units),0) INTO v_used FROM (SELECT COALESCE(SUM(b.allocated_units),0) units FROM (SELECT v_new_start point_at UNION SELECT GREATEST(b.start_at,v_new_start) FROM public.bookings b WHERE b.id<>v_booking.id AND b.resource_id=v_resource.id AND b.appointment_date=p_new_appointment_date AND (b.status='confirmed' OR (b.status='pending' AND b.pending_expires_at>v_now)) AND b.start_at<v_effective_end AND b.end_at+pg_catalog.make_interval(mins=>b.buffer_minutes)>v_new_start) p LEFT JOIN public.bookings b ON b.id<>v_booking.id AND b.resource_id=v_resource.id AND b.appointment_date=p_new_appointment_date AND (b.status='confirmed' OR (b.status='pending' AND b.pending_expires_at>v_now)) AND b.start_at<=p.point_at AND b.end_at+pg_catalog.make_interval(mins=>b.buffer_minutes)>p.point_at GROUP BY p.point_at) x;
    IF v_used+v_booking.allocated_units>v_resource.total_capacity THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','The requested time has insufficient capacity.'); END IF;
    v_new_status := v_booking.status;
    UPDATE public.bookings SET appointment_date=p_new_appointment_date,start_time_local=p_new_start_time_local,end_time_local=v_new_end_local,start_at=v_new_start,end_at=v_new_end,rescheduled_count=rescheduled_count+1 WHERE id=v_booking.id;
  END IF;

  INSERT INTO public.booking_audit_logs(booking_id,actor_type,action,previous_status,new_status,metadata)
    VALUES(v_booking.id,'admin','BOOKING_ADMIN_'||pg_catalog.upper(p_operation),v_booking.status,v_new_status,pg_catalog.jsonb_build_object('admin_user_id',p_admin_user_id,'reason',p_reason));
  INSERT INTO public.admin_activity_logs(actor_user_id,action,target_type,target_id,metadata)
    VALUES(p_admin_user_id,'BOOKING_'||pg_catalog.upper(p_operation),'booking',v_booking.id,pg_catalog.jsonb_build_object('previous_status',v_booking.status,'new_status',v_new_status));
  RETURN pg_catalog.jsonb_build_object('ok',TRUE,'booking_id',v_booking.id,'status',v_new_status);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_booking_setting_atomic(p_kind TEXT,p_id UUID,p_payload JSONB,p_admin_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_future_conflict BOOLEAN;
  v_capacity INTEGER;
  v_current_capacity INTEGER;
  v_open TIME;
  v_close TIME;
  v_active BOOLEAN;
  v_day SMALLINT;
  v_block_date DATE;
  v_block_start TIME;
  v_block_end TIME;
  v_block_resource UUID;
  v_resource_id UUID;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.admin_memberships WHERE user_id=p_admin_user_id AND is_active) THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','Administrator authorization failed.'); END IF;
  IF p_kind='service' THEN
    PERFORM 1 FROM public.services WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','Setting not found.'); END IF;
    SELECT EXISTS(SELECT 1 FROM public.bookings WHERE service_id=p_id AND status IN ('pending','confirmed') AND end_at>pg_catalog.clock_timestamp()) INTO v_future_conflict;
    IF v_future_conflict AND (p_payload ? 'duration_minutes' OR p_payload ? 'buffer_minutes') THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','Duration or buffer cannot change while future active bookings exist.'); END IF;
    UPDATE public.services SET duration_minutes=COALESCE((p_payload->>'duration_minutes')::int,duration_minutes),buffer_minutes=COALESCE((p_payload->>'buffer_minutes')::int,buffer_minutes),min_notice_hours=COALESCE((p_payload->>'min_notice_hours')::int,min_notice_hours),max_advance_days=COALESCE((p_payload->>'max_advance_days')::int,max_advance_days),cancellation_cutoff_minutes=COALESCE((p_payload->>'cancellation_cutoff_minutes')::int,cancellation_cutoff_minutes),reschedule_cutoff_minutes=COALESCE((p_payload->>'reschedule_cutoff_minutes')::int,reschedule_cutoff_minutes),confirmation_mode=COALESCE((p_payload->>'confirmation_mode')::public.confirmation_mode_enum,confirmation_mode),is_active=COALESCE((p_payload->>'is_active')::boolean,FALSE),is_dev_default=FALSE WHERE id=p_id;
  ELSIF p_kind='resource' THEN
    v_capacity := (p_payload->>'total_capacity')::int;
    IF v_capacity<1 OR v_capacity>20 THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','Capacity must be between 1 and 20.'); END IF;
    SELECT total_capacity INTO v_current_capacity FROM public.booking_resources WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','Setting not found.'); END IF;
    IF v_capacity<v_current_capacity AND EXISTS(SELECT 1 FROM public.bookings WHERE resource_id=p_id AND status IN ('pending','confirmed') AND end_at>pg_catalog.clock_timestamp()) THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','Capacity cannot be reduced while active or future bookings exist.'); END IF;
    UPDATE public.booking_resources SET total_capacity=v_capacity,is_active=COALESCE((p_payload->>'is_active')::boolean,FALSE),is_dev_default=FALSE WHERE id=p_id;
  ELSIF p_kind='hours' THEN
    v_open := (p_payload->>'open_time')::time; v_close := (p_payload->>'close_time')::time; v_active := COALESCE((p_payload->>'is_closed')::boolean,FALSE);
    IF NOT v_active AND v_open>=v_close THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','Opening time must precede closing time.'); END IF;
    SELECT day_of_week INTO v_day FROM public.business_hours WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','Setting not found.'); END IF;
    IF EXISTS(SELECT 1 FROM public.bookings b WHERE b.status IN ('pending','confirmed') AND b.end_at>pg_catalog.clock_timestamp() AND EXTRACT(DOW FROM b.appointment_date)=v_day AND (v_active OR b.start_time_local<v_open OR b.end_time_local>v_close)) THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','Hours conflict with active or future bookings.'); END IF;
    UPDATE public.business_hours SET open_time=v_open,close_time=v_close,is_closed=v_active,is_dev_default=FALSE WHERE id=p_id;
  ELSIF p_kind='block' THEN
    v_block_date := (p_payload->>'blocked_date')::date;
    v_block_start := NULLIF(p_payload->>'start_time','')::time;
    v_block_end := NULLIF(p_payload->>'end_time','')::time;
    v_block_resource := NULLIF(p_payload->>'resource_id','')::uuid;
    IF NULLIF(pg_catalog.btrim(p_payload->>'reason'),'') IS NULL OR v_block_date < (pg_catalog.clock_timestamp() AT TIME ZONE 'Asia/Manila')::date THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','A current or future date and reason are required.'); END IF;
    IF NULLIF(p_payload->>'start_time','') IS DISTINCT FROM NULLIF(p_payload->>'end_time','') THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','Provide both start and end times, or neither for a full-day block.'); END IF;
    -- Serialize with Phase 3 create/reschedule and Phase 4 admin reschedule.
    FOR v_resource_id IN SELECT id FROM public.booking_resources WHERE v_block_resource IS NULL OR id=v_block_resource ORDER BY id LOOP
      PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_resource_id::text||':'||v_block_date::text,0));
    END LOOP;
    IF EXISTS(SELECT 1 FROM public.bookings b WHERE b.appointment_date=v_block_date AND b.status IN ('pending','confirmed') AND (v_block_resource IS NULL OR b.resource_id=v_block_resource) AND (v_block_start IS NULL OR (b.start_time_local<v_block_end AND b.end_time_local>v_block_start))) THEN
      RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','The block conflicts with active bookings; reschedule or cancel them explicitly first.');
    END IF;
    INSERT INTO public.blocked_dates(blocked_date,start_time,end_time,resource_id,reason,is_active) VALUES(v_block_date,v_block_start,v_block_end,v_block_resource,pg_catalog.btrim(p_payload->>'reason'),TRUE) RETURNING id INTO p_id;
  ELSIF p_kind='block_deactivate' THEN
    UPDATE public.blocked_dates SET is_active=FALSE WHERE id=p_id;
  ELSE RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','Unsupported setting type.'); END IF;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','Setting not found.'); END IF;
  INSERT INTO public.admin_activity_logs(actor_user_id,action,target_type,target_id,metadata) VALUES(p_admin_user_id,'SETTING_UPDATED',p_kind,p_id,p_payload);
  RETURN pg_catalog.jsonb_build_object('ok',TRUE);
EXCEPTION WHEN check_violation OR invalid_text_representation THEN RETURN pg_catalog.jsonb_build_object('ok',FALSE,'message','One or more setting values are invalid.');
END; $$;

ALTER FUNCTION public.admin_transition_booking_atomic(UUID,TEXT,TEXT,DATE,TIME,UUID) OWNER TO postgres;
ALTER FUNCTION public.admin_update_booking_setting_atomic(TEXT,UUID,JSONB,UUID) OWNER TO postgres;
ALTER FUNCTION public.guard_booking_current_configuration() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.admin_transition_booking_atomic(UUID,TEXT,TEXT,DATE,TIME,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_update_booking_setting_atomic(TEXT,UUID,JSONB,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_transition_booking_atomic(UUID,TEXT,TEXT,DATE,TIME,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_booking_setting_atomic(TEXT,UUID,JSONB,UUID) TO service_role;
