'use client'

import { useState, useRef } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType, Result } from '@zxing/library'

interface QrUploaderProps {
  onScan?: (qrNumericString: string) => void
  isEnabled: boolean
}

export const QrUploader = ({ onScan, isEnabled = true }: QrUploaderProps) => {
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEnabled) return

    const file = e.target.files?.[0]
    if (!file) return

    setIsProcessing(true)
    setError(null)

    try {
      // Create an image URL from the file
      const imageUrl = URL.createObjectURL(file)

      // Configure hints for QR code scanning - EXACTLY the same as QrScanner
      const hints = new Map()
      // Set formats to QR_CODE only since we're scanning Aadhaar QR codes
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE])
      // Try harder for better detection
      hints.set(DecodeHintType.TRY_HARDER, true)
      // Do NOT set CHARACTER_SET to match QrScanner implementation

      // Create a new instance of BrowserMultiFormatReader with hints
      const codeReader = new BrowserMultiFormatReader(hints)

      try {
        // Create a canvas element for the image
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          throw new Error('Could not create canvas context')
        }

        // Create an image element and wait for it to load
        const img = new Image()
        img.src = imageUrl

        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = () => reject(new Error('Failed to load image'))
        })

        // Downscale very large images to improve detection
        const MAX_DIM = 1280
        const naturalW = img.naturalWidth || img.width
        const naturalH = img.naturalHeight || img.height
        const maxSide = Math.max(naturalW, naturalH)
        const scale = maxSide > MAX_DIM ? MAX_DIM / maxSide : 1

        // Try multiple rotations to handle EXIF orientation issues
        const angles = [0, 90, 180, 270]
        let decodedText: string | null = null

        for (const angle of angles) {
          const radians = (angle * Math.PI) / 180
          if (angle % 180 === 0) {
            canvas.width = Math.round(naturalW * scale)
            canvas.height = Math.round(naturalH * scale)
          } else {
            canvas.width = Math.round(naturalH * scale)
            canvas.height = Math.round(naturalW * scale)
          }

          ctx.save()
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.translate(canvas.width / 2, canvas.height / 2)
          ctx.rotate(radians)
          ctx.scale(scale, scale)
          ctx.drawImage(img, -naturalW / 2, -naturalH / 2)
          ctx.restore()

          try {
            // Attempt decode on original image
            const result: Result = await codeReader.decodeFromCanvas(canvas)
            if (result) {
              decodedText = result.getText()
              break
            }
          } catch (err: unknown) {
            if (!err || (err as Error).name !== 'NotFoundException') {
              // Rethrow non-NotFound errors
              throw err
            }
            // Invert image and try again
            try {
              const imgData = ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
              )
              const data = imgData.data
              for (let i = 0; i < data.length; i += 4) {
                data[i] = 255 - data[i]
                data[i + 1] = 255 - data[i + 1]
                data[i + 2] = 255 - data[i + 2]
                // alpha unchanged
              }
              ctx.putImageData(imgData, 0, 0)
              const result2: Result = await codeReader.decodeFromCanvas(canvas)
              if (result2) {
                decodedText = result2.getText()
                break
              }
            } catch (err2: unknown) {
              if (!err2 || (err2 as Error).name !== 'NotFoundException') {
                throw err2
              }
              // Will try next angle
            }
          }
        }

        // Final fallback: try the raw image element
        if (!decodedText) {
          try {
            const result: Result = await codeReader.decodeFromImageElement(img)
            if (result) {
              decodedText = result.getText()
            }
          } catch (err: unknown) {
            if (!err || (err as Error).name !== 'NotFoundException') {
              throw err
            }
          }
        }

        if (decodedText && onScan) {
          console.log('Successfully decoded QR code')
          onScan(decodedText)
        } else {
          setError(
            'No QR code found in the image. Please upload a clearer image.'
          )
        }
      } catch (err: unknown) {
        let errorMessage =
          'Could not read QR code from image. Please try another image.'
        if ((err as Error)?.name === 'ChecksumException') {
          errorMessage =
            'QR code detected but data is corrupted. Please try a clearer image.'
        } else if ((err as Error)?.name === 'FormatException') {
          errorMessage =
            'QR code format not recognized. Please ensure this is an Aadhaar QR code.'
        }
        setError(errorMessage)
        console.error('QR code reading error:', err)
      } finally {
        // Clean up the object URL
        URL.revokeObjectURL(imageUrl)
      }
    } catch (err: unknown) {
      setError('Error processing image: ' + (err as Error).message)
      console.error('File processing error:', err)
    } finally {
      setIsProcessing(false)
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="w-full max-w-md mx-auto min-h-[360px]">
      <div className="flex items-center justify-center w-full">
        <label
          htmlFor="qr-file-upload"
          className={`flex flex-col items-center justify-center w-full h-[300px] border-2 border-dashed rounded-lg cursor-pointer 
            ${
              isEnabled
                ? 'border-gray-300 hover:bg-gray-50'
                : 'border-gray-200 bg-gray-100 cursor-not-allowed'
            }`}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg
              className="w-8 h-8 mb-3 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              ></path>
            </svg>
            <p className="mb-1 text-sm text-gray-500">
              <span className="font-semibold">Click to upload</span> or drag and
              drop
            </p>
            <p className="text-xs text-gray-500">
              PNG, JPG or GIF with QR code
            </p>
          </div>
          <input
            id="qr-file-upload"
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
            disabled={!isEnabled || isProcessing}
            ref={fileInputRef}
          />
        </label>
      </div>

      {isProcessing && (
        <div className="mt-2 text-center">
          <p className="text-sm text-gray-600">Processing image...</p>
        </div>
      )}

      {error && (
        <p className="text-red-500 mt-2 text-sm text-center">{error}</p>
      )}
    </div>
  )
}
