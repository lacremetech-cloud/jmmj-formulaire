-- Espace dédié « formulaire JMMJ » : réponses au formulaire World Café.
-- Le schéma n'est pas exposé par l'API : tout passe par les fonctions public.jmmj_*.

create schema if not exists formulaire_jmmj;
revoke all on schema formulaire_jmmj from public, anon, authenticated;

create table formulaire_jmmj.reponses (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  nom_prenom      text not null check (length(btrim(nom_prenom)) between 2 and 200),
  telephone       text not null check (length(telephone) between 8 and 40),
  email           text not null check (length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  date_naissance  date not null check (date_naissance between '1900-01-01' and current_date),
  pour_vous       text[] not null default '{}',
  pour_proches    text[] not null default '{}',
  recontact       boolean not null,
  message         text check (message is null or length(message) <= 2000),
  evenement       text not null default 'World Café'
);
comment on table formulaire_jmmj.reponses is 'Réponses au formulaire JMMJ (QR code conférence). Écriture via public.jmmj_submit, lecture via public.jmmj_admin_list (code admin).';
alter table formulaire_jmmj.reponses enable row level security;
revoke all on formulaire_jmmj.reponses from public, anon, authenticated;

-- Secrets (hachés) : code admin et jeton d'export Google Sheets.
create table formulaire_jmmj.config (
  id                int primary key default 1 check (id = 1),
  admin_code_hash   text not null,
  sheet_token_hash  text not null
);
alter table formulaire_jmmj.config enable row level security;
revoke all on formulaire_jmmj.config from public, anon, authenticated;

create or replace function formulaire_jmmj.check_admin(p_code text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_code is null or not exists (
    select 1 from formulaire_jmmj.config
    where admin_code_hash = extensions.crypt(upper(btrim(p_code)), admin_code_hash)
  ) then
    perform pg_sleep(0.7);
    raise exception 'code_invalide' using errcode = '28000';
  end if;
end $$;
revoke all on function formulaire_jmmj.check_admin(text) from public, anon, authenticated;

-- Liste blanche des choix proposés.
create or replace function formulaire_jmmj.clean_choices(p jsonb)
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct v order by v), '{}')
  from jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) v
  where v in ('cours_hebdo', 'arabe_intensif', 'coran_tajwid', 'cours_en_ligne')
$$;

create or replace function public.jmmj_submit(payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_tel text := nullif(regexp_replace(coalesce(payload->>'telephone', ''), '[^0-9+]', '', 'g'), '');
  v_email text := nullif(lower(btrim(coalesce(payload->>'email', ''))), '');
begin
  if jsonb_typeof(payload->'recontact') <> 'boolean' then
    raise exception 'recontact_requis' using errcode = '22023';
  end if;
  insert into formulaire_jmmj.reponses
    (nom_prenom, telephone, email, date_naissance, pour_vous, pour_proches, recontact, message)
  values (
    btrim(payload->>'nom_prenom'),
    v_tel,
    v_email,
    nullif(payload->>'date_naissance', '')::date,
    formulaire_jmmj.clean_choices(payload->'pour_vous'),
    formulaire_jmmj.clean_choices(payload->'pour_proches'),
    (payload->>'recontact')::boolean,
    nullif(left(btrim(coalesce(payload->>'message', '')), 2000), '')
  )
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.jmmj_submit(jsonb) from public;
grant execute on function public.jmmj_submit(jsonb) to anon, authenticated;

create or replace function public.jmmj_admin_list(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform formulaire_jmmj.check_admin(p_code);
  return coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from formulaire_jmmj.reponses r), '[]');
end $$;
revoke all on function public.jmmj_admin_list(text) from public;
grant execute on function public.jmmj_admin_list(text) to anon, authenticated;

create or replace function public.jmmj_admin_delete(p_code text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform formulaire_jmmj.check_admin(p_code);
  delete from formulaire_jmmj.reponses where id = p_id;
end $$;
revoke all on function public.jmmj_admin_delete(text, uuid) from public;
grant execute on function public.jmmj_admin_delete(text, uuid) to anon, authenticated;

-- Lignes pour l'export Google Sheets (edge function jmmj-sheet), protégé par jeton.
create or replace function public.jmmj_sheet_rows(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_token is null or not exists (
    select 1 from formulaire_jmmj.config
    where sheet_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  ) then
    raise exception 'jeton_invalide' using errcode = '28000';
  end if;
  return coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at) from formulaire_jmmj.reponses r), '[]');
end $$;
revoke all on function public.jmmj_sheet_rows(text) from public;
grant execute on function public.jmmj_sheet_rows(text) to anon, authenticated;
