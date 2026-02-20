export function playCompleteSound() {
  const ctx = new AudioContext()

  function note(freq: number, start: number) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.2, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12)
    osc.start(start)
    osc.stop(start + 0.12)
  }

  note(660, ctx.currentTime)
  note(880, ctx.currentTime + 0.08)
  note(1100, ctx.currentTime + 0.16)
}

export function playReviewSound() {
  const ctx = new AudioContext()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(800, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1)
  gain.gain.setValueAtTime(0.15, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.15)
}
