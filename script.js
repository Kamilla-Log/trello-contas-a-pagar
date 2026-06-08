const client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY)

const people = { Kamilla: 'KS', Thai: 'TH', Adriano: 'AM', Daniel: 'DA' }
let columns = []
let cards = []
let selectedId = null
let isLoading = false  // ← evita carregamentos duplos

function setStatus(text, type=''){
  const el = document.getElementById('connectionStatus')
  el.textContent = text
  el.className = 'status ' + type
}

function priorityClass(p){ return {critica:'red', alta:'orange-priority', media:'purple-priority', baixa:'blue'}[p] || 'purple-priority' }
function priorityLabel(p){ return {critica:'Crítica', alta:'Alta', media:'Média', baixa:'Baixa'}[p] || 'Média' }
function isOverdue(d){ return d ? new Date(d + 'T23:59:59') < new Date() : false }
function formatDate(d){ return d ? new Date(d+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).replace('.','') : '' }

// ── Menu lateral ────────────────────────────────────────────────────────────
function initNav(){
  document.querySelectorAll('.sidebar nav a').forEach(a => {
    a.addEventListener('click', () => {
      document.querySelectorAll('.sidebar nav a').forEach(x => x.classList.remove('active'))
      a.classList.add('active')
      const view = a.dataset.view
      document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'))
      const target = document.getElementById('view-' + view)
      if(target) target.classList.remove('hidden')
    })
  })
}

// ── Carregamento de dados ───────────────────────────────────────────────────
async function loadData(){
  if(isLoading) return   // ← bloqueia chamada duplicada
  isLoading = true
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
  } finally {
    isLoading = false
  }
}

function filteredCards(){
  const search   = document.getElementById('search').value.toLowerCase()
  const assignee = document.getElementById('assigneeFilter').value
  const priority = document.getElementById('priorityFilter').value
  const due      = document.getElementById('dueFilter').value
  return cards.filter(card => {
    const matchSearch   = card.title.toLowerCase().includes(search) || card.tags.join(' ').toLowerCase().includes(search)
    const matchAssignee = assignee === 'todos' || card.assignee === assignee
    const matchPriority = priority === 'todas' || card.priority === priority
    const matchDue      = due === 'todos' || (due === 'vencidos' ? isOverdue(card.due) : !!card.due)
    return matchSearch && matchAssignee && matchPriority && matchDue
  })
}

// ── Render do board ─────────────────────────────────────────────────────────
function renderBoard(){
  const board   = document.getElementById('board')
  const visible = filteredCards()
  board.innerHTML = columns.map(col => {
    const list = visible.filter(c => c.column === col.id)
    return `
      <div class="column"
           data-col="${col.id}"
           ondragover="onDragOver(event)"
           ondrop="onDrop(event,'${col.id}')">
        <div class="column-header"><h2>${col.title}</h2><span>${list.length}</span></div>
        <div class="card-list" id="list-${col.id}">
          ${list.map(cardHtml).join('')}
        </div>
        <button class="add-card" onclick="addCard('${col.id}')">+ Adicionar um cartão</button>
      </div>`
  }).join('')
}

function cardHtml(card){
  return `
    <article class="task"
             draggable="true"
             data-id="${card.id}"
             ondragstart="onDragStart(event,'${card.id}')"
             ondblclick="openCard('${card.id}')">
      <div class="priority-line ${priorityClass(card.priority)}"></div>
      <button class="edit"   onclick="openCard('${card.id}')">✎</button>
      <button class="delete" onclick="deleteCard(event,'${card.id}')">🗑</button>
      <h3>${escapeHtml(card.title)}</h3>
      <div class="tags">${card.tags.slice(0,2).map(t => `<span>${escapeHtml(t)}</span>`).join('')}</div>
      <div class="meta">
        <span class="badge ${priorityClass(card.priority)}">${priorityLabel(card.priority)}</span>
        ${card.due ? `<span class="due ${isOverdue(card.due)?'overdue':''}">${formatDate(card.due)}</span>` : ''}
      </div>
      <div class="footer">
        <div class="avatar">${people[card.assignee] || '??'}</div>
        <button onclick="moveCard('${card.id}',-1)">←</button>
        <button onclick="moveCard('${card.id}', 1)">→</button>
        <span>💬 ${card.comments}</span>
      </div>
    </article>`
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))
}

// ── Drag & Drop ─────────────────────────────────────────────────────────────
let dragId = null

function onDragStart(e, id){
  dragId = id
  e.dataTransfer.effectAllowed = 'move'
  e.currentTarget.style.opacity = '0.4'
}

function onDragOver(e){
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
}

async function onDrop(e, colId){
  e.preventDefault()
  if(!dragId) return
  const card = cards.find(c => c.id === dragId)
  if(!card || card.column === colId){
    dragId = null; renderBoard(); return
  }
  card.column = colId
  renderBoard()  // atualiza visual imediatamente
  await client.from('board_cards').update({ column_id: colId, updated_at: new Date().toISOString() }).eq('id', dragId)
  dragId = null
}

