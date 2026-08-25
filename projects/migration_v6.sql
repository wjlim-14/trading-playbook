-- J.Tradebook migration v6
-- "Mindset" — saved meaningful quotes and personal trading lessons.
-- Safe to re-run.

create table if not exists wisdom (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null default 'quote',   -- 'quote' | 'lesson'
  text       text not null,
  author     text,                            -- source / who said it (quotes)
  title      text,                            -- short headline (lessons)
  category   text,                            -- Mindset | Discipline | Risk | Patience | Psychology | Strategy | Mistake
  favorite   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists wisdom_created_idx on wisdom (created_at desc);
