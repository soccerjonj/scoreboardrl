/**
 * Compress an image File to a JPEG Blob for *storage* (not for parsing).
 *
 * The full-res image is sent straight to Gemini for OCR accuracy; the copy we
 * keep in the `screenshots` bucket is only an audit/display aid, so we can
 * shrink it aggressively. This keeps the Supabase free-tier storage (1 GB) and
 * egress (5 GB/mo) flat instead of growing with every original-size upload.
 *
 * Falls back to the original File if the browser can't decode it (e.g. HEIC in
 * Chrome) so callers never have to special-case the failure.
 */
export async function compressImageForStorage(
  file: File,
  maxDim = 1280,
  quality = 0.8
): Promise<Blob> {
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no 2d context"));
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("image decode failed"));
      };
      img.src = url;
    });
    // If compression somehow produced something larger than the original
    // (tiny PNGs, already-optimized images), keep the smaller original.
    return blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
