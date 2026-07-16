// Downscale a photo to ≤900px and JPEG-compress it (quality 0.65).

function drawScaled(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 900;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const scale = MAX / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// → data-URL (used by try-on, which posts images as data-URLs).
export async function compressImage(file) {
  const canvas = await drawScaled(file);
  return canvas.toDataURL("image/jpeg", 0.65);
}

// → Blob (used for Storage uploads — no base64 inflation).
export async function compressImageToBlob(file) {
  const canvas = await drawScaled(file);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process that photo."))), "image/jpeg", 0.65);
  });
}
