# Bulk Product Importer

The Bulk Product Importer adds or updates many products at once from a ZIP package. It is at
**Admin > Bulk Importer** (`/admin/bulk-import`). This document covers:

1. Setting up the importer.
2. How an import runs.
3. The package format (schema version 1.0), which is the contract for the external Python
   sourcing app.
4. How duplicates and updates are handled.
5. A reference Python generator.

## 1. Setup

1. Apply the migration: `pnpm db:migrate` from `apps/web`. It runs
   `src/db/sql/017_bulk_import.sql`, which adds:
   - Four tables: `import_batches`, `import_batch_items`, `product_sources` and
     `product_import_events`.
   - Nullable `content_hash` / `content_type` / `size_bytes` columns on `product_images` and
     `product_print_files`.

   Existing tables and data are unchanged.
2. Storage:
   - **Object storage (`STORAGE_*` set, recommended in production)**:
     - The browser uploads the ZIP straight to the private print-files bucket with a signed
       link. Product images go to the images bucket and STL/3MF files to the private
       print-files bucket, like files added by hand.
     - The print-files bucket must allow browser `PUT` requests from the site origin (CORS).
       Print file uploads on the product page already need this.
   - **Local disk (no storage configured)**:
     - Packages are kept in `apps/web/private-storage/bulk-imports`, which is not publicly
       served. Images go to `apps/web/storage`.
     - This mode is for development only, because Vercel has no persistent disk.
   - **Supabase storage** is not supported for packages. The upload page says so.
3. Optional: set `CRON_SECRET` to keep imports running with the admin page closed (see
   section 2).

Only admins listed in `ADMIN_EMAILS` can use the importer. Every page, server action and API
route under `/admin` and `/api/admin` checks the Clerk session. The background route
`/api/cron/bulk-import` instead requires `Authorization: Bearer $CRON_SECRET`.

## 2. How an import runs

1. **Upload.**
   - The ZIP goes directly to storage (up to 5 GB) and never passes through a Vercel function.
     This avoids the 4.5 MB request limit.
2. **Validate.**
   - The server reads the ZIP in place using ranged reads. It checks the archive structure,
     file names, sizes, compression ratio, manifest.json and products.json, and every
     file reference.
   - It also matches each product against the shop by source ID, then by SKU.
   - A package-level problem rejects the whole package with a list of reasons. A product-level
     problem marks only that product invalid.
3. **Review.**
   - The admin previews each product: images and alt text, price, weight, filament and print
     time, source, creator and licence, the listing text, and the STL/3MF files (as
     downloads).
   - Products are approved or rejected one at a time, by selection, or all at once.
     Products whose licence forbids commercial use cannot be approved.
4. **Import.**
   - The admin chooses whether new products go live immediately or as drafts, then starts
     the import.
   - Products are imported in short steps of up to 40 seconds, two at a time. Each product
     is one database transaction.
   - Images are checked by their file signature. STL files are checked for a valid binary or
     ASCII structure, and 3MF files must be real 3MF archives.
5. **Resume and retry.**
   - Each product is claimed with a two-minute lease. If a step is cut off (tab closed,
     deploy, timeout), the product is picked up again after the lease expires.
   - Temporary failures such as a storage or network error are retried automatically, up to
     three attempts.
   - Permanent failures such as a damaged STL or a checksum mismatch are marked failed with
     the reason. The **Retry failed** button queues them again.

Steps are driven by one of these:

- **The open import page.** It runs steps in a loop and shows progress. Closing it pauses the
  work, and opening it again resumes.
- **`pnpm import:bulk-run [--batch <id>]`** from `apps/web`. It runs steps against the
  database in `.env` until the queue is empty. This is useful for very large imports.
- **A scheduler calling `GET /api/cron/bulk-import`** with the cron secret, every minute or
  so. The route is not registered in `vercel.json`, because per-minute Vercel crons need a
  paid plan. Add it there, or call it from any external scheduler.

History, per-product logs and errors are kept on each import. The ZIP can be deleted after
import to free storage. Retrying a failed product after that needs the package uploaded
again.

## 3. Package format, version 1.0

A package is a standard ZIP file (deflate or store, no password) laid out like this:

```text
manifest.json
products.json
images/<anything>/<file>.jpg|.jpeg|.png|.webp
models/<anything>/<file>.stl|.3mf
```

Rules:

