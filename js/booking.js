(function () {
  'use strict';
  const S = window.Store;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initial = (n) => n.charAt(0).toUpperCase();

  /* ---------- conteúdo das seções ---------- */
  $('#menu').innerHTML = S.SERVICES.map((s) => `
    <div class="menu-item reveal">
      <div class="menu-row"><h3>${s.name}</h3><span class="dots"></span><span class="price">${S.fmtMoney(s.price)}</span></div>
      <p>${s.desc}</p>
      <small>${s.duration} min</small>
    </div>`).join('');

  $('#team').innerHTML = S.BARBERS.map((b) => `
    <article class="barber-card reveal">
      <div class="avatar">${initial(b.name)}</div>
      <h3>${b.name}</h3>
      <p>${b.role}</p>
    </article>`).join('');

  $('#year').textContent = new Date().getFullYear();

  /* ---------- nav + animações ---------- */
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    $$('.reveal').forEach((el) => io.observe(el));
  } else {
    $$('.reveal').forEach((el) => el.classList.add('in'));
  }

  /* ---------- fluxo de agendamento ---------- */
  const state = { step: 1, serviceId: null, barberId: null, date: null, time: null };
  const panels = $$('.step-panel');
  const tabs = $$('.step-tab');

  function go(step) {
    state.step = step;
    panels.forEach((p) => p.classList.toggle('active', Number(p.dataset.step) === step));
    tabs.forEach((t) => {
      const n = Number(t.dataset.tab);
      t.classList.toggle('active', n === step);
      t.classList.toggle('done', n < step);
    });
    if (step === 3) renderDays();
    if (step === 4) renderSummary($('#summary'));
    const top = $('#booking').getBoundingClientRect().top + window.scrollY - 90;
    if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
  }

  function updateNext() {
    const panel = panels.find((p) => Number(p.dataset.step) === state.step);
    const btn = panel && $('[data-next]', panel);
    if (!btn) return;
    const ok = { 1: state.serviceId, 2: state.barberId, 3: state.date && state.time }[state.step];
    btn.disabled = !ok;
  }

  $$('[data-next]').forEach((b) => b.addEventListener('click', () => { go(state.step + 1); updateNext(); }));
  $$('[data-prev]').forEach((b) => b.addEventListener('click', () => { go(state.step - 1); updateNext(); }));

  // Passo 1 — serviços
  const svcBox = $('#svc-choices');
  svcBox.innerHTML = S.SERVICES.map((s) => `
    <button type="button" class="choice" data-id="${s.id}">
      <strong>${s.name}</strong>
      <span class="meta"><span>${s.duration} min</span><b>${S.fmtMoney(s.price)}</b></span>
    </button>`).join('');
  svcBox.addEventListener('click', (e) => {
    const c = e.target.closest('.choice');
    if (!c) return;
    state.serviceId = c.dataset.id;
    state.time = null; // a duração pode mudar os horários livres
    $$('.choice', svcBox).forEach((x) => x.classList.toggle('selected', x === c));
    updateNext();
  });

  // Passo 2 — barbeiros
  const barberBox = $('#barber-choices');
  barberBox.innerHTML = S.BARBERS.map((b) => `
    <button type="button" class="choice choice--barber" data-id="${b.id}">
      <span class="avatar">${initial(b.name)}</span>
      <span><strong>${b.name}</strong><br><small>${b.role}</small></span>
    </button>`).join('');
  barberBox.addEventListener('click', (e) => {
    const c = e.target.closest('.choice');
    if (!c) return;
    state.barberId = c.dataset.id;
    state.time = null;
    $$('.choice', barberBox).forEach((x) => x.classList.toggle('selected', x === c));
    updateNext();
  });

  // Passo 3 — dias e horários
  function renderDays() {
    const box = $('#days');
    const days = [];
    for (let i = 0; i < 14; i++) days.push(S.addDays(S.today(), i));
    if (!state.date || !S.isOpen(state.date)) state.date = S.nextOpenDay();
    box.innerHTML = days.map((d) => {
      const dt = S.fromISO(d);
      const wd = dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      const mo = dt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      return `<button type="button" class="day${d === state.date ? ' selected' : ''}" data-date="${d}" ${S.isOpen(d) ? '' : 'disabled'}>
        <small>${wd}</small><b>${dt.getDate()}</b><small>${mo}</small></button>`;
    }).join('');
    renderSlots();
  }

  $('#days').addEventListener('click', (e) => {
    const d = e.target.closest('.day');
    if (!d || d.disabled) return;
    state.date = d.dataset.date;
    state.time = null;
    $$('.day', $('#days')).forEach((x) => x.classList.toggle('selected', x === d));
    renderSlots();
    updateNext();
  });

  function renderSlots() {
    const box = $('#slots');
    const svc = S.getService(state.serviceId);
    const list = S.slots(state.date, state.barberId, svc.duration);
    if (!list.some((s) => s.available)) {
      box.innerHTML = '<p class="empty">Nenhum horário livre neste dia. Que tal escolher outra data?</p>';
      return;
    }
    box.innerHTML = list.map((s) =>
      `<button type="button" class="slot${s.time === state.time ? ' selected' : ''}" data-time="${s.time}" ${s.available ? '' : 'disabled'}>${s.time}</button>`
    ).join('');
  }

  $('#slots').addEventListener('click', (e) => {
    const s = e.target.closest('.slot');
    if (!s || s.disabled) return;
    state.time = s.dataset.time;
    $$('.slot', $('#slots')).forEach((x) => x.classList.toggle('selected', x === s));
    updateNext();
  });

  // Passo 4 — resumo e confirmação
  function renderSummary(el, extra) {
    const svc = S.getService(state.serviceId);
    const b = S.getBarber(state.barberId);
    el.innerHTML = `
      ${extra || ''}
      <div><span>Serviço</span><strong>${svc.name}</strong></div>
      <div><span>Barbeiro</span><strong>${b.name}</strong></div>
      <div><span>Data</span><strong style="text-transform:capitalize">${S.fmtDate(state.date)}</strong></div>
      <div><span>Horário</span><strong>${state.time}</strong></div>
      <div class="total"><span>Total</span><b>${S.fmtMoney(svc.price)}</b></div>`;
  }

  // máscara simples de telefone
  $('#c-phone').addEventListener('input', (e) => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 11);
    let out = d;
    if (d.length > 2) out = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 7) out = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
    e.target.value = out;
  });

  $('#confirm-btn').addEventListener('click', () => {
    const err = $('#book-error');
    const name = $('#c-name').value.trim();
    const phone = $('#c-phone').value.trim();
    err.textContent = '';
    if (name.length < 3) { err.textContent = 'Informe seu nome completo.'; $('#c-name').focus(); return; }
    if (phone.replace(/\D/g, '').length < 10) { err.textContent = 'Informe um WhatsApp válido com DDD.'; $('#c-phone').focus(); return; }
    try {
      const appt = S.save({ serviceId: state.serviceId, barberId: state.barberId, date: state.date, time: state.time, name, phone });
      $('#confirm-code').textContent = appt.code;
      renderSummary($('#confirm-summary'), `<div><span>Cliente</span><strong>${esc(name)}</strong></div>`);
      go(5);
    } catch (ex) {
      err.textContent = ex.message + ' Escolha outro horário.';
    }
  });

  $('#new-booking').addEventListener('click', () => {
    Object.assign(state, { serviceId: null, barberId: null, date: null, time: null });
    $$('.choice').forEach((x) => x.classList.remove('selected'));
    $('#client-form').reset();
    go(1);
    updateNext();
  });
})();
