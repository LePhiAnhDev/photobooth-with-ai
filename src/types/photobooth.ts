export interface Photo {
    id: string;
    dataUrl: string;
    timestamp: Date;
}

export interface SelectedPhotos {
    photo1: Photo | null;
    photo2: Photo | null;
    photo3: Photo | null;
}

export type ColorFilter = 'none' | 'white' | 'pink' | 'black' | 'yellow';

export type AppStep = 'capturing' | 'selecting' | 'editing';

export interface PhotoboothState {
    step: AppStep;
    photos: Photo[];
    selectedPhotos: SelectedPhotos;
    currentFilter: ColorFilter;
    isCapturing: boolean;
    countdown: number;
}
