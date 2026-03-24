/**
 * Client-side video thumbnail extraction
 * Extracts a frame from a video file to use as a preview
 */

export interface ThumbnailResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Extract a thumbnail frame from a video file
 * @param videoFile - The video file to extract from
 * @param seekTime - Time in seconds to capture (default: 1)
 * @param maxSize - Maximum dimension for thumbnail (default: 400)
 */
export async function extractVideoThumbnail(
  videoFile: File,
  seekTime: number = 1,
  maxSize: number = 400
): Promise<ThumbnailResult> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      URL.revokeObjectURL(video.src);
      video.remove();
      canvas.remove();
    };

    video.onloadedmetadata = () => {
      // Seek to the specified time, or 10% into the video if it's shorter
      const targetTime = Math.min(seekTime, video.duration * 0.1);
      video.currentTime = targetTime;
    };

    video.onseeked = () => {
      try {
        // Calculate scaled dimensions maintaining aspect ratio
        let width = video.videoWidth;
        let height = video.videoHeight;

        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;

        // Draw the video frame
        ctx.drawImage(video, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              cleanup();
              reject(new Error('Failed to create thumbnail blob'));
              return;
            }

            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            cleanup();

            resolve({
              blob,
              dataUrl,
              width,
              height,
            });
          },
          'image/jpeg',
          0.85
        );
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to load video for thumbnail extraction'));
    };

    // Load the video
    video.src = URL.createObjectURL(videoFile);
  });
}

/**
 * Create a File object from a thumbnail blob
 */
export function createThumbnailFile(
  blob: Blob,
  originalFileName: string
): File {
  const baseName = originalFileName.replace(/\.[^/.]+$/, '');
  const thumbnailName = `${baseName}_thumb.jpg`;
  return new File([blob], thumbnailName, { type: 'image/jpeg' });
}
