const client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY)

const people = { Kamilla: 'KS', Thai: 'TH', Adriano: 'AM', Daniel: 'DA' }
let columns = []
let cards = []
let selectedId = null

function setStatus(text, type=''){
  const el = document.getElementById('connectionStatus')
  el.textContent = text
  el.className = 'status ' + type
}

function priorityClass(priority){ return {critica:'red', alta:'orange-priority', media:'purple-priority', baixa:'blue'}[priority] || 'purple-priority' }
function priorityLabel(priority){ return {critica:'Crítica', alta:'Alta', media:'Média', baixa:'Baixa'}[priority] || 'Média' }
function isOverdue(date){ return date ? new Date(date + 'T23:59:59') < new Date() : false }
function formatDate(date){ return date ? new Date(date+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).replace('.','') : '' }

async function loadData(){
  try{
    const { data: cols, error: colErr } = await client.from('board_columns').select('*').order('position')
    if(colErr) throw colErr
    const { data: cardRows, error: cardErr } = await client.from('board_cards').select('*').order('position')
    if(cardErr) throw cardErr
    columns = cols
    cards = cardRows.map(row => ({
      id: row.id,
      column: row.column_id,
      title: row.title,
      description: row.description || '',
      priority: row.priority,
      assignee: row.assignee,
      tags: row.tags || [],
      due: row.due_date || '',
      comments: row.comments_count || 0,
      position: row.position || 0
    }))
    setStatus('Conectado ao Supabase. Dados salvos em tempo real.', 'ok')
    renderBoard()
  }catch(err){
    console.error(err)
    setStatus('Erro ao conectar. Rode o schema.sql no Supabase antes de usar.', 'err')
  }
}

function filteredCards(){
  const search = document.getElementById('search').value.toLowerCase()
  const assignee = document.getElementById('assigneeFilter').value
  const priority = document.getElementById('priorityFilter').value
  const due = document.getElementById('dueFilter').value
  return cards.filter(card => {
    const matchSearch = card.title.toLowerCase().includes(search) || card.tags.join(' ').toLowerCase().includes(search)
    const matchAssignee = assignee === 'todos' || card.assignee === assignee
    const matchPriority = priority === 'todas' || card.priority === priority
    const matchDue = due === 'todos' || (due === 'vencidos' ? isOverdue(card.due) : !!card.due)
    return matchSearch && matchAssignee && matchPriority && matchDue
  })
}

function renderBoard(){
  const board = document.getElementById('board')
  const visible = filteredCards()
  board.innerHTML = columns.map(col => {
    const list = visible.filter(c => c.column === col.id)
    return `<div class="column"><div class="column-header"><h2>${col.title}</h2><span>${list.length}</span></div><div class="card-list">${list.map(cardHtml).join('')}</div><button class="add-card" onclick="addCard('${col.id}')">+ Adicionar um cartão</button></div>`
  }).join('')
}

function cardHtml(card){
  return `<article class="task" ondblclick="openCard('${card.id}')">
    <div class="priority-line ${priorityClass(card.priority)}"></div>
    <button class="edit" onclick="openCard('${card.id}')">✎</button>
    <h3>${escapeHtml(card.title)}</h3>
    <div class="tags">${card.tags.slice(0,2).map(t => `<span>${escapeHtml(t)}</span>`).join('')}</div>
    <div class="meta"><span class="badge ${priorityClass(card.priority)}">${priorityLabel(card.priority)}</span>${card.due ? `<span class="due ${isOverdue(card.due) ? 'overdue' : ''}">${formatDate(card.due)}</span>` : ''}</div>
    <div class="footer"><div class="avatar">${people[card.assignee] || '??'}</div><button onclick="moveCard('${card.id}', -1)">←</button><button onclick="moveCard('${card.id}', 1)">→</button><span>💬 ${card.comments}</span></div>
  </article>`
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))
}

async function moveCard(id, direction){
  const order = columns.map(c => c.id)
  const card = cards.find(c => c.id === id)
  const index = order.indexOf(card.column)
  const next = Math.max(0, Math.min(order.length - 1, index + direction))
  const newColumn = order[next]
  await client.from('board_cards').update({ column_id: newColumn, updated_at: new Date().toISOString() }).eq('id', id)
  card.column = newColumn
  renderBoard()
}

async function addCard(column){
  const title = prompt('Nome da nova atividade:')
  if(!title) return
  const { error } = await client.from('board_cards').insert({
    title,
    column_id: column,
    priority: 'media',
    assignee: 'Kamilla',
    tags: ['Nova demanda'],
    position: cards.length + 1
  })
  if(error) alert('Erro ao criar card: ' + error.message)
  await loadData()
}

async function openCard(id){
  selectedId = id
  const card = cards.find(c => c.id === id)
  document.getElementById('modalTitle').value = card.title
  document.getElementById('modalDescription').value = card.description || ''
  document.getElementById('modalAssignee').value = card.assignee
  document.getElementById('modalPriority').value = card.priority
  document.getElementById('modalDue').value = card.due || ''
  document.getElementById('modalTags').value = card.tags.join(', ')
  document.getElementById('modal').classList.remove('hidden')
  await loadComments(id)
}

async function loadComments(cardId){
  const list = document.getElementById('commentsList')
  const { data, error } = await client.from('board_comments').select('*').eq('card_id', cardId).order('created_at')
  if(error){ list.innerHTML = '<p>Erro ao carregar comentários.</p>'; return }
  list.innerHTML = (data || []).map(c => `<div class="comment"><div class="avatar">${(c.author || '??').slice(0,2).toUpperCase()}</div><p><strong>${escapeHtml(c.author)}</strong><br>${escapeHtml(c.body)}</p></div>`).join('') || '<p style="color:#64748b">Nenhum comentário ainda.</p>'
}

function closeModal(){ document.getElementById('modal').classList.add('hidden') }

async function saveModal(){
  const title = document.getElementById('modalTitle').value
  const description = document.getElementById('modalDescription').value
  const assignee = document.getElementById('modalAssignee').value
  const priority = document.getElementById('modalPriority').value
  const due = document.getElementById('modalDue').value || null
  const tags = document.getElementById('modalTags').value.split(',').map(t => t.trim()).filter(Boolean)
  const { error } = await client.from('board_cards').update({ title, description, assignee, priority, due_date: due, tags, updated_at: new Date().toISOString() }).eq('id', selectedId)
  if(error){ alert('Erro ao salvar: ' + error.message); return }
  closeModal()
  await loadData()
}

async function addComment(){
  const input = document.getElementById('newComment')
  const body = input.value.trim()
  if(!body) return
  const { error } = await client.from('board_comments').insert({ card_id: selectedId, author: 'Kamilla', body })
  if(error){ alert('Erro ao comentar: ' + error.message); return }
  const card = cards.find(c => c.id === selectedId)
  await client.from('board_cards').update({ comments_count: (card.comments || 0) + 1 }).eq('id', selectedId)
  input.value = ''
  await loadComments(selectedId)
  await loadData()
}

function openLogin(){ document.getElementById('login').classList.remove('hidden') }
function closeLogin(){ document.getElementById('login').classList.add('hidden') }

client.channel('board-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'board_cards' }, () => loadData())
  .on('postgres_changes', { event: '*', schema: 'public', table: 'board_comments' }, () => { if(selectedId) loadComments(selectedId); loadData() })
  .subscribe()

loadData()
