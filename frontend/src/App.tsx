import { useState, useRef, useEffect } from 'react'
import './App.css'

interface Photo {
    id: string
    dataUrl: string
    timestamp: number
}

interface WebSocketData {
    frame: string
    gesture: string
    zoom_level: number
    mode: string
    is_capturing: boolean
    countdown: number
    captured_photos: Photo[]
    photos_count: number
    peace_sign_count?: number  // ✅ Thêm Peace sign counter
    required_peace_count?: number  // ✅ Thêm số lần Peace cần thiết
    gesture_stability_count?: number  // ✅ Thêm gesture stability counter
    gesture_stability_required?: number  // ✅ Thêm số frame stability cần thiết
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
    const [isComposing, setIsComposing] = useState(false)

    // New state for AI integration
    const [mode, setMode] = useState<'ON' | 'OFF'>('OFF')
    const [zoomLevel, setZoomLevel] = useState(1.0)
    const [currentGesture, setCurrentGesture] = useState('unknown')
    const [wsData, setWsData] = useState<WebSocketData | null>(null)
    const [peaceSignCount, setPeaceSignCount] = useState(0)  // ✅ Thêm Peace sign counter state
    const [requiredPeaceCount, setRequiredPeaceCount] = useState(1)  // ✅ Thêm required Peace count state
    const [gestureStabilityCount, setGestureStabilityCount] = useState(0)  // ✅ Thêm gesture stability state
    const [gestureStabilityRequired, setGestureStabilityRequired] = useState(3)  // ✅ Thêm required stability state

    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const wsRef = useRef<WebSocket | null>(null)

    // Initialize WebSocket connection
    useEffect(() => {
        const connectWebSocket = () => {
            try {
                const ws = new WebSocket('ws://localhost:8000/ws')
                wsRef.current = ws

                ws.onopen = () => {
                    console.log('🔌 Connected to AI backend')
                }

                ws.onmessage = (event) => {
                    try {
                        const data: WebSocketData = JSON.parse(event.data)
                        setWsData(data)
                        setMode(data.mode as 'ON' | 'OFF')
                        setZoomLevel(data.zoom_level)
                        setCurrentGesture(data.gesture)
                        setCountdown(data.countdown)
                        setIsCapturing(data.is_capturing)
                        setPhotos(data.captured_photos)
                        setPeaceSignCount(data.peace_sign_count || 0)  // ✅ Cập nhật Peace sign counter
                        setRequiredPeaceCount(data.required_peace_count || 1)  // ✅ Cập nhật required Peace count
                        setGestureStabilityCount(data.gesture_stability_count || 0)  // ✅ Cập nhật gesture stability
                        setGestureStabilityRequired(data.gesture_stability_required || 3)  // ✅ Cập nhật required stability

                        // Auto proceed to selection after 6 photos
                        if (data.photos_count >= 6 && appState === 'capturing') {
                            setTimeout(() => setAppState('selecting'), 2000)
                        }
                    } catch (error) {
                        console.error('Error parsing WebSocket data:', error)
                    }
                }

                ws.onclose = () => {
                    console.log('🔌 Disconnected from AI backend')
                    // Reconnect after 3 seconds
                    setTimeout(connectWebSocket, 3000)
                }

                ws.onerror = (error) => {
                    console.error('WebSocket error:', error)
                }
            } catch (error) {
                console.error('Error connecting to WebSocket:', error)
            }
        }

        connectWebSocket()

        return () => {
            if (wsRef.current) {
                wsRef.current.close()
            }
        }
    }, [appState])

    const [isToggling, setIsToggling] = useState(false)

