with ranked as (
  select
    post_key,
    row_number() over (
      partition by lower(trim(title))
      order by created_at_from_source desc nulls last, fetched_at desc, post_key desc
    ) as rn
  from public.external_posts
  where source like 'paxnet_stock_%'
),
duplicates as (
  select post_key
  from ranked
  where rn > 1
)
delete from public.external_posts
where post_key in (select post_key from duplicates);