// ── Mover com setas ─────────────────────────────────────────────────────────
async function moveCard(id, direction){
  const order = columns.map(c => c.id)
  const card  = cards.find(c => c.id === id)
  const index = order.indexOf(card.column)
  const next  = Math.max(0, Math.min(order.length - 1, index + direction))
  const newCol = order[next]
  if(newCol === card.column) return
  card.column = newCol
  renderBoard()
  await client.from('board_cards').update({ column_id: newCol, updated_at: new Date().toISOString() }).eq('id', id)
}

// ── Adicionar card ──────────────────────────────────────────────────────────
async function addCard(column){
  const title = prompt('Nome da nova atividade:')
  if(!title || !title.trim()) return
  const { error } = await client.from('board_cards').insert({
    title: title.trim(),
    column_id: column,
    priority: 'media',
    assignee: 'Kamilla',
    tags: ['Nova demanda'],
    position: cards.length + 1
  })
  if(error){ alert('Erro ao criar card: ' + error.message); return }
  await loadData()   // ← chamada única; o realtime está com throttle abaixo
}

// ── Excluir card ────────────────────────────────────────────────────────────
async function deleteCard(e, id){
  e.stopPropagation()
  if(!confirm('Excluir este cartão? Esta ação não pode ser desfeita.')) return
  // remove localmente antes da resposta para UX imediata
  cards = cards.filter(c => c.id !== id)
  renderBoard()
  const { error } = await client.from('board_cards').delete().eq('id', id)
  if(error){ alert('Erro ao excluir: ' + error.message); await loadData() }
}

// ── Modal de edição ─────────────────────────────────────────────────────────
async function openCard(id){
  selectedId = id
  const card = cards.find(c => c.id === id)
  document.getElementById('modalTitle').value       = card.title
  document.getElementById('modalDescription').value = card.description || ''
  document.getElementById('modalAssignee').value    = card.assignee
  document.getElementById('modalPriority').value    = card.priority
  document.getElementById('modalDue').value         = card.due || ''
  document.getElementById('modalTags').value        = card.tags.join(', ')
  document.getElementById('modal').classList.remove('hidden')
  await loadComments(id)
}

async function loadComments(cardId){
  const list = document.getElementById('commentsList')
  const { data, error } = await client.from('board_comments').select('*').eq('card_id', cardId).order('created_at')
  if(error){ list.innerHTML = '<p>Erro ao carregar comentários.</p>'; return }
  list.innerHTML = (data || []).map(c =>
    `<div class="comment">
       <div class="avatar">${(c.author||'??').slice(0,2).toUpperCase()}</div>
       <p><strong>${escapeHtml(c.author)}</strong><br>${escapeHtml(c.body)}</p>
     </div>`
  ).join('') || '<p style="color:#64748b">Nenhum comentário ainda.</p>'
}

function closeModal(){ document.getElementById('modal').classList.add('hidden') }

async function saveModal(){
  const title       = document.getElementById('modalTitle').value
  const description = document.getElementById('modalDescription').value
  const assignee    = document.getElementById('modalAssignee').value
  const priority    = document.getElementById('modalPriority').value
  const due         = document.getElementById('modalDue').value || null
  const tags        = document.getElementById('modalTags').value.split(',').map(t => t.trim()).filter(Boolean)
  const { error } = await client.from('board_cards').update({
    title, description, assignee, priority, due_date: due, tags,
    updated_at: new Date().toISOString()
  }).eq('id', selectedId)
  if(error){ alert('Erro ao salvar: ' + error.message); return }
  closeModal()
  await loadData()
}

async function addComment(){
  const input = document.getElementById('newComment')
  const body  = input.value.trim()
  if(!body) return
  const { error } = await client.from('board_comments').insert({ card_id: selectedId, author: 'Kamilla', body })
  if(error){ alert('Erro ao comentar: ' + error.message); return }
  const card = cards.find(c => c.id === selectedId)
  await client.from('board_cards').update({ comments_count: (card.comments || 0) + 1 }).eq('id', selectedId)
  input.value = ''
  await loadComments(selectedId)
  card.comments = (card.comments || 0) + 1
}

// ── Login ───────────────────────────────────────────────────────────────────
function openLogin(){ document.getElementById('login').classList.remove('hidden') }
function closeLogin(){ document.getElementById('login').classList.add('hidden') }

// ── Realtime (throttled para evitar duplo load) ─────────────────────────────
let realtimeTimer = null
function scheduleReload(){
  if(realtimeTimer) return          // já há um reload agendado — ignora
  realtimeTimer = setTimeout(async () => {
    realtimeTimer = null
    await loadData()
    if(selectedId) await loadComments(selectedId)
  }, 800)   // aguarda 800ms antes de recarregar (debounce)
}

client.channel('board-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'board_cards' },    scheduleReload)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'board_comments' }, scheduleReload)
  .subscribe()

// ── Init ─────────────────────────────────────────────────────────────────────
initNav()
loadData()
