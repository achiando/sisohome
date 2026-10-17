import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import type { CatalogData, CatalogGuide, CatalogOptions, CatalogPdfProps, CatalogProduct } from '../lib/types';

const fallback = '#8B0000';

const rgba = (hex: string, alpha: number) => {
  const c = hex.replace('#', '');
  const v = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const n = Number.parseInt(v, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

const formatPrice = (p: CatalogProduct, currency = 'KES') => {
  if (p.priceLabel) return p.priceLabel;
  if (p.minPrice == null && p.maxPrice == null) return 'Price on request';
  const m = (n: number) => `${currency} ${n.toLocaleString('en-KE')}`;
  return p.minPrice != null && p.maxPrice != null && p.minPrice !== p.maxPrice
    ? `${m(p.minPrice)} – ${m(p.maxPrice)}`
    : m(p.minPrice ?? p.maxPrice ?? 0);
};

const textValue = (v: unknown) =>
  v == null
    ? ''
    : ['string', 'number', 'boolean'].includes(typeof v)
      ? String(v)
      : JSON.stringify(v);

const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontFamily: 'Helvetica',
    color: '#272727',
    backgroundColor: '#FFF',
  },
  cover: {
    padding: 0,
    backgroundColor: '#FBF8F4',
    position: 'relative',
  },
  coverTop: {
    height: '58%',
    backgroundColor: '#8B0000',
    padding: 60,
    justifyContent: 'space-between',
    position: 'relative',
  },
  coverPattern: {
    position: 'absolute',
    right: -100,
    top: -100,
    width: 400,
    height: 400,
    backgroundColor: '#B22222',
    opacity: 0.15,
    borderRadius: 400,
  },
  coverAccent: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 200,
    height: 200,
    backgroundColor: '#B22222',
    opacity: 0.6,
    borderBottomLeftRadius: 200,
  },
  coverLogo: {
    width: 100,
    height: 100,
    objectFit: 'contain',
    alignSelf: 'flex-end',
  },
  coverKicker: {
    color: '#F7D9C7',
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 20,
    fontWeight: 'bold',
  },
  coverTitle: {
    color: '#FFF',
    fontSize: 56,
    lineHeight: 1.1,
    fontFamily: 'Helvetica-Bold',
    maxWidth: 500,
    marginBottom: 16,
  },
  coverTagline: {
    color: '#FFE9DE',
    fontSize: 16,
    maxWidth: 450,
    lineHeight: 1.5,
    fontWeight: 'light',
  },
  coverBottom: {
    padding: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  coverContact: {
    width: '60%',
  },
  coverContactLabel: {
    color: '#8B0000',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
    fontWeight: 'bold',
  },
  coverContactText: {
    fontSize: 11,
    lineHeight: 1.6,
    color: '#4A3F3A',
  },
  edition: {
    color: '#8B0000',
    fontSize: 11,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  editionSub: {
    color: '#8B0000',
    fontSize: 28,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
    borderBottomWidth: 2,
    borderBottomColor: '#E6DCD7',
    paddingBottom: 16,
    paddingHorizontal: 50,
    paddingTop: 40,
  },
  smallBrand: {
    fontSize: 10,
    color: '#8B0000',
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  pageNumber: {
    fontSize: 9,
    color: '#82736D',
    fontWeight: 'bold',
  },
  sectionKicker: {
    color: '#8B0000',
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 36,
    fontFamily: 'Helvetica-Bold',
    color: '#26201E',
    marginBottom: 16,
    lineHeight: 1.2,
  },
  sectionIntro: {
    fontSize: 12,
    color: '#6D625E',
    lineHeight: 1.6,
    maxWidth: 550,
    marginBottom: 32,
  },
  tocRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 20,
    paddingHorizontal: 50,
  },
  tocNumber: {
    color: '#8B0000',
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    width: 40,
    fontWeight: 'bold',
  },
  tocTitle: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: '#26201E',
  },
  tocMeta: {
    color: '#8B0000',
    fontSize: 10,
    marginLeft: 12,
    fontWeight: 'bold',
  },
  tocLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#E6DCD7',
    marginHorizontal: 12,
  },
  guideCard: {
    marginBottom: 24,
    paddingLeft: 20,
    borderLeftWidth: 4,
    backgroundColor: '#FAF8F5',
    padding: 20,
    borderRadius: 8,
  },
  guideCategory: {
    color: '#8B0000',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  guideTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    color: '#26201E',
  },
  guideSummary: {
    fontSize: 11,
    lineHeight: 1.6,
    color: '#5C504B',
    marginBottom: 12,
  },
  tip: {
    fontSize: 10,
    lineHeight: 1.6,
    color: '#6D625E',
    marginBottom: 4,
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -12,
  },
  serviceCard: {
    width: '50%',
    padding: 24,
    marginBottom: 24,
    borderRadius: 12,
  },
  serviceTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#FFF',
    marginBottom: 8,
  },
  serviceSummary: {
    fontSize: 11,
    lineHeight: 1.5,
    color: '#FFE9DE',
    marginBottom: 12,
  },
  serviceBullet: {
    fontSize: 10,
    lineHeight: 1.6,
    color: '#F7D9C7',
    marginBottom: 4,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -16,
  },
  productCard: {
    width: '50%',
    padding: 16,
    marginBottom: 24,
  },
  productImage: {
    width: '100%',
    height: 180,
    objectFit: 'cover',
    borderRadius: 8,
    marginBottom: 16,
  },
  productImagePlaceholder: {
    width: '100%',
    height: 180,
    backgroundColor: '#E6DCD7',
    borderRadius: 8,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImagePlaceholderText: {
    fontSize: 10,
    color: '#82736D',
  },
  productBody: {
    flex: 1,
  },
  productCategory: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
    fontWeight: 'bold',
  },
  productName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    color: '#26201E',
    lineHeight: 1.3,
  },
  productDesc: {
    fontSize: 10,
    lineHeight: 1.5,
    color: '#6D625E',
    marginBottom: 12,
  },
  spec: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  specKey: {
    fontSize: 9,
    color: '#82736D',
    width: 120,
    fontWeight: 'bold',
  },
  specValue: {
    fontSize: 9,
    color: '#5C504B',
    flex: 1,
  },
  price: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginTop: 12,
  },
  weldingCategory: {
    padding: 20,
    marginBottom: 24,
    borderRadius: 8,
  },
  weldingCategoryTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#FFF',
    marginBottom: 4,
  },
  weldingCategoryMeta: {
    fontSize: 11,
    color: '#F7D9C7',
  },
  weldingRow: {
    flexDirection: 'row',
    marginBottom: 32,
    alignItems: 'flex-start',
  },
  weldingRawImage: {
    width: 140,
    height: 140,
    objectFit: 'cover',
    borderRadius: 8,
    marginRight: 20,
  },
  weldingImagePlaceholder: {
    width: 140,
    height: 140,
    backgroundColor: '#E6DCD7',
    borderRadius: 8,
    marginRight: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weldingDetails: {
    flex: 1,
  },
  weldingProductName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    color: '#26201E',
  },
  weldingDescription: {
    fontSize: 11,
    lineHeight: 1.5,
    color: '#6D625E',
    marginBottom: 16,
  },
  weldingSubhead: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontWeight: 'bold',
    color: '#8B0000',
  },
  weldingBom: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weldingBomItem: {
    fontSize: 9,
    color: '#5C504B',
    flex: 1,
  },
  weldingBomSpec: {
    fontSize: 9,
    color: '#82736D',
    marginLeft: 12,
  },
  weldingBomQty: {
    fontSize: 9,
    color: '#8B0000',
    marginLeft: 12,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E6DCD7',
    paddingTop: 16,
  },
  footerText: {
    fontSize: 8,
    color: '#82736D',
  },
  contentSection: {
    paddingHorizontal: 50,
    paddingVertical: 40,
  },
});

