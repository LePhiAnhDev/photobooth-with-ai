'use client';

import { SelectedPhotos, ColorFilter } from '@/types/photobooth';
import { Card } from '@/components/ui/card';

interface FramePreviewProps {
    selectedPhotos: SelectedPhotos;
    currentFilter: ColorFilter;
}

export const FramePreview = ({ selectedPhotos, currentFilter }: FramePreviewProps) => {
    const applyFilter = (dataUrl: string, filter: ColorFilter): string => {
        if (filter === 'none') return dataUrl;

        // For now, return original dataUrl
        // In a real app, you'd implement sophisticated image processing here
        return dataUrl;
    };

    const photos = [selectedPhotos.photo1, selectedPhotos.photo2, selectedPhotos.photo3].filter(Boolean);

    return (
        <div className="frame-preview">
            <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-foreground mb-2">Your Photobooth Frame</h3>
                <p className="text-muted-foreground">Preview your selected photos</p>
            </div>

            <div className="flex flex-col items-center space-y-4">
                {photos.map((photo, index) => (
                    <Card key={photo?.id || index} className="overflow-hidden border-2 border-primary/20 shadow-lg hover:shadow-xl transition-shadow duration-300">
                        <div className="relative">
                            <img
                                src={photo ? applyFilter(photo.dataUrl, currentFilter) : ''}
                                alt={`Selected photo ${index + 1}`}
                                className="w-full max-w-sm h-auto object-cover"
                                style={{
                                    filter: currentFilter !== 'none' ?
                                        currentFilter === 'white' ? 'brightness(1.2) contrast(1.1)' :
                                            currentFilter === 'pink' ? 'hue-rotate(320deg) saturate(1.2)' :
                                                currentFilter === 'black' ? 'brightness(0.8) contrast(1.2)' :
                                                    currentFilter === 'yellow' ? 'hue-rotate(60deg) saturate(1.1)' :
                                                        'none' : 'none'
                                }}
                            />
                            <div className="absolute top-2 left-2 bg-primary text-primary-foreground px-2 py-1 rounded text-sm font-semibold">
                                Photo {index + 1}
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};
