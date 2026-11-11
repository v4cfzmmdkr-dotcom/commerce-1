import Link from "next/link"
import { formatMoney } from "@/lib/money"
import {
  defaultMaterial,
  materialColourLabel,
  materialColourRules,
  materialOptions,
  type ColourOption,
  type MaterialSetting,
} from "@/lib/product-options"
import { RETURN_DAYS } from "@/lib/returns"
import { FREE_SHIPPING_MIN_CENTS, STANDARD_SHIPPING_CENTS } from "@/lib/shipping"

const materialGuide: Record<string, { headline: string, bestFor: string[] }> = {
  PETG: {
    headline: "The everyday choice for parts that live indoors.",
    bestFor: ["Wall mounts and holders", "Tool, workshop, and appliance parts", "Organisers and storage", "Coffee station accessories"],
  },
  ASA: {
    headline: "Built for sun, heat, and the outdoors.",
    bestFor: ["Car interior parts that sit in the sun", "Outdoor, garden, and patio fittings", "Parts near windows or heat", "Gears", "Anything that has to keep its colour"],
  },
  "PET CF": {
    headline: "Carbon fibre reinforced for stiff, precise parts.",
    bestFor: ["Rigid brackets and mounts", "Parts that must hold their shape", "Matte black fittings"],
  },
  "PA6 CF": {
    headline: "Carbon fibre nylon for strength and toughness.",
    bestFor: ["Load-bearing brackets", "Gears and wear parts", "Parts under the bonnet"],
  },
  "PPS CF": {
    headline: "Carbon fibre reinforced for high heat and stiffness.",
    bestFor: ["Parts near engines or motors", "Stiff, load-bearing brackets", "High-temperature fittings"],
  },
}

export function MaterialGuide({ materials, colours }: { materials: MaterialSetting[], colours: ColourOption[] }) {
  const rules = materialColourRules(colours, materials)
  const offered = materialOptions.filter((material) => materials.find((setting) => setting.name === material.name)?.enabled !== false
    && rules[material.name]?.length)
  if (offered.length < 2) return null
  return (
    <section className="wrap-wide home-section" aria-labelledby="material-guide-title">
      <div className="mb-6">
        <h2 id="material-guide-title" className="collection-group-title">Which material?</h2>
        <p className="mt-1 max-w-xl text-sm opacity-70">
          Every part is printed to order. Choose the material on the product page.
        </p>
      </div>
      <div className="material-guide">
        {offered.map((material) => {
          const guide = materialGuide[material.name]
          return (
            <article key={material.name} className="material-card glass">
              <h3 className="material-card-name">{material.name}</h3>
              <p className="mt-2 text-base">{guide?.headline ?? material.note}</p>
              {guide ? (
                <ul className="material-card-uses">
                  {guide.bestFor.map((use) => <li key={use}>{use}</li>)}
                </ul>
              ) : null}
              <p className="material-card-colours">{materialColourLabel(material.name === defaultMaterial ? null : rules[material.name])}</p>
            </article>
          )
        })}
      </div>
      <p className="mt-4 text-sm opacity-70">
        Not sure? PETG suits most parts used indoors. Choose ASA for anything that lives outside or in a car.
      </p>
    </section>
  )
}

export function WhyNicheParts({ currency }: { currency: string }) {
  const reasons = [
    { title: "Made in Australia", body: "Designed and printed here, not shipped from overseas." },
    { title: "Dispatched in 48 hours", body: "Printed to order and sent with Australia Post." },
    {
      title: `Free shipping from ${formatMoney(FREE_SHIPPING_MIN_CENTS, currency).replace(/\.00$/, "")}`,
      body: `Australia Post standard shipping is ${formatMoney(STANDARD_SHIPPING_CENTS, currency)} on smaller orders.`,
    },
    { title: `${RETURN_DAYS}-day returns`, body: "Not the right fit? Send it back for a refund.", href: "/returns" },
  ]
  return (
    <section className="wrap-wide home-section" aria-labelledby="why-title">
      <h2 id="why-title" className="collection-group-title mb-6">Why Niche Parts</h2>
      <ul className="value-grid">
        {reasons.map((reason) => (
          <li key={reason.title} className="value-card glass">
            <p className="font-semibold">{reason.title}</p>
            <p className="mt-1 text-sm opacity-70">
              {reason.body}
              {reason.href ? <> <Link href={reason.href}>Returns policy</Link></> : null}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function CustomPartCta() {
  return (
    <section className="wrap-wide home-section home-section-last">
      <div className="custom-cta glass">
        <div>
          <h2 className="collection-group-title">Can&apos;t find your part?</h2>
          <p className="mt-2 max-w-xl text-sm opacity-70">
            We design and print custom parts to order. Send us a photo and the measurements and we will tell you what we can make.
          </p>
        </div>
        <Link href="/contact" className="btn no-underline">Request a custom part</Link>
      </div>
    </section>
  )
}