- **Allowed contents.** Nothing else is allowed in the ZIP. Unknown files, symlinks, encrypted
  entries and paths with `..` reject the package.
- **Single wrapping folder.** The files may sit inside one top-level folder, for example
  `my-package/manifest.json`. That folder is ignored.
- **System files.** `__MACOSX/`, `.DS_Store` and `._*` files are ignored.
- **Path names.**
  - Every path segment must match `^[A-Za-z0-9][A-Za-z0-9._-]*$`. That means letters,
    digits, dot, dash and underscore, with no spaces, and starting with a letter or digit.
  - The whole path can be at most 200 characters.
  - Paths are compared case-insensitively, so two files differing only by case are rejected.
- **Paths in products.json.** They are relative to the package root, like
  `images/model-123/1.jpg`. File names inside the ZIP are never trusted for storage: stored
  files are named by their SHA-256 hash.

Limits:

| What | Limit |
| --- | --- |
| Package size | 5 GB |
| ZIP entries | 20,000 |
| Products per package | 1,000 |
| manifest.json | 2 MB |
| products.json | 40 MB |
| Each image | 12 MB |
| Each STL / 3MF | 50 MB |
| Images per product | 20 |
| 3D files per product | 30 |
| Compression ratio | 200x for files over 1 MB (higher is treated as a ZIP bomb) |

Split larger catalogues into several packages. Products are matched across packages, so
uploading a second package never duplicates products from the first.

### manifest.json