    const toggleMode = async () => {
        if (isToggling) return // Prevent multiple clicks

        try {
            setIsToggling(true)
            const response = await fetch('http://localhost:8000/toggle_mode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            })
            const data = await response.json()
            setMode(data.mode)
            setIsCapturing(data.is_capturing)
            setCountdown(data.countdown)
        } catch (error) {
            console.error('Error toggling mode:', error)
        } finally {
            setTimeout(() => setIsToggling(false), 1000)
        }
    }

    const resetPhotos = async () => {
        try {
            await fetch('http://localhost:8000/reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            })
            setPhotos([])
            setSelectedPhotos([])
            setMode('OFF')
            setIsCapturing(false)
            setCountdown(0)
            setPeaceSignCount(0)  // ✅ Reset Peace sign counter
            setGestureStabilityCount(0)  // ✅ Reset gesture stability
            setIsComposing(false)  // ✅ Reset composing state
        } catch (error) {
            console.error('Error resetting photos:', error)
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
            setIsComposing(true)
            // Use setTimeout to ensure state update is processed before composePhotos
            setTimeout(() => {
                composePhotos()
            }, 0)
        }
    }

    const composePhotos = () => {
        const selectedPhotoData = selectedPhotos.map(id =>
            photos.find(photo => photo.id === id)
        ).filter(Boolean) as Photo[]

        // Load the frame image first
        const frameImg = new Image()
        frameImg.onload = () => {
            // Create composition canvas with frame dimensions
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            if (!ctx) return

            // Set canvas size to match frame image
            canvas.width = frameImg.width
            canvas.height = frameImg.height

            // Calculate photo dimensions based on frame
            const frameWidth = frameImg.width
            const frameHeight = frameImg.height
            const slotHeight = Math.floor(frameHeight / 3) // Divide frame into 3 equal vertical slots
            const slotWidth = Math.floor(frameWidth * 0.95) // Use 95% of frame width for photos to fill more space
            const slotX = Math.floor((frameWidth - slotWidth) / 2) // Center horizontally

            // Draw photos first (behind the frame)
            let photosLoaded = 0
            const totalPhotos = selectedPhotoData.length

            selectedPhotoData.forEach((photo, index) => {
                const img = new Image()
                img.onload = () => {
                    const y = index * slotHeight

                    // Force photo to fill the entire slot width to eliminate side borders
                    // This will crop top/bottom if needed but ensures no side borders
                    const drawX = slotX
                    const drawY = y
                    const drawWidth = slotWidth
                    const drawHeight = slotHeight

                    // Draw photo to completely fill the slot (no aspect ratio preservation)
                    // This ensures no black borders on the sides
                    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)

                    photosLoaded++

                    // When all photos are loaded, draw the frame on top
                    if (photosLoaded === totalPhotos) {
                        // Draw the frame on top (this will only show non-transparent parts)
                        ctx.drawImage(frameImg, 0, 0)

                        // Convert to data URL and update state
                        const resultDataUrl = canvas.toDataURL('image/jpeg', 0.9)
                        setFinalResult(resultDataUrl)
                        setIsComposing(false)
                        setAppState('result')
                    }
                }
                img.src = photo.dataUrl
            })
        }

        // Load the frame image
        frameImg.src = '/frame.png'
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
        resetPhotos()
        setAppState('capturing')
        setFinalResult(null)
        setAppliedFilter(null)
        setIsComposing(false)
    }

    const renderCapturing = () => (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 relative overflow-hidden">
            {/* Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.1)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

            <div className="relative z-10 container mx-auto px-4 py-8">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-slate-800 mb-2">Photobooth with AI</h1>
                    <p className="text-slate-600">Hand gesture control - 👊 Zoom Out | ✋ Zoom In | ✌🏻 Peace Sign (2 fingers) to Capture</p>
                </div>

                <div className="flex gap-8 max-w-7xl mx-auto">
                    {/* Camera Section */}
                    <div className="flex-1">
                        <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ aspectRatio: '9/6' }}>
                            {/* AI Camera Stream */}
                            {wsData?.frame ? (
                                <img
                                    src={wsData.frame}
                                    alt="AI Camera Stream"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                    <div className="text-gray-500 text-lg">Connecting to AI Camera...</div>
                                </div>
                            )}

                            {/* Countdown Overlay */}
                            {countdown > 0 && (
                                <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
                                    <div className="text-white text-[10rem] font-black countdown-number opacity-90">
                                        {countdown}
                                    </div>
                                </div>
                            )}

                            {/* Status Overlay */}
                            <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg">
                                <div className="text-sm">
                                    <div>Mode: <span className={`font-bold ${mode === 'ON' ? 'text-green-400' : 'text-red-400'}`}>{mode}</span></div>
                                    <div>Zoom: <span className="font-bold text-blue-400">{zoomLevel}x</span></div>
                                    <div>Gesture: <span className="font-bold text-yellow-400">{currentGesture}</span></div>
                                    {/* ✅ Thêm hiển thị Peace sign progress với gesture stability */}
                                    {currentGesture === 'peace' && mode === 'OFF' && (
                                        <div className="mt-2">
                                            <div className="text-xs text-gray-300">Peace Sign Stability:</div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 bg-gray-600 rounded-full h-2">
                                                    <div
                                                        className="bg-yellow-400 h-2 rounded-full transition-all duration-200"
                                                        style={{ width: `${(gestureStabilityCount / gestureStabilityRequired) * 100}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-xs font-bold text-yellow-400">
                                                    {gestureStabilityCount}/{gestureStabilityRequired}
                                                </span>
                                            </div>
                                            {gestureStabilityCount >= gestureStabilityRequired && (
                                                <div className="text-xs text-green-400 mt-1">✅ Ready to activate!</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Camera Frame */}
                            <div className="absolute inset-0 border-4 border-blue-600 rounded-2xl pointer-events-none"></div>
                        </div>

                        {/* Mode Toggle Button */}
                        <button
                            onClick={toggleMode}
                            disabled={photos.length >= 6 || isToggling}
                            className={`w-full mt-6 font-bold py-4 px-8 rounded-xl text-xl transition-colors duration-200 ${mode === 'ON'
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-red-600 hover:bg-red-700 text-white'
                                } ${(photos.length >= 6 || isToggling) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {photos.length >= 6 ? 'Maximum Photos Reached' :
                                isToggling ? 'Switching...' : `MODE: ${mode}`}
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
                                        style={{ aspectRatio: '9/6' }}
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
                                    style={{ aspectRatio: '9/6' }}
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

    const renderComposing = () => (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.1)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

            <div className="relative z-10 container mx-auto px-4 py-8">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-slate-800 mb-2">Composing Your Photos</h1>
                    <p className="text-slate-600 mb-8">Please wait while we create your photobooth result...</p>

                    <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
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
                                className={`w-full max-w-lg mx-auto rounded-2xl shadow-2xl object-contain ${appliedFilter === 'white' ? 'brightness-110 contrast-105' :
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
        case 'composing':
            return renderComposing()
        case 'result':
            return renderResult()
        default:
            return renderCapturing()
    }
}

export default App