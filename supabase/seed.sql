-- ==============================================================================
-- MANILA AUTO PROS — PHASE 3 SEED DATA (LABELED DEVELOPMENT DEFAULTS)
-- File: supabase/seed.sql
-- Note: Exact operating hours, service durations, bay capacity, and approval
-- rules are marked `is_dev_default = TRUE` until client confirmation.
-- ==============================================================================

-- 1. Studio Bay Resource Pools (Total 5 Bays across 3 specialized pools)
INSERT INTO booking_resources (code, name, resource_type, vehicle_type, total_capacity, is_active, is_dev_default, notes)
VALUES
  ('BAY-PPF-COAT', 'Car PPF & Coating Cleanroom Bays', 'car_surface_protection', 'Car', 2, TRUE, TRUE, 'Dev Default: 2 dust-controlled cleanroom bays for PPF and Ceramic/Graphene coating'),
  ('BAY-DETAIL-TINT', 'Car Detailing & Window Tint Bays', 'car_detailing_tint', 'Car', 2, TRUE, TRUE, 'Dev Default: 2 bays for correction, detailing, and window tint'),
  ('BAY-MOTO-PROS', 'Moto Pros Two-Wheel Studio Bay', 'moto_pros_bay', 'Motorcycle', 2, TRUE, TRUE, 'Dev Default: 2 motorcycle work stands')
ON CONFLICT (code) DO NOTHING;

-- 2. Business Hours (Asia/Manila: Monday–Saturday 09:00–18:00, Sunday Closed)
INSERT INTO business_hours (day_of_week, day_name, open_time, close_time, slot_interval_minutes, is_closed, timezone, is_dev_default)
VALUES
  (0, 'Sunday',    '09:00:00', '18:00:00', 60, TRUE,  'Asia/Manila', FALSE),
  (1, 'Monday',    '09:00:00', '18:00:00', 60, FALSE, 'Asia/Manila', TRUE),
  (2, 'Tuesday',   '09:00:00', '18:00:00', 60, FALSE, 'Asia/Manila', TRUE),
  (3, 'Wednesday', '09:00:00', '18:00:00', 60, FALSE, 'Asia/Manila', TRUE),
  (4, 'Thursday',  '09:00:00', '18:00:00', 60, FALSE, 'Asia/Manila', TRUE),
  (5, 'Friday',    '09:00:00', '18:00:00', 60, FALSE, 'Asia/Manila', TRUE),
  (6, 'Saturday',  '09:00:00', '18:00:00', 60, FALSE, 'Asia/Manila', TRUE)
ON CONFLICT (day_of_week) DO NOTHING;

