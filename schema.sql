
-- Logcomex Finance Board - Schema Supabase

create table if not exists board_columns (
  id text primary key,
  title text not null,
  position int not null
);

create table if not exists board_cards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  column_id text references board_columns(id) on delete cascade,
  assignee text not null default 'Kamilla',
  priority text not null default 'media',
  due_date date,
  tags text[] default '{}',
  comments_count int default 0,
  position int default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists board_comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references board_cards(id) on delete cascade,
  author text not null default 'Kamilla',
  body text not null,
  created_at timestamp with time zone default now()
);

alter table board_columns enable row level security;
alter table board_cards enable row level security;
alter table board_comments enable row level security;

drop policy if exists "public read columns" on board_columns;
drop policy if exists "public manage cards" on board_cards;
drop policy if exists "public manage comments" on board_comments;

create policy "public read columns"
on board_columns for select
using (true);

create policy "public manage cards"
on board_cards for all
using (true)
with check (true);

create policy "public manage comments"
on board_comments for all
using (true)
with check (true);

insert into board_columns (id, title, position) values
('todo', 'A fazer', 1),
('doing', 'Em andamento', 2),
('done', 'Concluído', 3),
('thai', 'Pendentes Thai', 4),
('declined', 'Declinado', 5)
on conflict (id) do nothing;

insert into board_cards (title, column_id, assignee, priority, due_date, tags, comments_count, position) values
('Montar e Comunicar a Política da janela semanal, PGTO 1X por semana', 'todo', 'Kamilla', 'alta', '2026-05-28', array['Política','Pagamentos'], 2, 1),
('Atualizar no Omie notas de adiantamento já emitida', 'todo', 'Thai', 'media', null, array['Omie'], 1, 2),
('Base de fornecedores, falta padronizar a forma de pagamento e recorrência', 'todo', 'Kamilla', 'media', '2026-06-05', array['Fornecedores'], 0, 3),
('P2P - Compras & Contas a pagar - Reestruturação do processo', 'todo', 'Adriano', 'alta', '2026-06-10', array['P2P','Processo'], 4, 4),
('Aprovações do pipe', 'todo', 'Kamilla', 'media', null, array['Pipefy'], 0, 5),
('Criar política de caixa e investimentos', 'todo', 'Kamilla', 'alta', '2026-06-15', array['Tesouraria'], 2, 6),
('Acessos Daniel banco', 'doing', 'Daniel', 'media', null, array['Banco'], 1, 1),
('Abertura da conta Offshore - Safra', 'doing', 'Kamilla', 'alta', '2026-06-03', array['Offshore','Safra'], 2, 2),
('Implementação CISa Santander', 'doing', 'Kamilla', 'critica', '2026-05-30', array['Santander','NetSuite'], 5, 3),
('Teste de remessa Netsuite', 'doing', 'Kamilla', 'critica', '2026-05-27', array['NetSuite','Banco'], 3, 4),
('Inclusão de Adriano e Daniel no BTG offshore como procuradores para investimentos', 'doing', 'Adriano', 'media', null, array['BTG','Offshore'], 1, 5),
('Cancelamento Notion', 'done', 'Kamilla', 'media', null, array['SaaS'], 0, 1),
('Conectar Niuco com Omie para monitoramento de desligados', 'done', 'Thai', 'media', null, array['Omie'], 1, 2),
('Melhoria no processo de pagamentos benefícios novos colaboradores UX - Segurança', 'done', 'Kamilla', 'baixa', null, array['UX','Benefícios'], 2, 3),
('Reunião omie', 'done', 'Kamilla', 'alta', '2026-04-22', array['Omie'], 2, 4),
('Pipe DP', 'thai', 'Thai', 'alta', '2026-04-21', array['DP'], 1, 1),
('Acesso banco rendimentos', 'thai', 'Thai', 'alta', '2026-04-20', array['Banco'], 0, 2),
('Integrar os fornecedores conta simples', 'thai', 'Thai', 'alta', '2026-04-22', array['Fornecedores'], 1, 3),
('Ajuste da coluna de recorrência no relatório de pagamentos', 'thai', 'Thai', 'alta', null, array['Relatório'], 0, 4),
('Teste 2 de pagamentos subindo via importação de planilha no OMIE - mapeamento dos erros', 'thai', 'Thai', 'alta', null, array['Omie'], 0, 5),
('Melhoria no processo de viagens internacionais com o grupo rendimentos', 'declined', 'Kamilla', 'media', null, array['Viagens'], 1, 1),
('Melhoria do pipe para o logger e aprovadores', 'declined', 'Thai', 'media', null, array['Pipefy'], 1, 2)
on conflict do nothing;
