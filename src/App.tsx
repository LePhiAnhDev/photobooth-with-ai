import { useState, useRef, useEffect } from 'react'
import './App.css'

interface Photo {
    id: string
    dataUrl: string
    timestamp: number
}

type AppState = 'capturing' | 'selecting' | 'composing' | 'result'

function App() {
    const [appState, setAppState] = useState<AppState>('capturing')
    const [photos, setPhotos] = useState<Photo[]>([])
    const [selectedPhotos, setSelectedPhotos] = useState<string[]>([])
    const [countdown, setCountdown] = useState(0)
    const [isCapturing, setIsCapturing] = useState(false)
    const [finalResult, setFinalResult] = useState<string | null>(null)
    const [appliedFilter, setAppliedFilter] = useState<string | null>(null)

    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)

    // Initialize camera
    useEffect(() => {
        const initCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 1280, height: 720 }
                })
                if (videoRef.current) {
                    videoRef.current.srcObject = stream
                    streamRef.current = stream
                }
            } catch (error) {
                console.error('Error accessing camera:', error)
            }
        }

        initCamera()

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop())
            }
        }
    }, [])

    // Countdown and capture logic
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
            return () => clearTimeout(timer)
        } else if (countdown === 0 && isCapturing) {
            capturePhoto()
        }
    }, [countdown, isCapturing])

    const startCapturing = () => {
        if (photos.length >= 6) return

        setIsCapturing(true)
        setCountdown(5)
    }

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return

        const canvas = canvasRef.current
        const video = videoRef.current
        const ctx = canvas.getContext('2d')

        if (!ctx) return

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0)

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        const newPhoto: Photo = {
            id: Date.now().toString(),
            dataUrl,
            timestamp: Date.now()
        }

        setPhotos(prev => [...prev, newPhoto])
        setIsCapturing(false)

        // Auto proceed to selection after 6 photos
        if (photos.length + 1 >= 6) {
            setTimeout(() => setAppState('selecting'), 1000)
        }
    }

    const selectPhoto = (photoId: string) => {
        setSelectedPhotos(prev => {
            if (prev.includes(photoId)) {
                return prev.filter(id => id !== photoId)
            } else if (prev.length < 3) {
                return [...prev, photoId]
            }
            return prev
        })
    }

    const confirmSelection = () => {
        if (selectedPhotos.length === 3) {
            setAppState('composing')
            composePhotos()
        }
    }

    const composePhotos = () => {
        const selectedPhotoData = selectedPhotos.map(id =>
            photos.find(photo => photo.id === id)
        ).filter(Boolean) as Photo[]

        // Create composition canvas
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Set canvas size for vertical composition
        const photoWidth = 450
        const photoHeight = 350
        const spacing = 10
        const framePadding = 30

        canvas.width = photoWidth + framePadding * 2
        canvas.height = (photoHeight + spacing) * 3 + framePadding * 2 - spacing

        // Draw very light ocean blue gradient background frame
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
        gradient.addColorStop(0, '#bfdbfe')
        gradient.addColorStop(0.5, '#93c5fd')
        gradient.addColorStop(1, '#60a5fa')

        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Draw photos
        selectedPhotoData.forEach((photo, index) => {
            const img = new Image()
            img.onload = () => {
                const x = framePadding
                const y = framePadding + index * (photoHeight + spacing)

                // Draw photo with rounded corners
                ctx.save()
                ctx.beginPath()
                ctx.roundRect(x, y, photoWidth, photoHeight, 15)
                ctx.clip()
                ctx.drawImage(img, x, y, photoWidth, photoHeight)
                ctx.restore()
            }
            img.src = photo.dataUrl
        })

        // Convert to data URL
        setTimeout(() => {
            const resultDataUrl = canvas.toDataURL('image/jpeg', 0.9)
            setFinalResult(resultDataUrl)
            setAppState('result')
        }, 1000)
    }

    const applyFilter = (filterType: string) => {
        setAppliedFilter(filterType === 'original' ? null : filterType)
    }

    const downloadResult = () => {
        if (!finalResult) return

        const link = document.createElement('a')
        link.download = 'photobooth-result.jpg'
        link.href = finalResult
        link.click()
    }

    const takeNew = () => {
        setAppState('capturing')
        setPhotos([])
        setSelectedPhotos([])
        setFinalResult(null)
        setAppliedFilter(null)
        setIsCapturing(false)
        setCountdown(0)
    }

    const renderCapturing = () => (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 relative overflow-hidden">
            {/* Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.1)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

            <div className="relative z-10 container mx-auto px-4 py-8">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-slate-800 mb-2">Photobooth with AI</h1>
                    <p className="text-slate-600">Capture your perfect moments</p>
                </div>

                <div className="flex gap-8 max-w-7xl mx-auto">
                    {/* Camera Section */}
                    <div className="flex-1">
                        <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ aspectRatio: '7/5' }}>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                            />
                            <canvas ref={canvasRef} className="hidden" />

                            {/* Countdown Overlay */}
                            {countdown > 0 && (
                                <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
                                    <div className="text-white text-[10rem] font-black countdown-number opacity-90">
                                        {countdown}
                                    </div>
                                </div>
                            )}

                            {/* Camera Frame */}
                            <div className="absolute inset-0 border-4 border-blue-600 rounded-2xl pointer-events-none"></div>
                        </div>

                        <button
                            onClick={startCapturing}
                            disabled={isCapturing || photos.length >= 6}
                            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-4 px-8 rounded-xl text-xl transition-colors duration-200"
                        >
                            {photos.length >= 6 ? 'Maximum Photos Reached' : 'Start Capturing'}
                        </button>
                    </div>

                    {/* Thumbnails Section */}
                    <div className="w-64">
                        <h3 className="text-lg font-semibold text-slate-700 mb-4">Captured Photos ({photos.length}/6)</h3>
                        <div className="space-y-2">
                            {photos.map((photo, index) => (
                                <div key={photo.id} className="relative">
                                    <img
                                        src={photo.dataUrl}
                                        alt={`Photo ${index + 1}`}
                                        className="w-full h-36 object-cover rounded-lg shadow-md"
                                    />
                                    <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                                        {index + 1}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )

    const renderSelecting = () => (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.1)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

            <div className="relative z-10 container mx-auto px-4 py-8">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-slate-800 mb-2">Select 3 Photos</h1>
                    <p className="text-slate-600">Choose your favorite photos to compose</p>
                </div>

                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
                        {photos.map((photo, index) => (
                            <div
                                key={photo.id}
                                onClick={() => selectPhoto(photo.id)}
                                className={`relative cursor-pointer transform transition-all duration-200 hover:scale-105 ${selectedPhotos.includes(photo.id)
                                    ? 'ring-4 ring-blue-500 scale-105'
                                    : 'hover:shadow-lg'
                                    }`}
                            >
                                <img
                                    src={photo.dataUrl}
                                    alt={`Photo ${index + 1}`}
                                    className="w-full h-64 object-cover rounded-xl shadow-md"
                                />
                                {selectedPhotos.includes(photo.id) && (
                                    <div className="absolute top-4 right-4 bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
                                        ✓
                                    </div>
                                )}
                                <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                                    Photo {index + 1}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="text-center">
                        <p className="text-slate-600 mb-4">
                            Selected: {selectedPhotos.length}/3 photos
                        </p>
                        <button
                            onClick={confirmSelection}
                            disabled={selectedPhotos.length !== 3}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-4 px-8 rounded-xl text-xl transition-colors duration-200"
                        >
                            Confirm Selection
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )

    const renderResult = () => (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.1)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

            <div className="relative z-10 container mx-auto px-4 py-8">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-slate-800 mb-2">Your Photobooth Result</h1>
                    <p className="text-slate-600">Download or take new photos</p>
                </div>

                <div className="max-w-4xl mx-auto">
                    {finalResult && (
                        <div className="relative mb-8">
                            <img
                                src={finalResult}
                                alt="Photobooth Result"
                                className={`w-full max-w-md mx-auto rounded-2xl shadow-2xl ${appliedFilter === 'white' ? 'brightness-110 contrast-105' :
                                    appliedFilter === 'pink' ? 'sepia-20 saturate-150 hue-rotate-320' :
                                        appliedFilter === 'black' ? 'brightness-70 contrast-120 saturate-80' :
                                            appliedFilter === 'yellow' ? 'sepia-40 saturate-150 hue-rotate-30 brightness-105' :
                                                ''
                                    }`}
                            />
                        </div>
                    )}

                    {/* Filter Options */}
                    <div className="flex justify-center gap-3 mb-8">
                        <button
                            onClick={() => applyFilter('original')}
                            className={`px-5 py-2 rounded-lg font-semibold transition-colors ${appliedFilter === 'original' || appliedFilter === null
                                ? 'bg-blue-200 text-blue-800'
                                : 'bg-white text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            Original
                        </button>
                        <button
                            onClick={() => applyFilter('white')}
                            className={`px-5 py-2 rounded-lg font-semibold transition-colors ${appliedFilter === 'white'
                                ? 'bg-gray-200 text-gray-800'
                                : 'bg-white text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            White
                        </button>
                        <button
                            onClick={() => applyFilter('pink')}
                            className={`px-5 py-2 rounded-lg font-semibold transition-colors ${appliedFilter === 'pink'
                                ? 'bg-pink-200 text-pink-800'
                                : 'bg-white text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            Pink
                        </button>
                        <button
                            onClick={() => applyFilter('black')}
                            className={`px-5 py-2 rounded-lg font-semibold transition-colors ${appliedFilter === 'black'
                                ? 'bg-gray-800 text-white'
                                : 'bg-white text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            Black
                        </button>
                        <button
                            onClick={() => applyFilter('yellow')}
                            className={`px-5 py-2 rounded-lg font-semibold transition-colors ${appliedFilter === 'yellow'
                                ? 'bg-yellow-200 text-yellow-800'
                                : 'bg-white text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            Yellow
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-center gap-6">
                        <button
                            onClick={downloadResult}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-xl text-xl transition-colors duration-200"
                        >
                            Download
                        </button>
                        <button
                            onClick={takeNew}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-xl text-xl transition-colors duration-200"
                        >
                            Take New
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )

    switch (appState) {
        case 'selecting':
            return renderSelecting()
        case 'result':
            return renderResult()
        default:
            return renderCapturing()
    }
}

export default App