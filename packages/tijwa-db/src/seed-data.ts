export type SeedSpec = {
  label: string
  material: string
  pieces?: number
}

export type SeedImage = {
  url: string
  alt: string
}

export type SeedCategory = {
  name: string
  slug: string
  description: string
  sortOrder: number
}

export type SeedProduct = {
  categorySlug: string
  name: string
  slug: string
  shortDesc: string
  description: string
  specifications: SeedSpec[]
  images: SeedImage[]
  isFeatured: boolean
  sortOrder: number
  seoTitle: string
  seoDesc: string
  priceRange?: string
}

export type SeedProject = {
  title: string
  slug: string
  type: string
  description: string
  images: SeedImage[]
  isFeatured: boolean
  sortOrder: number
  seoTitle: string
  seoDesc: string
}

function seedImage(slug: string, alt: string, second = false): SeedImage[] {
  return [{ url: `/seed/${slug}${second ? "-2" : ""}.jpg`, alt }]
}

export const categories: SeedCategory[] = [
  {
    name: "Gates",
    slug: "gates",
    description:
      "Sliding, pedestrian and swing gates fabricated to the size of your opening, in your choice of tube and gauge.",
    sortOrder: 1,
  },
  {
    name: "Doors",
    slug: "doors",
    description:
      "Steel security doors, double doors and door frames fabricated from tube and sheet.",
    sortOrder: 2,
  },
  {
    name: "Windows & Grills",
    slug: "windows",
    description:
      "Window grills, steel window frames and expanded metal screens sized to your window openings.",
    sortOrder: 3,
  },
  {
    name: "Railings",
    slug: "railings",
    description:
      "Balcony railings, stair railings and handrails fabricated from square tube to your measurements.",
    sortOrder: 4,
  },
  {
    name: "Structural",
    slug: "structural",
    description:
      "Beams, columns and structural steelwork fabricated from plate and section to your drawing.",
    sortOrder: 5,
  },
  {
    name: "Custom Fabrication",
    slug: "custom-fabrication",
    description:
      "One-off fabricated items made from your drawing, sketch or sample, in tube, sheet or plate.",
    sortOrder: 6,
  },
]

