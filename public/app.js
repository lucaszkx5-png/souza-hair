(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const API = '/api/app';
  const TZ = 'America/Recife';
  const state = {
    cfg: null,
    services: [],
    selectedServices: new Set(),
    date: '',
    time: '',
    reserved: new Set(),
    slots: [],
    loading: true
  };

  const fallbackPhoto = 'linear-gradient(145deg,#ead6cf,#cfa79f)';
  const photoLayer = (path, overlay) => {
    const safe = typeof path === 'string' && (/^\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp)$/i.test(path) || /^\/api\/app\?r=photo&pathname=photos%2F[A-Za-z0-9._-]+$/i.test(path));
    return safe ? overlay + ',url("' + path + '")' : fallbackPhoto;
  };

  function dateKey(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value || '';
    return get('year') + '-' + get('month') + '-' + get('day');
  }

  function dateFromKey(key) {
    const p = key.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2], 12, 0, 0);
  }

  function minutes(value) {
    const p = String(value || '').split(':').map(Number);
    return p.length === 2 && p.every(Number.isFinite) ? p[0] * 60 + p[1] : 0;
  }

  function timeLabel(value) {
    return String(value || '');
  }

  async function getJson(url, options) {
    const response = await fetch(url, options);
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(data.e || 'Não foi possível concluir a solicitação.');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function setPhoto(el, path, overlay) {
    if (!el) return;
    el.style.setProperty('--ph', photoLayer(path, overlay || 'linear-gradient(to top,rgba(45,25,25,.12),transparent 60%)'));
  }

  function renderServices() {
    const host = $('svc');
    const cards = $('svl');
    if (!host || !cards) return;
    host.replaceChildren();
    cards.replaceChildren();

    state.services.forEach((service) => {
      const id = String(service.id || '');
      if (!id) return;

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'cp';
      chip.setAttribute('aria-pressed', state.selectedServices.has(id) ? 'true' : 'false');
      chip.append(document.createTextNode(service.name || 'Serviço'));
      chip.addEventListener('click', () => {
        if (state.selectedServices.has(id)) state.selectedServices.delete(id);
        else state.selectedServices.add(id);
        chip.setAttribute('aria-pressed', state.selectedServices.has(id) ? 'true' : 'false');
        updateSummary();
      });
      host.append(chip);

      const card = document.createElement('article');
      card.className = 'sv';
      setPhoto(card, service.photo, 'linear-gradient(to top,rgba(45,25,25,.78),transparent 65%)');
      const title = document.createElement('h3');
      title.textContent = service.name || 'Serviço';
      const description = document.createElement('p');
      description.textContent = service.desc || '';
      card.append(title, description);
      cards.append(card);
    });

    if ($('ns')) $('ns').textContent = String(state.services.length || 0);
  }

  function renderGallery() {
    const host = $('gal');
    if (!host) return;
    host.replaceChildren();
    (state.cfg.gallery || []).forEach((item, index) => {
      const card = document.createElement('div');
      if (index === 0 || index === 3) card.classList.add('t');
      if (index === 2) card.classList.add('wd');
      setPhoto(card, item.photo, 'linear-gradient(to top,rgba(45,25,25,.55),transparent 55%)');
      card.textContent = item.label || 'Roberto Souza Hair';
      host.append(card);
    });
  }

  function renderBrand() {
    const cfg = state.cfg || {};
    if ($('nm')) $('nm').textContent = cfg.name || 'Roberto Souza Hair';
    setPhoto($('hp'), cfg.hero, 'linear-gradient(145deg,rgba(168,100,95,.08),rgba(60,35,35,.12))');
    setPhoto($('vis'), cfg.about, 'linear-gradient(145deg,rgba(168,100,95,.08),rgba(60,35,35,.12))');

    if ($('addr')) {
      $('addr').textContent = cfg.address || '';
      $('addr').style.display = cfg.address ? '' : 'none';
    }
    if ($('dir')) {
      $('dir').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(cfg.address || 'Roberto Souza Hair, Paudalho, PE');
    }
    if ($('ft')) {
      $('ft').textContent = (cfg.name || 'Roberto Souza Hair') + ' · Atendimento com hora marcada';
    }
  }

  function dayHours(key) {
    const cfg = state.cfg || {};
    if ((cfg.blocked || []).includes(key)) return null;
    const date = dateFromKey(key);
    const weekday = date.getDay();
    const hours = Array.isArray(cfg.week) ? cfg.week[weekday] : null;
    return hours && hours.open ? hours : null;
  }

  function timesForDay(key) {
    const hours = dayHours(key);
    if (!hours) return [];
    const step = Number(state.cfg.step) === 60 ? 60 : 30;
    const result = [];
    [[hours.m1, hours.m2], [hours.t1, hours.t2]].forEach(([start, end]) => {
      if (!start || !end || minutes(end) <= minutes(start)) return;
      for (let m = minutes(start); m + step <= minutes(end); m += step) {
        result.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
      }
    });
    if (key === dateKey(new Date())) {
      const nowParts = new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(new Date());
      const now = minutes(nowParts.find(p => p.type === 'hour')?.value + ':' + nowParts.find(p => p.type === 'minute')?.value);
      return result.filter(t => minutes(t) > now);
    }
    return result;
  }

  function renderDays() {
    const host = $('days');
    if (!host) return;
    host.replaceChildren();
    const today = dateKey(new Date());
    let count = 0;
    for (let offset = 0; offset < 45 && count < 24; offset++) {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      const key = dateKey(date);
      if (!dayHours(key) || !timesForDay(key).some(t => !state.reserved.has(key + '_' + t.replace(':', '')))) continue;
      count++;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'day';
      button.setAttribute('aria-pressed', state.date === key ? 'true' : 'false');
      const day = document.createElement('span');
      day.textContent = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'short' }).format(date).replace('.', '');
      const number = document.createElement('b');
      number.textContent = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit' }).format(date);
      const month = document.createElement('span');
      month.textContent = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, month: 'short' }).format(date).replace('.', '');
      button.append(day, number, month);
      button.addEventListener('click', () => {
        state.date = key;
        state.time = '';
        renderDays();
        renderSlots();
        updateSummary();
      });
      host.append(button);
    }
    if (!count) {
      const note = document.createElement('p');
      note.className = 'pd';
      note.textContent = 'Não há datas disponíveis nos próximos dias. Tente novamente mais tarde.';
      host.append(note);
    }
    if (state.date && (state.date < today || !dayHours(state.date))) state.date = '';
  }

  function renderSlots() {
    const host = $('slots');
    if (!host) return;
    host.replaceChildren();
    const date = state.date;
    if ($('dl')) {
      $('dl').textContent = date
        ? dateFromKey(date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
        : 'Escolha um dia primeiro';
    }
    if (!date) {
      const note = document.createElement('p');
      note.className = 'pd';
      note.textContent = 'Selecione uma data para ver os horários.';
      host.append(note);
      return;
    }
    const available = timesForDay(date);
    const open = available.filter(t => !state.reserved.has(date + '_' + t.replace(':', '')));
    if (!available.length) {
      const note = document.createElement('p');
      note.className = 'pd';
      note.textContent = 'Não há horários disponíveis nesta data.';
      host.append(note);
      return;
    }
    available.forEach((time) => {
      const taken = state.reserved.has(date + '_' + time.replace(':', ''));
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'slot' + (taken ? ' tk' : '');
      button.textContent = timeLabel(time);
      button.disabled = taken;
      button.setAttribute('aria-pressed', state.time === time ? 'true' : 'false');
      button.addEventListener('click', () => {
        state.time = time;
        renderSlots();
        updateSummary();
      });
      host.append(button);
    });
    if (!open.length) {
      const note = document.createElement('p');
      note.className = 'pd';
      note.textContent = 'Todos os horários deste dia já foram ocupados. Escolha outra data.';
      host.append(note);
    }
  }

  function updateSummary() {
    const chosen = state.services.filter(s => state.selectedServices.has(String(s.id)));
    const sum = $('sum');
    const go = $('go');
    if (sum) {
      if (!chosen.length || !state.date || !state.time) {
        sum.textContent = 'Selecione serviço, dia e horário.';
      } else {
        sum.replaceChildren();
        const b = document.createElement('b');
        b.textContent = chosen.map(s => s.name).join(' + ');
        const detail = document.createElement('span');
        detail.textContent = ' · ' + dateFromKey(state.date).toLocaleDateString('pt-BR') + ' às ' + state.time;
        sum.append(b, detail);
      }
    }
    if (go) go.disabled = state.loading || !chosen.length || !state.date || !state.time;
  }

  async function refreshReserved() {
    try {
      const values = await getJson(API + '?r=slots');
      state.reserved = new Set(Array.isArray(values) ? values : []);
    } catch (_) {
      state.reserved = new Set();
    }
  }

  async function submitBooking() {
    const button = $('go');
    const status = $('ok');
    const name = ($('n')?.value || '').trim();
    const phone = ($('t')?.value || '').trim();
    const services = state.services.filter(s => state.selectedServices.has(String(s.id))).map(s => s.id);
    if (!services.length || !state.date || !state.time) {
      if (status) status.textContent = 'Escolha o serviço, o dia e o horário.';
      return;
    }
    if (name.length < 2) {
      if (status) status.textContent = 'Digite seu nome completo.';
      $('n')?.focus();
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      if (status) status.textContent = 'Digite um telefone com DDD válido.';
      $('t')?.focus();
      return;
    }

    button.disabled = true;
    button.textContent = 'Confirmando…';
    if (status) status.textContent = '';
    try {
      await getJson(API + '?r=book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, services, date: state.date, time: state.time })
      });
      if (status) {
        status.textContent = 'Agendamento confirmado! Se precisar, entre em contato pelo WhatsApp.';
      }
      state.selectedServices.clear();
      state.time = '';
      if ($('n')) $('n').value = '';
      if ($('t')) $('t').value = '';
      await refreshReserved();
      renderServices();
      renderDays();
      renderSlots();
      updateSummary();
    } catch (error) {
      if (error.status === 409 || error.message === 'taken') {
        if (status) status.textContent = 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro horário.';
      } else if (error.message === 'horario') {
        if (status) status.textContent = 'Esse horário não está mais disponível. Atualize a escolha e tente novamente.';
      } else {
        if (status) status.textContent = 'Não foi possível confirmar agora. Confira sua conexão e tente novamente.';
      }
      await refreshReserved();
      renderDays();
      renderSlots();
    } finally {
      button.textContent = 'Confirmar agendamento';
      updateSummary();
    }
  }

  async function init() {
    const fab = $('fab');
    if (fab && 'IntersectionObserver' in window && $('agendar')) {
      const observer = new IntersectionObserver((entries) => {
        fab.classList.toggle('off', entries.some(entry => entry.isIntersecting));
      }, { threshold: 0.08 });
      observer.observe($('agendar'));
    }

    if ($('go')) $('go').addEventListener('click', submitBooking);
    try {
      state.cfg = await getJson(API + '?r=config');
      state.services = Array.isArray(state.cfg.services) ? state.cfg.services : [];
      renderBrand();
      renderServices();
      renderGallery();
      await refreshReserved();
      renderDays();
      renderSlots();
    } catch (_) {
      const status = $('ok');
      if (status) status.textContent = 'O sistema de agendamento está temporariamente indisponível. Tente novamente mais tarde.';
      if ($('svc')) $('svc').textContent = 'Não foi possível carregar os serviços.';
    } finally {
      state.loading = false;
      updateSummary();
    }
  }

  init();
})();