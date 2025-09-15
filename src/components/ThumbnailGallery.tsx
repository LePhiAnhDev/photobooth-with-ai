'use client';

import { Photo } from '@/types/photobooth';
import { Card } from '@/components/ui/card';

interface ThumbnailGalleryProps {
    photos: Photo[];
}

export const ThumbnailGallery = ({ photos }: ThumbnailGalleryProps) => {
    if (photos.length === 0) {
        return (
            <div className="w-32 space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground text-center">
                    Photos ({photos.length}/6)
                </h3>
                <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <Card key={index} className="w-full h-20 bg-muted/50 border-dashed border-2 border-muted-foreground/30" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="w-32 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground text-center">
                Photos ({photos.length}/6)
            </h3>
            <div className="thumbnail-grid">
                {photos.map((photo, index) => (
                    <Card key={`photo-${photo.id}-${index}`} className="overflow-hidden border-2 border-primary/20 hover:border-primary/40 transition-colors">
                        <img
                            src={photo.dataUrl}
                            alt={`Photo ${index + 1}`}
                            className="w-full h-20 object-cover"
                        />
                    </Card>
                ))}
                {Array.from({ length: 6 - photos.length }).map((_, index) => (
                    <Card key={`empty-${photos.length}-${index}`} className="w-full h-20 bg-muted/50 border-dashed border-2 border-muted-foreground/30" />
                ))}
            </div>
        </div>
    );
};