export const products: SeedProduct[] = [
  {
    categorySlug: "gates",
    name: "Steel Sliding Gate",
    slug: "steel-sliding-gate",
    shortDesc: "Sliding gate fabricated to the width and height of your opening.",
    description:
      "A sliding gate built on a square tube frame with a choice of 3/4 inch or 1 inch tube and gauge 16 or gauge 18 infill. Send the opening measurement and we return a quotation on WhatsApp before any work starts.",
    specifications: [
      { label: "Frame", material: "3/4 inch or 1 inch square tube", pieces: 1 },
      { label: "Infill", material: "Gauge 16 or gauge 18", pieces: 2 },
      { label: "Operation", material: "Sliding" },
      { label: "Sizing", material: "Made to your opening measurement" },
    ],
    images: [
      ...seedImage(
        "steel-sliding-gate",
        "Blue steel sliding gate set into a brick wall",
      ),
      ...seedImage(
        "steel-sliding-gate",
        "Close-up of a sliding gate latch on a steel frame",
        true,
      ),
    ],
    isFeatured: true,
    sortOrder: 1,
    seoTitle: "Steel Sliding Gates | TijwaWelders",
    seoDesc:
      "Steel sliding gates fabricated to your opening in 3/4 inch or 1 inch tube, gauge 16 or gauge 18.",
    priceRange: "KES 25,000 - KES 45,000",
  },
  {
    categorySlug: "gates",
    name: "Steel Pedestrian Gate",
    slug: "steel-pedestrian-gate",
    shortDesc: "Single leaf pedestrian gate for a walkway or side entrance.",
    description:
      "A pedestrian gate on a 3/4 inch square tube frame with gauge 16 or gauge 18 infill. Fabricated to the opening measurement you give us.",
    specifications: [
      { label: "Frame", material: "3/4 inch square tube", pieces: 1 },
      { label: "Infill", material: "Gauge 16 or gauge 18", pieces: 1 },
      { label: "Operation", material: "Single swing" },
      { label: "Sizing", material: "Made to your opening measurement" },
    ],
    images: seedImage(
      "steel-pedestrian-gate",
      "Metal pedestrian gate between stone pillars on a garden path",
    ),
    isFeatured: false,
    sortOrder: 2,
    seoTitle: "Steel Pedestrian Gates | TijwaWelders",
    seoDesc:
      "Pedestrian gates fabricated from 3/4 inch square tube with gauge 16 or gauge 18 infill.",
    priceRange: "KES 8,000 - KES 15,000",
  },
  {
    categorySlug: "gates",
    name: "Steel Security Gate",
    slug: "steel-security-gate",
    shortDesc: "Close-spaced infill gate for entrances that need extra cover.",
    description:
      "A security gate with closely spaced infill on a 1 inch square tube frame. Available in gauge 16 or gauge 18, fabricated to your opening measurement.",
    specifications: [
      { label: "Frame", material: "1 inch square tube", pieces: 1 },
      { label: "Infill", material: "Gauge 16 or gauge 18, close spacing", pieces: 2 },
      { label: "Operation", material: "Swing or sliding" },
      { label: "Sizing", material: "Made to your opening measurement" },
    ],
    images: seedImage(
      "steel-security-gate",
      "Vertical bar security gate in a brick archway",
    ),
    isFeatured: false,
    sortOrder: 3,
    seoTitle: "Steel Security Gates | TijwaWelders",
    seoDesc:
      "Security gates with close-spaced gauge 16 or gauge 18 infill on a 1 inch square tube frame.",
    priceRange: "KES 20,000 - KES 40,000",
  },
  {
    categorySlug: "gates",
    name: "Steel Swing Gate",
    slug: "steel-swing-gate",
    shortDesc: "Double leaf swing gate fabricated for a driveway or yard.",
    description:
      "A double leaf swing gate on a 1 inch square tube frame with gauge 16 or gauge 18 infill, made to the width of your opening.",
    specifications: [
      { label: "Frame", material: "1 inch square tube", pieces: 1 },
      { label: "Infill", material: "Gauge 16 or gauge 18", pieces: 2 },
      { label: "Operation", material: "Double swing" },
      { label: "Sizing", material: "Made to your opening measurement" },
    ],
    images: seedImage(
      "steel-swing-gate",
      "Black steel swing gate closing a driveway between stone walls",
    ),
    isFeatured: false,
    sortOrder: 4,
    seoTitle: "Steel Swing Gates | TijwaWelders",
    seoDesc:
      "Double leaf swing gates fabricated from 1 inch square tube in gauge 16 or gauge 18.",
    priceRange: "KES 30,000 - KES 55,000",
  },

  {
    categorySlug: "doors",
    name: "Steel Security Door",
    slug: "steel-security-door",
    shortDesc: "Single leaf steel door fabricated to your door opening.",
    description:
      "A steel security door with a sheet skin in gauge 16 or gauge 18 on a 1 inch square tube frame, fabricated to the door opening you measure.",
    specifications: [
      { label: "Frame", material: "1 inch square tube", pieces: 1 },
      { label: "Skin", material: "Steel sheet, gauge 16 or gauge 18", pieces: 1 },
      { label: "Leaf", material: "Single leaf", pieces: 1 },
      { label: "Sizing", material: "Made to your door opening" },
    ],
    images: [
      ...seedImage("steel-security-door", "Dark red steel door in a courtyard"),
      ...seedImage(
        "steel-security-door",
        "Brushed steel lever handle with keys in a door lock",
        true,
      ),
    ],
    isFeatured: true,
    sortOrder: 1,
    seoTitle: "Steel Security Doors | TijwaWelders",
    seoDesc:
      "Steel security doors with gauge 16 or gauge 18 sheet skin on a 1 inch square tube frame.",
    priceRange: "KES 18,000 - KES 35,000",
  },
  {
    categorySlug: "doors",
    name: "Steel Door Frame",
    slug: "steel-door-frame",
    shortDesc: "Door frame fabricated to your opening for a steel or timber leaf.",
    description:
      "A fabricated steel door frame made to your opening measurement. Confirm the frame section and leaf you plan to hang when you request the quote.",
    specifications: [
      { label: "Frame", material: "Fabricated steel section", pieces: 1 },
      { label: "Leaf", material: "To suit your existing or new leaf", pieces: 1 },
      { label: "Sizing", material: "Made to your door opening" },
    ],
    images: seedImage(
      "steel-door-frame",
      "Arched double entry doors with grille inserts in a house facade",
    ),
    isFeatured: false,
    sortOrder: 2,
    seoTitle: "Steel Door Frames | TijwaWelders",
    seoDesc: "Steel door frames fabricated to your measured door opening.",
    priceRange: "KES 6,000 - KES 12,000",
  },
  {
    categorySlug: "doors",
    name: "Steel Double Door",
    slug: "steel-double-door",
    shortDesc: "Double leaf steel door for a wide entrance.",
    description:
      "A double leaf steel door with sheet skin in gauge 16 or gauge 18 on a 1 inch square tube frame, made to the width of your entrance.",
    specifications: [
      { label: "Frame", material: "1 inch square tube", pieces: 1 },
      { label: "Skin", material: "Steel sheet, gauge 16 or gauge 18", pieces: 2 },
      { label: "Leaf", material: "Double leaf", pieces: 2 },
      { label: "Sizing", material: "Made to your entrance width" },
    ],
    images: seedImage(
      "steel-double-door",
      "Black metal double doors with decorative grille tops",
    ),
    isFeatured: false,
    sortOrder: 3,
    seoTitle: "Steel Double Doors | TijwaWelders",
    seoDesc:
      "Double leaf steel doors fabricated from 1 inch square tube with gauge 16 or gauge 18 skin.",
    priceRange: "KES 35,000 - KES 60,000",
  },

  {
    categorySlug: "windows",
    name: "Window Grills",
    slug: "window-grills",
    shortDesc: "Window grills fabricated to each window opening.",
    description:
      "Window grills built on a 3/4 inch square tube frame with gauge 16 or gauge 18 bar infill, fabricated to the window openings you measure.",
    specifications: [
      { label: "Frame", material: "3/4 inch square tube", pieces: 1 },
      { label: "Infill", material: "Gauge 16 or gauge 18 bar", pieces: 1 },
      { label: "Sizing", material: "Made to each window opening" },
    ],
    images: [
      ...seedImage(
        "window-grills",
        "Decorative metal window grill with a fleur-de-lis pattern",
      ),
      ...seedImage(
        "window-grills",
        "Window with black security bars set into a stone wall",
        true,
      ),
    ],
    isFeatured: true,
    sortOrder: 1,
    seoTitle: "Window Grills | TijwaWelders",
    seoDesc:
      "Window grills fabricated from 3/4 inch square tube with gauge 16 or gauge 18 bar infill.",
    priceRange: "KES 3,500 - KES 8,000",
  },
  {
    categorySlug: "windows",
    name: "Steel Window Frame",
    slug: "steel-window-frame",
    shortDesc: "Steel window frame fabricated to your window opening.",
    description:
      "A fabricated steel window frame made to your window measurement. Tell us the glazing you intend to fit so the frame section can be quoted correctly.",
    specifications: [
      { label: "Frame", material: "Fabricated steel section", pieces: 1 },
      { label: "Glazing", material: "To suit your chosen glazing" },
      { label: "Sizing", material: "Made to your window opening" },
    ],
    images: seedImage(
      "steel-window-frame",
      "Arched window in a white steel frame set into a rendered wall",
    ),
    isFeatured: false,
    sortOrder: 2,
    seoTitle: "Steel Window Frames | TijwaWelders",
    seoDesc: "Steel window frames fabricated to your measured window opening.",
    priceRange: "KES 5,000 - KES 10,000",
  },
  {
    categorySlug: "windows",
    name: "Expanded Metal Window Screen",
    slug: "expanded-metal-screen",
    shortDesc: "Expanded metal panel set into a square tube frame.",
    description:
      "An expanded metal sheet panel welded into a 3/4 inch square tube frame for window openings that need cover without blocking airflow.",
    specifications: [
      { label: "Panel", material: "Expanded metal sheet", pieces: 1 },
      { label: "Frame", material: "3/4 inch square tube", pieces: 1 },
      { label: "Sizing", material: "Made to your window opening" },
    ],
    images: seedImage(
      "expanded-metal-screen",
      "Close-up of an expanded metal mesh panel",
    ),
    isFeatured: false,
    sortOrder: 3,
    seoTitle: "Expanded Metal Window Screens | TijwaWelders",
    seoDesc:
      "Expanded metal window screens welded into 3/4 inch square tube frames.",
    priceRange: "KES 2,500 - KES 5,000",
  },

  {
    categorySlug: "railings",
    name: "Balcony Railings",
    slug: "balcony-railings",
    shortDesc: "Balcony railing fabricated to your site measurement.",
    description:
      "A balcony railing with a 1 inch square tube top rail and gauge 16 or gauge 18 infill, fabricated to the length and height you measure on site.",
    specifications: [
      { label: "Infill", material: "Gauge 16 or gauge 18", pieces: 2 },
      { label: "Sizing", material: "Made to your site measurement" },
    ],
    images: [
      ...seedImage(
        "balcony-railings",
        "Branch-style balustrade panels on the corner of a timber house",
      ),
      ...seedImage(
        "balcony-railings",
        "Ornate wrought iron balcony railing with scrollwork on a facade",
        true,
      ),
    ],
    isFeatured: true,
    sortOrder: 1,
    seoTitle: "Balcony Railings | TijwaWelders",
    seoDesc:
      "Balcony railings fabricated from 1 inch square tube with gauge 16 or gauge 18 infill.",
    priceRange: "KES 4,000 - KES 8,000 per meter",
  },
  {
    categorySlug: "railings",
    name: "Stair Railings",
    slug: "stair-railings",
    shortDesc: "Stair railing fabricated to your stair pitch and length.",
    description:
      "A stair railing with a 1 inch square tube top rail and 3/4 inch square tube posts, fabricated to the pitch and length of your stair.",
    specifications: [
      { label: "Posts", material: "3/4 inch square tube", pieces: 4 },
      { label: "Sizing", material: "Made to your stair pitch" },
    ],
    images: seedImage(
      "stair-railings",
      "Indoor staircase with a light metal railing beside timber treads",
    ),
    isFeatured: false,
    sortOrder: 2,
    seoTitle: "Stair Railings | TijwaWelders",
    seoDesc:
      "Stair railings fabricated from 1 inch and 3/4 inch square tube to your stair measurement.",
    priceRange: "KES 5,000 - KES 10,000 per meter",
  },
  {
    categorySlug: "railings",
    name: "Steel Handrails",
    slug: "steel-handrails",
    shortDesc: "Straight handrail run fabricated to your measurement.",
    description:
      "A straight handrail on 3/4 inch square tube posts with a 1 inch tube rail, fabricated to the length you give us.",
    specifications: [
      { label: "Rail", material: "1 inch square tube", pieces: 1 },
      { label: "Posts", material: "3/4 inch square tube", pieces: 3 },
      { label: "Sizing", material: "Made to your measurement" },
    ],
    images: seedImage(
      "steel-handrails",
      "Polished round steel handrail mounted to a concrete wall",
    ),
    isFeatured: false,
    sortOrder: 3,
    seoTitle: "Steel Handrails | TijwaWelders",
    seoDesc:
      "Steel handrails fabricated from 1 inch rail tube on 3/4 inch square tube posts.",
    priceRange: "KES 3,000 - KES 6,000 per meter",
  },

  {
    categorySlug: "structural",
    name: "Structural Steel Beams",
    slug: "structural-steel-beams",
    shortDesc: "Beams cut and welded from steel plate and section.",
    description:
      "Structural beams fabricated from steel plate and section, cut and welded to your drawing. Send the drawing with your quote request so the section sizes can be confirmed.",
    specifications: [
      { label: "Material", material: "Steel plate and section", pieces: 1 },
      { label: "Working", material: "Cut and welded to your drawing" },
      { label: "Finish", material: "As specified in your quote" },
    ],
    images: [
      ...seedImage(
        "structural-steel-beams",
        "Structural steel columns and beams inside an industrial building",
      ),
      ...seedImage(
        "structural-steel-beams",
        "Stacked hollow section steel beams in a fabrication yard",
        true,
      ),
    ],
    isFeatured: true,
    sortOrder: 1,
    seoTitle: "Structural Steel Beams | TijwaWelders",
    seoDesc:
      "Structural steel beams fabricated from plate and section, cut and welded to your drawing.",
    priceRange: "KES 8,000 - KES 15,000 per meter",
  },
  {
    categorySlug: "structural",
    name: "Steel Columns",
    slug: "steel-columns",
    shortDesc: "Columns fabricated from steel plate and section to your drawing.",
    description:
      "Steel columns fabricated from plate and section, cut and welded to the drawing you supply with your quote request.",
    specifications: [
      { label: "Material", material: "Steel plate and section", pieces: 1 },
      { label: "Working", material: "Cut and welded to your drawing" },
      { label: "Finish", material: "As specified in your quote" },
    ],
    images: seedImage(
      "steel-columns",
      "Steel frame of a multi-storey building under construction",
    ),
    isFeatured: false,
    sortOrder: 2,
    seoTitle: "Steel Columns | TijwaWelders",
    seoDesc:
      "Steel columns fabricated from plate and section, cut and welded to your drawing.",
    priceRange: "KES 10,000 - KES 20,000 per meter",
  },

  {
    categorySlug: "custom-fabrication",
    name: "Custom Fabrication",
    slug: "custom-fabrication",
    shortDesc: "One-off items fabricated from your drawing, sketch or sample.",
    description:
      "Send a drawing, a sketch or a photograph of the item you need and we quote the fabrication. Material and gauge are confirmed on the quote before work starts.",
    specifications: [
      { label: "Input", material: "Drawing, sketch or photograph" },
      { label: "Material", material: "Square tube, sheet or plate", pieces: 1 },
      { label: "Gauge", material: "Gauge 16 or gauge 18, as specified on your quote" },
      { label: "Sizing", material: "As per your drawing or sample" },
    ],
    images: seedImage(
      "custom-fabrication",
      "Workshop entrance with a metal fabrication sign and steel gates",
    ),
    isFeatured: true,
    sortOrder: 1,
    seoTitle: "Custom Steel Fabrication | TijwaWelders",
    seoDesc:
      "Custom steel fabrication from your drawing, sketch or sample in square tube, sheet or plate.",
    priceRange: "Request Quote",
  },
]

