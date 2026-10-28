import energyApi from './energyApi'

// Ingestion pipeline runs Spark jobs server-side — give it 5 minutes per file.
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000  // 5 minutes

/**
 * Upload a single dataset file (backwards-compatible).
 *
 * @param {File}     file             - File object from <input type="file">
 * @param {Function} onUploadProgress - Callback(pct: number)
 * @param {string}   datasetType      - Optional dataset type override
 */
export const uploadDataset = async (file, onUploadProgress, datasetType = null) => {
  const formData = new FormData()
  formData.append('file', file)
  if (datasetType) formData.append('dataset_type', datasetType)

  const res = await energyApi.post('/upload', formData, {
    timeout: UPLOAD_TIMEOUT_MS,
    headers: { 'Content-Type': undefined },
    onUploadProgress: (e) => {
      if (onUploadProgress && e.total) {
        onUploadProgress(Math.round((e.loaded * 100) / e.total))
      }
    },
  })
  return res
}

/**
 * Upload multiple dataset files in one batch request.
 *
 * @param {Array<{file: File, datasetType: string}>} items  - Files + their types
 * @param {Function}                                onProgress - Callback(pct: number) for HTTP upload
 * @returns {Promise<Array>} - Array of per-file result objects
 */
export const uploadDatasetBatch = async (items, onProgress) => {
  const formData = new FormData()

  items.forEach(({ file, datasetType }) => {
    formData.append('files[]', file)
    formData.append('dataset_types[]', datasetType || 'energy')
  })

  const res = await energyApi.post('/upload/batch', formData, {
    // Allow 5 minutes per file
    timeout: UPLOAD_TIMEOUT_MS * Math.max(items.length, 1),
    headers: { 'Content-Type': undefined },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total))
      }
    },
  })
  // energyApi interceptor unwraps response.data.data
  return res
}

/**
 * Fetch supported upload information and rules.
 */
export const fetchUploadInfo = async () => {
  return energyApi.get('/upload/info')
}
