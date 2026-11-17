import './style.css';
import { loadPeople } from './people/HumanoidView';
import type { PeopleLoadProgress } from './people/HumanoidView';
import { CharacterAssetError } from './people/CharacterAsset';
import { Game } from './core/Game';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('NCR Drive mount point is missing.');

/**
 * Phase 6 — lazy character load. The game boots immediately; the 1.6 MB
 * character GLB downloads in the background with real progress. The boot
 * overlay below lives in document.body (not #app) so Game's
 * root.replaceChildren() never wipes it, and it never blocks play: the
 * "Enter the city" button enables as soon as the Game is constructed, and
 * the overlay auto-dismisses when the residents arrive. If the download
 * fails, the game still runs on placeholder figures — the overlay says so
 * instead of failing the boot.
 */
function buildBootOverlay(): { overlay: HTMLDivElement; bar: HTMLDivElement; status: HTMLParagraphElement; detail: HTMLParagraphElement; enter: HTMLButtonElement } {
  const overlay = document.createElement('div');
  overlay.className = 'boot-overlay';
  overlay.setAttribute('role', 'status');
  overlay.innerHTML = `
    <div class="boot-panel">
      <span class="eyebrow">NCR DRIVE · NEW DELHI, INDIA</span>
      <h1>Your evening.<br>Your <em>Delhi.</em></h1>
      <p data-boot-status>Preparing Connaught Place…</p>
      <div class="boot-progress" role="progressbar" aria-label="Character download progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div data-boot-bar></div></div>
      <p class="boot-detail" data-boot-detail>City loading…</p>
      <button class="primary" data-boot-enter disabled>Enter the city →</button>
    </div>`;
  document.body.append(overlay);
  return {
    overlay,
    bar: overlay.querySelector<HTMLDivElement>('[data-boot-bar]')!,
    status: overlay.querySelector<HTMLParagraphElement>('[data-boot-status]')!,
    detail: overlay.querySelector<HTMLParagraphElement>('[data-boot-detail]')!,
    enter: overlay.querySelector<HTMLButtonElement>('[data-boot-enter]')!,
  };
}

const boot = buildBootOverlay();
let bootDismissed = false;
const dismissBoot = (): void => {
  if (bootDismissed) return;
  bootDismissed = true;
  boot.overlay.remove();
};
boot.enter.addEventListener('click', dismissBoot);

function renderBootProgress(progress: PeopleLoadProgress, cityReady: boolean): void {
  const percent = progress.percent;
  boot.bar.style.width = percent === null ? '100%' : `${percent}%`;
  boot.bar.classList.toggle('indeterminate', percent === null && progress.state === 'loading');
  boot.overlay.querySelector<HTMLElement>('.boot-progress')!.setAttribute('aria-valuenow', String(percent ?? 0));
  if (progress.state === 'ready') {
    boot.status.textContent = 'Delhi residents have arrived.';
    boot.detail.textContent = 'City ready · Residents ready';
  } else if (progress.state === 'failed') {
    boot.status.textContent = 'Residents could not load — you can still drive.';
    boot.detail.textContent = 'Characters will appear as simple figures. Reload to retry the download.';
  } else if (progress.state === 'loading') {
    boot.status.textContent = cityReady ? 'City ready — loading Delhi residents…' : 'Preparing Connaught Place…';
    boot.detail.textContent = percent === null
      ? `City ${cityReady ? 'ready' : 'loading'} · Residents downloading…`
      : `City ${cityReady ? 'ready' : 'loading'} · Residents ${percent}% (${Math.round(progress.loaded / 1024)} KB of ${Math.round(progress.total / 1024)} KB)`;
  } else {
    boot.status.textContent = 'Preparing Connaught Place…';
    boot.detail.textContent = `City ${cityReady ? 'ready' : 'loading'} · Residents queued…`;
  }
}

/** Download progress for the GLB (real bytes from the loader). `cityReady` flips once the Game is constructed; the overlay keeps showing GLB progress either way. */
let cityReady = false;
let lastPeopleProgress: PeopleLoadProgress = { state: 'pending', loaded: 0, total: 0, percent: null };
loadPeople(
  (progress) => { lastPeopleProgress = progress; renderBootProgress(progress, cityReady); },
).then(() => {
  // Let "Residents ready" read for a beat, then get out of the way.
  window.setTimeout(dismissBoot, 500);
}).catch((error) => {
  // loadPeople only rejects on download/validation failure, which is
  // non-fatal: the game runs on placeholder figures. The overlay already
  // shows the failed state via the progress listener.
  console.error('NCR Drive character load failed (game continues on placeholders):', error);
  return undefined;
});

try {
  root.textContent = '';
  const game = new Game(root);
  cityReady = true;
  boot.enter.disabled = false;
  // Re-render with the real last-known progress now that the city is ready
  // (the listener may have rendered mid-download with cityReady=false).
  renderBootProgress(lastPeopleProgress, true);
  import.meta.hot?.dispose(() => { dismissBoot(); game.dispose(); });
  window.addEventListener('pagehide', (event) => { if (!event.persisted) { dismissBoot(); game.dispose(); } });
} catch (error) {
  dismissBoot();
  console.error('NCR Drive startup failed:', error);
  root.replaceChildren();
  const panel = document.createElement('div'); panel.className = 'startup-error';
  const title = document.createElement('h1'); title.textContent = 'The city could not start.';
  const message = document.createElement('p'); message.textContent = error instanceof CharacterAssetError
    ? 'Character files could not load. Check your connection and reload to retry. If this continues, try again later.'
    : error instanceof Error && /webgl|graphics context/i.test(error.message)
      ? 'Graphics could not start. Enable WebGL in your browser, then reload to retry.'
      : 'The city could not finish starting. Reload to retry. If this continues, try again later.';
  const retry = document.createElement('button'); retry.className = 'primary'; retry.textContent = 'Reload game'; retry.addEventListener('click', () => location.reload());
  panel.append(title, message, retry); root.append(panel);
}
