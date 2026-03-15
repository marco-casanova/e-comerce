import { Camera } from 'expo-camera';
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import { toAppError } from '../../../core/errors/appError';
import { eventsApi } from '../../events/api/eventsApi';
import type { EventSummary, TicketPass } from '../../events/types';
import { extractTicketIdFromPayload, formatShortDateTime } from '../../events/utils';
import type { BusyActionRunner, CameraPermissionState, ScreenTab, BannerState } from '../../events/hooks/experienceTypes';

export function useScannerExperience({
  activeTab,
  busyKey,
  canValidateTickets,
  runBusyAction,
  setTickets,
  visibleEvents,
}: {
  activeTab: ScreenTab;
  busyKey: string | null;
  canValidateTickets: boolean;
  runBusyAction: BusyActionRunner;
  setTickets: Dispatch<SetStateAction<TicketPass[]>>;
  visibleEvents: EventSummary[];
}) {
  const [scannerEventId, setScannerEventId] = useState<string | null>(null);
  const [scannerInput, setScannerInput] = useState('');
  const [scanFeedback, setScanFeedback] = useState<BannerState | null>(null);
  const [scannerCameraPaused, setScannerCameraPaused] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<CameraPermissionState | null>(null);
  const [isCheckingCameraPermission, setIsCheckingCameraPermission] = useState(false);

  useEffect(() => {
    if (!scannerEventId && visibleEvents[0]) {
      setScannerEventId(visibleEvents[0].id);
    }
  }, [scannerEventId, visibleEvents]);

  useEffect(() => {
    if (activeTab !== 'scanner' || !canValidateTickets || cameraPermission || isCheckingCameraPermission) {
      return;
    }

    void hydrateCameraPermission();
  }, [activeTab, cameraPermission, canValidateTickets, isCheckingCameraPermission]);

  async function hydrateCameraPermission() {
    try {
      setIsCheckingCameraPermission(true);
      const permission = await Camera.getCameraPermissionsAsync();
      setCameraPermission({
        granted: permission.granted,
        canAskAgain: permission.canAskAgain,
      });
    } catch (error) {
      setScanFeedback({ tone: 'error', message: toAppError(error).message });
    } finally {
      setIsCheckingCameraPermission(false);
    }
  }

  async function requestCameraPermission() {
    try {
      setIsCheckingCameraPermission(true);
      const permission = await Camera.requestCameraPermissionsAsync();
      setCameraPermission({
        granted: permission.granted,
        canAskAgain: permission.canAskAgain,
      });

      if (!permission.granted) {
        setScanFeedback({
          tone: 'info',
          message: permission.canAskAgain
            ? 'Camera access is still disabled. Allow it to scan tickets live.'
            : 'Camera access is blocked. Enable it from iOS Settings to scan tickets live.',
        });
      }
    } catch (error) {
      setScanFeedback({ tone: 'error', message: toAppError(error).message });
    } finally {
      setIsCheckingCameraPermission(false);
    }
  }

  function resetScanner() {
    setScannerCameraPaused(false);
    setScannerInput('');
    setScanFeedback(null);
  }

  function resumeScannerCamera() {
    setScannerCameraPaused(false);
  }

  async function handleValidateTicket(rawInput = scannerInput) {
    const ticketId = extractTicketIdFromPayload(rawInput.trim());

    if (!ticketId || !scannerEventId) {
      setScanFeedback({ tone: 'error', message: 'Paste a valid ticket payload or ticket id first.' });
      return;
    }

    await runBusyAction({
      busyKey: 'scanner:validate',
      errorTarget: 'scan',
      action: async () => {
        const result = await eventsApi.validateTicketScan(ticketId, scannerEventId);
        const nextTickets = await eventsApi.listTickets();
        return { result, nextTickets };
      },
      onSuccess: ({ result, nextTickets }) => {
        setScanFeedback({
          tone: 'success',
          message: `Ticket ${result.ticket.id.slice(0, 8)} validated. Entry open until ${formatShortDateTime(
            result.ticket.windowClosesAt,
          )}.`,
        });
        setScannerInput(rawInput);
        setTickets(nextTickets);
      },
    });
  }

  function handleCameraScan(payload: string) {
    if (scannerCameraPaused || busyKey === 'scanner:validate') {
      return;
    }

    setScannerCameraPaused(true);
    setScannerInput(payload);
    void handleValidateTicket(payload);
  }

  function handleSelectScannerEvent(eventId: string) {
    setScannerEventId(eventId);
    setScanFeedback(null);
  }

  return {
    cameraPermission,
    handleCameraScan,
    handleSelectScannerEvent,
    handleValidateTicket,
    isCheckingCameraPermission,
    requestCameraPermission,
    resetScanner,
    resumeScannerCamera,
    scanFeedback,
    scannerCameraPaused,
    scannerEventId,
    scannerInput,
    setScanFeedback,
    setScannerInput,
  };
}
