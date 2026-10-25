// TakTek site behaviour. No dependencies; every feature checks for its own
// markup, and the page stays complete if this file never runs.
(() => {
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Remember the language a visitor picks, so the root URL opens in it next time.
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-lang]');
    if (!link) return;
    try { localStorage.setItem('tt-lang', link.dataset.lang); } catch (_) { /* storage blocked */ }
  });

  // Header gains a hairline once the page scrolls under it.
  const header = document.querySelector('[data-header]');
  if (header) {
    const sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;inset-block-start:0;block-size:1px;inline-size:1px';
    document.body.prepend(sentinel);
    new IntersectionObserver(([entry]) => header.classList.toggle('is-stuck', !entry.isIntersecting)).observe(sentinel);
  }

  // Mobile menu: a modal sheet. Focus moves in, is kept in, and returns on close.
  const menu = document.querySelector('[data-menu]');
  const opener = document.querySelector('[data-menu-open]');
  if (menu && opener) {
    const closer = menu.querySelector('[data-menu-close]');
    const focusables = () => [...menu.querySelectorAll('a[href], button:not([disabled])')];
    const open = () => {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
      opener.setAttribute('aria-expanded', 'true');
      root.style.overflow = 'hidden';
      closer.focus();
    };
    const close = () => {
      menu.classList.remove('is-open');
      menu.hidden = true;
      opener.setAttribute('aria-expanded', 'false');
      root.style.overflow = '';
      opener.focus();
    };
    opener.addEventListener('click', open);
    closer.addEventListener('click', close);
    menu.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') return close();
      if (event.key !== 'Tab') return;
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    menu.addEventListener('click', (event) => { if (event.target.closest('a[href^="#"]')) close(); });
    matchMedia('(min-width: 1080px)').addEventListener('change', (q) => { if (q.matches && !menu.hidden) close(); });
  }

  // The click loader runs once per session (decided in <head>); clear it once the curtain has opened.
  if (root.classList.contains('intro-on')) setTimeout(() => root.classList.remove('intro-on'), 1800);

  const canObserve = 'IntersectionObserver' in window && !reduceMotion;
  const onceInView = (els, fn, options = { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }) => {
    if (!canObserve) { els.forEach(fn); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      fn(entry.target);
      io.unobserve(entry.target);
    }), options);
    els.forEach((el) => io.observe(el));
  };

  // Sections ease in once, as they enter the viewport.
  const revealTargets = [...document.querySelectorAll(
    '.section-head > p, .section-lede, .practices, .feature-works, .work-rows, .steps, .portal-band, .work-entry, .rundown.full, .dv-split > *, .facts-list, .mini-works, .principles, .two-col > *'
  )];
  if (canObserve) revealTargets.forEach((el) => el.setAttribute('data-reveal', ''));
  onceInView(revealTargets, (el) => el.classList.add('is-in'));

  // Headlines arrive word by word. Whole words only, so Arabic letters stay joined.
  const headlines = [...document.querySelectorAll('.hero-title, .section-title, .page-title, .dv-title, .close-title, .sub-title')];
  if (canObserve) {
    headlines.forEach((heading) => {
      let i = 0;
      const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        const parts = node.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(part); return; }
          const word = document.createElement('span');
          word.className = 'w';
          word.style.setProperty('--i', i++);
          word.textContent = part;
          frag.append(word);
        });
        node.replaceWith(frag);
      });
      heading.classList.add('split');
    });
    const hero = document.querySelector('.hero-title');
    if (hero) requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('is-in')));
    onceInView(headlines.filter((h) => h !== hero), (h) => h.classList.add('is-in'));
  }

  // Facts count up from zero: small, real numbers.
  onceInView([...document.querySelectorAll('[data-count]')], (el) => {
    const end = +el.dataset.count;
    const start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / 900);
      el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    if (!reduceMotion) requestAnimationFrame(step);
  }, { threshold: 0.6 });

  // Live sites scroll inside their frames: on hover or focus, or by themselves on touch screens.
  const frames = [...document.querySelectorAll('[data-tall]')];
  const loadTall = (frame) => new Promise((resolve) => {
    if (frame.tall) return resolve(frame.tall);
    const img = new Image();
    img.className = 'tall';
    img.alt = '';
    img.decoding = 'async';
    img.onload = () => { frame.append(img); frame.tall = img; requestAnimationFrame(() => { frame.classList.add('has-tall'); resolve(img); }); };
    img.onerror = () => resolve(null);
    img.src = frame.dataset.tall;
  });
  const scrollFrame = async (frame, on) => {
    if (!on) {
      frame.style.setProperty('--scroll-time', '1.1s');
      frame.classList.remove('is-scrolling');
      return;
    }
    const img = await loadTall(frame);
    if (!img) return;
    const distance = Math.max(0, img.getBoundingClientRect().height - frame.clientHeight);
    frame.style.setProperty('--scroll-to', `${-distance}px`);
    frame.style.setProperty('--scroll-time', `${Math.max(4, distance / 240)}s`);
    requestAnimationFrame(() => frame.classList.add('is-scrolling'));
  };
  if (!reduceMotion) {
    const hoverable = matchMedia('(hover: hover)').matches;
    frames.forEach((frame) => {
      const target = frame.closest('a, figure') || frame;
      if (hoverable) {
        target.addEventListener('pointerenter', () => scrollFrame(frame, true));
        target.addEventListener('pointerleave', () => scrollFrame(frame, false));
      }
      frame.addEventListener('focus', () => scrollFrame(frame, true));
      frame.addEventListener('blur', () => scrollFrame(frame, false));
    });
    if (!hoverable && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => entries.forEach((e) => scrollFrame(e.target, e.isIntersecting)), { threshold: 0.75 });
      frames.forEach((f) => io.observe(f));
    }
  }

  // The process line fills as you read through the four steps.
  const steps = document.querySelector('.steps');
  if (steps) {
    const items = [...steps.querySelectorAll('.step')];
    let ticking = false;
    const update = () => {
      ticking = false;
      const top = steps.getBoundingClientRect().top;
      const p = Math.min(1, Math.max(0, (innerHeight * 0.8 - top) / (innerHeight * 0.45)));
      steps.style.setProperty('--p', p.toFixed(3));
      items.forEach((item, i) => item.classList.toggle('is-lit', p > i / items.length + 0.02));
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  // Devlo board: sample stories move through the panel's real statuses, under a running clock.
  document.querySelectorAll('[data-board]').forEach((board) => {
    const labels = JSON.parse(board.dataset.lamps);
    const order = ['draft', 'standby', 'live', 'published'];
    const rows = [...board.querySelectorAll('.bd-row')];
    const clock = board.querySelector('[data-clock]');
    let visible = false;
    let turn = 0;
    const pad = (n) => String(n).padStart(2, '0');
    const tickClock = () => { const d = new Date(); clock.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
    const advance = () => {
      const row = rows[turn++ % rows.length];
      const next = order[(order.indexOf(row.dataset.lamp) + 1) % order.length];
      row.dataset.lamp = next;
      row.querySelector('.bd-status > span:last-child').textContent = labels[next];
      row.classList.remove('is-changed');
      void row.offsetWidth;
      row.classList.add('is-changed');
    };
    tickClock();
    if (reduceMotion) return;
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(board);
    setInterval(() => { if (visible && !document.hidden) tickClock(); }, 1000);
    setInterval(() => { if (visible && !document.hidden) advance(); }, 2300);
  });

  // Edition switch: the same story in another edition, entering from that language's reading side.
  document.querySelectorAll('[data-edition-switch]').forEach((box) => {
    const keys = [...box.querySelectorAll('[data-edition-key]')];
    const cards = [...box.querySelectorAll('[data-edition]')];
    keys.forEach((key) => key.addEventListener('click', () => {
      const lang = key.dataset.editionKey;
      keys.forEach((k) => k.setAttribute('aria-pressed', String(k === key)));
      cards.forEach((card) => {
        const show = card.dataset.edition === lang;
        card.hidden = !show;
        card.classList.remove('is-entering');
        if (show && !reduceMotion) {
          card.style.setProperty('--from', card.dir === 'rtl' ? 1 : -1);
          void card.offsetWidth;
          card.classList.add('is-entering');
        }
      });
    }));
  });

  // Hero in 3D: loaded once the visitor engages, only where it will run well. The SVG lattice stays otherwise.
  const heroCanvas = document.querySelector('[data-hero-3d]');
  if (heroCanvas && !reduceMotion && !(navigator.connection && navigator.connection.saveData) && (navigator.deviceMemory || 4) >= 2) {
    // import() resolves against this script, not the page, so make the URL absolute first
    const start = () => import(new URL(heroCanvas.dataset.module, document.baseURI).href)
      .then((mod) => mod.default(heroCanvas, heroCanvas.closest('[data-hero-art]'), root.classList.contains('intro-on') ? 1150 : 0))
      .catch(() => { /* WebGL or module unavailable: the SVG lattice remains */ });
    // Wait for the visitor's first mouse move or scroll, so parsing Three.js never competes with page load.
    // Taps and keys are left out on purpose: work right after them would delay their response.
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
    const kick = (event) => {
      if (event.type === 'pointermove' && event.pointerType !== 'mouse') return;
      removeEventListener('pointermove', kick);
      removeEventListener('scroll', kick);
      idle(start);
    };
    addEventListener('pointermove', kick, { passive: true });
    addEventListener('scroll', kick, { passive: true });
  }

  // Hero lattice: cells near the pointer brighten, like parts being picked up.
  const lattice = document.querySelector('[data-lattice]');
  if (lattice && !reduceMotion && matchMedia('(pointer: fine)').matches) {
    const cells = [...lattice.querySelectorAll('.cell:not(.mark)')].map((el) => ({ el, x: +el.dataset.x, y: +el.dataset.y }));
    let lit = [];
    let frame = 0;
    let point = null;
    const paint = () => {
      frame = 0;
      lit.forEach((c) => c.el.classList.remove('is-near'));
      if (!point) { lit = []; return; }
      lit = cells.filter((c) => Math.hypot(c.x - point.x, c.y - point.y) < 92);
      lit.forEach((c) => c.el.classList.add('is-near'));
    };
    lattice.addEventListener('pointermove', (event) => {
      const box = lattice.getBoundingClientRect();
      const vb = lattice.viewBox.baseVal;
      point = { x: (event.clientX - box.left) * (vb.width / box.width), y: (event.clientY - box.top) * (vb.height / box.height) };
      if (!frame) frame = requestAnimationFrame(paint);
    });
    lattice.addEventListener('pointerleave', () => { point = null; if (!frame) frame = requestAnimationFrame(paint); });
  }

  // Project form: validates in the page's language, then hands the message to
  // the visitor's email app. Nothing is sent to a server.
  const form = document.querySelector('[data-form]');
  if (form) {
    const el = form.elements; // form.name would be the form's own name attribute
    const msgs = JSON.parse(form.dataset.msgs);
    const status = form.querySelector('[data-status]');
    const topic = new URLSearchParams(location.search).get('topic');
    if (topic && el.topic.querySelector(`option[value="${CSS.escape(topic)}"]`)) el.topic.value = topic;

    const setError = (field, message) => {
      const err = form.querySelector(`#e-${field.id.slice(2)}`);
      field.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (err) err.textContent = message || '';
    };
    const check = (field) => {
      const value = field.value.trim();
      if (field.required && !value) return msgs['form.err.required'];
      if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return msgs['form.err.email'];
      if (field.minLength > 0 && value && value.length < field.minLength) return msgs['form.err.short'];
      return '';
    };
    const required = [el.name, el.email, el.message];
    required.forEach((field) => field.addEventListener('blur', () => {
      if (field.value.trim() || field.getAttribute('aria-invalid') === 'true') setError(field, check(field));
    }));

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      let firstBad = null;
      required.forEach((field) => {
        const message = check(field);
        setError(field, message);
        if (message && !firstBad) firstBad = field;
      });
      status.hidden = false;
      if (firstBad) {
        status.className = 'form-status is-error';
        status.textContent = msgs['form.err.summary'];
        firstBad.focus();
        return;
      }
      const langs = [...form.querySelectorAll('input[name="langs"]:checked')].map((i) => i.value).join(', ');
      const lines = [
        `${form.querySelector('label[for="f-name"]').textContent.trim()}: ${el.name.value.trim()}`,
        el.organisation.value.trim() ? `${form.querySelector('label[for="f-org"]').firstChild.textContent.trim()}: ${el.organisation.value.trim()}` : null,
        `${form.querySelector('label[for="f-email"]').textContent.trim()}: ${el.email.value.trim()}`,
        `${form.querySelector('label[for="f-topic"]').textContent.trim()} ${el.topic.options[el.topic.selectedIndex].text}`,
        langs ? `${form.querySelector('legend').firstChild.textContent.trim()}: ${langs}` : null,
        '',
        el.message.value.trim(),
      ].filter((line) => line !== null);
      const subject = `${msgs['form.subject']}: ${el.topic.options[el.topic.selectedIndex].text}`;
      const href = `mailto:${form.dataset.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
      form.dataset.lastMailto = href;
      status.className = 'form-status is-ok';
      status.textContent = msgs['form.ok'];
      window.location.href = href;
    });
  }
})();
