"use client";

import { blobToUint8, getFFmpeg } from "./ffmpeg";

/**
 * Extrai a trilha de áudio de um vídeo como MP3 mono 16kHz/48kbps —
 * formato pequeno o suficiente para a rota de transcrição (limite de body
 * de ~4.5MB na Vercel; 90s de áudio ≈ 540KB neste bitrate).
 */
export async function extractAudioForTranscription(video: Blob): Promise<Blob> {
  const ffmpeg = await getFFmpeg();
  await ffmpeg.writeFile("ta_input.mp4", await blobToUint8(video));
  try {
    await ffmpeg.exec([
      "-i", "ta_input.mp4",
      "-vn",
      "-ac", "1",
      "-ar", "16000",
      "-b:a", "48k",
      "-f", "mp3",
      "ta_audio.mp3",
    ]);
    const data = (await ffmpeg.readFile("ta_audio.mp3")) as Uint8Array;
    return new Blob([data.slice().buffer], { type: "audio/mpeg" });
  } finally {
    for (const f of ["ta_input.mp4", "ta_audio.mp3"]) {
      try {
        await ffmpeg.deleteFile(f);
      } catch {
        // já removido
      }
    }
  }
}
