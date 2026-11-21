export const toFileDTO = (file) => ({
  originalName: file.originalName,
  fileName: file.fileName,
  path: file.path,
  mimeType: file.mimeType,
  size: file.size,
  type: file.type,
  uploadedAt: file.uploadedAt,
});
