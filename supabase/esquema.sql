-- Study App · esquema de Supabase
-- Pégalo entero en  SQL Editor → New query  y pulsa «Run». Se puede ejecutar varias veces sin problema.

-- 1) Tabla con los datos de cada usuario (documentos, carpetas y marcas/notas)
create table if not exists public.items (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  store      text not null check (store in ('docs', 'folders', 'marks')),
  id         text not null,
  data       jsonb,
  deleted    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, store, id)
);
create index if not exists items_user_updated on public.items (user_id, updated_at);

-- la hora de cada cambio la pone el servidor (para sincronizar sin depender del reloj de cada dispositivo)
create or replace function public.items_touch() returns trigger
language plpgsql as $$ begin new.updated_at := clock_timestamp(); return new; end $$;
drop trigger if exists items_touch on public.items;
create trigger items_touch before insert or update on public.items
  for each row execute function public.items_touch();

-- 2) Seguridad: cada usuario solo ve y modifica lo suyo
alter table public.items enable row level security;
drop policy if exists "items: ver lo propio" on public.items;
drop policy if exists "items: crear lo propio" on public.items;
drop policy if exists "items: cambiar lo propio" on public.items;
drop policy if exists "items: borrar lo propio" on public.items;
create policy "items: ver lo propio"     on public.items for select to authenticated using (auth.uid() = user_id);
create policy "items: crear lo propio"   on public.items for insert to authenticated with check (auth.uid() = user_id);
create policy "items: cambiar lo propio" on public.items for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "items: borrar lo propio"  on public.items for delete to authenticated using (auth.uid() = user_id);

-- 3) Almacén privado para los PDF (carpeta = id del usuario; máx. 50 MB por archivo en el plan gratuito)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pdfs', 'pdfs', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "pdfs: ver lo propio" on storage.objects;
drop policy if exists "pdfs: subir lo propio" on storage.objects;
drop policy if exists "pdfs: cambiar lo propio" on storage.objects;
drop policy if exists "pdfs: borrar lo propio" on storage.objects;
create policy "pdfs: ver lo propio"     on storage.objects for select to authenticated using (bucket_id = 'pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "pdfs: subir lo propio"   on storage.objects for insert to authenticated with check (bucket_id = 'pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "pdfs: cambiar lo propio" on storage.objects for update to authenticated using (bucket_id = 'pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "pdfs: borrar lo propio"  on storage.objects for delete to authenticated using (bucket_id = 'pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