function Header({ brand, page }: { brand: CatalogData['brand']; page: string | number }) {
  return (
    <View style={styles.pageHeader} fixed>
      <Text style={[styles.smallBrand, { color: brand.primaryColor ?? fallback }]}>
        {brand.name.toUpperCase()}
      </Text>
      <Text style={styles.pageNumber}>{String(page)}</Text>
    </View>
  );
}

function Footer({ brand, page }: { brand: CatalogData['brand']; page: string | number }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>{brand.footerText ?? brand.website ?? brand.phone ?? ''}</Text>
      <Text style={styles.footerText}>{brand.location ?? brand.address ?? ''}</Text>
      <Text style={styles.footerText}>Page {String(page)}</Text>
    </View>
  );
}

function Cover({ data, pageSize }: CatalogPdfProps) {
  const { brand, edition } = data;
  const primary = brand.primaryColor ?? fallback;

  return (
    <Page size={pageSize} style={[styles.cover, { backgroundColor: brand.lightColor ?? '#FBF8F4' }]}>
      <View style={[styles.coverTop, { backgroundColor: primary }]}>
        <View style={[styles.coverPattern]} />
        <View style={[styles.coverAccent, { backgroundColor: brand.darkColor ?? '#5D0000' }]} />
        {brand.logoPath ? (
          <Image src={brand.logoPath} style={styles.coverLogo} />
        ) : (
          <View style={{ height: 100 }} />
        )}
        <View>
          <Text style={styles.coverKicker}>
            {data.mode === 'welding' ? 'Welding & Fabrication' : 'Tools, Components & Projects'}
          </Text>
          <Text style={styles.coverTitle}>{brand.name}</Text>
          {brand.tagline && <Text style={styles.coverTagline}>{brand.tagline}</Text>}
        </View>
      </View>
      <View style={styles.coverBottom}>
        <View style={styles.coverContact}>
          <Text style={[styles.coverContactLabel, { color: primary }]}>Contact & Enquiries</Text>
          <Text style={styles.coverContactText}>
            {[brand.phone, brand.whatsapp && `WhatsApp: ${brand.whatsapp}`, brand.email, brand.website, brand.address ?? brand.location]
              .filter(Boolean)
              .join('\n')}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.edition, { color: primary }]}>{edition ?? new Date().getFullYear().toString()}</Text>
          <Text style={[styles.editionSub, { color: primary }]}>CATALOGUE</Text>
        </View>
      </View>
      <Footer brand={brand} page="1" />
    </Page>
  );
}