-- 3. Services (All 23 options across the 5 Manila Auto Pros divisions)
INSERT INTO services (
  category_slug, category_title, option_slug, name, short_description,
  vehicle_type, duration_minutes, buffer_minutes, required_resource_type,
  required_units, confirmation_mode, pending_hold_minutes, min_notice_hours, max_advance_days, is_dev_default
)
VALUES
  -- 01 // Paint Protection Film
  ('paint-protection-film', 'Paint Protection Film', 'xpel-ppf', 'XPEL Paint Protection Film Installation', 'Installation of XPEL paint protection film on selected panels or the full vehicle.', 'Car', 240, 30, 'car_surface_protection', 1, 'manual', 120, 12, 60, TRUE),
  ('paint-protection-film', 'Paint Protection Film', 'clear-ppf', 'Clear PPF', 'Transparent gloss film that protects paint without changing its original color.', 'Car', 240, 30, 'car_surface_protection', 1, 'manual', 120, 12, 60, TRUE),
  ('paint-protection-film', 'Paint Protection Film', 'black-ppf', 'Black PPF', 'Black film for roofs, trim, and accents — styling and protection in one layer.', 'Car', 180, 30, 'car_surface_protection', 1, 'manual', 120, 12, 60, TRUE),
  ('paint-protection-film', 'Paint Protection Film', 'matte-ppf', 'Matte PPF', 'Satin/matte film that gives gloss paint a stealth finish or protects factory matte paint.', 'Car', 240, 30, 'car_surface_protection', 1, 'manual', 120, 12, 60, TRUE),
  ('paint-protection-film', 'Paint Protection Film', 'full-body-ppf', 'Full Body PPF', 'Coverage across all painted exterior panels.', 'Car', 480, 30, 'car_surface_protection', 2, 'manual', 180, 24, 60, TRUE),
  ('paint-protection-film', 'Paint Protection Film', 'partial-ppf', 'Partial PPF', 'Targeted coverage for high-impact areas such as bumpers, hoods, fenders, and mirrors.', 'Car', 180, 30, 'car_surface_protection', 1, 'auto', 120, 12, 60, TRUE),

  -- 02 // Ceramic & Graphene Coating
  ('ceramic-graphene-coating', 'Ceramic & Graphene Coating', 'premium-ceramic-coating', 'Premium Ceramic Coating', 'Ceramic protection for gloss, water repellency, and easier maintenance.', 'Car', 240, 30, 'car_surface_protection', 1, 'auto', 120, 12, 60, TRUE),
  ('ceramic-graphene-coating', 'Ceramic & Graphene Coating', 'graphene-coating', 'Graphene Coating', 'Graphene-enhanced coating for a slick, protective, high-gloss finish.', 'Car', 240, 30, 'car_surface_protection', 1, 'auto', 120, 12, 60, TRUE),
  ('ceramic-graphene-coating', 'Ceramic & Graphene Coating', 'multi-layer-coating', 'Multi-Layer Coating Packages', 'Multiple coating layers for added build and protection.', 'Car', 360, 30, 'car_surface_protection', 1, 'manual', 120, 12, 60, TRUE),
  ('ceramic-graphene-coating', 'Ceramic & Graphene Coating', 'paint-enhancement-protection', 'Paint Enhancement and Protection', 'Polishing to restore clarity and gloss, followed by a protective coating.', 'Car', 300, 30, 'car_surface_protection', 1, 'auto', 120, 12, 60, TRUE),

  -- 03 // Auto Detailing
  ('auto-detailing', 'Auto Detailing', 'full-detailing', 'Full Detailing', 'Complete interior and exterior detailing.', 'Car', 240, 30, 'car_detailing_tint', 1, 'auto', 120, 12, 60, TRUE),
  ('auto-detailing', 'Auto Detailing', 'paint-correction', 'Paint Correction', 'Multi-step polishing to reduce swirl marks, haze, and light scratches.', 'Car', 300, 30, 'car_detailing_tint', 1, 'manual', 120, 12, 60, TRUE),
  ('auto-detailing', 'Auto Detailing', 'machine-polishing', 'Machine Polishing', 'Machine refinement to enhance gloss and clarity.', 'Car', 180, 30, 'car_detailing_tint', 1, 'auto', 120, 12, 60, TRUE),
  ('auto-detailing', 'Auto Detailing', 'paint-decontamination', 'Paint Decontamination', 'Removal of iron fallout, tar, and bonded contaminants from the paint.', 'Car', 120, 15, 'car_detailing_tint', 1, 'auto', 120, 6, 60, TRUE),
  ('auto-detailing', 'Auto Detailing', 'interior-detailing', 'Interior Detailing', 'Deep cleaning and refresh of cabin surfaces and upholstery.', 'Car', 180, 15, 'car_detailing_tint', 1, 'auto', 120, 6, 60, TRUE),
  ('auto-detailing', 'Auto Detailing', 'exterior-detailing', 'Exterior Detailing', 'Detailed cleaning of paint, wheels, glass, and trim.', 'Car', 120, 15, 'car_detailing_tint', 1, 'auto', 120, 6, 60, TRUE),

  -- 04 // Automotive Window Tint
  ('automotive-window-tint', 'Automotive Window Tint', 'premium-window-tint', 'Premium Window Tint Installation', 'Professional installation of premium automotive window film.', 'Car', 120, 15, 'car_detailing_tint', 1, 'auto', 120, 6, 60, TRUE),
  ('automotive-window-tint', 'Automotive Window Tint', 'heat-rejection-window-films', 'Heat-Rejection Window Films', 'Films designed to reduce solar heat and UV while maintaining visibility.', 'Car', 150, 15, 'car_detailing_tint', 1, 'auto', 120, 6, 60, TRUE),

  -- 05 // Moto Pros
  ('moto-pros', 'Moto Pros', 'motorcycle-ceramic-coating', 'Motorcycle Ceramic Coating', 'Ceramic protection for fairings, tanks, wheels, and frames.', 'Motorcycle', 180, 15, 'moto_pros_bay', 1, 'auto', 120, 12, 60, TRUE),
  ('moto-pros', 'Moto Pros', 'motorcycle-graphene-coating', 'Motorcycle Graphene Coating', 'Graphene-enhanced coating for a slick, protective finish.', 'Motorcycle', 180, 15, 'moto_pros_bay', 1, 'auto', 120, 12, 60, TRUE),
  ('moto-pros', 'Moto Pros', 'motorcycle-ppf-installation', 'Motorcycle PPF Installation', 'Film protection for tanks, fairings, and other high-wear areas.', 'Motorcycle', 240, 30, 'moto_pros_bay', 1, 'manual', 120, 12, 60, TRUE),
  ('moto-pros', 'Moto Pros', 'motorcycle-detailing', 'Motorcycle Detailing', 'Careful cleaning and detailing of paint, metal, and components.', 'Motorcycle', 120, 15, 'moto_pros_bay', 1, 'auto', 120, 6, 60, TRUE),
  ('moto-pros', 'Moto Pros', 'motorcycle-paint-protection', 'Motorcycle Paint Protection', 'Combined protection packages using film and coatings for your bike.', 'Motorcycle', 300, 30, 'moto_pros_bay', 1, 'manual', 120, 12, 60, TRUE)
ON CONFLICT (option_slug) DO NOTHING;
