/** A short, soft tone for the 1:00 warning. Does nothing where audio is unavailable. */
export function softBeep(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.03);
    gain.gain.linearRampToValueAtTime(0, t + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.onended = () => void ctx.close();
    void ctx.resume();
    osc.start(t);
    osc.stop(t + 0.36);
  } catch {
    // The beep is a nicety: a blocked or missing audio device must never disturb the test.
  }
}
