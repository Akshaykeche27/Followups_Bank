const $ = (selector) => document.querySelector(selector);
const state = { customers: [], customerMap: new Map(), toastTimer: null };

function todayIST() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(date);
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
  }).format(date);
}

function toISTDateTimeInput(value) {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function fromISTDateTimeInput(value) {
  if (!value) return null;
  return new Date(`${value}:00+05:30`).toISOString();
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
  });
  if (response.status === 401) {
    window.location.href = '/login';
    throw new Error('Your session has expired. Please sign in again.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function showToast(message, isError = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function showModal(id) { $(`#${id}`).classList.remove('hidden'); }
function hideModal(id) { $(`#${id}`).classList.add('hidden'); }

function setActiveTab(tabName) {
  document.querySelectorAll('.nav-tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === tabName));
  document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `${tabName}Tab`));
  if (tabName === 'dashboard') loadDashboard();
  if (tabName === 'customers') { loadGroups(); loadCustomers(); }
  if (tabName === 'notes') loadNotes();
}

function emptyState(title, message) {
  return `<div class="empty-state"><strong>${escapeHTML(title)}</strong>${escapeHTML(message)}</div>`;
}

function statusBadge(status) {
  const safe = status === 'Recovered' ? 'Recovered' : 'Pending';
  return `<span class="badge ${safe === 'Recovered' ? 'badge-recovered' : 'badge-pending'}">${safe}</span>`;
}

function actionButton(label, action, id, extraClass = '') {
  return `<button type="button" class="action-link ${extraClass}" data-action="${action}" data-id="${escapeHTML(id)}">${label}</button>`;
}

async function loadDashboard() {
  const date = $('#dashboardDate').value || todayIST();
  try {
    const data = await api(`/api/dashboard?date=${encodeURIComponent(date)}`);
    $('#statScheduled').textContent = data.stats.scheduled;
    $('#statFollowed').textContent = data.stats.followed;
    $('#statRecovered').textContent = data.stats.recovered;
    $('#statPending').textContent = data.stats.pending;
    $('#overdueText').textContent = `${data.stats.overdue} overdue follow-up${data.stats.overdue === 1 ? '' : 's'}`;
    $('#scheduledCount').textContent = data.stats.scheduled;
    $('#activityCount').textContent = data.stats.followed;

    data.scheduled.forEach((customer) => state.customerMap.set(String(customer._id), customer));
    $('#scheduledTable').innerHTML = data.scheduled.length ? `
      <table><thead><tr><th>Customer</th><th>Call</th><th>List</th><th>Next follow-up</th><th>Action</th></tr></thead><tbody>
      ${data.scheduled.map((customer) => `
        <tr>
          <td><span class="customer-name">${escapeHTML(customer.name)}</span><span class="cell-sub">${escapeHTML(customer.location || 'Location not added')}</span></td>
          <td><a class="phone-link" href="tel:${escapeHTML(String(customer.mobile).replace(/[^\d+]/g, ''))}">☎ ${escapeHTML(customer.mobile)}</a></td>
          <td>${escapeHTML(customer.groupName)}</td>
          <td>${formatDateTime(customer.nextFollowUpAt)}</td>
          <td>${actionButton('Update', 'followup', customer._id)}</td>
        </tr>`).join('')}
      </tbody></table>` : emptyState('Nothing scheduled', 'No pending customer is scheduled for this date.');

    $('#activityTable').innerHTML = data.activities.length ? `
      <table><thead><tr><th>Customer</th><th>Result</th><th>Time</th><th>Remark</th></tr></thead><tbody>
      ${data.activities.map((item) => {
        const customer = item.customerId || {};
        return `<tr>
          <td><span class="customer-name">${escapeHTML(customer.name || 'Customer record deleted')}</span><span class="cell-sub">${escapeHTML(customer.mobile || '')}</span></td>
          <td>${statusBadge(item.outcome)}</td>
          <td>${formatDateTime(item.followedAt)}</td>
          <td class="remark-cell" title="${escapeHTML(item.remark)}">${escapeHTML(item.remark || '—')}</td>
        </tr>`;
      }).join('')}
      </tbody></table>` : emptyState('No activity yet', 'Follow-up entries saved on this date will appear here.');
  } catch (error) {
    showToast(error.message, true);
  }
}

async function loadGroups() {
  try {
    const groups = await api('/api/groups');
    const selected = $('#groupFilter').value;
    $('#groupFilter').innerHTML = '<option value="">All lists</option>' + groups.map((group) => `<option value="${escapeHTML(group)}">${escapeHTML(group)}</option>`).join('');
    if (groups.includes(selected)) $('#groupFilter').value = selected;
    $('#groupSuggestions').innerHTML = groups.map((group) => `<option value="${escapeHTML(group)}"></option>`).join('');
  } catch (error) {
    showToast(error.message, true);
  }
}

function customerQueryString() {
  const params = new URLSearchParams();
  const values = {
    search: $('#searchFilter').value.trim(),
    groupName: $('#groupFilter').value,
    category: $('#categoryFilter').value,
    status: $('#statusFilter').value,
    dueDate: $('#dueDateFilter').value
  };
  Object.entries(values).forEach(([key, value]) => { if (value) params.set(key, value); });
  return params.toString();
}

async function loadCustomers() {
  try {
    const query = customerQueryString();
    const customers = await api(`/api/customers${query ? `?${query}` : ''}`);
    state.customers = customers;
    customers.forEach((customer) => state.customerMap.set(String(customer._id), customer));
    $('#customerCount').textContent = `${customers.length} customer${customers.length === 1 ? '' : 's'}`;
    $('#customersTable').innerHTML = customers.length ? `
      <table><thead><tr><th>Customer</th><th>Mobile / call</th><th>List</th><th>Repayment category</th><th>Status</th><th>Next follow-up</th><th>Latest remark</th><th>Actions</th></tr></thead><tbody>
      ${customers.map((customer) => `
        <tr>
          <td><span class="customer-name">${escapeHTML(customer.name)}</span><span class="cell-sub">${escapeHTML(customer.location || 'Location not added')}</span></td>
          <td><a class="phone-link" href="tel:${escapeHTML(String(customer.mobile).replace(/[^\d+]/g, ''))}">☎ ${escapeHTML(customer.mobile)}</a></td>
          <td>${escapeHTML(customer.groupName)}</td>
          <td><span class="badge badge-category">${escapeHTML(customer.repaymentCategory)}</span></td>
          <td>${statusBadge(customer.status)}</td>
          <td>${formatDateTime(customer.nextFollowUpAt)}</td>
          <td class="remark-cell" title="${escapeHTML(customer.lastRemark)}">${escapeHTML(customer.lastRemark || '—')}</td>
          <td><div class="row-actions">
            ${actionButton('Follow-up', 'followup', customer._id)}
            ${actionButton('Edit', 'edit', customer._id)}
            ${actionButton('History', 'history', customer._id)}
            ${actionButton('Delete', 'delete', customer._id, 'danger')}
          </div></td>
        </tr>`).join('')}
      </tbody></table>` : emptyState('No customers found', 'Add a customer or change the filters to see records.');
  } catch (error) {
    showToast(error.message, true);
  }
}

function openCustomerForm(customer = null) {
  $('#customerForm').reset();
  $('#customerId').value = customer?._id || '';
  $('#customerModalTitle').textContent = customer ? 'Edit customer' : 'Add customer';
  $('#customerName').value = customer?.name || '';
  $('#customerMobile').value = customer?.mobile || '';
  $('#customerLocation').value = customer?.location || '';
  $('#customerCategory').value = customer?.repaymentCategory || 'Standard Regular';
  $('#customerGroup').value = customer?.groupName || 'List 1';
  $('#customerStatus').value = customer?.status || 'Pending';
  showModal('customerModal');
  $('#customerName').focus();
}

function openFollowupForm(customer) {
  if (!customer) return showToast('Customer details not found. Refresh the customer list.', true);
  $('#followupForm').reset();
  $('#followupCustomerId').value = customer._id;
  $('#followupModalTitle').textContent = `Follow-up: ${customer.name}`;
  $('#followupCustomerInfo').textContent = `${customer.mobile} · ${customer.groupName || 'No list'}`;
  $('#followupOutcome').value = customer.status || 'Pending';
  $('#nextFollowUpAt').value = customer.nextFollowUpAt ? toISTDateTimeInput(customer.nextFollowUpAt) : '';
  $('#followupRemark').value = '';
  showModal('followupModal');
}

async function openHistory(id, customerName = 'Customer') {
  $('#historyTitle').textContent = `${customerName} · History`;
  $('#historyContent').innerHTML = '<div class="empty-state">Loading follow-up history...</div>';
  showModal('historyModal');
  try {
    const entries = await api(`/api/customers/${encodeURIComponent(id)}/followups`);
    $('#historyContent').innerHTML = entries.length ? entries.map((entry) => `
      <article class="history-entry">
        <div class="history-entry-top"><strong>${statusBadge(entry.outcome)}</strong><span class="note-date">${formatDateTime(entry.followedAt)}</span></div>
        <p>${escapeHTML(entry.remark || 'No remark was added.')}</p>
        <div class="history-meta">Next follow-up: ${formatDateTime(entry.nextFollowUpAt)}</div>
      </article>`).join('') : emptyState('No follow-up history', 'The first saved update for this customer will appear here.');
  } catch (error) {
    $('#historyContent').innerHTML = emptyState('Unable to load history', error.message);
  }
}

async function loadNotes() {
  const params = new URLSearchParams();
  if ($('#notesDateFilter').value) params.set('date', $('#notesDateFilter').value);
  if ($('#notesSearch').value.trim()) params.set('search', $('#notesSearch').value.trim());
  try {
    const notes = await api(`/api/notes${params.toString() ? `?${params.toString()}` : ''}`);
    $('#notesList').innerHTML = notes.length ? notes.map((note) => `
      <article class="note-item">
        <div class="note-item-head"><h3>${escapeHTML(note.title)}</h3><span class="note-date">${formatDate(note.noteDate)}</span></div>
        <p>${escapeHTML(note.content)}</p>
        <div class="note-actions">${actionButton('Edit', 'edit-note', note._id)}${actionButton('Delete', 'delete-note', note._id, 'danger')}</div>
      </article>`).join('') : emptyState('No notes found', 'Create a note or clear the date and search filters.');
  } catch (error) {
    showToast(error.message, true);
  }
}

function resetNoteForm() {
  $('#noteForm').reset();
  $('#noteId').value = '';
  $('#noteDate').value = todayIST();
  $('#noteFormHeading').textContent = 'Add a short note';
  $('#saveNoteBtn').textContent = 'Save note';
  $('#cancelNoteEdit').classList.add('hidden');
}

async function onCustomerAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const id = button.dataset.id;
  const customer = state.customerMap.get(String(id)) || state.customers.find((item) => String(item._id) === String(id));
  switch (button.dataset.action) {
    case 'followup':
      openFollowupForm(customer);
      break;
    case 'edit':
      openCustomerForm(customer);
      break;
    case 'history':
      openHistory(id, customer?.name || 'Customer');
      break;
    case 'delete':
      if (window.confirm(`Delete ${customer?.name || 'this customer'} and all their follow-up history? This cannot be undone.`)) {
        try {
          await api(`/api/customers/${encodeURIComponent(id)}`, { method: 'DELETE' });
          state.customerMap.delete(String(id));
          showToast('Customer deleted.');
          await Promise.all([loadCustomers(), loadDashboard(), loadGroups()]);
        } catch (error) { showToast(error.message, true); }
      }
      break;
  }
}

