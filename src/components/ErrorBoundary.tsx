'use client';

import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 p-6">
                    <AlertTriangle className="w-12 h-12 text-destructive" />
                    <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
                    <p className="text-muted-foreground text-center max-w-md">
                        We encountered an error while initializing the camera. Please check your browser permissions and try again.
                    </p>
                    <Button
                        onClick={() => this.setState({ hasError: false })}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Try Again
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
