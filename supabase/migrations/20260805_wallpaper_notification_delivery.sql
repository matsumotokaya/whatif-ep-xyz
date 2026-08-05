-- Persist transactional-email delivery state so a successful payment is not
-- permanently separated from its guest download link when Resend is down.
alter table public.wallpaper_purchases
  add column if not exists notification_status text,
  add column if not exists notification_error text,
  add column if not exists notification_sent_at timestamptz;

-- Existing rows predate the outbox state. Treat them as already delivered to
-- avoid sending old purchase emails during a later webhook replay.
update public.wallpaper_purchases
set notification_status = 'sent'
where notification_status is null;

alter table public.wallpaper_purchases
  alter column notification_status set default 'pending',
  alter column notification_status set not null;

alter table public.wallpaper_purchases
  drop constraint if exists wallpaper_purchases_notification_status_check;

alter table public.wallpaper_purchases
  add constraint wallpaper_purchases_notification_status_check
  check (notification_status in ('pending', 'sent', 'failed'));

create index if not exists wallpaper_purchases_notification_retry_idx
  on public.wallpaper_purchases (notification_status, updated_at)
  where notification_status <> 'sent';
