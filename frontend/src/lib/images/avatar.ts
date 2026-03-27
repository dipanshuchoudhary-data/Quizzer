"use client"

const MAX_DIMENSION = 512
const TARGET_MAX_BYTES = 200 * 1024
const OUTPUT_TYPE = "image/webp"
const OUTPUT_NAME = "avatar.webp"

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new window.Image()
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("Unable to read image"))
    }
    image.src = objectUrl
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Image compression failed"))
        return
      }
      resolve(blob)
    }, OUTPUT_TYPE, quality)
  })
}

export async function compressAvatar(file: File): Promise<File> {
  const image = await loadImage(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height))

  let width = Math.max(1, Math.round(image.width * scale))
  let height = Math.max(1, Math.round(image.height * scale))
  let quality = 0.86

  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Canvas is not available in this browser")
  }

  let bestBlob: Blob | null = null

  for (let dimensionStep = 0; dimensionStep < 4; dimensionStep += 1) {
    canvas.width = width
    canvas.height = height
    context.clearRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)

    quality = 0.86
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const blob = await canvasToBlob(canvas, quality)
      bestBlob = blob
      if (blob.size <= TARGET_MAX_BYTES) {
        return new File([blob], OUTPUT_NAME, { type: OUTPUT_TYPE, lastModified: Date.now() })
      }
      quality -= 0.1
    }

    width = Math.max(256, Math.round(width * 0.88))
    height = Math.max(256, Math.round(height * 0.88))
  }

  if (!bestBlob) {
    throw new Error("Image compression failed")
  }

  if (bestBlob.size > TARGET_MAX_BYTES) {
    throw new Error("Please choose a simpler image that can be compressed below 200KB")
  }

  return new File([bestBlob], OUTPUT_NAME, { type: OUTPUT_TYPE, lastModified: Date.now() })
}
