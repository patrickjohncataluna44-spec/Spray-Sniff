'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import {
  Check,
  Compass,
  Crosshair,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

export interface SelectedLocationData {
  lat: number
  lng: number
  street?: string
  city?: string
  province?: string
  postalCode?: string
  displayName?: string
}

interface AddressMapPickerProps {
  initialLat?: number | null
  initialLng?: number | null
  streetAddress?: string
  city?: string
  onLocationSelected: (data: SelectedLocationData) => void
}

// Fallback coordinates: Mabini, Davao de Oro (or Philippines center)
const DEFAULT_LAT = 7.3084
const DEFAULT_LNG = 125.8534
const DEFAULT_ZOOM = 14

export default function AddressMapPicker({
  initialLat,
  initialLng,
  streetAddress = '',
  city = '',
  onLocationSelected,
}: AddressMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null,
  )
  const [detectedAddress, setDetectedAddress] = useState<string | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false)

  // Custom high-contrast modern Pin marker to avoid missing PNG asset 404s in Next.js
  const createPinIcon = useCallback(() => {
    return L.divIcon({
      className: 'osm-custom-pin',
      html: `
        <div style="position: relative; width: 38px; height: 48px; transform: translate(-50%, -100%); cursor: grab;">
          <!-- Pin shadow -->
          <div style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 14px; height: 6px; background: rgba(0,0,0,0.35); border-radius: 50%; filter: blur(1.5px);"></div>
          
          <!-- Pulsing ring -->
          <div style="position: absolute; top: 2px; left: 50%; transform: translateX(-50%); width: 34px; height: 34px; border-radius: 50%; background: rgba(79, 70, 229, 0.25); animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>

          <!-- Pin marker head -->
          <div style="position: relative; width: 38px; height: 38px; background: #4F46E5; border: 2.5px solid #ffffff; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.45);">
            <div style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center; color: white;">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
          </div>
        </div>
      `,
      iconSize: [38, 48],
      iconAnchor: [19, 48],
      popupAnchor: [0, -48],
    })
  }, [])

  // Reverse Geocoding via our server route `/api/geocode?action=reverse`
  const reverseGeocode = useCallback(
    async (lat: number, lng: number, autoApply = false) => {
      setIsReverseGeocoding(true)
      try {
        const res = await fetch(`/api/geocode?action=reverse&lat=${lat}&lon=${lng}`)
        if (!res.ok) throw new Error('Could not fetch address details')
        const data = await res.json()

        const display = data.displayName || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        setDetectedAddress(display)

        if (autoApply) {
          onLocationSelected({
            lat,
            lng,
            street: data.street || undefined,
            city: data.city || undefined,
            province: data.province || undefined,
            postalCode: data.postalCode || undefined,
            displayName: data.displayName || undefined,
          })
        }
      } catch (err) {
        console.error('Reverse geocode failed', err)
      } finally {
        setIsReverseGeocoding(false)
      }
    },
    [onLocationSelected],
  )

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return

    const initialCenterLat = currentCoords?.lat || DEFAULT_LAT
    const initialCenterLng = currentCoords?.lng || DEFAULT_LNG

    const map = L.map(mapContainerRef.current, {
      center: [initialCenterLat, initialCenterLng],
      zoom: currentCoords ? 16 : DEFAULT_ZOOM,
      zoomControl: true,
      scrollWheelZoom: false, // Prevent accidental scrolling when browsing page
    })

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(map)

    // Add draggable marker
    const pinIcon = createPinIcon()
    const marker = L.marker([initialCenterLat, initialCenterLng], {
      icon: pinIcon,
      draggable: true,
      autoPan: true,
    }).addTo(map)

    // Handle marker dragend
    marker.on('dragend', () => {
      const pos = marker.getLatLng()
      setCurrentCoords({ lat: pos.lat, lng: pos.lng })
      void reverseGeocode(pos.lat, pos.lng, true)
    })

    // Handle click on map to move pin
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng
      marker.setLatLng([lat, lng])
      setCurrentCoords({ lat, lng })
      void reverseGeocode(lat, lng, true)
    })

    mapInstanceRef.current = map
    markerRef.current = marker

    // Initial reverse geocode if coordinates provided
    if (currentCoords) {
      void reverseGeocode(currentCoords.lat, currentCoords.lng, false)
    }

    // Leaflet needs invalidateSize after container renders
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 250)

    return () => {
      clearTimeout(timer)
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
    }
  }, [createPinIcon, reverseGeocode]) // eslint-disable-line react-hooks/exhaustive-deps

  // "Use My Location" Instant Pinning (GPS Geolocation)
  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast({
        title: 'Geolocation not supported',
        description: 'Your browser does not support GPS location detection.',
        variant: 'destructive',
      })
      return
    }

    setIsLocating(true)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude

        setCurrentCoords({ lat, lng })
        setIsLocating(false)

        if (mapInstanceRef.current && markerRef.current) {
          // Immediately fly to coordinates and pin location
          mapInstanceRef.current.flyTo([lat, lng], 17, {
            duration: 1.2,
          })
          markerRef.current.setLatLng([lat, lng])
        }

        // Fetch address & auto-populate the delivery fields
        void reverseGeocode(lat, lng, true)

        toast({
          title: '📍 Location pinned!',
          description: 'Your exact location was pinned on OpenStreetMap and address updated.',
        })
      },
      (error) => {
        setIsLocating(false)
        let message = 'Unable to retrieve your location.'
        if (error.code === error.PERMISSION_DENIED) {
          message = 'Location permission was denied. Please allow location access in your browser settings.'
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = 'Location information is currently unavailable.'
        } else if (error.code === error.TIMEOUT) {
          message = 'GPS request timed out. Please try again.'
        }
        toast({
          title: 'Location Error',
          description: message,
          variant: 'destructive',
        })
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    )
  }, [reverseGeocode])

  // "Search / Locate Address on Map"
  const handleSearchAddress = useCallback(async () => {
    const query = [streetAddress, city].filter(Boolean).join(', ')
    if (!query.trim()) {
      toast({
        title: 'Enter address first',
        description: 'Please type a street or city to search on the map.',
        variant: 'destructive',
      })
      return
    }

    setIsSearching(true)
    try {
      const res = await fetch(`/api/geocode?action=search&q=${encodeURIComponent(query)}`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()

      if (data.results && data.results.length > 0) {
        const topResult = data.results[0]
        const lat = Number(topResult.lat)
        const lng = Number(topResult.lon)

        setCurrentCoords({ lat, lng })

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 16, { duration: 1.2 })
          markerRef.current.setLatLng([lat, lng])
        }

        void reverseGeocode(lat, lng, false)

        toast({
          title: 'Address Found',
          description: `Pinned near: ${topResult.display_name.slice(0, 70)}...`,
        })
      } else {
        toast({
          title: 'Location not found',
          description: 'Could not pinpoint that exact address. You can tap on the map to set your pin.',
          variant: 'destructive',
        })
      }
    } catch (err) {
      console.error('Search error', err)
      toast({
        title: 'Search Error',
        description: 'Failed to search address on OpenStreetMap.',
        variant: 'destructive',
      })
    } finally {
      setIsSearching(false)
    }
  }, [streetAddress, city, reverseGeocode])

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      {/* Map Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/75 px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#ECECFE] text-[#4F46E5]">
            <MapPin className="h-3.5 w-3.5" />
          </span>
          <div>
            <span className="text-[12px] font-semibold text-slate-800 flex items-center gap-1.5">
              OpenStreetMap Pin
              {currentCoords && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                  Pinned
                </span>
              )}
            </span>
            <p className="text-[10px] text-slate-500">
              Drag pin or tap map to set exact delivery gate/door
            </p>
          </div>
        </div>

        {/* Action Buttons: "Use My Location" + "Verify Address" */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleUseMyLocation}
            disabled={isLocating}
            className="h-8 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white px-2.5 sm:px-3 text-[11px] font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95"
            title="Automatically detect your GPS location and drop a pin"
          >
            {isLocating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Locating...</span>
              </>
            ) : (
              <>
                <Crosshair className="h-3.5 w-3.5 text-indigo-200 animate-pulse" />
                <span>Use My Location</span>
              </>
            )}
          </Button>

          {(streetAddress || city) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSearchAddress}
              disabled={isSearching}
              className="h-8 rounded-lg border-slate-200 text-slate-700 hover:bg-slate-100 px-2.5 text-[11px] font-medium"
              title="Locate the address typed above on the map"
            >
              {isSearching ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Search className="h-3 w-3 text-slate-500 mr-1" />
              )}
              <span>Locate Address</span>
            </Button>
          )}
        </div>
      </div>

      {/* Map Canvas */}
      <div className="relative">
        <div
          ref={mapContainerRef}
          className="h-56 sm:h-64 w-full z-0 bg-slate-100"
          style={{ minHeight: '220px' }}
        />

        {/* Floating Instruction Badge */}
        <div className="pointer-events-none absolute bottom-2 left-2 z-[400] max-w-[85%] rounded-lg bg-white/95 backdrop-blur-xs px-2.5 py-1 text-[10px] font-medium text-slate-600 shadow-md border border-slate-200/80 flex items-center gap-1.5">
          <Compass className="h-3 w-3 text-[#4F46E5] flex-shrink-0" />
          <span className="truncate">
            {isReverseGeocoding ? (
              <span className="inline-flex items-center gap-1 text-slate-500">
                <Loader2 className="h-2.5 w-2.5 animate-spin" /> Fetching street details...
              </span>
            ) : detectedAddress ? (
              detectedAddress
            ) : (
              'Tap anywhere on map or drag pin to adjust'
            )}
          </span>
        </div>

        {/* Quick GPS button overlay inside map */}
        <div className="absolute top-3 right-3 z-[400]">
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={isLocating}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-700 shadow-md border border-slate-200 hover:bg-slate-50 hover:text-[#4F46E5] transition active:scale-95 disabled:opacity-50"
            title="Find My Location (GPS)"
          >
            {isLocating ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#4F46E5]" />
            ) : (
              <Crosshair className="h-4 w-4 text-[#4F46E5]" />
            )}
          </button>
        </div>
      </div>

      {/* Footer Address Sync Bar */}
      {currentCoords && (
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-white px-3 py-2 text-[11px] sm:px-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
            <span className="text-slate-500 truncate">
              Coordinates: <span className="font-mono text-slate-700">{currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => void reverseGeocode(currentCoords.lat, currentCoords.lng, true)}
            disabled={isReverseGeocoding}
            className="inline-flex items-center gap-1 font-semibold text-[#4F46E5] hover:underline flex-shrink-0 text-[11px]"
          >
            <RefreshCw className={`h-3 w-3 ${isReverseGeocoding ? 'animate-spin' : ''}`} />
            Sync Address to Form
          </button>
        </div>
      )}
    </div>
  )
}
