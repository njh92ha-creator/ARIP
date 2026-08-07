create extension if not exists vector with schema extensions;
create schema if not exists knowledge;

create table if not exists knowledge.document (
  id uuid primary key,
  candidate_id uuid not null unique,
  company_id uuid not null,
  title text not null,
  content_hash char(64) not null,
  approval_status varchar(20) not null default 'APPROVED',
  embedding_model text not null,
  page_count integer not null default 0,
  indexed_at timestamptz not null default now()
);

create table if not exists knowledge.chunk (
  id uuid primary key,
  document_id uuid not null references knowledge.document(id) on delete cascade,
  content text not null,
  page_number integer,
  locator varchar(100) not null,
  embedding extensions.vector not null
);

create index if not exists knowledge_document_company_status_idx
  on knowledge.document (company_id, approval_status, embedding_model);
create index if not exists knowledge_chunk_document_idx
  on knowledge.chunk (document_id);