async function onNoteAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const id = button.dataset.id;
  if (button.dataset.action === 'edit-note') {
    try {
      const notes = await api('/api/notes');
      const note = notes.find((item) => String(item._id) === String(id));
      if (!note) return showToast('Note not found. Refresh and try again.', true);
      $('#noteId').value = note._id;
      $('#noteDate').value = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(note.noteDate));
      $('#noteTitle').value = note.title;
      $('#noteContent').value = note.content;
      $('#noteFormHeading').textContent = 'Edit short note';
      $('#saveNoteBtn').textContent = 'Update note';
      $('#cancelNoteEdit').classList.remove('hidden');
      $('#noteTitle').focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) { showToast(error.message, true); }
  }
  if (button.dataset.action === 'delete-note' && window.confirm('Delete this note?')) {
    try {
      await api(`/api/notes/${encodeURIComponent(id)}`, { method: 'DELETE' });
      showToast('Note deleted.');
      await loadNotes();
    } catch (error) { showToast(error.message, true); }
  }
}

// Navigation and dashboard controls.
document.querySelectorAll('.nav-tab').forEach((button) => button.addEventListener('click', () => setActiveTab(button.dataset.tab)));
$('#dashboardDate').value = todayIST();
$('#dashboardDate').addEventListener('change', loadDashboard);
$('#logoutBtn').addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST' }); } finally { window.location.href = '/login'; }
});

