/*
 * Camada de dados do protótipo.
 * Tudo é salvo no localStorage do navegador. Para ir para produção,
 * basta reimplementar as funções deste arquivo chamando uma API real.
 */
(function () {
  'use strict';

  const KEY = 'jamil.appointments.v1';

  const SERVICES = [
    { id: 'corte', name: 'Corte Clássico', desc: 'Tesoura e máquina, finalizado com pomada e navalha na nuca.', price: 60, duration: 30 },
    { id: 'barba', name: 'Barba Real', desc: 'Toalha quente, óleo pré-barba e navalha à moda antiga.', price: 45, duration: 30 },
    { id: 'combo', name: 'Corte & Barba', desc: 'O ritual completo do cavalheiro, com toalha quente.', price: 95, duration: 60 },
    { id: 'pigmentacao', name: 'Pigmentação', desc: 'Correção de falhas na barba ou cabelo com acabamento natural.', price: 50, duration: 30 },
    { id: 'toalha', name: 'Ritual da Toalha Quente', desc: 'Limpeza facial, toalhas aromáticas e massagem relaxante.', price: 40, duration: 30 },
  ];

  const BARBERS = [
    { id: 'jamil', name: 'Jamil', role: 'Mestre barbeiro & fundador' },
    { id: 'rafael', name: 'Rafael', role: 'Especialista em barbas' },
    { id: 'theo', name: 'Theo', role: 'Cortes clássicos & degradê' },
  ];

  // Expediente: 0 = domingo ... 6 = sábado
  const HOURS = {
    openDays: [2, 3, 4, 5, 6],
    start: 9 * 60,
    end: 19 * 60,
    slot: 30,
  };

  /* ---------- utilitários de data ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const toTime = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
  const addDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
  const today = () => toISO(new Date());

  const fmtDate = (iso, opts) => fromISO(iso).toLocaleDateString('pt-BR', opts || { weekday: 'long', day: '2-digit', month: 'long' });
  const fmtMoney = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const isOpen = (iso) => HOURS.openDays.includes(fromISO(iso).getDay());

  /* ---------- persistência ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* armazenamento indisponível */ }
    const seeded = seed();
    persist(seeded);
    return seeded;
  }

  function persist(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* ignora */ }
  }

  function genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c = '';
    for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
    return 'JM-' + c;
  }

  function seed() {
    // Gera alguns agendamentos nos próximos dias úteis para o painel não abrir vazio.
    const names = [
      ['Carlos Mendes', '(11) 98877-1020'], ['André Lopes', '(11) 97766-3344'],
      ['Bruno Teixeira', '(11) 99123-4567'], ['Marcos Vieira', '(11) 98444-2211'],
      ['Felipe Andrade', '(11) 99555-8080'], ['Gustavo Rocha', '(11) 97000-1212'],
    ];
    const plan = [
      ['corte', 'jamil', '10:00'], ['combo', 'rafael', '11:00'], ['barba', 'theo', '14:30'],
      ['corte', 'jamil', '15:00'], ['pigmentacao', 'rafael', '16:00'], ['toalha', 'theo', '17:30'],
    ];
    const out = [];
    let day = today();
    let found = 0;
    for (let i = 0; i < 10 && found < 2; i++, day = addDays(day, 1)) {
      if (!isOpen(day)) continue;
      plan.forEach((p, idx) => {
        if ((idx + found) % 2 === 0 || found === 0) {
          const n = names[(idx + found * 2) % names.length];
          out.push({
            id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
            code: genCode(), serviceId: p[0], barberId: p[1], date: day, time: p[2],
            name: n[0], phone: n[1], status: 'confirmado', createdAt: Date.now(),
          });
        }
      });
      found++;
    }
    return out;
  }

  /* ---------- API pública ---------- */
  const getService = (id) => SERVICES.find((s) => s.id === id);
  const getBarber = (id) => BARBERS.find((b) => b.id === id);

  function list(filter) {
    let items = load();
    if (filter) {
      if (filter.date) items = items.filter((a) => a.date === filter.date);
      if (filter.barberId) items = items.filter((a) => a.barberId === filter.barberId);
    }
    return items.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }

  /** Verifica se o intervalo está livre para o barbeiro (ignorando `excludeId`). */
  function isFree(date, time, barberId, duration, excludeId) {
    const s = toMin(time);
    const e = s + duration;
    if (s < HOURS.start || e > HOURS.end) return false;
    return !load().some((a) => {
      if (a.id === excludeId || a.status === 'cancelado') return false;
      if (a.date !== date || a.barberId !== barberId) return false;
      const as = toMin(a.time);
      const ae = as + (getService(a.serviceId)?.duration || HOURS.slot);
      return s < ae && as < e;
    });
  }

  /** Lista todos os horários do dia com indicação de disponibilidade. */
  function slots(date, barberId, duration, excludeId) {
    if (!isOpen(date)) return [];
    const now = new Date();
    const isToday = date === today();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const out = [];
    for (let m = HOURS.start; m + duration <= HOURS.end; m += HOURS.slot) {
      const time = toTime(m);
      const past = isToday && m <= nowMin;
      out.push({ time, available: !past && isFree(date, time, barberId, duration, excludeId) });
    }
    return out;
  }

  function save(appt) {
    const items = load();
    const service = getService(appt.serviceId);
    if (!service || !getBarber(appt.barberId)) throw new Error('Serviço ou barbeiro inválido.');
    if (!isOpen(appt.date)) throw new Error('A barbearia não abre neste dia.');
    if (appt.status !== 'cancelado' && !isFree(appt.date, appt.time, appt.barberId, service.duration, appt.id)) {
      throw new Error('Este horário já está ocupado para o barbeiro escolhido.');
    }
    if (appt.id) {
      const i = items.findIndex((a) => a.id === appt.id);
      if (i < 0) throw new Error('Agendamento não encontrado.');
      items[i] = { ...items[i], ...appt };
      persist(items);
      return items[i];
    }
    const created = {
      ...appt,
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      code: genCode(),
      status: appt.status || 'confirmado',
      createdAt: Date.now(),
    };
    items.push(created);
    persist(items);
    return created;
  }

  function remove(id) {
    persist(load().filter((a) => a.id !== id));
  }

  function setStatus(id, status) {
    const items = load();
    const a = items.find((x) => x.id === id);
    if (a) { a.status = status; persist(items); }
  }

  function reset() {
    persist(seed());
  }

  /** Próximo dia (a partir de hoje) em que a barbearia está aberta. */
  function nextOpenDay(from) {
    let d = from || today();
    for (let i = 0; i < 14; i++, d = addDays(d, 1)) if (isOpen(d)) return d;
    return d;
  }

  window.Store = {
    SERVICES, BARBERS, HOURS,
    getService, getBarber, list, slots, isFree, save, remove, setStatus, reset,
    isOpen, nextOpenDay, today, addDays, fmtDate, fmtMoney, fromISO, toISO,
  };
})();
