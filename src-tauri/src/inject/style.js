window.addEventListener('DOMContentLoaded', (_event) => {
  const css = `
    .other-nav.nav {
      display: none !important;
    }

    .footer {
      display: none !important;
    }
  `;
  const styleElement = document.createElement('style');
  styleElement.innerHTML = css;
  document.head.appendChild(styleElement);
});
