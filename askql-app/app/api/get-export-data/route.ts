import { NextRequest, NextResponse } from 'next/server';

// Declare global type
declare global {
  var exportData: Record<string, any>;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const exportId = searchParams.get('id');

  if (!exportId) {
    return NextResponse.json(
      { error: 'Export ID is required' },
      { status: 400 }
    );
  }

  const data = global.exportData?.[exportId];

  if (!data) {
    return NextResponse.json(
      { error: 'Export data not found or expired' },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}
