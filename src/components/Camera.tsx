'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera as CameraIcon } from 'lucide-react';
import { Loading } from '@/components/Loading';

interface CameraProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    isCapturing: boolean;
    countdown: number;
    onStartCapture: () => void;
    onStartCountdown: () => void;
}

export const Camera = ({
    videoRef,
    canvasRef,
    isCapturing,
    countdown,
    onStartCapture,
    onStartCountdown,
}: CameraProps) => {
    const [isLoading, setIsLoading] = useState(true);
    const [cameraError, setCameraError] = useState<string | null>(null);


    useEffect(() => {
        const initCamera = async () => {
            try {
                setCameraError(null);
                await onStartCapture();
                setIsLoading(false);
            } catch {
                setCameraError('Failed to access camera. Please check permissions.');
                setIsLoading(false);
            }
        };

        initCamera();

        // Cleanup function
        return () => {
            const video = videoRef.current;
            if (video?.srcObject) {
                const stream = video.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [onStartCapture]);

    // Ensure video plays when ready
    useEffect(() => {
        const video = videoRef.current;
        if (video && !isLoading) {
            // Force play if paused
            if (video.paused) {
                video.play().catch(() => {
                    // Silent fail
                });
            }
        }
    }, [isLoading, videoRef]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center space-y-6">
                <div className="camera-frame w-full max-w-2xl relative">
                    <Loading message="Initializing camera..." />
                </div>
            </div>
        );
    }

    if (cameraError) {
        return (
            <div className="flex flex-col items-center space-y-6">
                <div className="camera-frame w-full max-w-2xl relative flex items-center justify-center bg-muted/50 border-2 border-dashed border-muted-foreground/30">
                    <div className="text-center space-y-4">
                        <p className="text-muted-foreground">{cameraError}</p>
                        <Button
                            onClick={() => {
                                setIsLoading(true);
                                setCameraError(null);
                                onStartCapture();
                            }}
                            variant="outline"
                        >
                            Try Again
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center space-y-6">
            <div className="camera-frame w-full max-w-2xl relative">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover rounded-lg"
                />

                {isCapturing && countdown > 0 && (
                    <div className="countdown-overlay">
                        {countdown}
                    </div>
                )}

                <canvas
                    ref={canvasRef}
                    className="hidden"
                />
            </div>

            <Button
                onClick={onStartCountdown}
                disabled={isCapturing}
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            >
                <CameraIcon className="w-5 h-5 mr-2" />
                {isCapturing ? 'Capturing...' : 'Start Capturing'}
            </Button>
        </div>
    );
};
