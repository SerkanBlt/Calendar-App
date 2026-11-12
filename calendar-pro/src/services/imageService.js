/**
 * imageService.js — Kullanıcı görsellerini arka plan olarak saklamaya hazırlar.
 *
 * Büyük fotoğraflar (ör. 6000×4000 telefon fotoğrafı) uzun kenarı MAX_DIMENSION olacak şekilde
 * küçültülür ve WebP'ye (desteklenmezse JPEG) çevrilir; böylece IndexedDB'de az yer kaplar ve hızlı yüklenir.
 * GIF (animasyon) ve SVG dosyaları olduğu gibi saklanır.
 */

const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const MAX_PASSTHROUGH_BYTES = 6 * 1024 * 1024; // GIF/SVG için üst sınır
const MAX_DIMENSION = 2560;
const KEEP_ORIGINAL_BELOW = 1.5 * 1024 * 1024; // küçük ve boyutu uygun dosyalar dönüştürülmez
const QUALITY = 0.86;

const canvasToBlob = (canvas, type) => new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));

/**
 * @param {File} file
 * @returns {Promise<{blob: Blob, width: number|null, height: number|null}>}
 */
export async function prepareBackgroundImage(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Lütfen bir görsel dosyası seçin (JPG, PNG, WebP, GIF…).');
  if (file.size > MAX_INPUT_BYTES) throw new Error('Görsel 25 MB sınırını aşıyor.');

  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    if (file.size > MAX_PASSTHROUGH_BYTES) throw new Error('GIF/SVG dosyaları en fazla 6 MB olabilir.');
    return { blob: file, width: null, height: null };
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Bu görsel biçimi tarayıcıda açılamıyor. JPG, PNG veya WebP deneyin.');
  }

  const { width, height } = bitmap;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  if (scale === 1 && file.size <= KEEP_ORIGINAL_BELOW) {
    bitmap.close?.();
    return { blob: file, width, height };
  }

  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  let blob = await canvasToBlob(canvas, 'image/webp');
  if (!blob || blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/jpeg');
  if (!blob) throw new Error('Görsel işlenemedi.');
  return { blob, width: w, height: h };
}