```json
{
  "schema": "nicheparts.product-package",
  "schema_version": "1.0",
  "package_id": "printables-2026-11-12-001",
  "generated_at": "2026-11-12T10:00:00Z",
  "generator": { "name": "niche-sourcer", "version": "2.3.0" },
  "currency": "AUD",
  "product_count": 2,
  "files": [
    { "path": "images/model-1/1.jpg", "size": 182331, "sha256": "9f2c...64 hex chars" },
    { "path": "models/model-1/clip.stl", "size": 84384, "sha256": "41ab..." }
  ]
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `schema` | yes | Exactly `nicheparts.product-package`. |
| `schema_version` | yes | `"MAJOR.MINOR"`. This shop reads major version 1. A newer minor version (1.1) is accepted with a warning and unknown fields are ignored. Version 2.x is rejected. |
| `package_id` | yes | Unique per package; letters, digits, `. _ : -`. Re-uploading the same ID shows a warning but is safe. |
| `generated_at` | no | ISO 8601 timestamp. |
| `generator` | no | `{ "name", "version" }` of the producing app. |
| `currency` | no | Must be `AUD` if present. |
| `product_count` | yes | Must equal the number of products in products.json, so a truncated package is caught. |
| `files` | recommended | Every file under `images/` and `models/`, with its exact byte size and lowercase SHA-256 hex. Do not list manifest.json or products.json. If present, it must be complete: missing, extra or wrongly sized files reject the package, and a checksum mismatch fails that product. |

### products.json

```json
{
  "schema_version": "1.0",
  "products": [ { "...": "one object per product, see below" } ]
}
```

`schema_version` must match manifest.json. Each product:

```json
{
  "external_id": "1234567",
  "source": { "name": "printables", "url": "https://www.printables.com/model/1234567-cable-clip" },
  "creator": { "name": "Example Maker", "url": "https://www.printables.com/@example" },
  "licence": {
    "name": "CC BY 4.0",
    "url": "https://creativecommons.org/licenses/by/4.0/",
    "commercial_use": "allowed",
    "attribution_required": true,
    "notes": "Credit the designer on the listing."
  },
  "title": "Cable Clip for 6 mm Cables",
  "handle": "cable-clip-6mm",
  "description_html": "<p>A tidy clip for 6 mm cables.</p>",
  "seo": { "title": "Cable Clip for 6 mm Cables | Niche Parts", "description": "Printed PETG cable clip." },
  "category": "Cable Management",
  "tags": ["cable", "clip"],
  "sku": "NP-CC-0006",
  "price_cents": 1295,
  "compare_at_price_cents": 1595,
  "print": { "filament_type": "PETG", "filament_grams": 12.5, "print_minutes": 45 },
  "shipping_weight_grams": 40,
  "images": [
    { "path": "images/1234567/1.jpg", "alt": "Cable clip holding a 6 mm cable" }
  ],
  "models": [
    { "path": "models/1234567/clip.stl", "copies": 2, "notes": "No supports" },
    { "path": "models/1234567/clip.3mf" }
  ]
}
```

| Field | Required | Rules | Where it goes |
| --- | --- | --- | --- |
| `external_id` | yes | 1-200 chars, letters, digits, `. _ : -`. Stable for the same design forever. | `product_sources.external_id` |
| `source.name` | yes | Lowercase slug, for example `printables`, `thingiverse`, `makerworld`. | `product_sources.source_name` |
| `source.url` | yes | http(s) link to the original listing. | `product_sources.source_url`, product metadata |
| `creator.name` / `creator.url` | name yes | Designer credit. | `product_sources` |
| `licence.name` / `licence.url` | name yes | Licence title and link. | `product_sources` |
| `licence.commercial_use` | yes | `allowed`, `not_allowed` or `unknown`. `not_allowed` blocks the product. `unknown` needs a manual check before approval. | `product_sources.commercial_use` |
| `licence.attribution_required` | no | Boolean, default `false`. | `product_sources` |
| `licence.notes` | no | Up to 2,000 chars. | `product_sources.licence_notes` |
| `title` | yes | Up to 250 chars. | `products.title` |
| `handle` | no | Lowercase words joined by dashes. Defaults to a slug of the title, and a number is added if taken. Only used when the product is created. | `products.handle` |
| `description_html` | yes (may be empty) | HTML. Only common formatting tags, links and images are kept; scripts, styles, iframes and event attributes are removed. | `products.description_html` |
| `seo.title` / `seo.description` | yes (may be empty) | Up to 200 / 500 chars. Warnings over about 70 / 160. An empty title falls back to the product title. | `products.seo_title`, `seo_description` |
| `category` | yes | Matched to an existing collection by handle or title, and the product is added to it. Otherwise a warning is shown and it is only stored as the product type. | `products.product_type`, `collection_products` |
| `tags` | no | Up to 50 strings of 60 chars. | `products.tags` |
| `sku` | yes | Up to 64 chars, letters, digits, `. _ -`. Unique within the package. | Base variant SKU |
| `price_cents` | yes | Integer cents in AUD, incl. GST, for the PETG option. For example `1295` = $12.95. | Base variant price. Other materials get the shop's material markups. |
| `compare_at_price_cents` | no | Integer cents. Ignored unless above `price_cents`. | Base variant compare-at price |
| `print.filament_type` | yes | For example `PETG`. A warning is shown if the shop does not sell it. | Product metadata |
| `print.filament_grams` | yes | Positive number. | Product metadata |
| `print.print_minutes` | yes | Positive whole minutes. | Product metadata |
| `shipping_weight_grams` | yes | Positive whole grams, up to 30,000. | Weight of every variant |
| `images` | yes, 1-20 | `path` under `images/`, `alt` text (falls back to the title). The first image is the main image. | `product_images` |
| `models` | yes, 1-30 | `path` under `models/`. `copies` 1-100 (default 1). `notes` up to 500 chars. | `product_print_files` (private) |

Every new product gets the shop's standard Colour and Material options, exactly like a product
created by hand. Its stock policy is "continue", because items are printed to order.

### Validation results

- **Package errors** reject the whole upload, and nothing is imported. Examples:
  - Bad JSON, with the parser message showing where it failed.
  - Wrong `schema`.
  - An unsupported major version.
  - Mismatched `product_count`.
  - A missing or extra file against the manifest.
  - Unsafe paths, oversized files or a ZIP bomb.
  - Duplicate `external_id` or `sku` within the package.
- **Product errors** mark one product invalid, and the rest can still be imported. Examples:
  - A missing or invalid field, such as `price_cents must be whole cents`.
  - A referenced image or model that is not in the ZIP.
  - A file in the wrong folder.
  - A licence that forbids commercial use.
  - A SKU owned by another product.
- **Warnings** never block anything. Examples: missing alt text, a long SEO text, an
  unknown category or filament, unused files, or a re-uploaded package ID.

## 4. Duplicates and updates

Products are identified by `source.name` + `external_id`.

1. **The source ID was imported before.** The existing product is updated, never duplicated.
2. **The source ID is new, but the SKU matches a product added by hand or by the Shopify
   import.** That product is updated and linked to the source, and a warning tells the admin
   before approval.
3. **The SKU belongs to a product imported from a different source ID, or to more than one
   product.** The product is marked invalid.
4. **Otherwise** a new product is created.

An update changes these fields:

- The title, description, category/product type, tags, SEO fields, and print and source
  metadata.
- The weight on all variants.
- The base (PETG) price and compare-at price, and the base SKU.
- Imported images and 3D files.

An update does not change these:

- The handle and status (a live product stays live, a draft stays a draft).
- Stock, extra options, and images or files added by hand.
- Prices on products with size or style options. These are left alone and a warning is shown.

Imported files are tracked by content hash:

- An unchanged file is not uploaded again.
- A file removed from the package is removed from the product.
- Images and files added by hand in the product editor are never touched.

Concurrent runners cannot import the same product twice. Each write takes a lock on the
source ID.

## 5. Reference generator (Python 3.9+)

This produces a valid package from a list of product dicts. It uses only the standard library.

```python
import hashlib
import json
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = "nicheparts.product-package"
VERSION = "1.0"
IMAGE_TYPES = {".jpg", ".jpeg", ".png", ".webp"}
MODEL_TYPES = {".stl", ".3mf"}