export const projects: SeedProject[] = [
  {
    title: "Sliding Gate Fabrication",
    slug: "sliding-gate-fabrication",
    type: "Residential",
    description:
      "Sliding gate fabricated from 3/4 inch square tube with gauge 18 infill, made to the supplied opening measurement.",
    images: [
      ...seedImage(
        "sliding-gate-fabrication",
        "Ornate metal sliding gate viewed from inside a shopfront",
      ),
      ...seedImage(
        "sliding-gate-fabrication",
        "Sliding gate motor mounted on paving beside a gate track",
        true,
      ),
    ],
    isFeatured: true,
    sortOrder: 1,
    seoTitle: "Sliding Gate Fabrication | TijwaWelders Projects",
    seoDesc:
      "Sliding gate fabricated from 3/4 inch square tube with gauge 18 infill.",
  },
  {
    title: "Balcony Railing Fabrication",
    slug: "balcony-railing-fabrication",
    type: "Residential",
    description:
      "Balcony railing fabricated from 1 inch square tube top rail with gauge 18 infill, made to the supplied site measurement.",
    images: [
      ...seedImage(
        "balcony-railing-fabrication",
        "Welder in a helmet and gloves holding a welding torch",
      ),
      ...seedImage(
        "balcony-railing-fabrication",
        "Decorative wrought iron grille with a monogram",
        true,
      ),
    ],
    isFeatured: true,
    sortOrder: 2,
    seoTitle: "Balcony Railing Fabrication | TijwaWelders Projects",
    seoDesc:
      "Balcony railing fabricated from 1 inch square tube with gauge 18 infill.",
  },
  {
    title: "Window Grill Fabrication",
    slug: "window-grill-fabrication",
    type: "Residential",
    description:
      "Window grills fabricated from 3/4 inch square tube frames with gauge 16 bar infill, made to each supplied window opening.",
    images: [
      ...seedImage(
        "window-grill-fabrication",
        "Wrought iron window grill seen from inside a room",
      ),
      ...seedImage(
        "window-grill-fabrication",
        "Welders working on a steel frame in an open workshop yard",
        true,
      ),
    ],
    isFeatured: false,
    sortOrder: 3,
    seoTitle: "Window Grill Fabrication | TijwaWelders Projects",
    seoDesc:
      "Window grills fabricated from 3/4 inch square tube with gauge 16 bar infill.",
  },
  {
    title: "Structural Steel Fabrication",
    slug: "structural-steel-fabrication",
    type: "Structural",
    description:
      "Structural steel members fabricated from plate and section, cut and welded to the supplied drawing.",
    images: [
      ...seedImage(
        "structural-steel-fabrication",
        "Tower crane above a steel framed building under construction",
      ),
      ...seedImage(
        "structural-steel-fabrication",
        "Welder working on steel with sparks flying in a workshop",
        true,
      ),
    ],
    isFeatured: false,
    sortOrder: 4,
    seoTitle: "Structural Steel Fabrication | TijwaWelders Projects",
    seoDesc:
      "Structural steel fabricated from plate and section, cut and welded to your drawing.",
  },
  {
    title: "Security Door Fabrication",
    slug: "security-door-fabrication",
    type: "Commercial",
    description:
      "Steel security door fabricated from 1 inch square tube frame with gauge 18 sheet skin, made to the supplied door opening.",
    images: seedImage(
      "security-door-fabrication",
      "Close-up of a welder joining steel with sparks flying",
    ),
    isFeatured: false,
    sortOrder: 5,
    seoTitle: "Security Door Fabrication | TijwaWelders Projects",
    seoDesc:
      "Steel security door fabricated from 1 inch square tube with gauge 18 sheet skin.",
  },
]
