import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

// Declare global type
declare global {
  var exportData: Record<string, any>;
}

export async function POST(request: NextRequest) {
  try {
    const { messages, conversationId } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid messages data' },
        { status: 400 }
      );
    }

    // Store data in a way the print page can access it
    // We'll use the URL to pass a temporary ID
    const exportId = `export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // In a production app, you'd store this in Redis or a database
    // For now, we'll use a simple in-memory store
    global.exportData = global.exportData || {};
    global.exportData[exportId] = {
      messages,
      conversationId,
      timestamp: new Date().toISOString()
    };

    // Get the base URL
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    // Launch headless browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Navigate to the print page
    await page.goto(`${baseUrl}/print-chat?id=${exportId}`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait a bit for any animations or lazy loading
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    await browser.close();

    // Clean up the temporary data
    delete global.exportData[exportId];

    // Return PDF as downloadable file
    const filename = `chat-export-${conversationId || 'new'}-${new Date().toISOString().split('T')[0]}.pdf`;
    
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
