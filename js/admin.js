(function () {
  'use strict';
  const S = window.Store;
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ATENÇÃO: credenciais fixas apenas para o protótipo.
  // Na versão final a autenticação acontece no servidor (senha com hash + sessão/JWT).
  const DEMO_USER = 'admin';
  const DEMO_PASS = 'jamil123';
  const SESSION_KEY = 'jamil.admin.session';

  const view = { date: S.today(), barberId: '' };
  const STATUS_LABEL = { confirmado: 'Confirmado', concluido: 'Concluído', cancelado: 'Cancelado' };

  /* ---------- sessão ---------- */
  const isLogged = () => { try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return false; } };
  const setLogged = (v) => { try { v ? sessionStorage.setItem(SESSION_KEY, '1') : sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignora */ } };

  function showView() {
    const logged = isLogged();
    $('#login-view').hidden = logged;
    $('#panel-view').hidden = !logged;
    if (logged) render(); else $('#l-user').focus();
  }

  $('#login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if ($('#l-user').value.trim() === DEMO_USER && $('#l-pass').value === DEMO_PASS) {
      setLogged(true);
      $('#login-error').textContent = '';
      showView();
    } else {
      $('#login-error').textContent = 'Usuário ou senha incorretos.';
    }
  });

  $('#logout-btn').addEventListener('click', () => { setLogged(false); $('#login-form').reset(); showView(); });

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg, isError) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('error', !!isError);
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------- filtros ---------- */
  $('#barber-filter').innerHTML = '<option value="">Todos os barbeiros</option>' +
    S.BARBERS.map((b) => `<option value="${b.id}">${b.name}</option>`).join('');
  $('#barber-filter').addEventListener('change', (e) => { view.barberId = e.target.value; render(); });
  $('#date-input').addEventListener('change', (e) => { if (e.target.value) { view.date = e.target.value; render(); } });
  $('#prev-day').addEventListener('click', () => { view.date = S.addDays(view.date, -1); render(); });
  $('#next-day').addEventListener('click', () => { view.date = S.addDays(view.date, 1); render(); });
  $('#today-btn').addEventListener('click', () => { view.date = S.today(); render(); });

  /* ---------- agenda ---------- */
  function render() {
    const items = S.list({ date: view.date, barberId: view.barberId || undefined });
    const active = items.filter((a) => a.status !== 'cancelado');
    const revenue = active.reduce((sum, a) => sum + (S.getService(a.serviceId)?.price || 0), 0);
    const done = items.filter((a) => a.status === 'concluido').length;

    $('#date-input').value = view.date;
    $('#day-title').textContent = view.date === S.today() ? 'Hoje' :
      view.date === S.addDays(S.today(), 1) ? 'Amanhã' : S.fmtDate(view.date, { day: '2-digit', month: 'long' });
    $('#day-sub').textContent = S.fmtDate(view.date, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) +
      (S.isOpen(view.date) ? '' : ' · barbearia fechada');

    $('#kpis').innerHTML = `
      <div class="kpi"><span>Atendimentos</span><b>${active.length}</b></div>
      <div class="kpi"><span>Concluídos</span><b>${done}</b></div>
      <div class="kpi"><span>Faturamento previsto</span><b>${S.fmtMoney(revenue)}</b></div>`;

    const agenda = $('#agenda');
    if (!items.length) {
      agenda.innerHTML = `<div class="agenda-empty"><p>Nenhum cliente na cadeira por enquanto.</p>
        <button class="btn btn--ghost btn--sm" data-act="new">Criar agendamento</button></div>`;
      return;
    }
    agenda.innerHTML = items.map((a) => {
      const svc = S.getService(a.serviceId);
      const b = S.getBarber(a.barberId);
      return `
      <article class="appt is-${a.status}" data-id="${a.id}">
        <div class="appt-time">${a.time}<small>${svc?.duration || 30} min</small></div>
        <div class="appt-info">
          <strong>${esc(a.name)}</strong><span class="badge badge--${a.status}">${STATUS_LABEL[a.status]}</span>
          <div class="sub"><span>${svc?.name || '—'}</span><span>${b?.name || '—'}</span><span>${esc(a.phone || 'sem telefone')}</span><span>${a.code}</span></div>
        </div>
        <div class="appt-actions">
          ${a.status === 'confirmado' ? '<button class="icon-btn" data-act="done">✓ Concluir</button>' : ''}
          <button class="icon-btn" data-act="edit">Editar</button>
          ${a.status !== 'cancelado' ? '<button class="icon-btn danger" data-act="cancel">Cancelar</button>' : ''}
          <button class="icon-btn danger" data-act="delete" title="Excluir">Excluir</button>
        </div>
      </article>`;
    }).join('');
  }

  $('#agenda').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'new') return openModal();
    const id = btn.closest('.appt').dataset.id;
    if (act === 'edit') openModal(S.list().find((a) => a.id === id));
    if (act === 'done') { S.setStatus(id, 'concluido'); toast('Atendimento concluído.'); render(); }
    if (act === 'cancel' && confirm('Cancelar este agendamento? O horário ficará livre.')) {
      S.setStatus(id, 'cancelado'); toast('Agendamento cancelado.'); render();
    }
    if (act === 'delete' && confirm('Excluir definitivamente este agendamento?')) {
      S.remove(id); toast('Agendamento excluído.'); render();
    }
  });

  $('#new-btn').addEventListener('click', () => openModal());
  $('#reset-btn').addEventListener('click', () => {
    if (confirm('Apagar todos os agendamentos e restaurar os dados de demonstração?')) {
      S.reset(); view.date = S.today(); render(); toast('Dados de demonstração restaurados.');
    }
  });

  /* ---------- modal criar/editar ---------- */
  const form = $('#appt-form');
  const F = form.elements;
  const modal = $('#modal');
  F.serviceId.innerHTML = S.SERVICES.map((s) => `<option value="${s.id}">${s.name} — ${S.fmtMoney(s.price)}</option>`).join('');
  F.barberId.innerHTML = S.BARBERS.map((b) => `<option value="${b.id}">${b.name}</option>`).join('');

  function fillTimes(keep) {
    const svc = S.getService(F.serviceId.value);
    const date = F.date.value;
    const id = F.id.value || undefined;
    if (!date || !S.isOpen(date)) {
      F.time.innerHTML = '<option value="">Barbearia fechada neste dia</option>';
      return;
    }
    // No painel o barbeiro pode agendar inclusive horários que já passaram (encaixe/registro).
    const all = [];
    for (let m = S.HOURS.start; m + svc.duration <= S.HOURS.end; m += S.HOURS.slot) {
      const t = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      all.push({ time: t, free: S.isFree(date, t, F.barberId.value, svc.duration, id) });
    }
    F.time.innerHTML = all.map((s) =>
      `<option value="${s.time}" ${s.free ? '' : 'disabled'}>${s.time}${s.free ? '' : ' — ocupado'}</option>`).join('');
    const firstFree = all.find((s) => s.free);
    if (keep && all.some((s) => s.time === keep && s.free)) F.time.value = keep;
    else if (firstFree) F.time.value = firstFree.time;
    else F.time.innerHTML = '<option value="">Sem horários livres</option>';
  }

  ['serviceId', 'barberId', 'date'].forEach((n) => F[n].addEventListener('change', () => fillTimes(F.time.value)));

  function openModal(appt) {
    form.reset();
    $('#form-error').textContent = '';
    $('#modal-title').textContent = appt ? `Editar agendamento · ${appt.code}` : 'Novo agendamento';
    F.id.value = appt?.id || '';
    F.name.value = appt?.name || '';
    F.phone.value = appt?.phone || '';
    F.serviceId.value = appt?.serviceId || S.SERVICES[0].id;
    F.barberId.value = appt?.barberId || view.barberId || S.BARBERS[0].id;
    F.date.value = appt?.date || (S.isOpen(view.date) ? view.date : S.nextOpenDay(view.date));
    F.status.value = appt?.status || 'confirmado';
    fillTimes(appt?.time);
    modal.classList.add('open');
    setTimeout(() => F.name.focus(), 50);
  }

  const closeModal = () => modal.classList.remove('open');
  $('#cancel-modal').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const err = $('#form-error');
    err.textContent = '';
    const data = {
      id: F.id.value || undefined,
      name: F.name.value.trim(),
      phone: F.phone.value.trim(),
      serviceId: F.serviceId.value,
      barberId: F.barberId.value,
      date: F.date.value,
      time: F.time.value,
      status: F.status.value,
    };
    if (data.name.length < 2) { err.textContent = 'Informe o nome do cliente.'; return; }
    if (!data.time) { err.textContent = 'Escolha um horário disponível.'; return; }
    try {
      S.save(data);
      closeModal();
      view.date = data.date;
      render();
      toast(data.id ? 'Agendamento atualizado.' : 'Agendamento criado.');
    } catch (ex) {
      err.textContent = ex.message;
    }
  });

  showView();
})();
