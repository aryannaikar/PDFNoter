import { NextRequest, NextResponse } from 'next/server';



/**
 * Uploads a shared .pdfnoter or PDF package to free zero-setup cloud storage.
 * Primary provider: tmpfiles.org (with fallback to catbox.moe)
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided in upload request' },
        { status: 400 }
      );
    }

    const fileName = file.name || 'study_document.pdfnoter';
    const arrayBuffer = await file.arrayBuffer();
    const fileBlob = new Blob([arrayBuffer], { type: file.type || 'application/octet-stream' });

    // 1. Primary: catbox.moe (permanent, direct download, CORS enabled)
    try {
      const catFormData = new FormData();
      catFormData.append('reqtype', 'fileupload');
      catFormData.append('fileToUpload', fileBlob, fileName);

      const catRes = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PDFNoter-App',
        },
        body: catFormData,
      });

      if (catRes.ok) {
        const directUrl = (await catRes.text()).trim();
        if (directUrl.startsWith('http')) {
          return NextResponse.json({
            success: true,
            provider: 'catbox',
            downloadUrl: directUrl,
          });
        }
      }
    } catch (catErr) {
      console.warn('catbox.moe primary upload failed, trying fallback provider...', catErr);
    }

    // 2. Fallback: uguu.se (direct file download)
    try {
      const uguuFormData = new FormData();
      uguuFormData.append('files[]', fileBlob, fileName);

      const uguuRes = await fetch('https://uguu.se/upload.php', {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PDFNoter-App',
        },
        body: uguuFormData,
      });

      if (uguuRes.ok) {
        const json = await uguuRes.json();
        const fileUrl = json?.files?.[0]?.url;
        if (fileUrl && fileUrl.startsWith('http')) {
          return NextResponse.json({
            success: true,
            provider: 'uguu',
            downloadUrl: fileUrl,
          });
        }
      }
    } catch (uguuErr) {
      console.warn('uguu.se fallback upload failed:', uguuErr);
    }

    // 3. Fallback: tmpfiles.org
    try {
      const tmpFormData = new FormData();
      tmpFormData.append('file', fileBlob, fileName);

      const tmpRes = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: tmpFormData,
      });

      if (tmpRes.ok) {
        const json = await tmpRes.json();
        if (json?.status === 'success' && json?.data?.url) {
          const originalUrl: string = json.data.url;
          const directUrl = originalUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
          return NextResponse.json({
            success: true,
            provider: 'tmpfiles',
            downloadUrl: directUrl,
          });
        }
      }
    } catch (tmpErr) {
      console.warn('tmpfiles.org upload failed:', tmpErr);
    }

    return NextResponse.json(
      { success: false, error: 'Cloud upload failed across all free storage providers. Please try again.' },
      { status: 502 }
    );
  } catch (error: any) {
    console.error('Share upload error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error during upload' },
      { status: 500 }
    );
  }
}
