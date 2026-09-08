-- ============================================================================
-- CASINO EXCHANGE 2.0 - SUPABASE REALTIME MULTIPLAYER
-- Kan køres på et nyt projekt ELLER oven på den tidligere Casino Exchange v1.
-- Kør hele filen i Supabase -> SQL Editor -> New query -> Run.
-- ============================================================================

begin;

create extension if not exists pgcrypto with schema extensions;

-- --------------------------------------------------------------------------
-- TABELLER
-- --------------------------------------------------------------------------
create table if not exists public.game_state (
  id text primary key default 'main',
  status text not null default 'closed' check (status in ('closed','open','paused')),
  duration_seconds integer not null default 2700,
  opened_at timestamptz,
  accumulated_open_seconds integer not null default 0,
  global_impact numeric not null default 0,
  leaderboard_visible boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.game_state add column if not exists last_tick_at timestamptz;
alter table public.game_state add column if not exists leaderboard_revision bigint not null default 0;
insert into public.game_state(id) values ('main') on conflict (id) do nothing;

create table if not exists public.assets (
  id text primary key,
  ticker text not null unique,
  name text not null,
  sector text not null,
  risk text not null,
  price numeric(14,2) not null check (price > 0),
  start_price numeric(14,2) not null check (start_price > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.asset_engine (
  asset_id text primary key references public.assets(id) on delete cascade,
  base_volatility numeric not null,
  trend numeric not null default 0,
  news_impact numeric not null default 0,
  momentum numeric not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.assets(id,ticker,name,sector,risk,price,start_price) values
('greenvolt','GVLT','GreenVolt Energy','Vedvarende energi','Mellem',100,100),
('novacoin','NOVA','NovaCoin','Fiktiv kryptovaluta','Meget høj',72,72),
('nordicdefence','NDS','Nordic Defence Systems','Forsvar & sikkerhed','Lav/mellem',145,145),
('cloudcore','CCT','CloudCore Technologies','AI & cloud','Høj',118,118),
('titanmining','TMC','Titan Mining Corporation','Råvarer & minedrift','Mellem/høj',86,86)
on conflict (id) do update set
  ticker=excluded.ticker,
  name=excluded.name,
  sector=excluded.sector,
  risk=excluded.risk;

insert into public.asset_engine(asset_id,base_volatility,trend) values
('greenvolt',0.0045,0.00015),
('novacoin',0.0120,0.00005),
('nordicdefence',0.0036,0.00020),
('cloudcore',0.0065,0.00025),
('titanmining',0.0052,-0.00005)
on conflict (asset_id) do update set
  base_volatility=excluded.base_volatility,
  trend=excluded.trend;

create table if not exists public.price_history (
  id bigint generated always as identity primary key,
  asset_id text not null references public.assets(id) on delete cascade,
  price numeric(14,2) not null check (price > 0),
  created_at timestamptz not null default now()
);
create index if not exists price_history_asset_time_idx on public.price_history(asset_id,created_at desc);
insert into public.price_history(asset_id,price)
select a.id,a.price from public.assets a
where not exists (select 1 from public.price_history ph where ph.asset_id=a.id);

create table if not exists public.teams (
  id text primary key,
  name text not null,
  starting_cash numeric(14,2) not null check (starting_cash >= 0),
  cash numeric(14,2) not null check (cash >= 0),
  updated_at timestamptz not null default now()
);
insert into public.teams(id,name,starting_cash,cash) values
('team1','Hold 1',3500,3500),
('team2','Hold 2',5200,5200),
('team3','Hold 3',2750,2750),
('team4','Hold 4',6100,6100),
('team5','Hold 5',4200,4200),
('team6','Hold 6',4700,4700),
('team7','Hold 7',3900,3900),
('team8','Hold 8',5600,5600)
on conflict (id) do update set name=excluded.name;

create table if not exists public.team_credentials (
  team_id text primary key references public.teams(id) on delete cascade,
  code_hash text not null
);
insert into public.team_credentials(team_id,code_hash) values
('team1',extensions.crypt('1472',extensions.gen_salt('bf'))),
('team2',extensions.crypt('5831',extensions.gen_salt('bf'))),
('team3',extensions.crypt('2746',extensions.gen_salt('bf'))),
('team4',extensions.crypt('6104',extensions.gen_salt('bf'))),
('team5',extensions.crypt('8325',extensions.gen_salt('bf'))),
('team6',extensions.crypt('4198',extensions.gen_salt('bf'))),
('team7',extensions.crypt('7653',extensions.gen_salt('bf'))),
('team8',extensions.crypt('9261',extensions.gen_salt('bf')))
on conflict (team_id) do nothing;

create table if not exists public.team_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  team_id text not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.holdings (
  team_id text not null references public.teams(id) on delete cascade,
  asset_id text not null references public.assets(id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  primary key(team_id,asset_id)
);
insert into public.holdings(team_id,asset_id,quantity)
select t.id,a.id,0 from public.teams t cross join public.assets a
on conflict(team_id,asset_id) do nothing;

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references public.teams(id) on delete cascade,
  asset_id text not null references public.assets(id),
  side text not null check (side in ('buy','sell')),
  quantity integer not null check (quantity > 0),
  price numeric(14,2) not null check (price > 0),
  total numeric(14,2) not null check (total > 0),
  created_at timestamptz not null default now()
);
create index if not exists trades_team_time_idx on public.trades(team_id,created_at desc);

create table if not exists public.admin_credentials (
  id text primary key,
  code_hash text not null
);
insert into public.admin_credentials(id,code_hash)
values ('main',extensions.crypt('9090',extensions.gen_salt('bf')))
on conflict (id) do nothing;

create table if not exists public.admin_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.news_templates (
  id text primary key,
  asset_id text not null references public.assets(id) on delete cascade,
  schedule_minute integer,
  headline text not null,
  body text not null default '',
  effect numeric not null default 0,
  breaking boolean not null default false
);

create table if not exists public.news_feed (
  id uuid primary key default gen_random_uuid(),
  asset_id text references public.assets(id) on delete set null,
  headline text not null,
  body text not null default '',
  effect numeric not null default 0,
  breaking boolean not null default false,
  published_at timestamptz not null default now()
);
alter table public.news_feed add column if not exists template_id text;
create unique index if not exists news_feed_template_unique on public.news_feed(template_id) where template_id is not null;
create index if not exists news_feed_time_idx on public.news_feed(published_at desc);

create table if not exists public.pending_events (
  id uuid primary key default gen_random_uuid(),
  asset_id text not null references public.assets(id) on delete cascade,
  effect numeric not null,
  execute_at timestamptz not null,
  event_type text not null default 'hidden_impact',
  processed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists pending_events_due_idx on public.pending_events(processed,execute_at);

insert into public.news_templates(id,asset_id,schedule_minute,headline,body,effect,breaking) values
('gv1','greenvolt',2,'GreenVolt vinder historisk stor vindmølleaftale','Selskabet skal levere energi til et nyt kystprojekt. Ordren er større end markedet havde forventet.',0.55,true),
('cc1','cloudcore',4,'CloudCore lancerer ny AI-platform før tidsplanen','De første testkunder melder om høj fart og lavere omkostninger.',0.34,false),
('tm1','titanmining',6,'Titan Mining finder lovende kobberforekomst','Geologerne kalder fundet interessant, men der går tid før størrelsen er kendt.',0.22,false),
('nv1','novacoin',8,'NovaCoin eksploderer på sociale medier','En kendt fiktiv streamer omtaler mønten. Handelsaktiviteten stiger kraftigt.',0.62,true),
('nd1','nordicdefence',10,'Nordic Defence udvalgt til stor radar-test','Tre lande vil afprøve selskabets nye system. En endelig kontrakt er dog ikke underskrevet.',0.27,false),
('gv2','greenvolt',12,'Tekniske problemer forsinker GreenVolt-projekt','Et stort vindprojekt sættes midlertidigt på pause, mens ingeniører undersøger en fejl.',-0.42,true),
('cc2','cloudcore',14,'CloudCore oplever omfattende servernedbrud','Flere store kunder klager over driftsstop og undersøger alternativer.',-0.58,true),
('tm2','titanmining',16,'Råvarepriser svinger efter nye industriprognoser','Nogle analytikere forventer højere efterspørgsel, mens andre frygter et midlertidigt fald.',0.02,false),
('nv2','novacoin',18,'Rygte om NovaCoin-opdatering skaber uro','Ingen officiel bekræftelse endnu. Markedet diskuterer både store muligheder og stor risiko.',0.08,false),
('nd2','nordicdefence',20,'Nordic Defence sikrer flerårig serviceaftale','Aftalen giver mere stabile indtægter de kommende år.',0.40,true),
('gv3','greenvolt',22,'GreenVolt annoncerer international satsning','Planen kan give stor vækst, men kræver også betydelige investeringer. Analytikerne er delte.',0.05,false),
('cc3','cloudcore',24,'CloudCore mister stor kunde til konkurrent','Kunden stod for en mærkbar del af selskabets cloudforbrug.',-0.36,false),
('tm3','titanmining',26,'Minearbejde stoppet efter oversvømmelse','Produktionen ventes reduceret, mens området tømmes for vand og sikkerheden kontrolleres.',-0.52,true),
('nv3','novacoin',28,'NovaCoin-netværket sætter ny hastighedsrekord','En softwareopdatering ser ud til at have gjort systemet hurtigere end forventet.',0.45,true),
('nd3','nordicdefence',30,'Forsvarsordre udskydes til næste måned','Kunden vil have ekstra test, før den endelige beslutning træffes.',-0.18,false),
('gv4','greenvolt',32,'Stærk blæst løfter GreenVolts produktion','Selskabet melder om en usædvanligt god produktionsuge på flere vindparker.',0.26,false),
('cc4','cloudcore',34,'CloudCore får stor skoleplatform som ny kunde','Kontrakten er ikke selskabets største, men ses som et godt kvalitetsstempel.',0.23,false),
('tm4','titanmining',36,'Titan Mining underskriver lang leveringsaftale','En stor batteriproducent reserverer råvarer fra selskabet i flere år.',0.47,true),
('nv4','novacoin',38,'Stor NovaCoin-wallet flytter millioner af mønter','Ingen ved endnu, om ejeren vil sælge. Handlende reagerer nervøst.',-0.26,false),
('nd4','nordicdefence',40,'Ny drone består alle sikkerhedstests','Nordic Defence oplyser, at produktet nu er klar til demonstration for kunder.',0.31,false),
('gv5','greenvolt',null,'GreenVolt-chef køber aktier i eget selskab','Markedet tolker ofte ledelsens egne køb som et tegn på tro på fremtiden.',0.24,false),
('cc5','cloudcore',null,'CloudCore afviser rygter om sikkerhedsproblem','Selskabet siger, at systemerne fungerer normalt. Nogle investorer er stadig forsigtige.',-0.06,false),
('tm5','titanmining',null,'Nyt miljøkrav kan gøre minedrift dyrere','Titan Mining undersøger, hvor meget de nye regler kan påvirke kommende projekter.',-0.30,false),
('nv5','novacoin',null,'NovaCoin-founder lover den største uge nogensinde','Der er ingen detaljer. Kommentaren skaber både hype og skepsis.',0.18,false),
('nd5','nordicdefence',null,'Konkurrent lancerer billigere radarløsning','Nordic Defence fastholder, at deres egen løsning har bedre rækkevidde.',-0.22,false)
on conflict(id) do update set
  asset_id=excluded.asset_id,
  schedule_minute=excluded.schedule_minute,
  headline=excluded.headline,
  body=excluded.body,
  effect=excluded.effect,
  breaking=excluded.breaking;

-- --------------------------------------------------------------------------
-- HJÆLPEFUNKTIONER / LOGIN
-- --------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path=''
as $$
  select exists(select 1 from public.admin_sessions s where s.user_id=auth.uid());
$$;

create or replace function public.my_team_id()
returns text
language sql stable security definer set search_path=''
as $$
  select s.team_id from public.team_sessions s where s.user_id=auth.uid() limit 1;
$$;

create or replace function public.get_team_choices()
returns table(team_id text, team_name text)
language sql stable security definer set search_path=''
as $$
  select t.id,t.name from public.teams t order by t.id;
$$;

create or replace function public.join_team(p_team_id text,p_code text)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare v_hash text;
begin
  if auth.uid() is null then return false; end if;
  select c.code_hash into v_hash from public.team_credentials c where c.team_id=p_team_id;
  if v_hash is null or extensions.crypt(p_code,v_hash)<>v_hash then return false; end if;
  insert into public.team_sessions(user_id,team_id)
  values(auth.uid(),p_team_id)
  on conflict(user_id) do update set team_id=excluded.team_id,created_at=now();
  return true;
end;
$$;

create or replace function public.leave_team()
returns boolean
language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null then return false; end if;
  delete from public.team_sessions where user_id=auth.uid();
  return true;
end;
$$;

create or replace function public.admin_login(p_code text)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare v_hash text;
begin
  if auth.uid() is null then return false; end if;
  select c.code_hash into v_hash from public.admin_credentials c where c.id='main';
  if v_hash is null or extensions.crypt(p_code,v_hash)<>v_hash then return false; end if;
  insert into public.admin_sessions(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  return true;
end;
$$;

create or replace function public.admin_logout()
returns boolean
language plpgsql security definer set search_path=''
as $$
begin
  delete from public.admin_sessions where user_id=auth.uid();
  return true;
end;
$$;

-- --------------------------------------------------------------------------
-- LEADERBOARD OG ATOMISK HANDEL
-- --------------------------------------------------------------------------
create or replace function public.get_leaderboard()
returns table(rank bigint,team_id text,team_name text,total_wealth numeric)
language plpgsql security definer set search_path=''
as $$
declare v_visible boolean;
begin
  select g.leaderboard_visible into v_visible from public.game_state g where g.id='main';
  if not coalesce(v_visible,false) and not public.is_admin() then return; end if;

  return query
  select
    row_number() over(order by (t.cash+coalesce(sum(h.quantity*a.price),0)) desc),
    t.id,
    t.name,
    round(t.cash+coalesce(sum(h.quantity*a.price),0),2)
  from public.teams t
  left join public.holdings h on h.team_id=t.id
  left join public.assets a on a.id=h.asset_id
  group by t.id,t.name,t.cash
  order by round(t.cash+coalesce(sum(h.quantity*a.price),0),2) desc;
end;
$$;

create or replace function public.execute_trade(p_asset_id text,p_side text,p_quantity integer)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_team text;
  v_price numeric(14,2);
  v_cash numeric(14,2);
  v_owned integer;
  v_total numeric(14,2);
  v_status text;
  v_trade uuid;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'message','Ikke logget ind.'); end if;
  if p_quantity is null or p_quantity<=0 then return jsonb_build_object('ok',false,'message','Vælg mindst 1 enhed.'); end if;
  if p_side not in ('buy','sell') then return jsonb_build_object('ok',false,'message','Ugyldig handelstype.'); end if;

  select g.status into v_status from public.game_state g where g.id='main';
  if v_status<>'open' then return jsonb_build_object('ok',false,'message','Markedet er ikke åbent.'); end if;

  select s.team_id into v_team from public.team_sessions s where s.user_id=auth.uid();
  if v_team is null then return jsonb_build_object('ok',false,'message','Vælg et hold først.'); end if;

  select a.price into v_price from public.assets a where a.id=p_asset_id;
  if v_price is null then return jsonb_build_object('ok',false,'message','Aktivet findes ikke.'); end if;

  select t.cash into v_cash from public.teams t where t.id=v_team for update;
  select h.quantity into v_owned from public.holdings h where h.team_id=v_team and h.asset_id=p_asset_id for update;
  v_total:=round(v_price*p_quantity,2);

  if p_side='buy' then
    if v_cash<v_total then return jsonb_build_object('ok',false,'message','Du har ikke nok penge til denne handel.'); end if;
    update public.teams set cash=round(cash-v_total,2),updated_at=now() where id=v_team;
    update public.holdings set quantity=quantity+p_quantity where team_id=v_team and asset_id=p_asset_id;
  else
    if coalesce(v_owned,0)<p_quantity then return jsonb_build_object('ok',false,'message','Du ejer ikke nok enheder. Short selling er ikke tilladt.'); end if;
    update public.teams set cash=round(cash+v_total,2),updated_at=now() where id=v_team;
    update public.holdings set quantity=quantity-p_quantity where team_id=v_team and asset_id=p_asset_id;
  end if;

  insert into public.trades(team_id,asset_id,side,quantity,price,total)
  values(v_team,p_asset_id,p_side,p_quantity,v_price,v_total)
  returning id into v_trade;

  update public.game_state set leaderboard_revision=leaderboard_revision+1,updated_at=now() where id='main';

  return jsonb_build_object('ok',true,'trade_id',v_trade,'team_id',v_team,'asset_id',p_asset_id,'side',p_side,'quantity',p_quantity,'price',v_price,'total',v_total);
end;
$$;

-- --------------------------------------------------------------------------
-- ADMIN-KONTROL
-- --------------------------------------------------------------------------
create or replace function public.admin_start_market()
returns jsonb
language plpgsql security definer set search_path=''
as $$
begin
  if not public.is_admin() then raise exception 'Admin required'; end if;
  update public.game_state
  set status='open',opened_at=now(),last_tick_at=null,updated_at=now()
  where id='main' and status<>'open';
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.admin_pause_market()
returns jsonb
language plpgsql security definer set search_path=''
as $$
begin
  if not public.is_admin() then raise exception 'Admin required'; end if;
  update public.game_state
  set accumulated_open_seconds=accumulated_open_seconds + case when status='open' and opened_at is not null then greatest(0,floor(extract(epoch from (now()-opened_at)))::integer) else 0 end,
      opened_at=null,status='paused',updated_at=now()
  where id='main';
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.admin_close_market()
returns jsonb
language plpgsql security definer set search_path=''
as $$
begin
  if not public.is_admin() then raise exception 'Admin required'; end if;
  update public.game_state
  set accumulated_open_seconds=accumulated_open_seconds + case when status='open' and opened_at is not null then greatest(0,floor(extract(epoch from (now()-opened_at)))::integer) else 0 end,
      opened_at=null,status='closed',updated_at=now()
  where id='main';
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.admin_set_team_cash(p_team_id text,p_cash numeric,p_set_starting boolean default false)
returns jsonb
language plpgsql security definer set search_path=''
as $$
begin
  if not public.is_admin() then raise exception 'Admin required'; end if;
  if p_cash is null or p_cash<0 then raise exception 'Cash must be >= 0'; end if;
  if p_set_starting then
    update public.teams set cash=round(p_cash,2),starting_cash=round(p_cash,2),updated_at=now() where id=p_team_id;
  else
    update public.teams set cash=round(p_cash,2),updated_at=now() where id=p_team_id;
  end if;
  update public.game_state set leaderboard_revision=leaderboard_revision+1,updated_at=now() where id='main';
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.admin_apply_impact(p_asset_id text,p_effect numeric)
returns jsonb
language plpgsql security definer set search_path=''
as $$
begin
  if not public.is_admin() then raise exception 'Admin required'; end if;
  update public.asset_engine
  set news_impact=greatest(-1.5,least(1.5,news_impact+p_effect)),updated_at=now()
  where asset_id=p_asset_id;
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.admin_global_impact(p_effect numeric)
returns jsonb
language plpgsql security definer set search_path=''
as $$
begin
  if not public.is_admin() then raise exception 'Admin required'; end if;
  update public.game_state
  set global_impact=greatest(-1.5,least(1.5,global_impact+p_effect)),updated_at=now()
  where id='main';
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.admin_queue_event(p_asset_id text,p_effect numeric,p_delay_seconds integer)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin required'; end if;
  if p_delay_seconds<0 or p_delay_seconds>600 then raise exception 'Invalid delay'; end if;
  insert into public.pending_events(asset_id,effect,execute_at)
  values(p_asset_id,p_effect,now()+make_interval(secs=>p_delay_seconds)) returning id into v_id;
  return jsonb_build_object('ok',true,'event_id',v_id);
end;
$$;

create or replace function public.admin_publish_news(p_asset_id text,p_headline text,p_body text,p_effect numeric,p_breaking boolean)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin required'; end if;
  if length(trim(coalesce(p_headline,'')))=0 then raise exception 'Headline required'; end if;
  insert into public.news_feed(asset_id,headline,body,breaking)
  values(p_asset_id,p_headline,coalesce(p_body,''),coalesce(p_breaking,false)) returning id into v_id;
  update public.asset_engine set news_impact=greatest(-1.5,least(1.5,news_impact+p_effect)),updated_at=now() where asset_id=p_asset_id;
  return jsonb_build_object('ok',true,'news_id',v_id);
end;
$$;

create or replace function public.admin_publish_template(p_template_id text)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v public.news_templates%rowtype; v_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin required'; end if;
  select * into v from public.news_templates where id=p_template_id;
  if not found then raise exception 'Template not found'; end if;
  if exists(select 1 from public.news_feed where template_id=p_template_id) then
    return jsonb_build_object('ok',false,'message','Nyheden er allerede udgivet.');
  end if;
  insert into public.news_feed(template_id,asset_id,headline,body,breaking)
  values(v.id,v.asset_id,v.headline,v.body,v.breaking) returning id into v_id;
  update public.asset_engine set news_impact=greatest(-1.5,least(1.5,news_impact+v.effect)),updated_at=now() where asset_id=v.asset_id;
  return jsonb_build_object('ok',true,'news_id',v_id);
end;
$$;

create or replace function public.admin_set_leaderboard_visible(p_visible boolean)
returns jsonb
language plpgsql security definer set search_path=''
as $$
begin
  if not public.is_admin() then raise exception 'Admin required'; end if;
  update public.game_state set leaderboard_visible=p_visible,leaderboard_revision=leaderboard_revision+1,updated_at=now() where id='main';
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.admin_reset_game()
returns jsonb
language plpgsql security definer set search_path=''
as $$
begin
  if not public.is_admin() then raise exception 'Admin required'; end if;
  delete from public.trades;
  update public.holdings set quantity=0;
  update public.teams set cash=starting_cash,updated_at=now();
  update public.assets set price=start_price,updated_at=now();
  update public.asset_engine set news_impact=0,momentum=0,updated_at=now();
  delete from public.price_history;
  insert into public.price_history(asset_id,price) select id,price from public.assets;
  delete from public.news_feed;
  delete from public.pending_events;
  update public.game_state
  set status='closed',opened_at=null,accumulated_open_seconds=0,global_impact=0,last_tick_at=null,
      leaderboard_visible=true,leaderboard_revision=leaderboard_revision+1,updated_at=now()
  where id='main';
  return jsonb_build_object('ok',true);
end;
$$;

-- --------------------------------------------------------------------------
-- CENTRAL MARKEDSMOTOR
-- Kun adminbrowseren kalder denne funktion. Selve beregningen sker i Postgres,
-- så alle enheder får samme officielle priser.
-- --------------------------------------------------------------------------
create or replace function public.market_tick()
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  g public.game_state%rowtype;
  a record;
  e record;
  n record;
  pe record;
  elapsed integer;
  u1 double precision;
  u2 double precision;
  gaussian double precision;
  noise double precision;
  move_pct double precision;
  new_price numeric(14,2);
  realized double precision;
  new_momentum numeric;
  new_impact numeric;
  new_global numeric;
  ticked integer:=0;
  inserted_rows integer:=0;
begin
  if not public.is_admin() then raise exception 'Admin required'; end if;

  select * into g from public.game_state where id='main' for update;
  if g.status<>'open' then return jsonb_build_object('ok',true,'skipped','market_not_open'); end if;

  if g.last_tick_at is not null and now()-g.last_tick_at < interval '4 seconds' then
    return jsonb_build_object('ok',true,'skipped','too_soon');
  end if;

  elapsed:=g.accumulated_open_seconds + case when g.opened_at is not null then greatest(0,floor(extract(epoch from(now()-g.opened_at)))::integer) else 0 end;
  if elapsed>=g.duration_seconds then
    update public.game_state
    set status='closed',opened_at=null,accumulated_open_seconds=g.duration_seconds,last_tick_at=now(),updated_at=now()
    where id='main';
    return jsonb_build_object('ok',true,'closed',true);
  end if;

  -- Skjulte events, fx hacker.
  for pe in
    select * from public.pending_events
    where processed=false and execute_at<=now()
    order by execute_at
    for update
  loop
    update public.asset_engine
    set news_impact=greatest(-1.5,least(1.5,news_impact+pe.effect)),updated_at=now()
    where asset_id=pe.asset_id;
    update public.pending_events set processed=true where id=pe.id;
  end loop;

  -- Automatisk planlagte nyheder.
  for n in
    select nt.* from public.news_templates nt
    where nt.schedule_minute is not null
      and nt.schedule_minute*60<=elapsed
      and not exists(select 1 from public.news_feed nf where nf.template_id=nt.id)
    order by nt.schedule_minute
  loop
    insert into public.news_feed(template_id,asset_id,headline,body,breaking)
    values(n.id,n.asset_id,n.headline,n.body,n.breaking)
    on conflict do nothing;
    get diagnostics inserted_rows = row_count;
    if inserted_rows>0 then
      update public.asset_engine
      set news_impact=greatest(-1.5,least(1.5,news_impact+n.effect)),updated_at=now()
      where asset_id=n.asset_id;
    end if;
  end loop;

  -- Prisberegning: noise + trend + momentum + news impact + global impact.
  for a in select * from public.assets order by id for update
  loop
    select * into e from public.asset_engine where asset_id=a.id for update;

    u1:=greatest(random(),0.000000001);
    u2:=random();
    gaussian:=sqrt(-2*ln(u1))*cos(2*pi()*u2);
    noise:=gaussian*e.base_volatility;

    move_pct:=noise + e.trend + e.momentum*0.18 + e.news_impact*0.014 + g.global_impact*0.010;

    if random()<0.015 then
      u1:=greatest(random(),0.000000001);
      u2:=random();
      gaussian:=sqrt(-2*ln(u1))*cos(2*pi()*u2);
      move_pct:=move_pct + gaussian*e.base_volatility*2.8;
    end if;

    move_pct:=greatest(-0.12,least(0.12,move_pct));
    new_price:=round((greatest(a.start_price*0.15,least(a.start_price*7,a.price*(1+move_pct))))::numeric,2);
    realized:=(new_price-a.price)/greatest(a.price,0.01);
    new_momentum:=e.momentum*0.72 + realized*0.45;
    new_impact:=e.news_impact*0.97;
    if abs(new_impact)<0.002 then new_impact:=0; end if;

    update public.assets set price=new_price,updated_at=now() where id=a.id;
    update public.asset_engine set momentum=new_momentum,news_impact=new_impact,updated_at=now() where asset_id=a.id;
    insert into public.price_history(asset_id,price) values(a.id,new_price);
    ticked:=ticked+1;
  end loop;

  new_global:=g.global_impact*0.94;
  if abs(new_global)<0.002 then new_global:=0; end if;

  update public.game_state
  set global_impact=new_global,last_tick_at=now(),leaderboard_revision=leaderboard_revision+1,updated_at=now()
  where id='main';

  -- Historik holdes kompakt: behold ca. de seneste 2 timer.
  delete from public.price_history where created_at<now()-interval '2 hours';

  return jsonb_build_object('ok',true,'ticked',ticked,'elapsed_seconds',elapsed);
end;
$$;

-- --------------------------------------------------------------------------
-- ROW LEVEL SECURITY / RETTIGHEDER
-- --------------------------------------------------------------------------
alter table public.game_state enable row level security;
alter table public.assets enable row level security;
alter table public.asset_engine enable row level security;
alter table public.price_history enable row level security;
alter table public.teams enable row level security;
alter table public.team_credentials enable row level security;
alter table public.team_sessions enable row level security;
alter table public.holdings enable row level security;
alter table public.trades enable row level security;
alter table public.admin_credentials enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.news_feed enable row level security;
alter table public.news_templates enable row level security;
alter table public.pending_events enable row level security;

-- Fjern tidligere policies fra v1/v2, så scriptet kan køres igen.
do $$
declare r record;
begin
  for r in
    select schemaname,tablename,policyname from pg_policies
    where schemaname='public' and tablename=any(array[
      'game_state','assets','asset_engine','price_history','teams','team_credentials',
      'team_sessions','holdings','trades','admin_credentials','admin_sessions',
      'news_feed','news_templates','pending_events'
    ])
  loop
    execute format('drop policy if exists %I on %I.%I',r.policyname,r.schemaname,r.tablename);
  end loop;
end $$;

revoke all on public.game_state,public.assets,public.asset_engine,public.price_history,
  public.teams,public.team_credentials,public.team_sessions,public.holdings,public.trades,
  public.admin_credentials,public.admin_sessions,public.news_feed,public.news_templates,
  public.pending_events from anon,authenticated;

-- Alle browsere får først Anonymous Auth og bliver dermed rollen authenticated.
grant select on public.game_state,public.assets,public.price_history to authenticated;
grant select(id,template_id,asset_id,headline,body,breaking,published_at) on public.news_feed to authenticated;
grant select on public.teams,public.team_sessions,public.holdings,public.trades to authenticated;
grant select on public.admin_sessions,public.asset_engine,public.news_templates,public.pending_events to authenticated;

create policy "market readable" on public.game_state for select to authenticated using(true);
create policy "assets readable" on public.assets for select to authenticated using(true);
create policy "history readable" on public.price_history for select to authenticated using(true);
create policy "published news readable" on public.news_feed for select to authenticated using(true);

create policy "own or admin team" on public.teams for select to authenticated using(public.is_admin() or id=public.my_team_id());
create policy "own or admin holdings" on public.holdings for select to authenticated using(public.is_admin() or team_id=public.my_team_id());
create policy "own or admin trades" on public.trades for select to authenticated using(public.is_admin() or team_id=public.my_team_id());
create policy "own or admin team session" on public.team_sessions for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy "own admin session" on public.admin_sessions for select to authenticated using(user_id=auth.uid());

create policy "admin engine read" on public.asset_engine for select to authenticated using(public.is_admin());
create policy "admin templates read" on public.news_templates for select to authenticated using(public.is_admin());
create policy "admin pending read" on public.pending_events for select to authenticated using(public.is_admin());

-- Credentials har bevidst ingen SELECT-policy/grant.

-- RPC-rettigheder.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=any(array[
      'is_admin','my_team_id','get_team_choices','join_team','leave_team','admin_login','admin_logout',
      'get_leaderboard','execute_trade','admin_start_market','admin_pause_market','admin_close_market',
      'admin_set_team_cash','admin_apply_impact','admin_global_impact','admin_queue_event',
      'admin_publish_news','admin_publish_template','admin_set_leaderboard_visible','admin_reset_game','market_tick'
    ])
  loop
    execute format('revoke execute on function %s from public,anon',f.sig);
    execute format('grant execute on function %s to authenticated',f.sig);
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- REALTIME
-- --------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['game_state','assets','price_history','teams','holdings','trades','news_feed']
  loop
    if not exists(
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=t
    ) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;

commit;

-- ============================================================================
-- HURTIG KONTROL EFTER SUCCESS
-- Kør eventuelt disse tre linjer som en ny query:
-- select id,ticker,name,price from public.assets order by id;
-- select id,name,starting_cash,cash from public.teams order by id;
-- select * from pg_publication_tables where pubname='supabase_realtime';
-- ============================================================================
