declare module 'hark' {
    interface HarkOptions {
        smoothing?: number;
        interval?: number;
        threshold?: number;
        play?: boolean;
        history?: number;
    }

    interface HarkEvents {
        on(event: 'speaking', listener: () => void): void;
        on(event: 'stopped_speaking', listener: () => void): void;
        on(event: 'volume_change', listener: (currentVolume: number, threshold: number) => void): void;
        stop(): void;
        suspend(): Promise<void>;
        resume(): Promise<void>;
    }

    export default function hark(stream: MediaStream, options?: HarkOptions): HarkEvents;
}
