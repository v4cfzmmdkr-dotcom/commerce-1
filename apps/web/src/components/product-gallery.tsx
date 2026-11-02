"use client"

import { useRef, useState, type PointerEvent } from "react"

type GalleryImage = { id: string, url: string, alt: string }

export function ProductGallery({
  title,
  images,
}: {
  title: string
  images: GalleryImage[]
}) {
  const [index, setIndex] = useState(0)
  const startX = useRef<number | null>(null)
  const current = images[index]

  if (!images.length) {
    return <div className="product-media" aria-hidden="true" />
  }

  const go = (next: number) => {
    const total = images.length
    setIndex((next + total) % total)
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (images.length < 2) return
    startX.current = event.clientX
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (startX.current == null) return
    const delta = event.clientX - startX.current
    startX.current = null
    if (Math.abs(delta) < 40) return
    go(index + (delta < 0 ? 1 : -1))
  }

  return (
    <div className="product-gallery">
      <div
        className="product-gallery-stage"
        tabIndex={images.length > 1 ? 0 : undefined}
        role="region"
        aria-roledescription="carousel"
        aria-label={`${title} photos`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { startX.current = null }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") go(index + 1)
          if (event.key === "ArrowLeft") go(index - 1)
        }}
      >
        <div className="product-media product-gallery-frame">
          <img src={current.url} alt={current.alt || title} />
        </div>
        {images.length > 1 ? (
          <>
            <button
              className="product-gallery-nav product-gallery-prev"
              type="button"
              aria-label="Previous photo"
              onClick={() => go(index - 1)}
            >
              ‹
            </button>
            <button
              className="product-gallery-nav product-gallery-next"
              type="button"
              aria-label="Next photo"
              onClick={() => go(index + 1)}
            >
              ›
            </button>
            <div className="product-gallery-dots glass">
              {images.map((image, dotIndex) => (
                <button
                  key={image.id}
                  type="button"
                  tabIndex={-1}
                  aria-label={`Show photo ${dotIndex + 1}`}
                  aria-current={dotIndex === index ? "true" : undefined}
                  className="product-gallery-dot"
                  onClick={() => setIndex(dotIndex)}
                />
              ))}
            </div>
            <p className="sr-only" aria-live="polite">
              Photo {index + 1} of {images.length}
            </p>
          </>
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="product-gallery-thumbs" role="tablist" aria-label="Product photos">
          {images.map((image, thumbIndex) => (
            <button
              key={image.id}
              type="button"
              role="tab"
              aria-selected={thumbIndex === index}
              aria-label={`Photo ${thumbIndex + 1} of ${images.length}`}
              className={thumbIndex === index ? "product-gallery-thumb is-active" : "product-gallery-thumb"}
              onClick={() => setIndex(thumbIndex)}
            >
              <img src={image.url} alt="" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
