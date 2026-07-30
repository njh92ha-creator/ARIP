create extension if not exists vector;
create extension if not exists pgcrypto;

create schema if not exists core;
create schema if not exists integration;
create schema if not exists ledger;
create schema if not exists event;
create schema if not exists risk;
create schema if not exists variance;
create schema if not exists knowledge;
create schema if not exists history;
create schema if not exists feature;
create schema if not exists audit;

create table if not exists core.company (
  id uuid primary key default gen_random_uuid(),
  company_code varchar(50) not null unique,
  company_name varchar(300) not null,
  industry varchar(200) not null,
  functional_currency char(3) not null default 'KRW',
  timezone varchar(100) not null default 'Asia/Seoul',
  fiscal_year_start_month smallint not null check (fiscal_year_start_month between 1 and 12),
  close_frequency varchar(20) not null default 'MONTHLY',
  month_close_day smallint not null check (month_close_day between 1 and 31),
  created_at timestamptz not null default now()
);

create table if not exists integration.mapping_profile (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.company(id),
  source_type varchar(40) not null,
  sheet_name varchar(200) not null,
  header_row integer not null,
  source_signature char(64) not null,
  mapping_json jsonb not null,
  status varchar(20) not null,
  version integer not null default 1,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (company_id, source_type, source_signature, version)
);

create table if not exists integration.import_batch (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.company(id),
  source_type varchar(40) not null,
  file_hash char(64) not null,
  mapping_profile_id uuid not null references integration.mapping_profile(id),
  status varchar(30) not null,
  source_rows bigint not null default 0,
  accepted_rows bigint not null default 0,
  rejected_rows bigint not null default 0,
  reconciliation jsonb,
  created_at timestamptz not null default now(),
  unique (company_id, source_type, file_hash)
);

create table if not exists ledger.journal_line (
  id uuid not null default gen_random_uuid(),
  company_id uuid not null references core.company(id),
  fiscal_year integer not null,
  fiscal_period smallint not null,
  posting_date date not null,
  document_number varchar(150) not null,
  source_row bigint not null,
  account_code varchar(100) not null,
  account_name varchar(300),
  debit_credit_indicator char(1) not null check (debit_credit_indicator in ('D','C')),
  local_amount numeric(24,4) not null,
  line_text text,
  header_text text,
  project_code varchar(150),
  contract_code varchar(150),
  source_hash char(64) not null,
  created_at timestamptz not null default now(),
  primary key (id, fiscal_year),
  unique (company_id, fiscal_year, source_hash)
) partition by range (fiscal_year);

create table if not exists ledger.journal_line_default
partition of ledger.journal_line default;

create index if not exists ix_journal_company_period_account
on ledger.journal_line (company_id, fiscal_year, fiscal_period, account_code);

create table if not exists event.accounting_event (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.company(id),
  event_type varchar(100) not null,
  title varchar(500) not null,
  amount numeric(24,4) not null,
  currency char(3) not null,
  classification_confidence numeric(5,4) not null,
  status varchar(30) not null,
  created_at timestamptz not null default now()
);

create table if not exists event.event_signature (
  id uuid primary key default gen_random_uuid(),
  accounting_event_id uuid not null references event.accounting_event(id),
  company_id uuid not null references core.company(id),
  signature_version varchar(50) not null,
  canonical_payload jsonb not null,
  exact_hash char(64) not null,
  created_at timestamptz not null default now(),
  unique (company_id, exact_hash, signature_version, accounting_event_id)
);
create index if not exists ix_event_hash
on event.event_signature (company_id, exact_hash, signature_version);

create table if not exists risk.risk (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.company(id),
  event_id uuid not null references event.accounting_event(id),
  title varchar(500) not null,
  statement text not null,
  risk_level varchar(20) not null,
  score integer not null check (score between 0 and 100),
  route varchar(40) not null,
  status varchar(30) not null,
  materiality_level varchar(30),
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ix_risk_work
on risk.risk (company_id, status, risk_level);

create table if not exists risk.risk_package (
  id uuid primary key default gen_random_uuid(),
  risk_id uuid not null references risk.risk(id),
  version integer not null,
  package_json jsonb not null,
  status varchar(30) not null default 'DRAFT',
  content_hash char(64) not null,
  created_at timestamptz not null default now(),
  unique (risk_id, version)
);

create table if not exists risk.risk_memory_entry (
  id uuid primary key default gen_random_uuid(),
  risk_id uuid not null references risk.risk(id),
  entry_type varchar(50) not null,
  summary text not null,
  actor varchar(200) not null,
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);

create table if not exists variance.threshold_profile (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.company(id),
  name varchar(300) not null,
  version integer not null,
  status varchar(20) not null,
  profile_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists variance.observation (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.company(id),
  period char(7) not null,
  account_code varchar(100) not null,
  account_name varchar(300),
  category varchar(30) not null,
  comparison varchar(10) not null,
  measurement_basis varchar(50) not null,
  current_value numeric(24,4) not null,
  comparison_value numeric(24,4) not null,
  delta_amount numeric(24,4) not null,
  delta_rate numeric(18,8),
  triggered_by jsonb not null,
  checklist jsonb not null,
  review_status varchar(30) not null default 'OPEN',
  created_at timestamptz not null default now()
);

create table if not exists knowledge.document (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references core.company(id),
  title varchar(1000) not null,
  source_type varchar(50) not null,
  source_uri text,
  content_hash char(64) not null,
  approval_status varchar(20) not null default 'PENDING',
  effective_date date,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists knowledge.chunk (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references knowledge.document(id),
  content text not null,
  locator varchar(500),
  embedding vector(3072),
  created_at timestamptz not null default now()
);

create table if not exists history.historical_event_summary (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.company(id),
  fiscal_year integer not null,
  summary_grain varchar(50) not null,
  dimension_key jsonb not null,
  event_count bigint not null,
  total_amount numeric(28,4),
  risk_count bigint not null default 0,
  generated_at timestamptz not null default now()
);

create table if not exists feature.snapshot (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.company(id),
  entity_type varchar(30) not null,
  entity_id uuid not null,
  as_of_at timestamptz not null,
  feature_set_version varchar(50) not null,
  values jsonb not null,
  source_watermark timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists audit.activity_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references core.company(id),
  actor varchar(200) not null,
  action varchar(100) not null,
  resource_type varchar(100) not null,
  resource_id varchar(100) not null,
  reason text,
  occurred_at timestamptz not null default now()
);