// Customer controls.
$('#addCustomerBtn').addEventListener('click', () => openCustomerForm());
$('#customersTable').addEventListener('click', onCustomerAction);
$('#scheduledTable').addEventListener('click', onCustomerAction);
$('#customerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = $('#customerId').value;
  const payload = {
    name: $('#customerName').value.trim(),
    mobile: $('#customerMobile').value.trim(),
    location: $('#customerLocation').value.trim(),
    repaymentCategory: $('#customerCategory').value,
    groupName: $('#customerGroup').value.trim(),
    status: $('#customerStatus').value
  };
  try {
    await api(id ? `/api/customers/${encodeURIComponent(id)}` : '/api/customers', {
      method: id ? 'PUT' : 'POST', body: JSON.stringify(payload)
    });
    hideModal('customerModal');
    showToast(id ? 'Customer updated.' : 'Customer added.');
    await Promise.all([loadCustomers(), loadDashboard(), loadGroups()]);
  } catch (error) { showToast(error.message, true); }
});

$('#followupForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = $('#followupCustomerId').value;
  const payload = {
    outcome: $('#followupOutcome').value,
    remark: $('#followupRemark').value.trim(),
    nextFollowUpAt: $('#followupOutcome').value === 'Recovered' ? null : fromISTDateTimeInput($('#nextFollowUpAt').value)
  };
  try {
    await api(`/api/customers/${encodeURIComponent(id)}/followups`, { method: 'POST', body: JSON.stringify(payload) });
    hideModal('followupModal');
    showToast('Follow-up saved and latest remark updated.');
    await Promise.all([loadCustomers(), loadDashboard()]);
  } catch (error) { showToast(error.message, true); }
});

