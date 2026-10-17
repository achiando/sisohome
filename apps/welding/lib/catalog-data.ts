import { prisma } from './db';
import { mapWeldingProduct } from './adapters';
import { getAllGuides } from './guides';
import type { CatalogData, CatalogMode, CatalogService } from './types';

const BRAND_CONFIG = {
  name: 'Tijwa Welders',
  tagline: 'Fabrication, welding and practical metalwork for projects that need to last.',
  phone: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '+254 700 000 000',
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '+254 700 000 000',
  email: process.env.BRAND_EMAIL || 'hello@tijwawelders.example',
  website: process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, '') || 'www.tijwawelders.example',
  address: process.env.BRAND_ADDRESS || 'Industrial Area, Nairobi, Kenya',
  location: process.env.BRAND_LOCATION || 'Nairobi, Kenya',
  currency: 'KES',
  primaryColor: '#8B0000',
  darkColor: '#5D0000',
  lightColor: '#FBF8F4',
  footerText: 'Custom work and product quotations available on request',
};

const SERVICES: CatalogService[] = [
  {
    title: 'Custom fabrication',
    summary: 'From measurements and sketches to finished metalwork.',
    bullets: ['Frames and brackets', 'Gates and railings'],
  },
  {
    title: 'Repair & modification',
    summary: 'Practical repairs and changes to improve fit, strength or usability.',
    bullets: ['On-site assessment', 'Reinforcement work'],
  },
  {
    title: 'Cutting & preparation',
    summary: 'Material preparation for one-off builds or repeat jobs.',
    bullets: ['Cut-to-size work', 'Drilling and finishing'],
  },
  {
    title: 'Project support',
    summary: 'Help specifying materials, dimensions and finish before work begins.',
    bullets: ['Material guidance', 'Technical specifications'],
  },
];

export async function getCatalogData(mode: CatalogMode = 'welding'): Promise<CatalogData> {
  // Fetch products from database
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
    },
    include: {
      category: true,
    },
    orderBy: [
      { sortOrder: 'asc' },
      { name: 'asc' },
    ],
  });

  // Map products to catalog format
  const catalogProducts = products.map(mapWeldingProduct);

  // Fetch guides
  const guides = await getAllGuides();

  // Convert guides to catalog format
  const catalogGuides = guides.map((guide) => ({
    title: guide.title,
    slug: guide.slug,
    category: 'Material guide',
    summary: guide.description,
    tips: extractTipsFromContent(guide.content),
  }));

  return {
    mode,
    edition: new Date().getFullYear().toString(),
    brand: BRAND_CONFIG,
    guides: catalogGuides,
    services: SERVICES,
    products: catalogProducts,
    productSectionTitle: mode === 'welding' ? 'Welding products' : 'Products',
    productSectionIntro:
      mode === 'welding'
        ? 'Products are arranged by category. Each listing shows the raw product image, specification and bill of materials so a quotation can be prepared accurately.'
        : 'Product specifications and prices are indicative where shown. Ask us for availability, quantities and current quotation.',
  };
}

function extractTipsFromContent(content: string): string[] {
  // Extract bullet points from markdown content
  const lines = content.split('\n');
  const tips: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      tips.push(trimmed.replace(/^[-*]\s+/, ''));
      inList = true;
    } else if (inList && trimmed.match(/^\d+\./)) {
      tips.push(trimmed.replace(/^\d+\.\s+/, ''));
    } else if (inList && trimmed === '') {
      inList = false;
    }
  }

  return tips.slice(0, 5); // Limit to 5 tips
}
