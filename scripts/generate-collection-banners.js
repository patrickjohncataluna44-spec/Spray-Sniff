const fs = require('node:fs/promises')
const path = require('node:path')
const sharp = require('sharp')

const WIDTH = 1600
const HEIGHT = 1000
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'collections')

const collections = [
  {
    output: 'timeless-classics-banner.jpg',
    source: 'public/products/golden-hour-1.jpg',
    backgroundPosition: 'centre',
    panel: { left: 210, top: 145, size: 700, position: 'centre' },
    palette: {
      base: '#29190f',
      start: '#3c2418',
      middle: '#7a4b2a',
      end: '#ebc49a',
      glowPrimary: '#f8d1aa',
      glowSecondary: '#a96f41',
      frame: 'rgba(255, 239, 222, 0.58)',
      shadow: 'rgba(12, 6, 3, 0.34)',
      detail: 'rgba(255, 236, 213, 0.24)',
    },
    motif: 'timeless',
  },
  {
    output: 'fresh-essence-banner.jpg',
    source: 'public/products/ocean-breeze-1.jpg',
    backgroundPosition: 'centre',
    panel: { left: 695, top: 150, size: 650, position: 'centre' },
    palette: {
      base: '#0f2530',
      start: '#163542',
      middle: '#2d7c90',
      end: '#b7edf5',
      glowPrimary: '#d8fbff',
      glowSecondary: '#46c4df',
      frame: 'rgba(237, 252, 255, 0.52)',
      shadow: 'rgba(4, 18, 26, 0.28)',
      detail: 'rgba(232, 253, 255, 0.28)',
    },
    motif: 'fresh',
  },
  {
    output: 'evening-elegance-banner.jpg',
    source: 'public/products/midnight-elegance-1.jpg',
    backgroundPosition: 'centre',
    panel: { left: 225, top: 135, size: 720, position: 'centre' },
    palette: {
      base: '#140a14',
      start: '#2a1024',
      middle: '#5a2041',
      end: '#f0bf7d',
      glowPrimary: '#f7d59a',
      glowSecondary: '#944d77',
      frame: 'rgba(255, 242, 216, 0.52)',
      shadow: 'rgba(9, 4, 10, 0.36)',
      detail: 'rgba(255, 228, 192, 0.22)',
    },
    motif: 'evening',
  },
  {
    output: 'oriental-dreams-banner.jpg',
    source: 'public/products/velvet-spice-1.jpg',
    backgroundPosition: 'centre',
    panel: { left: 665, top: 140, size: 690, position: 'centre' },
    palette: {
      base: '#1f120d',
      start: '#3a1f16',
      middle: '#8b4e1f',
      end: '#f3d3a2',
      glowPrimary: '#f3ca87',
      glowSecondary: '#cf7f2c',
      frame: 'rgba(255, 241, 213, 0.5)',
      shadow: 'rgba(16, 8, 3, 0.3)',
      detail: 'rgba(251, 229, 182, 0.24)',
    },
    motif: 'oriental',
  },
]

function svgToBuffer(svg) {
  return Buffer.from(svg)
}

function baseOverlaySvg(palette) {
  return svgToBuffer(`
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="${WIDTH}" y2="${HEIGHT}">
          <stop offset="0%" stop-color="${palette.start}"/>
          <stop offset="55%" stop-color="${palette.middle}"/>
          <stop offset="100%" stop-color="${palette.end}"/>
        </linearGradient>
        <radialGradient id="glowLeft" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(300 220) rotate(25) scale(520 410)">
          <stop stop-color="${palette.glowPrimary}" stop-opacity="0.46"/>
          <stop offset="1" stop-color="${palette.glowPrimary}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="glowRight" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1270 740) rotate(-12) scale(470 360)">
          <stop stop-color="${palette.glowSecondary}" stop-opacity="0.38"/>
          <stop offset="1" stop-color="${palette.glowSecondary}" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="veil" x1="0" y1="0" x2="${WIDTH}" y2="0">
          <stop offset="0%" stop-color="rgba(9, 6, 4, 0.32)"/>
          <stop offset="42%" stop-color="rgba(9, 6, 4, 0.06)"/>
          <stop offset="100%" stop-color="rgba(255, 255, 255, 0.05)"/>
        </linearGradient>
      </defs>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="${palette.base}"/>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glowLeft)"/>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glowRight)"/>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#veil)"/>
      <rect x="38" y="38" width="${WIDTH - 76}" height="${HEIGHT - 76}" rx="40" stroke="rgba(255,255,255,0.08)"/>
    </svg>
  `)
}

function vignetteSvg() {
  return svgToBuffer(`
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="v" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${WIDTH / 2} ${HEIGHT / 2}) rotate(90) scale(${HEIGHT * 0.72} ${WIDTH * 0.88})">
          <stop offset="0.56" stop-color="rgba(0,0,0,0)"/>
          <stop offset="1" stop-color="rgba(0,0,0,0.48)"/>
        </radialGradient>
      </defs>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#v)"/>
    </svg>
  `)
}

