'use client';

import { useState, useCallback, useRef } from 'react';
import { Photo, SelectedPhotos, ColorFilter, PhotoboothState } from '@/types/photobooth';

const initialState: PhotoboothState = {
    step: 'capturing',
    photos: [],
    selectedPhotos: {
        photo1: null,
        photo2: null,
        photo3: null,
    },
    currentFilter: 'none',
    isCapturing: false,
    countdown: 0,
};

export const usePhotobooth = () => {
    const [state, setState] = useState<PhotoboothState>(initialState);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const photoCounterRef = useRef(0);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isCapturingRef = useRef(false);

    const startCapture = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                }
            });

            if (videoRef.current) {
                const video = videoRef.current;
                video.srcObject = stream;
                video.load();

                // Wait for video to be ready
                return new Promise<void>((resolve) => {
                    let attempts = 0;
                    const maxAttempts = 50; // 5 seconds max

                    const checkVideoReady = () => {
                        attempts++;

                        if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
                            resolve();
                        } else if (attempts >= maxAttempts) {
                            resolve();
                        } else {
                            setTimeout(checkVideoReady, 100);
                        }
                    };

                    checkVideoReady();

                    video.onloadedmetadata = checkVideoReady;
                    video.oncanplay = checkVideoReady;
                    video.onloadeddata = checkVideoReady;
                });
            }
        } catch (error) {
            throw error;
        }
    }, []);

    const capturePhoto = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) {
            return;
        }

        // Prevent multiple captures using ref instead of state
        if (isCapturingRef.current) {
            return;
        }

        isCapturingRef.current = true;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            isCapturingRef.current = false;
            return;
        }

        // Check if video is ready
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            // Try to force video to load
            video.load();

            // Wait a bit and try again
            setTimeout(() => {
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                    capturePhoto();
                } else {
                    isCapturingRef.current = false;
                }
            }, 500);
            return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

        // Validate dataUrl
        if (dataUrl.length < 100) {
            isCapturingRef.current = false;
            return;
        }

        // Create unique ID using counter + timestamp
        photoCounterRef.current += 1;
        const uniqueId = `${Date.now()}-${photoCounterRef.current}`;

        const newPhoto: Photo = {
            id: uniqueId,
            dataUrl,
            timestamp: new Date(),
        };

        setState(prev => {
            const newPhotos = [...prev.photos, newPhoto];
            const shouldMoveToSelection = newPhotos.length >= 6;

            return {
                ...prev,
                photos: newPhotos,
                step: shouldMoveToSelection ? 'selecting' : 'capturing',
            };
        });

        // Reset capturing flag immediately after state update
        isCapturingRef.current = false;
    }, []);

    const startCountdown = useCallback(() => {
        // Clear any existing interval
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
        }

        // Reset capturing flag before starting countdown
        isCapturingRef.current = false;

        setState(prev => ({ ...prev, isCapturing: true, countdown: 5 }));

        countdownIntervalRef.current = setInterval(() => {
            setState(prev => {
                if (prev.countdown <= 1) {
                    if (countdownIntervalRef.current) {
                        clearInterval(countdownIntervalRef.current);
                        countdownIntervalRef.current = null;
                    }
                    capturePhoto();
                    return { ...prev, isCapturing: false, countdown: 0 };
                }
                return { ...prev, countdown: prev.countdown - 1 };
            });
        }, 1000);
    }, [capturePhoto]);

    const selectPhoto = useCallback((photo: Photo, position: keyof SelectedPhotos) => {
        setState(prev => ({
            ...prev,
            selectedPhotos: {
                ...prev.selectedPhotos,
                [position]: photo,
            },
        }));
    }, []);

    const confirmSelection = useCallback(() => {
        setState(prev => ({ ...prev, step: 'editing' }));
    }, []);

    const applyColorFilter = useCallback((filter: ColorFilter) => {
        setState(prev => ({ ...prev, currentFilter: filter }));
    }, []);

    const resetPhotobooth = useCallback(() => {
        // Clear countdown interval
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }

        // Reset photo counter and capturing flag
        photoCounterRef.current = 0;
        isCapturingRef.current = false;

        setState(initialState);
        if (videoRef.current?.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
    }, []);

    const downloadPhoto = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const link = document.createElement('a');
        link.download = `photobooth-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }, []);

    return {
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
    };
};
