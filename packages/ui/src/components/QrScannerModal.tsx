'use client'

import { useState } from 'react'
import { Modal } from './Modal'
import { QrScanner } from './QrScanner'
import { QrUploader } from './QrUploader'
import { DELIMITER_POSITION, getQRData } from 'anon-aadhaar-o1js'

interface QrScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onScan: (qrNumericString: string) => void
  publicKeyHex: string
  aadhaarMode: 'test' | 'prod'
}

export const QrScannerModal = ({
  isOpen,
  onClose,
  onScan,
  publicKeyHex,
  aadhaarMode,
}: QrScannerModalProps) => {
  const [mode, setMode] = useState<'scan' | 'upload'>('scan')
  const [qrNumericString, setQrNumericString] = useState<string | null>(null)
  const [aadhaarDetails, setAadhaarDetails] = useState<{ name: string } | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)

  // Extract Aadhaar details from QR data for display
  const extractAadhaarDetails = (qrString: string) => {
    try {
      const qrData = getQRData(qrString, publicKeyHex)

      // Find delimiter positions in the signed data
      // Delimiters in Aadhaar QR are typically 0xFF bytes
      const signedData = qrData.signedData
      const delimiterPositions: number[] = []

      for (let i = 0; i < signedData.length; i++) {
        if (signedData[i] === 0xff) {
          delimiterPositions.push(i)
        }
      }
      // Extract name, DOB, and gender
      const name = new TextDecoder().decode(
        signedData.subarray(
          delimiterPositions[DELIMITER_POSITION.NAME - 1] + 1,
          delimiterPositions[DELIMITER_POSITION.NAME]
        )
      )

      return name
    } catch (error) {
      console.error('Error extracting Aadhaar details:', error)
      return null
    }
  }

  // Handle QR code scan
  const handleQrScan = (qrString: string) => {
    setQrNumericString(qrString)
    setError(null)

    try {
      // Extract details for display
      const details = extractAadhaarDetails(qrString)
      if (details) {
        setAadhaarDetails({
          name: details,
        })
      }
    } catch (error) {
      console.error('Error processing QR code:', error)
      setError('Error processing QR code')
    }
  }

  // Handle use of scanned QR data
  const handleUseQrData = () => {
    if (qrNumericString) {
      onScan(qrNumericString)
      onClose()
    }
  }

  // Reset the form
  const handleReset = () => {
    setQrNumericString(null)
    setAadhaarDetails(null)
    setError(null)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Scan ${aadhaarMode === 'test' ? 'Test ' : ''}Aadhaar QR Code`}
    >
      {/* Mode selection tabs */}
      <div className="flex border-b border-gray-700 mb-4">
        <button
          className={`flex-1 py-2 px-4 text-center ${
            mode === 'scan'
              ? 'border-b-2 border-blue-500 text-blue-500'
              : 'text-gray-400'
          }`}
          onClick={() => {
            setMode('scan')
            handleReset()
          }}
        >
          Scan QR
        </button>
        <button
          className={`flex-1 py-2 px-4 text-center ${
            mode === 'upload'
              ? 'border-b-2 border-blue-500 text-blue-500'
              : 'text-gray-400'
          }`}
          onClick={() => {
            setMode('upload')
            handleReset()
          }}
        >
          Upload QR
        </button>
      </div>

      {/* QR Scanner/Uploader based on mode */}
      {mode === 'scan' && !qrNumericString && (
        <QrScanner onScan={handleQrScan} isEnabled={isOpen} />
      )}

      {mode === 'upload' && !qrNumericString && (
        <QrUploader onScan={handleQrScan} isEnabled={isOpen} />
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded relative mt-4">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Aadhaar details display */}
      {aadhaarDetails && qrNumericString && (
        <div className="mt-4 p-4 border border-gray-700 rounded-lg bg-gray-800">
          <h3 className="text-lg font-semibold mb-2 text-white">
            Aadhaar Details
          </h3>
          <div className="space-y-2 text-gray-300">
            <p>
              <span className="font-medium">Name:</span> {aadhaarDetails.name}
            </p>
          </div>

          <div className="mt-4 flex space-x-3">
            <button
              onClick={handleUseQrData}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Use This Aadhaar
            </button>
            <button
              onClick={handleReset}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
            >
              Scan Again
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
