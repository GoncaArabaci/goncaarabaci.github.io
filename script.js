document.addEventListener('DOMContentLoaded', () => {
    // 0. Featured projects on the home page
    const featured = document.getElementById('featured-projects');
    if (featured && typeof PROJECTS !== 'undefined') {
        featured.innerHTML = PROJECTS.filter(p => p.featured).slice(0, 6).map(renderProjectCard).join('');
    }

    // 1. Copy email
    const copyBtn = document.getElementById('copy-email-btn');
    const emailText = document.getElementById('email-text');

    if (copyBtn && emailText) {
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(emailText.textContent.trim()).then(() => {
                copyBtn.textContent = '✓ Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
            });
        });
    }

    // CV popup
    const cvModal = document.getElementById('cv-modal');
    const cvOpen = document.getElementById('cv-open');
    if (cvModal && cvOpen) {
        const closeCv = () => {
            cvModal.hidden = true;
            document.body.classList.remove('modal-open');
            cvOpen.focus();
        };
        cvOpen.addEventListener('click', () => {
            cvModal.hidden = false;
            document.body.classList.add('modal-open');
            cvModal.querySelector('.cv-close').focus();
        });
        cvModal.addEventListener('click', e => {
            if (e.target === cvModal || e.target.closest('.cv-close')) closeCv();
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && !cvModal.hidden) closeCv();
        });
    }

    // 2. Dark / Light Mode Switch
    const themeToggleBtn = document.getElementById('theme-toggle');
    const switchImg = document.getElementById('switch-img');

    const OFF_SRC = 'assets/switch_off.png'; // Dark mode
    const ON_SRC = 'assets/switch_on.png';   // Light mode

    // Apply the saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        if (switchImg) switchImg.src = ON_SRC;
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (switchImg) switchImg.src = OFF_SRC;
    }

    if (themeToggleBtn && switchImg) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';

            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);

            // Swap the switch image
            switchImg.src = newTheme === 'light' ? ON_SRC : OFF_SRC;
        });
    }
});
