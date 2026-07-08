-- M5 rollback: restore public.work_offers.target_url from the persistent backup
-- table created by scripts/m5_work_offers_target_url_cutover.sql.
--
-- Run this only if the M5 cutover introduced production issues and you need to
-- return work_offers.target_url to the old app.whatif-ep.xyz form.

begin;

update public.work_offers as o
set target_url = b.old_target_url
from public._m5_work_offers_target_url_backup as b
where o.id = b.id;

select
  count(*) as restored_legacy_host_rows
from public.work_offers
where target_url like 'https://app.whatif-ep.xyz/%';

commit;
