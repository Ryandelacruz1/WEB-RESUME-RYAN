export function initQA() {
  const items = document.querySelectorAll('.qa-item');

  items.forEach((item) => {
    const btn = item.querySelector('.qa-question');
    const answer = item.querySelector('.qa-answer');

    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');

      items.forEach((other) => {
        other.classList.remove('open');
        other.querySelector('.qa-question').setAttribute('aria-expanded', 'false');
      });

      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        answer.style.maxHeight = `${answer.scrollHeight}px`;
      } else {
        answer.style.maxHeight = '0';
      }
    });
  });
}

export function revealQA() {
  const section = document.getElementById('qa');
  section?.classList.add('visible');
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
