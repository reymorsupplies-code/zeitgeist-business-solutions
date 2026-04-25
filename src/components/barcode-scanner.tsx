'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScanLine, Camera, CameraOff, PackageSearch, ShoppingCart, AlertTriangle } from 'lucide-react';

interface ScannedProduct {
  id: string;
  name: string;
  price: number;
  cost: number;
  unit: string;
  barcode: string;
  category: string;
  stock: number;
}

interface BarcodeScannerProps {
  /** Optional callback when user taps "Add to Order" */
  onAddToOrder?: (product: ScannedProduct) => void;
}

export default function BarcodeScanner({ onAddToOrder }: BarcodeScannerProps) {
  const locale = useAppStore((s) => s.locale);
  const currentTenant = useAppStore((s) => s.currentTenant);
  const tenantId = currentTenant?.id;

  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);
  const [product, setProduct] = useState<ScannedProduct | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const scanningRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopScanning = useCallback(() => {
    scanningRef.current = false;
    if (readerRef.current) {
      readerRef.current.reset();
      readerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }, []);

  const lookupProduct = useCallback(
    async (barcode: string) => {
      if (!tenantId) return;
      setLoading(true);
      setNotFound(false);
      setProduct(null);
      try {
        const res = await fetch(
          `/api/tenant/${tenantId}/barcode-lookup?barcode=${encodeURIComponent(barcode)}`,
          {
            headers: {
              Authorization: `Bearer ${useAppStore.getState().token || localStorage.getItem('zbs-token')}`,
            },
          }
        );
        const data = await res.json();
        if (data.found && data.product) {
          setProduct(data.product);
          setShowResult(true);
        } else {
          setNotFound(true);
          setShowResult(true);
        }
      } catch {
        setError(t('common.error', locale));
      } finally {
        setLoading(false);
      }
    },
    [tenantId]
  );

  const startScanning = useCallback(async () => {
    setError(null);
    setCameraDenied(false);
    setNotFound(false);
    setProduct(null);
    setShowResult(false);

    // Check if getUserMedia is available
    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraDenied(true);
      setError(t('scanner.cameraError', locale));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setScanning(true);
      scanningRef.current = true;

      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      // Continuous scanning loop
      const scan = async () => {
        if (!scanningRef.current || !videoRef.current) return;
        try {
          const result = await reader.decodeFromVideoElement(videoRef.current);
          if (result && scanningRef.current) {
            const barcode = result.getText();
            setLastBarcode(barcode);
            // Stop scanning after a detection
            scanningRef.current = false;
            stopScanning();
            await lookupProduct(barcode);
          }
        } catch (err) {
          // NotFoundException is expected when no barcode is in frame — keep scanning
          if (err instanceof NotFoundException) {
            if (scanningRef.current) {
              requestAnimationFrame(scan);
            }
          } else {
            // Other errors — stop
            if (scanningRef.current) {
              requestAnimationFrame(scan);
            }
          }
        }
      };
      requestAnimationFrame(scan);
    } catch (err: any) {
      setCameraDenied(true);
      setError(t('scanner.cameraError', locale));
      console.error('Camera error:', err);
    }
  }, [locale, lookupProduct, stopScanning]);

  const handleAddToOrder = () => {
    if (product && onAddToOrder) {
      onAddToOrder(product);
    }
    setShowResult(false);
  };

  const handleTryAgain = () => {
    setShowResult(false);
    setNotFound(false);
    setProduct(null);
    setLastBarcode(null);
    setError(null);
    setCameraDenied(false);
  };

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md">
              <ScanLine className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base">{t('scanner.title', locale)}</CardTitle>
              <CardDescription className="text-sm">{t('scanner.subtitle', locale)}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Camera Viewfinder */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="relative aspect-[4/3] w-full bg-black rounded-lg overflow-hidden">
            {/* Video element */}
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${scanning ? 'block' : 'hidden'}`}
              playsInline
              muted
            />

            {/* Idle state — before scanning */}
            {!scanning && !cameraDenied && !showResult && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-zinc-900 to-zinc-800">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
                  <Camera className="h-10 w-10 text-white/60" />
                </div>
                <p className="text-sm text-white/50 px-4 text-center">
                  {t('scanner.subtitle', locale)}
                </p>
              </div>
            )}

            {/* Camera error state */}
            {!scanning && cameraDenied && !showResult && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-red-950 to-zinc-900 px-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-red-500/20">
                  <CameraOff className="h-10 w-10 text-red-400" />
                </div>
                <p className="text-sm text-red-300 text-center font-medium">
                  {error || t('scanner.cameraError', locale)}
                </p>
                <p className="text-xs text-red-300/60 text-center">
                  {t('scanner.cameraNotAllowed', locale)}
                </p>
                <Button variant="outline" size="sm" onClick={handleTryAgain} className="mt-2">
                  {t('scanner.tryAgain', locale)}
                </Button>
              </div>
            )}

            {/* Scanning overlay */}
            {scanning && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Corner brackets */}
                <div className="absolute top-4 left-4 h-12 w-12 border-l-2 border-t-2 border-amber-400 rounded-tl-lg" />
                <div className="absolute top-4 right-4 h-12 w-12 border-r-2 border-t-2 border-amber-400 rounded-tr-lg" />
                <div className="absolute bottom-4 left-4 h-12 w-12 border-l-2 border-b-2 border-amber-400 rounded-bl-lg" />
                <div className="absolute bottom-4 right-4 h-12 w-12 border-r-2 border-b-2 border-amber-400 rounded-br-lg" />

                {/* Animated scan line */}
                <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2">
                  <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse" />
                </div>

                {/* Scanning label */}
                <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                  <Badge
                    variant="secondary"
                    className="bg-black/70 text-amber-400 border-amber-400/30 backdrop-blur-sm animate-pulse"
                  >
                    {t('scanner.scanning', locale)}
                  </Badge>
                </div>
              </div>
            )}

            {/* Loading overlay during lookup */}
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                <p className="text-sm text-white/70">{t('scanner.scanning', locale)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Scan controls */}
      <div className="flex gap-3">
        {!scanning ? (
          <Button
            onClick={startScanning}
            className="flex-1 gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg"
            size="lg"
            disabled={loading}
          >
            <Camera className="h-5 w-5" />
            {t('scanner.startScan', locale)}
          </Button>
        ) : (
          <Button
            onClick={stopScanning}
            variant="destructive"
            className="flex-1 gap-2"
            size="lg"
          >
            <CameraOff className="h-5 w-5" />
            {t('scanner.stopScan', locale)}
          </Button>
        )}
      </div>

      {/* Last barcode display */}
      {lastBarcode && (
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            {t("barcode.last", locale)}: <span className="font-mono font-medium text-foreground">{lastBarcode}</span>
          </p>
        </div>
      )}

      {/* Product Found Dialog */}
      <Dialog open={showResult && !!product} onOpenChange={(open) => { if (!open) setShowResult(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                <PackageSearch className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              {t('scanner.productFound', locale)}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {product?.barcode}
            </DialogDescription>
          </DialogHeader>

          {product && (
            <div className="space-y-4 py-2">
              {/* Product Info Card */}
              <Card className="border-emerald-200 dark:border-emerald-800">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <p className="text-lg font-semibold leading-tight">{product.name}</p>
                    {product.category && (
                      <Badge variant="secondary" className="mt-1.5 text-xs">
                        {product.category}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{t("barcode.price", locale)}</p>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        ${Number(product.price).toFixed(2)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{t("barcode.cost", locale)}</p>
                      <p className="text-lg font-bold">
                        ${Number(product.cost).toFixed(2)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{t("barcode.stock", locale)}</p>
                      <p className={`text-lg font-bold ${product.stock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {product.stock}
                      </p>
                    </div>
                  </div>

                  {product.unit && (
                    <p className="text-xs text-muted-foreground text-center">
                      {t("barcode.unit", locale)}: {product.unit}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={handleTryAgain}
              className="gap-2"
            >
              {t('scanner.tryAgain', locale)}
            </Button>
            <Button
              onClick={handleAddToOrder}
              className="flex-1 gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
              disabled={!!(product && product.stock <= 0)}
            >
              <ShoppingCart className="h-4 w-4" />
              {t('scanner.addToOrder', locale)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Not Found Dialog */}
      <Dialog open={showResult && notFound} onOpenChange={(open) => { if (!open) setShowResult(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              {t('scanner.productNotFound', locale)}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {lastBarcode}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 text-center text-sm text-muted-foreground">
            {t('scanner.productNotFound', locale)}
          </div>

          <DialogFooter>
            <Button onClick={handleTryAgain} className="gap-2">
              {t('scanner.tryAgain', locale)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
