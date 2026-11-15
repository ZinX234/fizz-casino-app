'use client'

import { useState, type FormEvent } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import type { CarouselImageRecord } from '@/lib/casino-data'

const MAX_IMAGE_BYTES = 4 * 1024 * 1024

export function AdminCarouselImages({ initialImages, loadError }: { initialImages: CarouselImageRecord[]; loadError: boolean }) {
  const [images, setImages] = useState(initialImages)
  const [file, setFile] = useState<File | null>(null)
  const [altText, setAltText] = useState('')
  const [pending, setPending] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null)

  async function addImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !file) return
    if (file.size > MAX_IMAGE_BYTES) {
      setFeedback({ message: 'Choose an image that is 4 MB or smaller.', error: true })
      return
    }

    setPending(true)
    setFeedback(null)
    try {
      const formData = new FormData()
      formData.set('image', file)
      formData.set('altText', altText)
      const response = await fetch('/api/admin/carousel-images', { method: 'POST', body: formData })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'The carousel image could not be added.')

      setImages((current) => [...current, payload.image as CarouselImageRecord])
      setFile(null)
      setAltText('')
      const input = document.getElementById('carousel-image-file')
      if (input instanceof HTMLInputElement) input.value = ''
      setFeedback({ message: 'Image added to the featured carousel.', error: false })
    } catch (cause) {
      setFeedback({ message: cause instanceof Error ? cause.message : 'The carousel image could not be added.', error: true })
    } finally {
      setPending(false)
    }
  }

  async function removeImage(image: CarouselImageRecord) {
    if (pending || deletingId || !window.confirm('Remove this image from the featured carousel?')) return

    setDeletingId(image.id)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin/carousel-images', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: image.id }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'The carousel image could not be removed.')

      setImages((current) => current.filter((entry) => entry.id !== image.id))
      setFeedback({ message: 'Image removed from the featured carousel.', error: false })
    } catch (cause) {
      setFeedback({ message: cause instanceof Error ? cause.message : 'The carousel image could not be removed.', error: true })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-fuchsia-200/15 bg-[#12141a] p-5 sm:p-6" aria-labelledby="carousel-images-heading">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-fuchsia-200/15 bg-fuchsia-100/[0.06] text-fuchsia-100"><ImagePlus aria-hidden="true" className="size-4" /></span>
        <div>
          <h2 id="carousel-images-heading" className="text-base font-bold">Featured carousel images</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-white/45">Add images to the lobby carousel or remove any current image. PNG, JPEG, WebP, or GIF; maximum 4 MB each.</p>
        </div>
      </div>
      <form onSubmit={addImage} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="carousel-image-file" className="text-[11px] font-semibold text-white/65">Image file</label>
          <input id="carousel-image-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required disabled={pending || loadError} onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="min-h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-xs file:text-white" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="carousel-image-alt" className="text-[11px] font-semibold text-white/65">Image description</label>
          <input id="carousel-image-alt" type="text" required minLength={1} maxLength={200} disabled={pending || loadError} value={altText} onChange={(event) => setAltText(event.target.value)} placeholder="Describe the banner" className="min-h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white outline-none focus:border-fuchsia-200/50" />
        </div>
        <button type="submit" disabled={pending || loadError || !file} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-fuchsia-300 px-4 text-xs font-bold text-[#24132a] transition hover:bg-fuchsia-200 disabled:cursor-wait disabled:opacity-60 sm:col-span-2 lg:col-span-1"><ImagePlus aria-hidden="true" className="size-4" />{pending ? 'Adding…' : 'Add image'}</button>
      </form>
      {loadError ? (
        <p role="alert" className="mt-5 rounded-xl border border-amber-200/15 bg-amber-100/[0.04] px-4 py-4 text-xs leading-5 text-amber-100/75">Carousel image storage is unavailable. Apply the carousel image database migration before managing images.</p>
      ) : images.length > 0 ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image) => (
            <li key={image.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/15">
              <img src={image.imageUrl ?? `/api/carousel-images/${image.id}`} alt={image.altText} className="aspect-[16/9] w-full bg-black object-contain" />
              <div className="flex items-center justify-between gap-3 p-3">
                <p className="line-clamp-2 text-xs text-white/65">{image.altText}</p>
                <button type="button" onClick={() => void removeImage(image)} disabled={pending || deletingId !== null || loadError} aria-label={`Remove image: ${image.altText}`} className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-rose-200/15 text-rose-100/80 transition hover:bg-rose-100/10 disabled:cursor-wait disabled:opacity-50">
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="mt-5 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-white/45">No carousel images. Add an image to show it in the lobby.</p>}
      {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`mt-4 rounded-lg border px-3 py-2 text-xs ${feedback.error ? 'border-rose-200/15 bg-rose-100/[0.04] text-rose-100/80' : 'border-emerald-200/15 bg-emerald-100/[0.04] text-emerald-100/80'}`}>{feedback.message}</p>}
    </section>
  )
}
