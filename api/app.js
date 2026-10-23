const { put, list, del, get } = require('@vercel/blob');

const TZ = 'America/Recife';

// Configuração padrão (usada até o Roberto salvar algo no painel)
const SERVICES = [
  ['Corte', 'Sob medida para o seu rosto', '/img/p5.jpg'],
  ['Coloração', 'Cor, mechas e retoques', '/img/p1.jpg'],
  ['Progressiva', 'Fios alinhados e com brilho', '/img/p7.jpg'],
  ['Botox capilar', 'Brilho e menos frizz', '/img/p6.jpg'],
  ['Maquiagem', 'Social, festa e noiva', '/img/p2.jpg'],
  ['Penteado', 'Coques, tranças e eventos', '/img/p4.jpg'],
  ['Design de sobrancelha', 'Formato que valoriza o olhar', '/img/p3.jpg'],
  ['Sobrancelha com henna', 'Design com preenchimento', '/img/p3.jpg'],
];
const GALLERY = [
  ['Coloração', '/img/p1.jpg'], ['Corte', '/img/p5.jpg'], ['Luzes', '/img/p6.jpg'],
  ['Penteado', '/img/p4.jpg'], ['Progressiva', '/img/p7.jpg'],
  ['Maquiagem', '/img/p2.jpg'], ['Sobrancelha', '/img/p3.jpg'],
];
const DEF = {
  name: 'Roberto Souza Hair',
  whatsapp: '558191205500',
  address: 'Rua 8 de Março, Estr. Chã do Pinheiro, Paudalho - PE, 55825-000',
  step: 30,
  // 0 = domingo ... 6 = sábado
  week: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ open: d > 1, m1: '07:30', m2: '11:00', t1: '13:30', t2: '18:00' })),
  blocked: [],
  hero: '/img/p8.jpg',
  about: '/img/p7.jpg',
  services: SERVICES.map((s, i) => ({ id: 's' + (i + 1), name: s[0], desc: s[1], photo: s[2] })),
  gallery: GALLERY.map((g) => ({ label: g[0], photo: g[1] })),
};

const mins = (t) => { const a = t.split(':'); return +a[0] * 60 + +a[1]; };
const fmt = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

// Gera os horários livres de um dia a partir da configuração
function times(c, date) {
  const p = date.split('-').map(Number);
  const w = c.week[new Date(p[0], p[1] - 1, p[2]).getDay()];
  if (!w || !w.open || c.blocked.includes(date)) return [];
  const out = [];
  const st = +c.step || 30;
  [[w.m1, w.m2], [w.t1, w.t2]].forEach((r) => {
    if (!r[0] || !r[1]) return;
    for (let x = mins(r[0]); x + st <= mins(r[1]); x += st) out.push(fmt(x));
  });
  return out;
}

async function listAll(prefix) {
  let cursor;
  let all = [];
  do {
    const r = await list({ prefix, cursor, limit: 1000, access: 'private' });
    all = all.concat(r.blobs);
    cursor = r.hasMore ? r.cursor : null;
  } while (cursor);
  return all;
}

async function getCfg() {
  try {
    const b = await get('config.json', { access: 'private' });
    if (!b || b.statusCode !== 200) return DEF;
    return Object.assign({}, DEF, JSON.parse(await new Response(b.stream).text()));
  } catch (e) {
    if (/not found|does not exist/i.test(String(e.message || e))) return DEF;
    throw e;
  }
}

// Só aceita campos conhecidos e limita tamanhos
function clean(b) {
  const s = (v, n) => String(v == null ? '' : v).slice(0, n);
  const hm = (v) => (/^[0-9]{2}:[0-9]{2}$/.test(v || '') ? v : '');
  return {
    name: s(b.name, 80),
    whatsapp: s(b.whatsapp, 20).replace(/[^0-9]/g, ''),
    address: s(b.address, 200),
    step: Number(b.step) === 60 ? 60 : 30,
    week: b.week && b.week.length === 7
      ? b.week.map((w) => ({ open: !!w.open, m1: hm(w.m1), m2: hm(w.m2), t1: hm(w.t1), t2: hm(w.t2) }))
      : DEF.week,
    blocked: (b.blocked || []).filter((d) => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d)).slice(0, 400),
    hero: s(b.hero, 500),
    about: s(b.about, 500),
    services: (b.services || []).slice(0, 30).map((x, i) => ({
      id: s(x.id || 's' + i, 30), name: s(x.name, 60), desc: s(x.desc, 100), photo: s(x.photo, 500),
    })),
    gallery: (b.gallery || []).slice(0, 20).map((x) => ({ label: s(x.label, 40), photo: s(x.photo, 500) })),
  };
}

