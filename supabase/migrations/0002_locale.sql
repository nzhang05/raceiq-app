-- RaceIQ — athlete UI language
-- See docs/design-i18n.md §3.5. Safe to re-run.
--
-- Deliberately separate from `units`: language and measurement system are
-- independent choices (a French athlete may prefer imperial, and vice versa).

alter table public.profiles
  add column if not exists locale text not null default 'en';
