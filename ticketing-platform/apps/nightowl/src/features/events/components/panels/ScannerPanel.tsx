import { CameraView } from 'expo-camera';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { BannerCard } from '../../../../core/ui/components';
import type { EventSummary } from '../../types';
import type { BannerState, CameraPermissionState } from '../../hooks/experienceTypes';
import { styles } from '../eventsScreenStyles';

function CameraScannerCard({
  cameraPermission,
  isCheckingCameraPermission,
  isPaused,
  onRequestPermission,
  onRequestNextScan,
  onScanned,
}: {
  cameraPermission: CameraPermissionState | null;
  isCheckingCameraPermission: boolean;
  isPaused: boolean;
  onRequestPermission: () => void;
  onRequestNextScan: () => void;
  onScanned: (payload: string) => void;
}) {
  if (!cameraPermission || isCheckingCameraPermission) {
    return (
      <View style={styles.cameraFallback}>
        <ActivityIndicator color="#f0b35c" />
        <Text style={styles.cameraFallbackText}>Checking camera permission...</Text>
      </View>
    );
  }

  if (!cameraPermission.granted) {
    return (
      <View style={styles.cameraFallback}>
        <Text style={styles.cameraFallbackTitle}>Camera access required</Text>
        <Text style={styles.cameraFallbackText}>
          {cameraPermission.canAskAgain
            ? 'Allow camera permission to scan ticket QR payloads directly from the Scanner tab.'
            : 'Camera access is blocked. Enable it in iOS Settings to scan tickets live.'}
        </Text>
        {cameraPermission.canAskAgain ? (
          <Pressable onPress={onRequestPermission} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Allow camera</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.cameraCard}>
      <View style={styles.cameraViewport}>
        <CameraView
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          facing="back"
          onBarcodeScanned={isPaused ? undefined : ({ data }) => onScanned(data)}
          style={styles.cameraView}
        />
        <View pointerEvents="none" style={styles.cameraOverlay}>
          <View style={styles.cameraTarget} />
        </View>
      </View>

      <Text style={styles.cameraHint}>
        {isPaused ? 'Scanner paused after the last read.' : 'Point the camera at a Night Owl ticket QR payload.'}
      </Text>

      {isPaused ? (
        <Pressable onPress={onRequestNextScan} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Resume camera scan</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ScannerPanel({
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
  onRequestCameraPermission: () => void;
  onResetScanner: () => void;
  onSelectScannerEvent: (eventId: string) => void;
  onSetScannerInput: (value: string) => void;
  onValidateScan: () => void;
  scanFeedback: BannerState | null;
  scannerCameraPaused: boolean;
  scannerEventId: string | null;
  scannerInput: string;
  visibleEvents: EventSummary[];
}) {
  return (
    <View testID="scanner-panel" style={styles.panel}>
      <Text style={styles.panelTitle}>Door scanner</Text>
      <Text style={styles.eventDescription}>
        Staff validation checks duplication, event mismatch, and whether the scan is inside the allowed entry window.
      </Text>

      <CameraScannerCard
        cameraPermission={cameraPermission}
        isCheckingCameraPermission={isCheckingCameraPermission}
        isPaused={scannerCameraPaused || busyKey === 'scanner:validate'}
        onRequestPermission={onRequestCameraPermission}
        onRequestNextScan={onResetScanner}
        onScanned={onCameraScan}
      />

      <ScrollView contentContainerStyle={styles.scannerEventRow} horizontal showsHorizontalScrollIndicator={false}>
        {visibleEvents.map((event) => (
          <Pressable
            key={event.id}
            testID={`scanner-event-chip-${event.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            onPress={() => onSelectScannerEvent(event.id)}
            style={[
              styles.scannerEventChip,
              scannerEventId === event.id ? styles.scannerEventChipActive : null,
            ]}
          >
            <Text style={styles.scannerEventText}>{event.title}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <TextInput
        autoCapitalize="none"
        testID="scanner-input"
        placeholder="Paste ticket payload or ticket id"
        placeholderTextColor="#7a8599"
        style={styles.searchInput}
        value={scannerInput}
        onChangeText={onSetScannerInput}
      />

      <Pressable
        onPress={onValidateScan}
        disabled={busyKey === 'scanner:validate'}
        testID="scanner-validate-button"
        style={[styles.primaryButton, busyKey === 'scanner:validate' ? styles.buttonDisabled : null]}
      >
        <Text style={styles.primaryButtonText}>
          {busyKey === 'scanner:validate' ? 'Validating...' : 'Validate scan'}
        </Text>
      </Pressable>

      <Pressable testID="scanner-reset-button" onPress={onResetScanner} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>
          {scannerCameraPaused ? 'Scan next ticket' : 'Reset scanner'}
        </Text>
      </Pressable>

      {scanFeedback ? <BannerCard testID="scanner-banner" tone={scanFeedback.tone} message={scanFeedback.message} compact /> : null}
    </View>
  );
}