const key = (req) => String(req.headers['x-key'] || req.query.k || '');
const isAdmin = (req) => !!key(req) && key(req) === process.env.ADMIN_KEY;
const isAgenda = (req) => !!key(req) && (key(req) === process.env.AGENDA_KEY || key(req) === process.env.ADMIN_KEY);

async function book(req, res) {
  const b = req.body || {};
  const c = await getCfg();
  const date = String(b.date || '');
  const time = String(b.time || '');
  const name = String(b.name || '').trim().slice(0, 80);
  const phone = String(b.phone || '').replace(/[^0-9+() -]/g, '').slice(0, 25);
  const ids = Array.isArray(b.services) ? b.services : [];
  const sv = c.services.filter((s) => ids.includes(s.id));

  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date) || !name || phone.replace(/[^0-9]/g, '').length < 10 || !sv.length) {
    return res.status(400).json({ e: 'dados' });
  }
  const now = new Date();
  const today = now.toLocaleDateString('en-CA', { timeZone: TZ });
  const hm = now.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
  if (date < today || (date === today && mins(time) <= mins(hm)) || !times(c, date).includes(time)) {
    return res.status(400).json({ e: 'horario' });
  }

  const id = date + '_' + time.replace(':', '');
  // Reserva atômica: se o arquivo já existe, o put falha e o horário já é de outra pessoa
  try {
    await put('slots/' + id + '.json', '{"t":1}', {
      access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json',
    });
  } catch (e) {
    if (/exist/i.test(String(e.message || ''))) return res.status(409).json({ e: 'taken' });
    throw e;
  }
  await put(
    'bookings/' + id + '.json',
    JSON.stringify({ id, date, time, name, phone, services: sv.map((s) => s.name), at: now.toISOString() }),
    { access: 'private', addRandomSuffix: true, contentType: 'application/json' }
  );
  return res.json({ ok: 1 });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const r = req.query.r;
  try {
    if (r === 'photo') {
      const pathname = String(req.query.pathname || '');
      if (!/^photos\\/[A-Za-z0-9._-]+$/.test(pathname)) return res.status(400).send('arquivo inválido');
      const blob = await get(pathname, { access: 'private' });
      if (!blob || blob.statusCode !== 200) return res.status(404).send('não encontrado');
      res.setHeader('Content-Type', blob.blob.contentType || 'application/octet-stream');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=300');
      const { Readable } = require('node:stream');
      return Readable.fromWeb(blob.stream).pipe(res);
    }

    if (r === 'config') return res.json(await getCfg());

    if (r === 'slots') {
      const a = await listAll('slots/');
      return res.json(a.map((b) => b.pathname.slice(6, -5)));
    }

    if (r === 'book' && req.method === 'POST') return await book(req, res);

    if (r === 'whoami') return res.json({ admin: isAdmin(req) });

    if (r === 'bookings') {
      if (!isAgenda(req)) return res.status(401).json({ e: 'auth' });
      const a = await listAll('bookings/');
      const rows = await Promise.all(a.map(async (b) => { try { const x = await get(b.pathname, { access: 'private' }); return x && x.statusCode === 200 ? JSON.parse(await new Response(x.stream).text()) : null; } catch (_) { return null; } }));
      return res.json(rows.filter(Boolean).sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time)));
    }

    if (r === 'cancel' && req.method === 'POST') {
      if (!isAgenda(req)) return res.status(401).json({ e: 'auth' });
      const id = String((req.body || {}).id || '').replace(/[^0-9_-]/g, '');
      if (id.length < 10) return res.status(400).json({ e: 'id' });
      const a = await listAll('bookings/' + id);
      const s = await listAll('slots/' + id + '.json');
      const urls = a.concat(s).map((b) => b.url);
      if (urls.length) await del(urls, { access: 'private' });
      return res.json({ ok: 1 });
    }

    if (r === 'save' && req.method === 'POST') {
      if (!isAdmin(req)) return res.status(401).json({ e: 'auth' });
      await put('config.json', JSON.stringify(clean(req.body || {})), {
        access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60,
      });
      return res.json({ ok: 1 });
    }

    if (r === 'upload' && req.method === 'POST') {
      if (!isAdmin(req)) return res.status(401).json({ e: 'auth' });
      const d = String((req.body || {}).data || '');
      const pre = 'data:image/jpeg;base64,';
      if (!d.startsWith(pre)) return res.status(400).json({ e: 'formato' });
      const buf = Buffer.from(d.slice(pre.length), 'base64');
      if (buf.length > 3500000) return res.status(413).json({ e: 'grande' });
      const p = await put('photos/foto.jpg', buf, { access: 'private', addRandomSuffix: true, contentType: 'image/jpeg' });
      return res.json({ url: '/api/app?r=photo&pathname=' + encodeURIComponent(p.pathname) });
    }

    return res.status(404).json({ e: 'rota' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ e: 'erro' });
  }
};
