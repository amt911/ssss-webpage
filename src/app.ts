import { initApp } from './ui/main';

// The bundle is injected at the end of <body>, so the document is already parsed;
// the guard is there for the case where that ever stops being true.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initApp(document);
  });
} else {
  initApp(document);
}