function motifSvg(collection) {
  const { motif, palette } = collection

  if (motif === 'timeless') {
    return svgToBuffer(`
      <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1010 180C1168 64 1408 68 1510 258" stroke="${palette.detail}" stroke-width="2.2"/>
        <path d="M980 290C1150 150 1396 152 1500 360" stroke="${palette.detail}" stroke-width="1.4"/>
        <path d="M1110 520C1290 420 1476 446 1540 618" stroke="${palette.detail}" stroke-width="1.8"/>
        <circle cx="1274" cy="284" r="168" stroke="${palette.detail}" stroke-width="1"/>
      </svg>
    `)
  }

  if (motif === 'fresh') {
    return svgToBuffer(`
      <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="316" cy="534" r="158" stroke="${palette.detail}" stroke-width="1.4"/>
        <circle cx="316" cy="534" r="216" stroke="${palette.detail}" stroke-width="0.9"/>
        <path d="M160 266C288 218 450 226 572 318" stroke="${palette.detail}" stroke-width="1.3"/>
        <path d="M144 782C308 690 518 702 676 816" stroke="${palette.detail}" stroke-width="1.3"/>
        <path d="M230 166C354 124 470 134 576 212" stroke="${palette.detail}" stroke-width="0.9"/>
      </svg>
    `)
  }

  if (motif === 'evening') {
    return svgToBuffer(`
      <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M980 164L1480 664" stroke="${palette.detail}" stroke-width="1.1"/>
        <path d="M1058 96L1558 596" stroke="${palette.detail}" stroke-width="1.9"/>
        <path d="M1122 44L1598 520" stroke="${palette.detail}" stroke-width="0.9"/>
        <path d="M990 340C1180 260 1390 288 1550 444" stroke="${palette.detail}" stroke-width="1.1"/>
        <circle cx="1308" cy="304" r="132" stroke="${palette.detail}" stroke-width="0.8"/>
      </svg>
    `)
  }

  return svgToBuffer(`
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="312" cy="500" r="206" stroke="${palette.detail}" stroke-width="1.3"/>
      <circle cx="312" cy="500" r="146" stroke="${palette.detail}" stroke-width="1"/>
      <circle cx="312" cy="500" r="86" stroke="${palette.detail}" stroke-width="0.9"/>
      <path d="M150 500H474" stroke="${palette.detail}" stroke-width="0.9"/>
      <path d="M312 338V662" stroke="${palette.detail}" stroke-width="0.9"/>
      <path d="M208 396C256 446 256 554 208 604" stroke="${palette.detail}" stroke-width="0.9"/>
      <path d="M416 396C368 446 368 554 416 604" stroke="${palette.detail}" stroke-width="0.9"/>
      <path d="M112 712C258 644 422 654 548 748" stroke="${palette.detail}" stroke-width="1.1"/>
    </svg>
  `)
}

function frameSvg(size, frameColor) {
  return svgToBuffer(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="frameGlow" x1="0" y1="0" x2="${size}" y2="${size}">
          <stop offset="0%" stop-color="rgba(255,255,255,0.28)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0.02)"/>
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="${size - 16}" height="${size - 16}" rx="34" stroke="${frameColor}" stroke-width="2.2"/>
      <rect x="24" y="24" width="${size - 48}" height="${size - 48}" rx="24" fill="url(#frameGlow)" opacity="0.18"/>
      <rect x="0.75" y="0.75" width="${size - 1.5}" height="${size - 1.5}" rx="39" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>
    </svg>
  `)
}

function shadowSvg(panel, color) {
  return svgToBuffer(`
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="40"/>
        </filter>
      </defs>
      <rect x="${panel.left + 12}" y="${panel.top + 18}" width="${panel.size - 24}" height="${panel.size - 24}" rx="34" fill="${color}" filter="url(#shadow)"/>
    </svg>
  `)
}

function highlightSvg(panel) {
  return svgToBuffer(`
    <svg width="${panel.size}" height="${panel.size}" viewBox="0 0 ${panel.size} ${panel.size}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shine" x1="0" y1="0" x2="${panel.size}" y2="${panel.size}">
          <stop offset="0%" stop-color="rgba(255,255,255,0.22)"/>
          <stop offset="36%" stop-color="rgba(255,255,255,0.06)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
        </linearGradient>
      </defs>
      <rect width="${panel.size}" height="${panel.size}" fill="url(#shine)"/>
    </svg>
  `)
}

function roundedMask(size) {
  return svgToBuffer(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="38" fill="#ffffff"/>
    </svg>
  `)
}

async function createPanelImage(collection) {
  const sourcePath = path.join(process.cwd(), collection.source)
  const { size, position } = collection.panel
  const photo = await sharp(sourcePath)
    .resize(size, size, { fit: 'cover', position })
    .modulate({ brightness: 1.04, saturation: 1.08 })
    .sharpen()
    .png()
    .toBuffer()

  return sharp(photo)
    .composite([
      { input: highlightSvg(collection.panel), blend: 'screen' },
      { input: roundedMask(size), blend: 'dest-in' },
    ])
    .png()
    .toBuffer()
}

async function createBlurredBackground(collection) {
  const sourcePath = path.join(process.cwd(), collection.source)

  return sharp(sourcePath)
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: collection.backgroundPosition })
    .modulate({ brightness: 0.98, saturation: 1.12 })
    .blur(34)
    .ensureAlpha(0.34)
    .png()
    .toBuffer()
}

async function generateBanner(collection) {
  const panelImage = await createPanelImage(collection)
  const blurredBackground = await createBlurredBackground(collection)
  const banner = sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: collection.palette.base,
    },
  })

  await banner
    .composite([
      { input: baseOverlaySvg(collection.palette) },
      { input: blurredBackground, blend: 'screen' },
      { input: motifSvg(collection), blend: 'screen' },
      { input: shadowSvg(collection.panel, collection.palette.shadow), blend: 'multiply' },
      { input: panelImage, left: collection.panel.left, top: collection.panel.top },
      { input: frameSvg(collection.panel.size, collection.palette.frame), left: collection.panel.left, top: collection.panel.top, blend: 'screen' },
      { input: vignetteSvg(), blend: 'multiply' },
    ])
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toFile(path.join(OUTPUT_DIR, collection.output))
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true })

  for (const collection of collections) {
    await generateBanner(collection)
  }

  console.log(`Generated ${collections.length} collection banners in ${OUTPUT_DIR}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
