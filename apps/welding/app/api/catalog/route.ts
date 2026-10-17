import { NextRequest, NextResponse } from 'next/server';
import { getCatalogData } from '@/lib/catalog-data';
import { generateCatalogPdf } from '@/components/catalog-pdf';
import type { CatalogMode } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mode = (searchParams.get('mode') as CatalogMode) || 'welding';
    const pageSize = (searchParams.get('pageSize') as 'A4' | 'A3') || 'A4';

    // Fetch catalog data from database
    const data = await getCatalogData(mode);

    // Generate PDF
    const outputPath = `/tmp/catalog-${mode}-${Date.now()}.pdf`;
    await generateCatalogPdf(data, {
      pageSize,
      outputPath,
    });

    // Read the generated PDF
    const fs = await import('node:fs/promises');
    const pdfBuffer = await fs.readFile(outputPath);

    // Clean up the temporary file
    await fs.unlink(outputPath);

    // Return the PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="tijwawelders-catalog-${mode}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating catalog PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate catalog PDF' },
      { status: 500 }
    );
  }
}
