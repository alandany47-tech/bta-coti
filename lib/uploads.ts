export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_PROPERTY_IMAGES = 10;

/** Valida tamaño/tipo antes de subir a Supabase Storage. Devuelve un mensaje de error o null si es válido. */
export function validateMediaFile(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) {
    return `"${file.name}" supera 5 MB. Comprime el archivo antes de subirlo.`;
  }
  const isRasterImage = file.type.startsWith("image/");
  if (!isRasterImage) {
    return `"${file.name}" no es una imagen válida.`;
  }
  return null;
}
