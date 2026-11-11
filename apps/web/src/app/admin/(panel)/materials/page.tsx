import type { CSSProperties } from "react"
import { saveMaterialsAndColours } from "@/app/admin/option-actions"
import { ColourPaletteChips } from "@/components/colour-palette-chips"
import { PendingButton } from "@/components/pending-button"
import { defaultMaterial, materialColourRules, materialOptions } from "@/lib/product-options"
import { getSettings } from "@/lib/settings"

export const maxDuration = 60

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ colours?: string, added?: string, materials?: string, repriced?: string, materialError?: string }>
}) {
  const params = await searchParams
  const settings = await getSettings()
  const colourRules = materialColourRules(settings.colours, settings.materials)
  const added = Number(params.added) || 0
  const repriced = Number(params.repriced) || 0
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-semibold">Materials and colours</h1>
      <form action={saveMaterialsAndColours} className="admin-card grid gap-4">
        <p className="admin-note text-sm">
          Switching a material on offers it on every product. Switch it off to hide it everywhere. Tick the colours each material comes in; new colours are added to every product at the same price as Black. To leave a material off one product, untick it on that product&apos;s edit page.
        </p>
        <div className="grid gap-5">
          {materialOptions.map((material) => {
            const setting = settings.materials.find((item) => item.name === material.name)
            const isBase = material.name === defaultMaterial
            const chosen = colourRules[material.name] ?? []
            return (
              <div key={material.name} className="material-block grid gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="colour-chip material-chip">
                    <input type="checkbox" name="materials" value={material.name} defaultChecked={setting?.enabled !== false} />
                    <span className="font-medium">{material.name}</span>
                  </label>
                  {isBase ? (
                    <span className="admin-note text-sm">Base price</span>
                  ) : (
                    <label className="flex items-center gap-2 whitespace-nowrap text-sm normal-case">
                      Markup over PETG ($)
                      <input
                        className="field w-28 normal-case"
                        name={`markup_${material.name}`}
                        inputMode="decimal"
                        placeholder="0.00"
                        defaultValue={((setting?.markupCents ?? 0) / 100).toFixed(2)}
                        aria-label={`${material.name} markup over PETG`}
                      />
                    </label>
                  )}
                </div>
                {isBase ? (
                  <>
                    <ColourPaletteChips
                      key={settings.colours.map((colour) => colour.name).join("|")}
                      colours={settings.colours}
                      name={`colours_${material.name}`}
                    />
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="label max-w-xs flex-1">
                        Add a colour
                        <input className="field normal-case" name="newName" maxLength={30} placeholder="Olive" />
                      </label>
                      <input className="colour-picker" type="color" name="newHex" defaultValue="#6b8e23" aria-label="Swatch for the new colour" />
                    </div>
                  </>
                ) : (
                  <fieldset className="colour-chips">
                    <legend className="sr-only">{material.name} colours</legend>
                    {settings.colours.map((colour) => (
                      <label key={colour.name} className="colour-chip" data-colour={colour.name}>
                        <input
                          type="checkbox"
                          name={`colours_${material.name}`}
                          value={colour.name}
                          defaultChecked={chosen.includes(colour.name)}
                        />
                        <span className="colour-chip-dot" style={{ "--swatch": colour.hex } as CSSProperties} aria-hidden />
                        {colour.name}
                      </label>
                    ))}
                  </fieldset>
                )}
              </div>
            )
          })}
        </div>
        <p className="admin-note text-sm">
          Drag a PETG colour by its handle to rearrange the colours everywhere, including on product pages. A new colour is switched on for PETG and can then be ticked for other materials. Removing a colour with × takes it off every material. Saving updates the price of every non-PETG option to its PETG price plus the markup.
        </p>
        {params.colours === "removed" ? <p className="text-sm" role="status">Colour removed.</p> : null}
        {params.materials === "saved" ? (
          <p className="text-sm" role="status">
            Saved{repriced ? `, ${repriced} ${repriced === 1 ? "price" : "prices"} updated` : ""}{added ? `, ${added} new ${added === 1 ? "variant" : "variants"} added` : ""}.
          </p>
        ) : null}
        {params.materialError ? <p className="text-sm" role="alert">{params.materialError}</p> : null}
        <div>
          <PendingButton pendingText="Saving…">Save materials and colours</PendingButton>
        </div>
      </form>
    </div>
  )
}