let searchTimer;
$('#searchFilter').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadCustomers, 260);
});
['groupFilter', 'categoryFilter', 'statusFilter', 'dueDateFilter'].forEach((id) => $(`#${id}`).addEventListener('change', loadCustomers));
$('#clearFiltersBtn').addEventListener('click', () => {
  $('#searchFilter').value = '';
  $('#groupFilter').value = '';
  $('#categoryFilter').value = '';
  $('#statusFilter').value = '';
  $('#dueDateFilter').value = '';
  loadCustomers();
});

// Dated notes.
$('#noteDate').value = todayIST();
$('#notesDateFilter').value = '';
$('#noteForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = $('#noteId').value;
  const payload = { noteDate: $('#noteDate').value, title: $('#noteTitle').value.trim(), content: $('#noteContent').value.trim() };
  try {
    await api(id ? `/api/notes/${encodeURIComponent(id)}` : '/api/notes', {
      method: id ? 'PUT' : 'POST', body: JSON.stringify(payload)
    });
    showToast(id ? 'Note updated.' : 'Note saved.');
    resetNoteForm();
    await loadNotes();
  } catch (error) { showToast(error.message, true); }
});
$('#notesList').addEventListener('click', onNoteAction);
$('#notesDateFilter').addEventListener('change', loadNotes);
let noteSearchTimer;
$('#notesSearch').addEventListener('input', () => {
  clearTimeout(noteSearchTimer);
  noteSearchTimer = setTimeout(loadNotes, 260);
});
$('#clearNotesFilter').addEventListener('click', () => {
  $('#notesDateFilter').value = '';
  $('#notesSearch').value = '';
  loadNotes();
});
$('#cancelNoteEdit').addEventListener('click', resetNoteForm);

// Close modals from close buttons, backdrops, or Escape.
document.querySelectorAll('[data-close]').forEach((element) => element.addEventListener('click', () => hideModal(element.dataset.close)));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') document.querySelectorAll('.modal:not(.hidden)').forEach((modal) => modal.classList.add('hidden'));
});

// First render.
loadDashboard();
