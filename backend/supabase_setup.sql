-- SQL setup for Supabase database with pgvector
-- Enables pgvector extension, creates memories table and similarity search function.

create extension if not exists vector;

create table if not exists memories (
    id text primary key,
    content_embedding vector(1536),
    metadata jsonb
);

-- HNSW index for fast vector search
create index if not exists memories_embedding_hnsw on memories using hnsw (content_embedding vector_cosine_ops);

-- Enable row level security
alter table memories enable row level security;
create policy "Allow read" on memories for select using (true);
create policy "Allow insert" on memories for insert with check (true);

-- Similarity search function
create or replace function match_vectors(query vector(1536), match_count integer, metadata_filter jsonb default '{}'::jsonb)
returns table(id text, metadata jsonb, similarity float)
language plpgsql as $$
begin
    return query
    select m.id, m.metadata,
           1 - (m.content_embedding <=> query) as similarity
    from memories m
    where m.metadata @> metadata_filter
    order by m.content_embedding <=> query
    limit match_count;
end;
$$;
