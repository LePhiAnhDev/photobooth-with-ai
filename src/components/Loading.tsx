'use client';

import { Loader2 } from 'lucide-react';

interface LoadingProps {
    message?: string;
}

export const Loading = ({ message = 'Loading...' }: LoadingProps) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">{message}</p>
        </div>
    );
};
