'use client';

import { Photo, SelectedPhotos } from '@/types/photobooth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check } from 'lucide-react';

interface PhotoSelectionProps {
    photos: Photo[];
    selectedPhotos: SelectedPhotos;
    onSelectPhoto: (photo: Photo, position: keyof SelectedPhotos) => void;
    onConfirmSelection: () => void;
}

export const PhotoSelection = ({
    photos,
    selectedPhotos,
    onSelectPhoto,
    onConfirmSelection,
}: PhotoSelectionProps) => {
    const isSelectionComplete = selectedPhotos.photo1 && selectedPhotos.photo2 && selectedPhotos.photo3;

    const getSelectionPosition = (photo: Photo): keyof SelectedPhotos | null => {
        if (selectedPhotos.photo1?.id === photo.id) return 'photo1';
        if (selectedPhotos.photo2?.id === photo.id) return 'photo2';
        if (selectedPhotos.photo3?.id === photo.id) return 'photo3';
        return null;
    };

    const getNextEmptyPosition = (): keyof SelectedPhotos | null => {
        if (!selectedPhotos.photo1) return 'photo1';
        if (!selectedPhotos.photo2) return 'photo2';
        if (!selectedPhotos.photo3) return 'photo3';
        return null;
    };

    const handlePhotoClick = (photo: Photo) => {
        const currentPosition = getSelectionPosition(photo);

        if (currentPosition) {
            // Deselect if already selected
            onSelectPhoto(photo, currentPosition);
        } else {
            // Select in next empty position
            const nextPosition = getNextEmptyPosition();
            if (nextPosition) {
                onSelectPhoto(photo, nextPosition);
            }
        }
    };

    return (
        <div className="space-y-8">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-foreground">Select Your Photos</h2>
                <p className="text-muted-foreground">Choose 3 photos to create your photobooth collage</p>
            </div>

            <div className="photo-selection-grid">
                {photos.map((photo) => {
                    const position = getSelectionPosition(photo);
                    const isSelected = position !== null;

                    return (
                        <Card
                            key={photo.id}
                            className={`cursor-pointer transition-all duration-300 hover:scale-105 ${isSelected
                                    ? 'ring-2 ring-primary shadow-lg'
                                    : 'hover:shadow-md'
                                }`}
                            onClick={() => handlePhotoClick(photo)}
                        >
                            <div className="relative">
                                <img
                                    src={photo.dataUrl}
                                    alt={`Photo ${photo.id}`}
                                    className="w-full h-48 object-cover rounded-lg"
                                />
                                {isSelected && (
                                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                                        <Check className="w-4 h-4" />
                                    </div>
                                )}
                                {position && (
                                    <div className="absolute bottom-2 left-2 bg-primary text-primary-foreground px-2 py-1 rounded text-sm font-semibold">
                                        {position.replace('photo', 'Photo ')}
                                    </div>
                                )}
                            </div>
                        </Card>
                    );
                })}
            </div>

            <div className="flex justify-center">
                <Button
                    onClick={onConfirmSelection}
                    disabled={!isSelectionComplete}
                    size="lg"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                >
                    Confirm Selection
                </Button>
            </div>
        </div>
    );
};
