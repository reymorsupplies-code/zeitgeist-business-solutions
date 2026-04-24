/**
 * ZBS Notification Sound System
 * Generates notification tones using Web Audio API (no audio files needed).
 * SSR-safe: checks `typeof window` before using AudioContext.
 * User preferences persisted in localStorage.
 */

// ─── State ───

let _soundEnabled: boolean | null = null;
let _volume: number | null = null;

// ─── Helpers ───

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    return new Ctx();
  } catch {
    return null;
  }
}

function isSoundEnabled(): boolean {
  if (_soundEnabled !== null) return _soundEnabled;
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem('zbs-sound-enabled');
  _soundEnabled = stored === null ? true : stored === 'true';
  return _soundEnabled;
}

function getVolume(): number {
  if (_volume !== null) return _volume;
  if (typeof window === 'undefined') return 0.5;
  const stored = localStorage.getItem('zbs-sound-volume');
  _volume = stored === null ? 0.5 : parseFloat(stored);
  return _volume;
}

// ─── Public API ───

/**
 * Enable or disable notification sounds.
 * Persists to localStorage under 'zbs-sound-enabled'.
 */
export function setSoundEnabled(enabled: boolean): void {
  _soundEnabled = enabled;
  if (typeof window !== 'undefined') {
    localStorage.setItem('zbs-sound-enabled', String(enabled));
  }
}

/**
 * Set the notification volume (0 to 1).
 * Persists to localStorage under 'zbs-sound-volume'.
 */
export function setVolume(volume: number): void {
  const clamped = Math.max(0, Math.min(1, volume));
  _volume = clamped;
  if (typeof window !== 'undefined') {
    localStorage.setItem('zbs-sound-volume', String(clamped));
  }
}

/**
 * Play a tone at the given frequency and duration.
 * Returns immediately — sound plays asynchronously.
 */
function playTone(
  ctx: AudioContext,
  frequency: number,
  durationMs: number,
  volume: number,
  startOffsetMs: number = 0
): void {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

  // Envelope: quick fade-in, sustain, quick fade-out
  const startTime = ctx.currentTime + startOffsetMs / 1000;
  const durationSec = durationMs / 1000;

  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01); // 10ms attack
  gainNode.gain.setValueAtTime(volume, startTime + durationSec - 0.05); // sustain
  gainNode.gain.linearRampToValueAtTime(0, startTime + durationSec); // 50ms release

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + durationSec + 0.01);
}

/**
 * Play a notification sound of the given type.
 *
 * Supported types:
 * - "message"       — short pleasant chime (C5 → E5, 100ms each)
 * - "payment"       — success sound (ascending C5 → E5 → G5)
 * - "maintenance"   — neutral alert (single medium tone)
 * - "rent_due"      — gentle reminder (descending 2 notes)
 * - "lease_alert"   — attention sound (2 short beeps)
 * - "general"       — soft notification (single gentle tone)
 */
export function playNotificationSound(type: string): void {
  if (!isSoundEnabled()) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const vol = getVolume();

  // Musical note frequencies
  const C5 = 523.25;
  const E5 = 659.25;
  const G5 = 783.99;
  const A4 = 440.00;

  switch (type) {
    // "message": short pleasant chime (C5 → E5, 100ms each)
    case 'message':
      playTone(ctx, C5, 100, vol, 0);
      playTone(ctx, E5, 120, vol, 110);
      break;

    // "payment": success sound (ascending 3 notes, C5 → E5 → G5)
    case 'payment':
      playTone(ctx, C5, 100, vol, 0);
      playTone(ctx, E5, 100, vol, 110);
      playTone(ctx, G5, 150, vol, 220);
      break;

    // "maintenance": neutral alert (single medium tone)
    case 'maintenance':
      playTone(ctx, A4, 200, vol * 0.8, 0);
      break;

    // "rent_due": gentle reminder (descending 2 notes)
    case 'rent_due':
      playTone(ctx, E5, 120, vol * 0.7, 0);
      playTone(ctx, C5, 150, vol * 0.7, 130);
      break;

    // "lease_alert": attention sound (2 short beeps)
    case 'lease_alert':
      playTone(ctx, C5, 80, vol, 0);
      playTone(ctx, C5, 80, vol, 100);
      break;

    // "general": soft notification (single gentle tone)
    case 'general':
    default:
      playTone(ctx, E5, 150, vol * 0.6, 0);
      break;
  }
}