function Contents({ data, pageSize }: CatalogPdfProps) {
  // Calculate page numbers
  let currentPage = 3; // Cover is 1, Contents is 2
  const guidesCount = data.guides?.length ?? 0;
  const guidesPages = guidesCount > 0 ? Math.ceil(guidesCount / 4) : 0;
  const servicesCount = data.services?.length ?? 0;
  const servicesPages = servicesCount > 0 ? Math.ceil(servicesCount / 4) : 0;
  const productsPages = data.mode === 'welding'
    ? new Set(data.products.map((p) => p.category)).size
    : Math.ceil(data.products.length / 6);

  const guidesStart = currentPage;
  const guidesEnd = guidesStart + guidesPages - 1;
  const servicesStart = guidesEnd + 1;
  const servicesEnd = servicesStart + servicesPages - 1;
  const productsStart = servicesEnd + 1;
  const productsEnd = productsStart + productsPages - 1;

  // If no guides, adjust services start
  const hasGuides = guidesCount > 0;
  const hasServices = servicesCount > 0;
  const actualServicesStart = hasGuides ? servicesStart : guidesStart;
  const actualServicesEnd = hasGuides ? servicesEnd : actualServicesStart + servicesPages - 1;
  const actualProductsStart = hasServices ? actualServicesEnd + 1 : (hasGuides ? guidesEnd + 1 : guidesStart);
  const actualProductsEnd = actualProductsStart + productsPages - 1;

  const entries = [
    { n: '01', title: 'At a glance', meta: 'Company & contact', page: '2' },
    ...(hasGuides
      ? [
          {
            n: '02',
            title: 'Material guides',
            meta: `${guidesCount} guides`,
            page: guidesPages === 1 ? `${guidesStart}` : `${guidesStart}-${guidesEnd}`,
          },
        ]
      : []),
    ...(hasServices
      ? [
          {
            n: hasGuides ? '03' : '02',
            title: 'Services',
            meta: `${servicesCount} services`,
            page: servicesPages === 1 ? `${actualServicesStart}` : `${actualServicesStart}-${actualServicesEnd}`,
          },
        ]
      : []),
    {
      n: hasGuides && hasServices
        ? '04'
        : hasGuides || hasServices
          ? '03'
          : '02',
      title: data.productSectionTitle ?? 'Products',
      meta: `${data.products.length} products`,
      page: productsPages === 1 ? `${actualProductsStart}` : `${actualProductsStart}-${actualProductsEnd}`,
    },
  ];

  return (
    <Page size={pageSize} style={styles.page}>
      <Header brand={data.brand} page="2" />
      <View style={styles.contentSection}>
        <Text style={[styles.sectionKicker, { color: data.brand.primaryColor ?? fallback }]}>
          Inside this edition
        </Text>
        <Text style={styles.sectionTitle}>Find what you need.</Text>
        <Text style={styles.sectionIntro}>
          A compact view of our capabilities, practical guidance and selected products. Use this
          catalogue as a starting point, then contact us for a tailored quotation.
        </Text>
        <View style={{ marginTop: 24 }}>
          {entries.map((e) => (
            <View style={styles.tocRow} key={e.n}>
              <Text style={[styles.tocNumber, { color: data.brand.primaryColor ?? fallback }]}>{e.n}</Text>
              <Text style={styles.tocTitle}>{e.title}</Text>
              <View style={styles.tocLine} />
              <Text style={[styles.tocMeta, { color: data.brand.primaryColor ?? fallback }]}>{e.page}</Text>
            </View>
          ))}
        </View>
        <View
          style={{
            marginTop: 80,
            padding: 28,
            backgroundColor: rgba(data.brand.primaryColor ?? fallback, 0.08),
            borderRadius: 12,
          }}
        >
          <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 12 }}>
            Need a custom quotation?
          </Text>
          <Text style={{ fontSize: 11, lineHeight: 1.6, color: '#5C504B' }}>
            Send us the product names, quantities, dimensions or a reference image. We will help you
            choose the right solution.
          </Text>
        </View>
      </View>
      <Footer brand={data.brand} page="2" />
    </Page>
  );
}

