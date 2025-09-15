'use client';

import { usePhotobooth } from '@/hooks/usePhotobooth';
import { Camera } from '@/components/Camera';
import { ThumbnailGallery } from '@/components/ThumbnailGallery';
import { PhotoSelection } from '@/components/PhotoSelection';
import { FramePreview } from '@/components/FramePreview';
import { ColorFilters } from '@/components/ColorFilters';
import { ActionButtons } from '@/components/ActionButtons';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Sparkles } from 'lucide-react';

export default function Home() {
    const {
        state,
        videoRef,
        canvasRef,
        startCapture,
        startCountdown,
        selectPhoto,
        confirmSelection,
        applyColorFilter,
        resetPhotobooth,
        downloadPhoto,
    } = usePhotobooth();

    const renderStep = () => {
        switch (state.step) {
            case 'capturing':
                return (
                    <div className="flex flex-col lg:flex-row gap-8 items-start justify-center min-h-screen p-6">
                        <div className="flex-1 max-w-4xl">
                            <div className="text-center mb-8">
                                <div className="flex items-center justify-center mb-4">
                                    <Sparkles className="w-8 h-8 text-primary mr-3" />
                                    <h1 className="text-4xl font-bold text-foreground">Photobooth with AI</h1>
                                </div>
                                <p className="text-lg text-muted-foreground">
                                    Capture up to 6 photos to create your perfect photobooth experience
                                </p>
                            </div>

                            <div className="flex flex-col lg:flex-row gap-8 items-center">
                                <div className="flex-1">
                                    <ErrorBoundary>
                                        <Camera
                                            videoRef={videoRef}
                                            canvasRef={canvasRef}
                                            isCapturing={state.isCapturing}
                                            countdown={state.countdown}
                                            onStartCapture={startCapture}
                                            onStartCountdown={startCountdown}
                                        />
                                    </ErrorBoundary>
                                </div>

                                <div className="lg:ml-4">
                                    <ThumbnailGallery photos={state.photos} />
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'selecting':
                return (
                    <div className="min-h-screen p-6">
                        <div className="max-w-6xl mx-auto">
                            <PhotoSelection
                                photos={state.photos}
                                selectedPhotos={state.selectedPhotos}
                                onSelectPhoto={selectPhoto}
                                onConfirmSelection={confirmSelection}
                            />
                        </div>
                    </div>
                );

            case 'editing':
                return (
                    <div className="min-h-screen p-6">
                        <div className="max-w-6xl mx-auto space-y-8">
                            <div className="text-center space-y-2">
                                <h1 className="text-4xl font-bold text-foreground">Edit Your Photos</h1>
                                <p className="text-lg text-muted-foreground">
                                    Apply filters and customize your photobooth frame
                                </p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <ColorFilters
                                        currentFilter={state.currentFilter}
                                        onApplyFilter={applyColorFilter}
                                    />

                                    <ActionButtons
                                        onDownload={downloadPhoto}
                                        onTakeNew={resetPhotobooth}
                                    />
                                </div>

                                <div>
                                    <FramePreview
                                        selectedPhotos={state.selectedPhotos}
                                        currentFilter={state.currentFilter}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-background">
            {renderStep()}
        </div>
    );
}