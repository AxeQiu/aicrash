async function loadHeaderStats(lang) {
  const langVal = lang || getLang();
  try {
    const res = await fetch(`/api/news/stats?lang=${langVal}`);
    if (!res.ok) throw new Error('Failed to load stats');
    const { total, today } = await res.json();

    const pairs = [
      ['total-count', total],
      ['m-total-count', total],
      ['today-count', today],
      ['m-today-count', today],
    ];
    pairs.forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value.toLocaleString();
    });
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}
