alter table if exists places
  add column if not exists updated_at text;

update places
set updated_at = coalesce(nullif(updated_at, ''), created_at, now()::text)
where updated_at is null or updated_at = '';

alter table if exists hotels
  add column if not exists created_at text not null default now()::text,
  add column if not exists updated_at text not null default now()::text;

alter table if exists tickets
  add column if not exists created_at text not null default now()::text,
  add column if not exists updated_at text not null default now()::text;

alter table if exists days
  add column if not exists created_at text not null default now()::text,
  add column if not exists updated_at text not null default now()::text;

alter table if exists day_items
  add column if not exists created_at text not null default now()::text,
  add column if not exists updated_at text not null default now()::text;

alter table if exists checklists
  add column if not exists created_at text not null default now()::text,
  add column if not exists updated_at text not null default now()::text;

alter table if exists checklist_items
  add column if not exists created_at text not null default now()::text,
  add column if not exists updated_at text not null default now()::text;

alter table if exists settings
  add column if not exists theme text not null default 'system'
    check (theme in ('light', 'dark', 'system'));

alter table if exists expenses
  add column if not exists exchange_rate numeric(12, 4),
  add column if not exists amount_cny numeric(12, 2),
  add column if not exists split_type text not null default 'equal'
    check (split_type in ('equal', 'exact', 'percentage')),
  add column if not exists day_id text references days(id) on delete set null,
  add column if not exists place_id text references places(id) on delete set null,
  add column if not exists hotel_id text references hotels(id) on delete set null,
  add column if not exists ticket_id text references tickets(id) on delete set null,
  add column if not exists created_by text references travelers(id) on delete restrict,
  add column if not exists updated_at text;

update expenses
set
  exchange_rate = coalesce(exchange_rate, (select cny_to_rub_rate from settings where id = 1), 11.4),
  amount_cny = coalesce(
    amount_cny,
    case
      when currency = 'RUB' then round(amount / coalesce((select cny_to_rub_rate from settings where id = 1), 11.4), 2)
      else amount
    end
  ),
  created_by = coalesce(created_by, payer_id),
  updated_at = coalesce(nullif(updated_at, ''), created_at, now()::text)
where exchange_rate is null
   or amount_cny is null
   or created_by is null
   or updated_at is null
   or updated_at = '';

alter table expenses
  alter column exchange_rate set not null,
  alter column amount_cny set not null,
  alter column created_by set not null,
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'expenses' and constraint_name = 'expenses_amount_positive'
  ) then
    alter table expenses add constraint expenses_amount_positive check (amount > 0);
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'expenses' and constraint_name = 'expenses_exchange_rate_positive'
  ) then
    alter table expenses add constraint expenses_exchange_rate_positive check (exchange_rate > 0);
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'expenses' and constraint_name = 'expenses_amount_cny_positive'
  ) then
    alter table expenses add constraint expenses_amount_cny_positive check (amount_cny > 0);
  end if;
end $$;

create table if not exists expense_splits (
  id text primary key,
  expense_id text not null references expenses(id) on delete cascade,
  traveler_id text not null references travelers(id) on delete restrict,
  value numeric(12, 4) not null default 0 check (value >= 0),
  amount_cny numeric(12, 2) not null check (amount_cny >= 0),
  unique (expense_id, traveler_id)
);

with migrated_equal_splits as (
  select
    expense_shares.expense_id,
    expense_shares.traveler_id,
    expenses.amount_cny,
    count(*) over (partition by expense_shares.expense_id) as share_count,
    row_number() over (partition by expense_shares.expense_id order by expense_shares.traveler_id) as share_number
  from expense_shares
  join expenses on expenses.id = expense_shares.expense_id
)
insert into expense_splits (id, expense_id, traveler_id, value, amount_cny)
select
  expense_id || '-split-' || traveler_id,
  expense_id,
  traveler_id,
  case
    when share_number = share_count then
      amount_cny - (round(amount_cny / nullif(share_count, 0), 2) * (share_count - 1))
    else round(amount_cny / nullif(share_count, 0), 2)
  end,
  case
    when share_number = share_count then
      amount_cny - (round(amount_cny / nullif(share_count, 0), 2) * (share_count - 1))
    else round(amount_cny / nullif(share_count, 0), 2)
  end
from migrated_equal_splits
on conflict (expense_id, traveler_id) do nothing;

create table if not exists payments (
  id text primary key,
  from_traveler_id text not null references travelers(id) on delete restrict,
  to_traveler_id text not null references travelers(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'CNY' check (currency in ('CNY', 'RUB')),
  exchange_rate numeric(12, 4) not null check (exchange_rate > 0),
  amount_cny numeric(12, 2) not null check (amount_cny > 0),
  status text not null default 'planned' check (status in ('planned', 'completed')),
  paid_at text,
  note text not null default '',
  created_at text not null default now()::text,
  updated_at text not null default now()::text,
  check (from_traveler_id <> to_traveler_id)
);

create index if not exists idx_places_day_id on places(day_id);
create index if not exists idx_day_items_day_sort on day_items(day_id, sort_order);
create index if not exists idx_expenses_payer on expenses(payer_id);
create index if not exists idx_expenses_spent_at on expenses(spent_at);
create index if not exists idx_expense_splits_expense on expense_splits(expense_id);
create index if not exists idx_payments_status on payments(status);
create index if not exists idx_payments_travelers on payments(from_traveler_id, to_traveler_id);

create table if not exists trip_settings (
  id integer primary key default 1 check (id = 1),
  cny_to_rub_rate numeric(12, 4) not null default 11.4 check (cny_to_rub_rate > 0),
  rate_updated_at text not null default now()::text,
  display_currency text not null default 'CNY' check (display_currency in ('CNY', 'RUB')),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  created_at text not null default now()::text,
  updated_at text not null default now()::text
);

insert into trip_settings (id, cny_to_rub_rate, rate_updated_at, display_currency, theme)
select id, cny_to_rub_rate, rate_updated_at, display_currency, theme
from settings
where id = 1
on conflict (id) do update set
  cny_to_rub_rate = excluded.cny_to_rub_rate,
  rate_updated_at = excluded.rate_updated_at,
  display_currency = excluded.display_currency,
  theme = excluded.theme,
  updated_at = now()::text;
