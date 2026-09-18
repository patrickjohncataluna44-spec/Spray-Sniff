const MAX_IMAGE_DIMENSION = 800
const MIN_IMAGE_DIMENSION = 360
// Target size strictly in KB (120 KB) so database storage stays extremely small and lightning fast
const TARGET_IMAGE_BYTES = 120 * 1024
const JPEG_QUALITIES = [0.75, 0.65, 0.55, 0.45, 0.35]

function resizeToFit(width: number, height: number, maxDimension: number) {
  const largestSide = Math.max(width, height)

  if (largestSide <= maxDimension) {
    return { width, height }
  }

  const scale = maxDimension / largestSide

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Unable to prepare the image for upload.'))
          return
        }

        resolve(blob)
      },
      'image/jpeg',
      quality,
    )
  })
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unable to prepare the image for upload.'))
        return
      }

      resolve(reader.result)
    }

    reader.onerror = () => {
      reject(new Error('Unable to prepare the image for upload.'))
    }

    reader.readAsDataURL(blob)
  })
}

export async function optimizeProductImage(file: File) {
  const objectUrl = URL.createObjectURL(file)
  const image = new Image()

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('The selected file could not be read as an image.'))
      image.src = objectUrl
    })

    let maxDimension = MAX_IMAGE_DIMENSION
    let bestBlob: Blob | null = null

    while (maxDimension >= MIN_IMAGE_DIMENSION) {
      const { width, height } = resizeToFit(image.width, image.height, maxDimension)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error('Unable to prepare the image for upload.')
      }

      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, width, height)
      context.drawImage(image, 0, 0, width, height)

      for (const quality of JPEG_QUALITIES) {
        const blob = await canvasToBlob(canvas, quality)

        if (!bestBlob || blob.size < bestBlob.size) {
          bestBlob = blob
        }

        if (blob.size <= TARGET_IMAGE_BYTES) {
          return blobToDataUrl(blob)
        }
      }

      maxDimension = Math.round(maxDimension * 0.82)
    }

    if (!bestBlob) {
      throw new Error('Unable to optimize the selected image.')
    }

    return blobToDataUrl(bestBlob)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
