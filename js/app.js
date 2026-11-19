// Histologia em Cena — comportamento das páginas (sem dependências)
(function () {
  document.documentElement.classList.add('js');

  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const ler = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // ---- Menu no celular ----
  const menuBtn = document.querySelector('.menu-btn');
  const nav = document.querySelector('.nav');
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', () => {
      const aberto = nav.classList.toggle('aberto');
      menuBtn.setAttribute('aria-expanded', aberto);
    });
  }

  // ---- Acervo: filtros e busca ----
  // Publicações: filtro por tipo
  const pubs = [...document.querySelectorAll('.pub')];
  if (pubs.length) {
    const chipsP = [...document.querySelectorAll('.chip')];
    chipsP.forEach((ch) => ch.addEventListener('click', () => {
      chipsP.forEach((o) => o.setAttribute('aria-pressed', o === ch));
      pubs.forEach((p) => { p.hidden = !(ch.dataset.grupo === 'todos' || p.dataset.grupo === ch.dataset.grupo); });
    }));
  }

  const grade = document.querySelector('.grade-laminas');
  if (grade) {
    const cartoes = [...grade.querySelectorAll('.cartao')];
    const titulos = [...grade.querySelectorAll('.grupo-titulo')];
    const chips = [...document.querySelectorAll('.chip')];
    const campo = document.querySelector('#busca');
    const nada = grade.querySelector('.nada');
    let grupo = 'todos';

    const aplicar = () => {
      const termo = semAcento((campo && campo.value) || '').trim();
      let visiveis = 0;
      const porGrupo = {};
      cartoes.forEach((c) => {
        const ok = (grupo === 'todos' || c.dataset.grupo === grupo) && (!termo || c.dataset.busca.includes(termo));
        c.hidden = !ok;
        if (ok) { visiveis++; porGrupo[c.dataset.grupo] = true; }
      });
      titulos.forEach((t) => { t.hidden = !porGrupo[t.dataset.grupo]; });
      if (nada) nada.hidden = visiveis > 0;
    };
    chips.forEach((ch) => ch.addEventListener('click', () => {
      grupo = ch.dataset.grupo;
      chips.forEach((o) => o.setAttribute('aria-pressed', o === ch));
      aplicar();
    }));
    if (campo) campo.addEventListener('input', aplicar);
  }

  // ---- Lâmina: troca de imagem, siglas e zoom ----
  const cenas = [...document.querySelectorAll('.cena')];
  if (!cenas.length) return;
  const minis = [...document.querySelectorAll('.miniaturas button')];
  let atual = 0;

  const mostrar = (i, foco) => {
    atual = (i + cenas.length) % cenas.length;
    cenas.forEach((c, k) => c.classList.toggle('ativa', k === atual));
    minis.forEach((m, k) => m.setAttribute('aria-current', k === atual));
    history.replaceState(null, '', '#imagem-' + (atual + 1));
    if (foco && minis[atual]) minis[atual].focus();
  };
  minis.forEach((m, k) => m.addEventListener('click', () => mostrar(k)));
  const inicial = parseInt((location.hash.match(/imagem-(\d+)/) || [])[1], 10);
  mostrar(Number.isFinite(inicial) ? inicial - 1 : 0);

  // Siglas sobre a imagem (lembra a escolha do visitante)
  const botoesSiglas = [...document.querySelectorAll('[data-alternar-siglas]')];
  const definirSiglas = (on) => {
    document.body.classList.toggle('sem-siglas', !on);
    botoesSiglas.forEach((b) => b.setAttribute('aria-pressed', on));
    guardar('hec-siglas', on ? '1' : '0');
  };
  definirSiglas(ler('hec-siglas') !== '0');
  botoesSiglas.forEach((b) => b.addEventListener('click', () => definirSiglas(b.getAttribute('aria-pressed') !== 'true')));

  // Visualizador ampliado com arrastar e zoom (roda do mouse ou pinça)
  const dlg = document.querySelector('dialog.zoom');
  if (!dlg) return;
  const area = dlg.querySelector('.area');
  const cont = dlg.querySelector('.conteudo');
  const rotulo = dlg.querySelector('.rotulo');
  let esc = 1, tx = 0, ty = 0, base = 1;
  const pontos = new Map();
  let pinca = null;

  const desenhar = () => { cont.style.transform = `translate(${tx}px, ${ty}px) scale(${esc})`; };
  const ajustar = () => {
    const W = area.clientWidth, H = area.clientHeight;
    const w = cont.offsetWidth, h = cont.offsetHeight;
    base = Math.min(W / w, H / h);
    esc = base; tx = (W - w * esc) / 2; ty = (H - h * esc) / 2; desenhar();
  };
  const zoomEm = (fator, cx, cy) => {
    const novo = Math.min(Math.max(esc * fator, base * 0.8), base * 8);
    const f = novo / esc;
    tx = cx - (cx - tx) * f; ty = cy - (cy - ty) * f; esc = novo; desenhar();
  };

  const abrir = () => {
    const fig = cenas[atual];
    const img = fig.querySelector('img');
    const svg = fig.querySelector('svg.marcas');
    cont.innerHTML = '';
    const grande = new Image();
    grande.src = img.dataset.grande || img.currentSrc || img.src;
    grande.alt = img.alt;
    grande.draggable = false;
    cont.style.width = Math.max(img.naturalWidth, 1600) + 'px';
    cont.appendChild(grande);
    if (svg) cont.appendChild(svg.cloneNode(true));
    rotulo.textContent = fig.dataset.rotulo || '';
    dlg.showModal();
    if (grande.complete) ajustar(); else grande.onload = ajustar;
    requestAnimationFrame(ajustar);
  };
  cenas.forEach((c) => {
    const q = c.querySelector('.quadro');
    q.addEventListener('click', abrir);
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } });
  });
  dlg.querySelector('[data-fechar]').addEventListener('click', () => dlg.close());
  dlg.querySelector('[data-mais]').addEventListener('click', () => zoomEm(1.4, area.clientWidth / 2, area.clientHeight / 2));
  dlg.querySelector('[data-menos]').addEventListener('click', () => zoomEm(1 / 1.4, area.clientWidth / 2, area.clientHeight / 2));
  window.addEventListener('resize', () => { if (dlg.open) ajustar(); });

  area.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = area.getBoundingClientRect();
    zoomEm(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  area.addEventListener('dblclick', (e) => { const r = area.getBoundingClientRect(); zoomEm(2, e.clientX - r.left, e.clientY - r.top); });

  area.addEventListener('pointerdown', (e) => {
    area.setPointerCapture(e.pointerId);
    pontos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    area.classList.add('arrastando');
    if (pontos.size === 2) {
      const [a, b] = [...pontos.values()];
      pinca = { d: Math.hypot(a.x - b.x, a.y - b.y) };
    }
  });
  area.addEventListener('pointermove', (e) => {
    if (!pontos.has(e.pointerId)) return;
    const ant = pontos.get(e.pointerId);
    pontos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pontos.size === 2 && pinca) {
      const [a, b] = [...pontos.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const r = area.getBoundingClientRect();
      zoomEm(d / pinca.d, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      pinca.d = d;
    } else if (pontos.size === 1) {
      tx += e.clientX - ant.x; ty += e.clientY - ant.y; desenhar();
    }
  });
  const soltar = (e) => { pontos.delete(e.pointerId); if (pontos.size < 2) pinca = null; if (!pontos.size) area.classList.remove('arrastando'); };
  area.addEventListener('pointerup', soltar);
  area.addEventListener('pointercancel', soltar);

  document.addEventListener('keydown', (e) => {
    if (dlg.open) return;
    if (e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight') mostrar(atual + 1, true);
    if (e.key === 'ArrowLeft') mostrar(atual - 1, true);
  });
})();
