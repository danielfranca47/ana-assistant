export function speak(
  text: string,
  opts?: { onend?: () => void; onerror?: () => void },
) {
  if (!('speechSynthesis' in window)) return
  const utt = new SpeechSynthesisUtterance(text)
  const voices = speechSynthesis.getVoices()
  const voiceName = localStorage.getItem('ana_voice_name')
  if (voiceName) {
    const voice = voices.find(v => v.name === voiceName)
    if (voice) utt.voice = voice
  } else {
    const ptVoice = voices.find(v => v.lang.startsWith('pt'))
    if (ptVoice) utt.voice = ptVoice
  }
  utt.rate = parseFloat(localStorage.getItem('ana_voice_rate') ?? '0.95')
  utt.pitch = parseFloat(localStorage.getItem('ana_voice_pitch') ?? '1.05')
  if (opts?.onend) utt.onend = opts.onend
  if (opts?.onerror) utt.onerror = opts.onerror
  speechSynthesis.cancel()
  speechSynthesis.speak(utt)
}
