alter table class_bookings_v2 add column if not exists cancelled_at timestamptz;
create index if not exists class_bookings_v2_cancelled_at_idx on class_bookings_v2(cancelled_at);
