'use client'

import { useRef, useState, useCallback } from 'react'

type Status = 'idle' | 'recording' | 'processing'

export function useVoiceRecorder(onBlob: (blob: Blob) => void) {
  const [status, setStatus] = useState<Status>('idle')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])

  const startRecording = useCallback(async () => {
    if (status !== 'idle') return

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    // Prefere webm; fallback para o primeiro suportado
    const mimeType = MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : ''

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
    recorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || 'audio/webm',
      })
      onBlob(blob)
      recorderRef.current = null
      setStatus('idle')
    }

    recorder.start()
    setStatus('recording')
  }, [status, onBlob])

  const stopRecording = useCallback(() => {
    if (recorderRef.current && status === 'recording') {
      setStatus('processing')
      recorderRef.current.stop()
    }
  }, [status])

  return { status, startRecording, stopRecording }
}
