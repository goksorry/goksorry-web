alter table public.sentiment_results
  add column if not exists sentiment_score smallint;

update public.sentiment_results
set sentiment_score = case lower(label)
  when 'bearish' then 3
  when 'bullish' then 7
  else 5
end
where sentiment_score is null;

alter table public.sentiment_results
  alter column sentiment_score set default 5,
  alter column sentiment_score set not null;

alter table public.sentiment_results
  drop constraint if exists sentiment_results_sentiment_score_range;

alter table public.sentiment_results
  add constraint sentiment_results_sentiment_score_range
  check (sentiment_score between 1 and 10);
