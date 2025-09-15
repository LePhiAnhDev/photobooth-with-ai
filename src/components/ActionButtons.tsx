'use client';

import { Button } from '@/components/ui/button';
import { Download, RotateCcw } from 'lucide-react';

interface ActionButtonsProps {
    onDownload: () => void;
    onTakeNew: () => void;
}

export const ActionButtons = ({ onDownload, onTakeNew }: ActionButtonsProps) => {
    return (
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
                onClick={onDownload}
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            >
                <Download className="w-5 h-5 mr-2" />
                Download
            </Button>

            <Button
                onClick={onTakeNew}
                variant="outline"
                size="lg"
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            >
                <RotateCcw className="w-5 h-5 mr-2" />
                Take New
            </Button>
        </div>
    );
};
