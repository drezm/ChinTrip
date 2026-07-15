do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'days'
      and column_name = 'id'
      and udt_name = 'uuid'
  ) then
    drop table if exists
      expense_shares,
      checklist_items,
      day_items,
      places,
      place_sections,
      hotels,
      tickets,
      expenses,
      checklists,
      settings,
      days,
      travelers
    cascade;

    drop type if exists
      place_category,
      place_status,
      day_item_kind,
      ticket_kind,
      currency_code,
      checklist_kind
    cascade;
  end if;
end $$;

create table if not exists travelers (
  id text primary key,
  name text not null,
  color text not null,
  sort_order integer not null default 0
);

create table if not exists days (
  id text primary key,
  date text not null,
  city text not null,
  note text not null default ''
);

create table if not exists place_sections (
  id text primary key,
  title text not null,
  sort_order integer not null default 0
);

create table if not exists places (
  id text primary key,
  name text not null,
  city text not null,
  category text not null default 'sight',
  url text not null default '',
  note text not null default '',
  photo_url text not null default '',
  status text not null default 'want' check (status in ('want', 'done')),
  day_id text references days(id) on delete set null,
  created_at text not null default ''
);

alter table if exists places drop constraint if exists places_category_check;

create table if not exists hotels (
  id text primary key,
  name text not null,
  city text not null,
  address text not null default '',
  check_in text not null default '',
  check_out text not null default '',
  price numeric(12, 2) not null default 0,
  currency text not null default 'CNY' check (currency in ('CNY', 'RUB')),
  url text not null default '',
  confirmation_url text not null default '',
  note text not null default ''
);

create table if not exists tickets (
  id text primary key,
  kind text not null default 'train' check (kind in ('flight', 'train', 'metro-pass')),
  from_city text not null,
  to_city text not null,
  depart_at text not null default '',
  arrive_at text not null default '',
  ref_number text not null default '',
  seat text not null default '',
  price numeric(12, 2) not null default 0,
  currency text not null default 'CNY' check (currency in ('CNY', 'RUB')),
  url text not null default '',
  file_url text not null default ''
);

create table if not exists day_items (
  id text primary key,
  day_id text not null references days(id) on delete cascade,
  kind text not null check (kind in ('place', 'hotel', 'ticket', 'note')),
  ref_id text not null,
  sort_order integer not null default 0,
  title text,
  note text
);

create table if not exists expenses (
  id text primary key,
  payer_id text not null references travelers(id) on delete restrict,
  amount numeric(12, 2) not null,
  currency text not null default 'CNY' check (currency in ('CNY', 'RUB')),
  category text not null default '',
  description text not null default '',
  spent_at text not null default '',
  created_at text not null default ''
);

create table if not exists expense_shares (
  expense_id text not null references expenses(id) on delete cascade,
  traveler_id text not null references travelers(id) on delete cascade,
  primary key (expense_id, traveler_id)
);

create table if not exists checklists (
  id text primary key,
  title text not null,
  kind text not null default 'notes' check (kind in ('notes', 'packing', 'visa', 'phrases'))
);

create table if not exists checklist_items (
  id text primary key,
  checklist_id text not null references checklists(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  sort_order integer not null default 0
);

create table if not exists settings (
  id integer primary key default 1 check (id = 1),
  cny_to_rub_rate numeric(12, 4) not null default 11.4,
  rate_updated_at text not null default '',
  display_currency text not null default 'CNY' check (display_currency in ('CNY', 'RUB'))
);

insert into travelers (id, name, color, sort_order) values
  ('traveler-a', 'Матвей', '#e11d48', 1),
  ('traveler-b', 'Артур', '#0891b2', 2),
  ('traveler-c', 'Лера', '#ca8a04', 3)
on conflict (id) do nothing;

insert into settings (id, cny_to_rub_rate, rate_updated_at, display_currency)
values (1, 11.4, now()::text, 'CNY')
on conflict (id) do nothing;

insert into place_sections (id, title, sort_order) values
  ('sight', 'Достопримечательности', 10),
  ('food', 'Еда', 20),
  ('shopping', 'Шопинг', 30)
on conflict (id) do nothing;

-- Supabase storage bucket equivalent, if you later wire file uploads:
-- insert into storage.buckets (id, name, public)
-- values ('trip-files', 'trip-files', false)
-- on conflict (id) do nothing;

-- RLS is intentionally not enabled here. Access is gated by server functions
-- that require the encrypted PIN session cookie before touching data.