function Guides({ data, pageSize, startPage = 3 }: CatalogPdfProps) {
  const guides = data.guides;
  if (!guides || guides.length === 0) return null;

  const GUIDES_PER_PAGE = 4;
  const pages = Math.ceil(guides.length / GUIDES_PER_PAGE);

  return (
    <>
      {Array.from({ length: pages }).map((_, pageIndex) => {
        const start = pageIndex * GUIDES_PER_PAGE;
        const end = start + GUIDES_PER_PAGE;
        const pageGuides = guides.slice(start, end);
        const isFirstPage = pageIndex === 0;
        const currentPage = startPage + pageIndex;

        return (
          <Page size={pageSize} style={styles.page} key={pageIndex}>
            <Header brand={data.brand} page={currentPage} />
            <View style={styles.contentSection}>
              {isFirstPage && (
                <>
                  <Text style={[styles.sectionKicker, { color: data.brand.primaryColor ?? fallback }]}>
                    Practical guidance
                  </Text>
                  <Text style={styles.sectionTitle}>Material guides</Text>
                  <Text style={styles.sectionIntro}>
                    Short references to help customers compare materials and start a conversation with the
                    right requirements.
                  </Text>
                </>
              )}
              {pageGuides.map((g: CatalogGuide) => (
                <View
                  style={[styles.guideCard, { borderLeftColor: data.brand.primaryColor ?? fallback }]}
                  wrap={false}
                  key={`${g.category}-${g.title}`}
                >
                  <Text style={[styles.guideCategory, { color: data.brand.primaryColor ?? fallback }]}>
                    {g.category}
                  </Text>
                  <Text style={styles.guideTitle}>{g.title}</Text>
                  <Text style={styles.guideSummary}>{g.summary}</Text>
                  {g.tips?.slice(0, 3).map((t) => (
                    <Text style={styles.tip} key={t}>
                      • {t}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
            <Footer brand={data.brand} page={currentPage} />
          </Page>
        );
      })}
    </>
  );
}

function Services({ data, pageSize, startPage = 3 }: CatalogPdfProps) {
  const services = data.services;
  if (!services || services.length === 0) return null;

  const SERVICES_PER_PAGE = 4;
  const pages = Math.ceil(services.length / SERVICES_PER_PAGE);

  return (
    <>
      {Array.from({ length: pages }).map((_, pageIndex) => {
        const start = pageIndex * SERVICES_PER_PAGE;
        const end = start + SERVICES_PER_PAGE;
        const pageServices = services.slice(start, end);
        const isFirstPage = pageIndex === 0;
        const currentPage = startPage + pageIndex;

        return (
          <Page size={pageSize} style={styles.page} key={pageIndex}>
            <Header brand={data.brand} page={currentPage} />
            <View style={styles.contentSection}>
              {isFirstPage && (
                <>
                  <Text style={[styles.sectionKicker, { color: data.brand.primaryColor ?? fallback }]}>
                    What we do
                  </Text>
                  <Text style={styles.sectionTitle}>Services</Text>
                  <Text style={styles.sectionIntro}>
                    From one-off jobs to repeat supply, we focus on practical, well-specified work that fits
                    the project.
                  </Text>
                </>
              )}
              <View style={styles.serviceGrid}>
                {pageServices.map((s) => (
                  <View
                    style={[styles.serviceCard, { backgroundColor: data.brand.primaryColor ?? fallback }]}
                    wrap={false}
                    key={s.title}
                  >
                    <Text style={styles.serviceTitle}>{s.title}</Text>
                    <Text style={styles.serviceSummary}>{s.summary}</Text>
                    {s.bullets?.map((b) => (
                      <Text style={styles.serviceBullet} key={b}>
                        • {b}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </View>
            <Footer brand={data.brand} page={currentPage} />
          </Page>
        );
      })}
    </>
  );
}

function DiyProducts({ data, pageSize, startPage = 3 }: CatalogPdfProps) {
  const PRODUCTS_PER_PAGE = 6;
  const pages = Math.ceil(data.products.length / PRODUCTS_PER_PAGE);

  return (
    <>
      {Array.from({ length: pages }).map((_, pageIndex) => {
        const start = pageIndex * PRODUCTS_PER_PAGE;
        const end = start + PRODUCTS_PER_PAGE;
        const pageProducts = data.products.slice(start, end);
        const isFirstPage = pageIndex === 0;
        const currentPage = startPage + pageIndex;

        return (
          <Page size={pageSize} style={styles.page} key={pageIndex}>
            <Header brand={data.brand} page={currentPage} />
            <View style={styles.contentSection}>
              {isFirstPage && (
                <>
                  <Text style={[styles.sectionKicker, { color: data.brand.primaryColor ?? fallback }]}>
                    Selected range
                  </Text>
                  <Text style={styles.sectionTitle}>{data.productSectionTitle ?? 'Products'}</Text>
                  <Text style={styles.sectionIntro}>
                    {data.productSectionIntro ??
                      'Product specifications and prices are indicative where shown. Ask us for availability, quantities and current quotation.'}
                  </Text>
                </>
              )}
              <View style={styles.productGrid}>
                {pageProducts.map((p) => (
                  <View style={styles.productCard} wrap={false} key={p.id}>
                    {p.imagePath ? (
                      <Image src={p.imagePath} style={styles.productImage} />
                    ) : (
                      <View style={styles.productImagePlaceholder}>
                        <Text style={styles.productImagePlaceholderText}>Product image</Text>
                      </View>
                    )}
                    <View style={styles.productBody}>
                      <Text style={[styles.productCategory, { color: data.brand.primaryColor ?? fallback }]}>
                        {p.category}
                      </Text>
                      <Text style={styles.productName}>{p.name}</Text>
                      {(p.shortDescription ?? p.description) && (
                        <Text style={styles.productDesc}>{p.shortDescription ?? p.description}</Text>
                      )}
                      {p.specifications &&
                        Object.entries(p.specifications).slice(0, 4).map(([k, v]) => (
                          <View style={styles.spec} key={k}>
                            <Text style={styles.specKey}>{k}</Text>
                            <Text style={styles.specValue}>{textValue(v)}</Text>
                          </View>
                        ))}
                      <Text style={[styles.price, { color: data.brand.primaryColor ?? fallback }]}>
                        {formatPrice(p, data.brand.currency)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
            <Footer brand={data.brand} page={currentPage} />
          </Page>
        );
      })}
    </>
  );
}

function WeldingProducts({ data, pageSize, startPage = 3 }: CatalogPdfProps) {
  const groups = Array.from(new Set(data.products.map((p) => p.category)));

  return (
    <>
      {groups.map((category, categoryIndex) => {
        const categoryProducts = data.products.filter((p) => p.category === category);
        const isFirstCategory = categoryIndex === 0;
        const currentPage = startPage + categoryIndex;

        return (
          <Page size={pageSize} style={styles.page} key={category}>
            <Header brand={data.brand} page={currentPage} />
            <View style={styles.contentSection}>
              {isFirstCategory && (
                <>
                  <Text style={[styles.sectionKicker, { color: data.brand.primaryColor ?? fallback }]}>
                    Technical range
                  </Text>
                  <Text style={styles.sectionTitle}>{data.productSectionTitle ?? 'Welding products'}</Text>
                  <Text style={styles.sectionIntro}>
                    {data.productSectionIntro ??
                      'Products are arranged by category. Each listing shows the raw product image, specification and bill of materials so a quotation can be prepared accurately.'}
                  </Text>
                </>
              )}
              <View style={[styles.weldingCategory, { backgroundColor: data.brand.primaryColor ?? fallback }]}>
                <Text style={styles.weldingCategoryTitle}>{category}</Text>
                <Text style={styles.weldingCategoryMeta}>
                  {categoryProducts.length} listed product{categoryProducts.length === 1 ? '' : 's'}
                </Text>
              </View>
              {categoryProducts.map((p) => (
                <View style={styles.weldingRow} wrap={false} key={p.id}>
                  {p.imagePath ? (
                    <Image src={p.imagePath} style={styles.weldingRawImage} />
                  ) : (
                    <View style={styles.weldingImagePlaceholder}>
                      <Text style={styles.productImagePlaceholderText}>Raw product image</Text>
                    </View>
                  )}
                  <View style={styles.weldingDetails}>
                    <Text style={styles.weldingProductName}>{p.name}</Text>
                    {(p.shortDescription ?? p.description) && (
                      <Text style={styles.weldingDescription}>{p.shortDescription ?? p.description}</Text>
                    )}
                    <Text style={styles.weldingSubhead}>Specification</Text>
                    {p.specifications &&
                      Object.entries(p.specifications).map(([k, v]) => (
                        <View style={styles.spec} key={k}>
                          <Text style={styles.specKey}>{k}</Text>
                          <Text style={styles.specValue}>{textValue(v)}</Text>
                        </View>
                      ))}
                    <Text style={styles.weldingSubhead}>Bill of materials</Text>
                    {p.billOfMaterials?.length ? (
                      p.billOfMaterials.map((bom) => (
                        <View style={styles.weldingBom} key={`${bom.item}-${bom.specification}`}>
                          <Text style={styles.weldingBomItem}>{bom.item}</Text>
                          {bom.specification && (
                            <Text style={styles.weldingBomSpec}>{bom.specification}</Text>
                          )}
                          {bom.quantity && <Text style={styles.weldingBomQty}>{bom.quantity}</Text>}
                        </View>
                      ))
                    ) : (
                      <Text style={{ fontSize: 9, color: '#82736D', fontStyle: 'italic' }}>
                        Not specified
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
            <Footer brand={data.brand} page={currentPage} />
          </Page>
        );
      })}
    </>
  );
}

function Products({ data, pageSize, startPage = 3 }: CatalogPdfProps) {
  return data.mode === 'welding' ? (
    <WeldingProducts data={data} pageSize={pageSize} startPage={startPage} />
  ) : (
    <DiyProducts data={data} pageSize={pageSize} startPage={startPage} />
  );
}

export function CatalogDocument({ data, pageSize }: CatalogPdfProps) {
  // Calculate page numbers
  let currentPage = 3; // Cover is 1, Contents is 2
  const guidesCount = data.guides?.length ?? 0;
  const guidesPages = guidesCount > 0 ? Math.ceil(guidesCount / 4) : 0;
  const servicesCount = data.services?.length ?? 0;
  const servicesPages = servicesCount > 0 ? Math.ceil(servicesCount / 4) : 0;

  const guidesStart = currentPage;
  const guidesEnd = guidesStart + guidesPages - 1;
  const servicesStart = guidesEnd + 1;
  const servicesEnd = servicesStart + servicesPages - 1;
  const productsStart = servicesEnd + 1;

  // If no guides, adjust services start
  const hasGuides = guidesCount > 0;
  const hasServices = servicesCount > 0;
  const actualServicesStart = hasGuides ? servicesStart : guidesStart;
  const actualServicesEnd = hasGuides ? servicesEnd : actualServicesStart + servicesPages - 1;
  const actualProductsStart = hasServices ? actualServicesEnd + 1 : (hasGuides ? guidesEnd + 1 : guidesStart);

  return (
    <Document title={`${data.brand.name} Catalogue`} author={data.brand.name}>
      <Cover data={data} pageSize={pageSize} />
      <Contents data={data} pageSize={pageSize} />
      {hasGuides ? (
        <Guides data={data} pageSize={pageSize} startPage={guidesStart} />
      ) : null}
      {hasServices ? (
        <Services data={data} pageSize={pageSize} startPage={actualServicesStart} />
      ) : null}
      <Products data={data} pageSize={pageSize} startPage={actualProductsStart} />
    </Document>
  );
}

export async function generateCatalogPdf(data: CatalogData, options: CatalogOptions) {
  const output = await pdf(<CatalogDocument data={data} pageSize={options.pageSize ?? 'A4'} />).toBuffer();
  const chunks: Buffer[] = [];
  for await (const chunk of output as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);
  const { writeFile } = await import('node:fs/promises');
  await writeFile(options.outputPath, buffer);
  return options.outputPath;
}
