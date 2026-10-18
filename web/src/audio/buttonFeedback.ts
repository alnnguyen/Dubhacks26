import { gameAudio } from './gameAudio';

const CLICKABLE = 'button,[role="button"],a[href],input[type="checkbox"],[role="switch"]';

function enabled(control: Element) {
  return !control.matches(':disabled,[aria-disabled="true"]') &&
    !control.closest('[inert],[aria-disabled="true"],[data-button-feedback="off"]');
}

/** Click-only feedback. Hover ticks were removed — they get noisy when sweeping the HUD. */
export function installButtonFeedback(doc: Document = document) {
  const click = (event: MouseEvent) => {
    if (!(event.target instanceof Element) || event.target.closest('[data-audio-control]')) return;
    const control = event.target.closest(CLICKABLE);
    if (!control || !enabled(control)) return;
    const label = control.getAttribute('aria-label') || control.textContent?.trim() || '';
    const tagged = control.getAttribute('data-ui-sound');
    // Explicit commit (Radar / Bridge / Challenge / profile) wins over back heuristics.
    if (tagged === 'commit') {
      gameAudio.play('commit');
      return;
    }
    // Back / cancel / close use click_h, not the default confirm click.
    if (tagged === 'back' || /^(?:[←‹]\s*)?(?:back\b|return\b|cancel\b|close\b)/i.test(label)) {
      gameAudio.play('back');
      return;
    }
    gameAudio.play('click');
  };
  doc.addEventListener('click', click, true);
  return () => {
    doc.removeEventListener('click', click, true);
  };
}
