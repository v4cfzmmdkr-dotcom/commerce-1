"use client"

export function SelectAll({ form, name, label }: { form: string, name: string, label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm normal-case">
      <input
        type="checkbox"
        onChange={(event) => {
          const target = document.getElementById(form)
          target?.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${name}"]:not(:disabled)`).forEach((box) => {
            box.checked = event.target.checked
          })
        }}
      />
      {label}
    </label>
  )
}
