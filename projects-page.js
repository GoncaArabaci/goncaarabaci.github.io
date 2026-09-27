// Search, category filter and sorting for projects.html
(function () {
    const grid = document.getElementById('all-projects');
    const search = document.getElementById('project-search');
    const categoryBox = document.getElementById('category-filters');
    const clearBtn = document.getElementById('clear-filters');
    const sortSelect = document.getElementById('sort-select');
    const countEl = document.getElementById('result-count');
    const emptyEl = document.getElementById('empty-state');

    const ALL = 'All';
    const state = { category: ALL };

    const categories = [ALL, ...new Set(PROJECTS.map(p => p.category))];

    function chip(label, active, onClick) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip' + (active ? ' active' : '');
        b.textContent = label;
        b.addEventListener('click', onClick);
        return b;
    }

    function renderChips() {
        categoryBox.innerHTML = '';
        categories.forEach(c => categoryBox.appendChild(
            chip(c, state.category === c, () => { state.category = c; update(); })
        ));
    }

    const norm = s => s.toLocaleLowerCase('en');

    function update() {
        renderChips();
        const q = norm(search.value.trim());

        let list = PROJECTS.filter(p => {
            if (state.category !== ALL && p.category !== state.category) return false;
            if (!q) return true;
            const hay = norm([p.title, p.summary, p.description, p.category, p.slug, ...p.tags].join(' '));
            return q.split(/\s+/).every(w => hay.includes(w));
        });

        const sort = sortSelect.value;
        list = list.slice().sort((a, b) =>
            sort === 'az' ? a.title.localeCompare(b.title, 'en')
            : sort === 'old' ? (a.year || 0) - (b.year || 0)
            : (b.year || 0) - (a.year || 0)
        );

        grid.innerHTML = list.map(renderProjectCard).join('');
        countEl.textContent = `${list.length} of ${PROJECTS.length} projects`;
        emptyEl.hidden = list.length > 0;
    }

    search.addEventListener('input', update);
    sortSelect.addEventListener('change', update);
    clearBtn.addEventListener('click', () => {
        state.category = ALL;
        search.value = '';
        update();
    });

    // Links like projects.html?q=unity open with a search applied
    const params = new URLSearchParams(location.search);
    if (params.get('q')) search.value = params.get('q');

    update();
})();
