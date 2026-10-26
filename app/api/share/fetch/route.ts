import { NextRequest, NextResponse } from 'next/server';



/**
 * Server-side proxy to fetch shared study packages without client CORS restrictions.
 */
export async function GET(req: NextRequest) {
  try {
    const targetUrl = req.nextUrl.searchParams.get('url');

    if (!targetUrl || !targetUrl.startsWith('https://')) {
      return NextResponse.json(
        { error: 'Valid https url parameter required' },
        { status: 400 }
      );
    }

    // Security check: ensure URL belongs to trusted/known file host providers
    const parsed = new URL(targetUrl);
    const allowedHosts = [
      'tmpfiles.org',
      'files.catbox.moe',
      'catbox.moe',
      'file.io',
      'raw.githubusercontent.com',
    ];

    const isAllowed = allowedHosts.some(
      (h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`)
    );

    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Target host is not in allowed file sharing providers list' },
        { status: 403 }
      );
    }

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'PDFNoter-App/1.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Remote storage responded with status ${response.status}` },
        { status: response.status }
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
        'Content-Length': String(arrayBuffer.byteLength),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('Share fetch proxy error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch shared document from cloud' },
      { status: 500 }
    );
  }
}
