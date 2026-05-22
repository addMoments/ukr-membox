export async function askPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch {
    return false;
  }
}

export async function startRecording(
  onComplete: (file: File, mimeType: string) => void,
  maxSeconds = 180,
): Promise<() => void> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder is not supported on this browser.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const chunks: Blob[] = [];

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
    ? 'audio/webm'
    : MediaRecorder.isTypeSupported('audio/mp4')
    ? 'audio/mp4'
    : '';

  const ext = mimeType.startsWith('audio/webm') ? 'webm' : 'm4a';

  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);

  const actualMime = recorder.mimeType || mimeType || 'audio/mp4';

  const limitTimer = window.setTimeout(() => stop(), maxSeconds * 1000);

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = () => {
    clearTimeout(limitTimer);
    stream.getTracks().forEach(track => track.stop());
    const blob = new Blob(chunks, { type: actualMime });
    const file = new File([blob], `recording.${ext}`, { type: actualMime });
    onComplete(file, actualMime);
  };

  recorder.start();

  const stop = () => {
    if (recorder.state !== 'inactive') recorder.stop();
  };

  return stop;
}
