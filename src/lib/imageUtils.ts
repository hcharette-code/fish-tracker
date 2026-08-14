const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.85

function looksLikeHeic(file: File): boolean {
  return /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
}

async function resizeToJpeg(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get a canvas context to process the photo')
  ctx.drawImage(bitmap, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Could not encode the photo'))),
      'image/jpeg',
      JPEG_QUALITY
    )
  })
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export interface PreparedPhoto {
  /** Resized JPEG, ready to upload to Supabase Storage. */
  blob: Blob
  /** Base64 (no data: prefix), ready to send to the OCR function. */
  base64: string
  mimeType: 'image/jpeg'
}

/**
 * Converts HEIC/HEIF (the default iPhone photo format) to JPEG if needed,
 * then downscales to keep the OCR request and storage upload small and fast.
 */
export async function prepareReportPhoto(file: File): Promise<PreparedPhoto> {
  let working: Blob = file
  if (looksLikeHeic(file)) {
    const heic2any = (await import('heic2any')).default
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: JPEG_QUALITY })
    working = Array.isArray(converted) ? converted[0] : converted
  }
  const resized = await resizeToJpeg(working)
  const base64 = await blobToBase64(resized)
  return { blob: resized, base64, mimeType: 'image/jpeg' }
}
