import { firebaseConfig } from './config';

/**
 * Uploads a study package (.pdfnoter or PDF) directly from the client's browser to Firebase Cloud Storage.
 * Uses the Google Cloud / Firebase Storage REST API with XMLHttpRequest for accurate real-time progress.
 * Completely bypasses Vercel's 4.5MB Serverless Function payload limit, supporting packages up to hundreds of megabytes.
 */
export async function uploadStudyPackageToFirebase(
  blob: Blob,
  fileName: string,
  onProgress?: (percent: number, message: string) => void
): Promise<string> {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `shares/${timestamp}_${randomSuffix}_${sanitizedName}`;
  const encodedPath = encodeURIComponent(path);

  const bucket = firebaseConfig.storageBucket || 'pdf-noter.firebasestorage.app';
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${encodedPath}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        const percent = Math.round((e.loaded / e.total) * 100);
        const uploadedMb = (e.loaded / (1024 * 1024)).toFixed(1);
        const totalMb = (e.total / (1024 * 1024)).toFixed(1);
        onProgress?.(percent, `Uploading to Firebase Storage (${uploadedMb} / ${totalMb} MB)...`);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          const token = data.downloadTokens || '';
          const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media${token ? `&token=${token}` : ''}`;
          resolve(downloadUrl);
        } catch {
          reject(new Error('Failed to parse Firebase storage response'));
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          const code = errData?.error?.code || xhr.status;
          const msg = errData?.error?.message || `Firebase storage error (${xhr.status})`;
          if (code === 404) {
            reject(
              new Error(
                'Firebase Storage is not enabled yet in your Firebase console. Please visit the Firebase Console -> Build -> Storage and click "Get started".'
              )
            );
          } else if (code === 403) {
            reject(
              new Error(
                'Firebase Storage permission denied. Please ensure your Firebase Storage rules allow public read/write.'
              )
            );
          } else {
            reject(new Error(msg));
          }
        } catch {
          reject(new Error(`Firebase storage returned HTTP ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network error uploading to Firebase Storage'));
    xhr.send(blob);
  });
}
