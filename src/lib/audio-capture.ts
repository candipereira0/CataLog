/**
 * Audio capture for Shazam-style identification.
 * Uses MediaRecorder API to capture microphone audio and returns a Blob
 * suitable for sending to the recognition API.
 */

let mediaStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let chunks: Blob[] = [];

export interface CaptureState {
  status: "idle" | "requesting" | "recording" | "processing" | "done" | "error" | "denied";
  message: string;
}

export type CaptureCallback = (state: CaptureState) => void;

/**
 * Start recording audio from the microphone.
 * Returns a cleanup function that stops recording and resolves with the audio blob.
 */
export function startCapture(onState: CaptureCallback): {
  stop: () => Promise<Blob | null>;
  abort: () => void;
} {
  let stopped = false;
  chunks = [];

  const update = (s: Partial<CaptureState>) => {
    if (stopped) return;
    onState({
      status: "idle",
      message: "",
      ...s,
    });
  };

  const abort = () => {
    stopped = true;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
    }
    mediaStream = null;
    mediaRecorder = null;
    update({ status: "idle", message: "" });
  };

  const start = async () => {
    update({ status: "requesting", message: "Requesting microphone access..." });

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const e = err as DOMException;
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        update({
          status: "denied",
          message: "Microphone access denied. Please allow mic access in your browser settings.",
        });
      } else {
        update({
          status: "error",
          message: `Could not access microphone: ${e.message}`,
        });
      }
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

    mediaRecorder = new MediaRecorder(mediaStream, { mimeType });
    chunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onerror = () => {
      update({ status: "error", message: "Recording error occurred." });
      abort();
    };

    mediaRecorder.start(100); // collect chunks every 100ms
    update({ status: "recording", message: "Listening..." });
  };

  start();

  return {
    abort,
    stop: async (): Promise<Blob | null> => {
      if (stopped) return null;
      stopped = true;

      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        abort();
        return null;
      }

      update({ status: "processing", message: "Processing audio..." });

      return new Promise((resolve) => {
        mediaRecorder!.onstop = () => {
          // Stop the stream tracks
          if (mediaStream) {
            mediaStream.getTracks().forEach((t) => t.stop());
            mediaStream = null;
          }

          const blob = new Blob(chunks, {
            type: mediaRecorder!.mimeType || "audio/webm",
          });

          if (blob.size === 0) {
            update({ status: "error", message: "No audio captured." });
            resolve(null);
            return;
          }

          update({ status: "done", message: "Audio captured!" });
          resolve(blob);
        };

        mediaRecorder!.stop();
      });
    },
  };
}
