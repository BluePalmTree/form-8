import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { zipSync } from 'fflate'
import { StageView, viewBoxOf } from './components/StageView'
import type { Choreography } from './types'

const PNG_WIDTH = 1600

export interface ExportLabels {
  audience: string
  formation: (n: number) => string
}

function formationSvg(choreo: Choreography, index: number, labels: ExportLabels, showPaths: boolean): string {
  const f = choreo.formations[index]
  const title = `${choreo.name} · ${index + 1}/${choreo.formations.length} · ${f.name || labels.formation(index + 1)}`
  return renderToStaticMarkup(
    createElement(StageView, {
      choreo,
      index,
      showPaths,
      audienceLabel: labels.audience,
      title,
      pixelWidth: PNG_WIDTH,
    }),
  )
}

async function svgToPng(svg: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = Math.round(height)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function formationPng(
  choreo: Choreography,
  index: number,
  labels: ExportLabels,
  showPaths: boolean,
): Promise<Blob> {
  const vb = viewBoxOf(choreo.stage, true)
  return svgToPng(formationSvg(choreo, index, labels, showPaths), PNG_WIDTH, (PNG_WIDTH * vb.h) / vb.w)
}

const slug = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase() || 'choreo'

export function pngFiles(choreo: Choreography, blobs: Blob[]): File[] {
  const base = slug(choreo.name)
  const pad = String(blobs.length).length
  return blobs.map((b, i) => new File([b], `${base}-${String(i + 1).padStart(pad, '0')}.png`, { type: 'image/png' }))
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Share the images via the system share sheet (e.g. WhatsApp on mobile) or fall back to a download. */
export async function shareOrDownload(choreo: Choreography, files: File[]) {
  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, title: choreo.name })
      return
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      // fall through to download
    }
  }
  if (files.length === 1) {
    download(files[0], files[0].name)
    return
  }
  const entries: Record<string, Uint8Array> = {}
  for (const f of files) entries[f.name] = new Uint8Array(await f.arrayBuffer())
  const zip = zipSync(entries, { level: 0 })
  download(new Blob([zip as BlobPart], { type: 'application/zip' }), `${slug(choreo.name)}.zip`)
}

export function exportJson(choreo: Choreography) {
  download(new Blob([JSON.stringify(choreo, null, 2)], { type: 'application/json' }), `${slug(choreo.name)}.json`)
}
