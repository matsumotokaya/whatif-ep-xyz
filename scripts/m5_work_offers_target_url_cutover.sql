-- M5 cutover: rewrite legacy IMAGINE deep links in public.work_offers.target_url
-- from https://app.whatif-ep.xyz/* to same-origin routes on whatif-ep.xyz.
--
-- Run this ONLY after:
-- 1. next.config.ts legacy redirects are deployed on whatif-ep.xyz
-- 2. app.whatif-ep.xyz -> whatif-ep.xyz 301 is enabled
-- 3. deep-link smoke tests have passed on production
--
-- Safe to run multiple times:
-- - rows are backed up once into public._m5_work_offers_target_url_backup
-- - only app.whatif-ep.xyz rows are rewritten

begin;

-- 1) Preflight inventory: see exactly what will move before you commit.
select
  offer_type,
  count(*) as row_count
from public.work_offers
where target_url like 'https://app.whatif-ep.xyz/%'
group by offer_type
order by offer_type;

select
  id,
  offer_type,
  target_ref,
  target_url as old_target_url,
  case
    when target_url ~ '^https://app\.whatif-ep\.xyz/banner(\?.*)?$'
      then regexp_replace(target_url, '^https://app\.whatif-ep\.xyz/banner', '/edit')
    when target_url ~ '^https://app\.whatif-ep\.xyz/banner/[^?]+(\?.*)?$'
      then regexp_replace(target_url, '^https://app\.whatif-ep\.xyz/banner/', '/edit/')
    when target_url ~ '^https://app\.whatif-ep\.xyz/banners(\?.*)?$'
      then regexp_replace(target_url, '^https://app\.whatif-ep\.xyz/banners', '/mydesign')
    when target_url ~ '^https://app\.whatif-ep\.xyz/banners/[^?]+(\?.*)?$'
      then regexp_replace(target_url, '^https://app\.whatif-ep\.xyz/banners/', '/mydesign/')
    when target_url ~ '^https://app\.whatif-ep\.xyz/upgrade(/.*)?(\?.*)?$'
      then regexp_replace(target_url, '^https://app\.whatif-ep\.xyz/upgrade', '/plans')
    else target_url
  end as new_target_url
from public.work_offers
where target_url like 'https://app.whatif-ep.xyz/%'
order by updated_at desc, id
limit 50;

-- 2) Persistent backup for rollback. Keep this table until M6 is fully closed.
create table if not exists public._m5_work_offers_target_url_backup (
  id uuid primary key,
  offer_type text not null,
  target_ref text,
  old_target_url text not null,
  backed_up_at timestamptz not null default timezone('utc'::text, now())
);

insert into public._m5_work_offers_target_url_backup (
  id,
  offer_type,
  target_ref,
  old_target_url
)
select
  id,
  offer_type,
  target_ref,
  target_url
from public.work_offers
where target_url like 'https://app.whatif-ep.xyz/%'
on conflict (id) do nothing;

-- 3) Canonical rewrite.
update public.work_offers
set target_url = case
  when target_url ~ '^https://app\.whatif-ep\.xyz/banner(\?.*)?$'
    then regexp_replace(target_url, '^https://app\.whatif-ep\.xyz/banner', '/edit')
  when target_url ~ '^https://app\.whatif-ep\.xyz/banner/[^?]+(\?.*)?$'
    then regexp_replace(target_url, '^https://app\.whatif-ep\.xyz/banner/', '/edit/')
  when target_url ~ '^https://app\.whatif-ep\.xyz/banners(\?.*)?$'
    then regexp_replace(target_url, '^https://app\.whatif-ep\.xyz/banners', '/mydesign')
  when target_url ~ '^https://app\.whatif-ep\.xyz/banners/[^?]+(\?.*)?$'
    then regexp_replace(target_url, '^https://app\.whatif-ep\.xyz/banners/', '/mydesign/')
  when target_url ~ '^https://app\.whatif-ep\.xyz/upgrade(/.*)?(\?.*)?$'
    then regexp_replace(target_url, '^https://app\.whatif-ep\.xyz/upgrade', '/plans')
  else target_url
end
where target_url like 'https://app.whatif-ep.xyz/%';

-- 4) Post-checks. Expect 0 remaining legacy host rows after commit.
select
  count(*) as remaining_legacy_host_rows
from public.work_offers
where target_url like 'https://app.whatif-ep.xyz/%';

select
  offer_type,
  count(*) as rewritten_row_count
from public.work_offers
where target_url like '/edit%'
   or target_url like '/mydesign%'
   or target_url like '/plans%'
group by offer_type
order by offer_type;

commit;
