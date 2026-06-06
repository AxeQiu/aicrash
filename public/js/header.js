window.headerPromise = (async function() {
  try {
    const res = await fetch('/components/header.html');
    const html = await res.text();
    document.body.insertAdjacentHTML('afterbegin', html);

    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobile-menu');

    if (hamburger && mobileMenu) {
      hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        mobileMenu.classList.toggle('open');
        // Re-render sparkline when menu opens (canvas was 0-sized when hidden)
        if (mobileMenu.classList.contains('open') && window._renderMobileSparkline) {
          requestAnimationFrame(() => window._renderMobileSparkline());
        }
      });

      document.addEventListener('click', (e) => {
        if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
          hamburger.classList.remove('active');
          mobileMenu.classList.remove('open');
        }
      });
    }
  } catch (err) {
    console.error('Failed to load header:', err);
  }
})();