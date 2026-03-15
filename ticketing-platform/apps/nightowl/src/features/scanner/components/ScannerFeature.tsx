import type { BannerState, CameraPermissionState } from '../../events/hooks/experienceTypes';
import type { EventSummary } from '../../events/types';
import { ScannerPanel } from '../../events/components/panels/ScannerPanel';

export function ScannerFeature({
  busyKey,
  cameraPermission,
  isCheckingCameraPermission,
  onCameraScan,
  onRequestCameraPermission,
  onResetScanner,
  onSelectScannerEvent,
  onSetScannerInput,
  onValidateScan,
  scanFeedback,
  scannerCameraPaused,
  scannerEventId,
  scannerInput,
  visibleEvents,
}: {
  busyKey: string | null;
  cameraPermission: CameraPermissionState | null;
  isCheckingCameraPermission: boolean;
  onCameraScan: (payload: string) => void;
  onRequestCameraPermission: () => Promise<void> | void;
  onResetScanner: () => void;
  onSelectScannerEvent: (eventId: string) => void;
  onSetScannerInput: (value: string) => void;
  onValidateScan: () => Promise<void> | void;
  scanFeedback: BannerState | null;
  scannerCameraPaused: boolean;
  scannerEventId: string | null;
  scannerInput: string;
  visibleEvents: EventSummary[];
}) {
  return (
    <ScannerPanel
      busyKey={busyKey}
      cameraPermission={cameraPermission}
      isCheckingCameraPermission={isCheckingCameraPermission}
      onCameraScan={onCameraScan}
      onRequestCameraPermission={() => void onRequestCameraPermission()}
      onResetScanner={onResetScanner}
      onSelectScannerEvent={onSelectScannerEvent}
      onSetScannerInput={onSetScannerInput}
      onValidateScan={() => void onValidateScan()}
      scanFeedback={scanFeedback}
      scannerCameraPaused={scannerCameraPaused}
      scannerEventId={scannerEventId}
      scannerInput={scannerInput}
      visibleEvents={visibleEvents}
    />
  );
}
