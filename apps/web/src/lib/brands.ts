export type Brand = { slug: string, name: string, terms: string[] }

// Products fit a brand when their title names it or one of its product lines.
export const brands: Brand[] = [
  { slug: "asus", name: "Asus", terms: ["asus"] },
  { slug: "aurora", name: "Aurora", terms: ["aurora"] },
  { slug: "beko", name: "Beko", terms: ["beko"] },
  { slug: "black-decker", name: "Black & Decker", terms: ["black & decker", "black and decker", "black\\+decker"] },
  { slug: "bmw", name: "BMW", terms: ["bmw"] },
  { slug: "bonsaii", name: "Bonsaii", terms: ["bonsaii"] },
  { slug: "bosch", name: "Bosch", terms: ["bosch"] },
  { slug: "breville", name: "Breville", terms: ["breville"] },
  { slug: "citadel", name: "Citadel", terms: ["citadel"] },
  { slug: "delta", name: "Delta", terms: ["delta"] },
  { slug: "dewalt", name: "DeWalt", terms: ["dewalt", "de walt", "toughsystem", "tough system", "tstak"] },
  { slug: "dyson", name: "Dyson", terms: ["dyson"] },
  { slug: "fellowes", name: "Fellowes", terms: ["fellowes"] },
  { slug: "festool", name: "Festool", terms: ["festool", "systainer"] },
  { slug: "ford", name: "Ford", terms: ["ford"] },
  { slug: "google", name: "Google", terms: ["google", "nest"] },
  { slug: "honda", name: "Honda", terms: ["honda"] },
  { slug: "ikea", name: "IKEA", terms: ["ikea", "skadis", "skådis"] },
  { slug: "kawasaki", name: "Kawasaki", terms: ["kawasaki"] },
  { slug: "kobalt", name: "Kobalt", terms: ["kobalt"] },
  { slug: "lego", name: "Lego", terms: ["lego"] },
  { slug: "leitz", name: "Leitz", terms: ["leitz"] },
  { slug: "makita", name: "Makita", terms: ["makita"] },
  { slug: "mercedes", name: "Mercedes-Benz", terms: ["mercedes", "benz"] },
  { slug: "metabo", name: "Metabo", terms: ["metabo"] },
  { slug: "milwaukee", name: "Milwaukee", terms: ["milwaukee", "packout"] },
  { slug: "nespresso", name: "Nespresso", terms: ["nespresso"] },
  { slug: "nintendo", name: "Nintendo", terms: ["nintendo"] },
  { slug: "ninja", name: "Ninja", terms: ["ninja"] },
  { slug: "playstation", name: "PlayStation", terms: ["playstation", "ps4", "ps5"] },
  { slug: "porsche", name: "Porsche", terms: ["porsche"] },
  { slug: "porter-cable", name: "Porter-Cable", terms: ["porter cable", "porter-cable"] },
  { slug: "revox", name: "Revox", terms: ["revox"] },
  { slug: "rexel", name: "Rexel", terms: ["rexel"] },
  { slug: "ryobi", name: "Ryobi", terms: ["ryobi"] },
  { slug: "smeg", name: "Smeg", terms: ["smeg"] },
  { slug: "sony", name: "Sony", terms: ["sony"] },
  { slug: "stanley", name: "Stanley", terms: ["stanley", "fatmax"] },
  { slug: "starlink", name: "Starlink", terms: ["starlink"] },
  { slug: "suzuki", name: "Suzuki", terms: ["suzuki"] },
  { slug: "teac", name: "Teac", terms: ["teac"] },
  { slug: "technics", name: "Technics", terms: ["technics"] },
  { slug: "ubiquiti", name: "Ubiquiti", terms: ["ubiquiti", "unifi"] },
  { slug: "xbox", name: "Xbox", terms: ["xbox"] },
  { slug: "yamaha", name: "Yamaha", terms: ["yamaha"] },
]

export type BrandCount = { slug: string, name: string, count: number }

// Square logo tiles in public/brand-logos, used by the home page brand carousel.
const brandLogoSlugs = new Set([
  "asus", "aurora", "beko", "black-decker", "bmw", "bonsaii", "bosch", "citadel", "delta", "dyson",
  "fellowes", "festool", "ford", "google", "honda", "ikea", "kawasaki", "kobalt", "lego", "leitz",
  "mercedes", "metabo", "nespresso", "nintendo", "ninja", "playstation", "porsche", "porter-cable", "revox", "rexel",
  "smeg", "sony", "stanley", "starlink", "suzuki", "teac", "technics", "ubiquiti", "xbox", "yamaha",
])

export function brandLogo(slug: string) {
  return brandLogoSlugs.has(slug) ? `/brand-logos/${slug}.webp` : null
}

export function findBrand(slug: string | undefined) {
  return slug ? brands.find((brand) => brand.slug === slug) : undefined
}

// Postgres regular expression, matched case-insensitively against product titles.
export function brandPattern(brand: Brand) {
  return `\\m(${brand.terms.join("|")})\\M`
}

function brandRegex(brand: Brand) {
  return new RegExp(`(?<![\\p{L}\\p{N}])(${brand.terms.join("|")})(?![\\p{L}\\p{N}])`, "iu")
}

export function countBrands(titles: string[]): BrandCount[] {
  return brands
    .map((brand) => {
      const regex = brandRegex(brand)
      return { slug: brand.slug, name: brand.name, count: titles.filter((title) => regex.test(title)).length }
    })
    .filter((brand) => brand.count > 0)
}
