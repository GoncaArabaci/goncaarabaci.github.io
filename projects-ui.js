// Project cards + detail popup. Used by index.html and projects.html.

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

function projectUrl(p) {
    return p.url || `https://github.com/${GITHUB_USER}/${encodeURIComponent(p.slug)}`;
}

function projectImage(p, src, cls) {
    const pixel = p.pixelated ? ' pixelated' : '';
    return `<img class="${cls}${pixel}" src="assets/projects/${escapeHtml(src)}" alt="${escapeHtml(p.title)} screenshot" loading="lazy">`;
}

function projectCover(p, cls) {
    if (p.images && p.images.length) return projectImage(p, p.images[0], cls);
    return `<div class="${cls} cover-placeholder" data-category="${escapeHtml(p.category)}">
                <span class="cover-icon">${escapeHtml(p.icon || '💡')}</span>
                <span class="cover-title">${escapeHtml(p.title)}</span>
            </div>`;
}

function renderProjectCard(p) {
    const tags = p.tags.map(t => `<span>${escapeHtml(t)}</span>`).join('');
    return `
        <button type="button" class="repo-card" data-slug="${escapeHtml(p.slug)}" aria-haspopup="dialog">
            <div class="repo-thumb">${projectCover(p, 'repo-thumb-img')}</div>
            <div class="repo-body">
                <div class="repo-header">
                    <h3>${escapeHtml(p.title)}</h3>
                    <span class="repo-year">${p.noRepo ? '<span class="private-badge">🔒 Private</span>' : ''}${escapeHtml(p.year || '')}</span>
                </div>
                <p>${escapeHtml(p.summary)}</p>
                <div class="tags"><span class="tag-category">${escapeHtml(p.category)}</span>${tags}</div>
                <span class="repo-link">View details →</span>
            </div>
        </button>`;
}

// ---- Modal ----
const projectModal = (() => {
    const el = document.createElement('div');
    el.className = 'pm-overlay';
    el.hidden = true;
    el.innerHTML = `
        <div class="pm-dialog" role="dialog" aria-modal="true" aria-labelledby="pm-title">
            <button type="button" class="pm-close" aria-label="Close">✕</button>
            <div class="pm-content"></div>
        </div>`;
    document.body.appendChild(el);
    return el;
})();

let lastFocused = null;
let showImage = () => {};
let showStep = () => {};

function openProjectModal(slug) {
    const p = PROJECTS.find(x => x.slug === slug);
    if (!p) return;

    const images = p.images || [];
    const gallery = images.length > 1
        ? `<div class="pm-thumbs">${images.map((src, i) =>
            `<button type="button" class="pm-thumb${i === 0 ? ' active' : ''}" data-index="${i}" aria-label="Image ${i + 1}">${projectImage(p, src, 'pm-thumb-img')}</button>`
          ).join('')}</div>`
        : '';

    const highlights = p.highlights && p.highlights.length
        ? `<h4>Highlights</h4><ul class="pm-list">${p.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('')}</ul>`
        : '';
    const role = p.role ? `<h4>My Role</h4><p>${escapeHtml(p.role)}</p>` : '';

    const arrows = images.length > 1
        ? `<button type="button" class="pm-arrow pm-prev" aria-label="Previous image">‹</button>
           <button type="button" class="pm-arrow pm-next" aria-label="Next image">›</button>
           <span class="pm-counter">1 / ${images.length}</span>`
        : '';
    const teamLabel = p.team ? '👥 Team project' : '👤 Solo project';

    projectModal.querySelector('.pm-content').innerHTML = `
        <div class="pm-media">
            <div class="pm-media-inner">${projectCover(p, 'pm-main-img')}</div>
            ${arrows}
        </div>
        ${gallery}
        <div class="pm-text">
            <div class="pm-meta">${escapeHtml(p.category)}${p.year ? ' · ' + escapeHtml(p.year) : ''}</div>
            <span class="pm-team">${teamLabel}</span>
            <h3 id="pm-title">${escapeHtml(p.title)}</h3>
            <p>${escapeHtml(p.description)}</p>
            ${role}
            ${highlights}
            <div class="tags">${p.tags.map(t => `<span>${escapeHtml(t)}</span>`).join('')}</div>
            ${p.noRepo ? `<div class="pm-actions">
                <span class="private-note">🔒 Private project: the source code isn't publicly available.</span>
            </div>` : `<div class="pm-actions">
                <a href="${escapeHtml(projectUrl(p))}" target="_blank" rel="noopener" class="btn">View on GitHub ↗</a>
            </div>`}
        </div>`;

    let current = 0;
    showImage = i => {
        if (images.length < 2) return;
        current = (i + images.length) % images.length;
        projectModal.querySelector('.pm-media-inner').innerHTML = projectImage(p, images[current], 'pm-main-img');
        projectModal.querySelector('.pm-counter').textContent = `${current + 1} / ${images.length}`;
        projectModal.querySelectorAll('.pm-thumb').forEach((b, j) => b.classList.toggle('active', j === current));
    };

    projectModal.querySelectorAll('.pm-thumb').forEach(btn => {
        btn.addEventListener('click', () => showImage(Number(btn.dataset.index)));
    });
    const prev = projectModal.querySelector('.pm-prev');
    const next = projectModal.querySelector('.pm-next');
    if (prev) prev.addEventListener('click', () => showImage(current - 1));
    if (next) next.addEventListener('click', () => showImage(current + 1));
    showStep = d => showImage(current + d);

    lastFocused = document.activeElement;
    projectModal.hidden = false;
    document.body.classList.add('modal-open');
    projectModal.querySelector('.pm-dialog').scrollTop = 0;
    projectModal.querySelector('.pm-close').focus();
}

function closeProjectModal() {
    showImage = () => {};
    showStep = () => {};
    projectModal.hidden = true;
    document.body.classList.remove('modal-open');
    if (lastFocused) lastFocused.focus();
}

projectModal.addEventListener('click', e => {
    if (e.target === projectModal || e.target.closest('.pm-close')) closeProjectModal();
});

document.addEventListener('keydown', e => {
    if (projectModal.hidden) return;
    if (e.key === 'Escape') closeProjectModal();
    else if (e.key === 'ArrowLeft') showStep(-1);
    else if (e.key === 'ArrowRight') showStep(1);
});

document.addEventListener('click', e => {
    const card = e.target.closest('.repo-card[data-slug]');
    if (card) openProjectModal(card.dataset.slug);
});