def safe_segment(text: str) -> str:
    """Make one path segment acceptable: letters, digits, dot, dash, underscore."""
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", text).strip("-.") or "file"
    if not cleaned[0].isalnum():
        cleaned = "f" + cleaned
    return cleaned[:80]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def build_package(products: list[dict], out_path: str, package_id: str) -> None:
    """
    Each product dict follows the products.json schema, except that
    product["images"][i]["file"] and product["models"][i]["file"] are local
    file paths. The package paths are generated here.
    """
    files = []
    package_products = []
    for product in products:
        folder = safe_segment(f"{product['source']['name']}-{product['external_id']}")
        entry = {k: v for k, v in product.items() if k not in ("images", "models")}
        entry["images"] = []
        entry["models"] = []
        for kind, allowed in (("images", IMAGE_TYPES), ("models", MODEL_TYPES)):
            for index, item in enumerate(product[kind], start=1):
                local = Path(item["file"])
                suffix = local.suffix.lower()
                if suffix not in allowed:
                    raise ValueError(f"{local} is not an allowed {kind[:-1]} type")
                name = f"{index:02d}-{safe_segment(local.stem)}{suffix}"
                arc = f"{kind}/{folder}/{name}"
                files.append({"path": arc, "local": local})
                described = {k: v for k, v in item.items() if k != "file"}
                entry[kind].append({**described, "path": arc})
        package_products.append(entry)

    manifest = {
        "schema": SCHEMA,
        "schema_version": VERSION,
        "package_id": package_id,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "generator": {"name": "niche-sourcer", "version": "1.0.0"},
        "currency": "AUD",
        "product_count": len(package_products),
        "files": [
            {"path": f["path"], "size": f["local"].stat().st_size, "sha256": sha256(f["local"])}
            for f in files
        ],
    }

    with zipfile.ZipFile(out_path, "w", allowZip64=True) as zf:
        zf.writestr("manifest.json", json.dumps(manifest, indent=2), zipfile.ZIP_DEFLATED)
        zf.writestr(
            "products.json",
            json.dumps({"schema_version": VERSION, "products": package_products}, indent=2, ensure_ascii=False),
            zipfile.ZIP_DEFLATED,
        )
        for f in files:
            # Images are already compressed; models compress well.
            method = zipfile.ZIP_STORED if f["path"].startswith("images/") else zipfile.ZIP_DEFLATED
            zf.write(f["local"], f["path"], method)
```

Checklist for the sourcing app:

- **Stable IDs.** Keep `external_id` and `source.name` stable. Changing them creates a new
  product instead of updating the old one.
- **Licence checks.** Set `licence.commercial_use` from the actual licence text. Use
  `unknown` when unsure, never `allowed`.
- **Prices.** Send prices as integer cents including GST.
- **Counts and checksums.** Fill in `product_count` and `files` last, from what was actually
  written. Never fill them from what was planned.
- **Package size.** Keep each package to 1,000 products or fewer, and well under 5 GB.
- **Test locally.** Run `pnpm import:bulk-sample --count 5 --out sample.zip` in `apps/web` to
  produce a known-good package to compare against.
- **Test a real package against a throwaway database.** The database name must contain
  "test", and its schema is wiped:
  `BULK_IMPORT_TEST_DATABASE_URL=postgres://.../bulktest BULK_IMPORT_TEST_PACKAGE=out.zip pnpm test src/lib/bulk-import`.
  This validates and imports the package, then lists any product that failed.
