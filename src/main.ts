import './style.css';
import { loadPeople } from './people/HumanoidView';
import { Game } from './core/Game';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('NCR Drive mount point is missing.');
try {
  root.textContent = 'Preparing your Delhi neighborhood…';
  await loadPeople();
  const game = new Game(root);
  import.meta.hot?.dispose(() => game.dispose());
  window.addEventListener('pagehide', event => { if (!event.persisted) game.dispose(); });
} catch (error) {
  console.error('NCR Drive startup failed:', error);
  root.replaceChildren();
  const panel = document.createElement('div'); panel.className = 'startup-error';
  const title = document.createElement('h1'); title.textContent = 'The city could not start.';
  const message = document.createElement('p'); message.textContent = 'Use a browser with WebGL graphics enabled, then reload NCR Drive.';
  const retry = document.createElement('button'); retry.className = 'primary'; retry.textContent = 'Reload game'; retry.addEventListener('click', () => location.reload());
  panel.append(title, message, retry); root.append(panel);
}
