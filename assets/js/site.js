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

  // Sections ease in once, as they enter the viewport.
  const revealTargets = document.querySelectorAll(
    '.section-head, .practices, .feature-works, .steps, .work-entry, .rundown.full, .dv-split'
  );
  const rundown = document.querySelector('.rundown.mini');
  if ('IntersectionObserver' in window && !reduceMotion) {
    revealTargets.forEach((el) => el.setAttribute('data-reveal', ''));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealTargets.forEach((el) => io.observe(el));
    if (rundown) io.observe(rundown);
  } else if (rundown) {
    rundown.classList.add('is-in');
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
