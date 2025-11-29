declare module "qr-scanner" {
  interface QrScanner {
    start: () => void;
    stop: () => void;
    destroy: () => void;
    hasCamera: boolean;
    supported: boolean;
  }

  const QrScanner: new (
    video: HTMLVideoElement,
    callback: (result: string) => void
  ) => QrScanner;

  export default QrScanner;
}
