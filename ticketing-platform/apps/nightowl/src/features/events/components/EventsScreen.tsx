import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { BannerCard, TabButton } from './EventUi';
import { CartPanel } from './panels/CartPanel';
import { DiscoverPanel } from './panels/DiscoverPanel';
import { ScannerPanel } from './panels/ScannerPanel';
import { TicketsPanel } from './panels/TicketsPanel';
import { styles } from './eventsScreenStyles';
import { useEventsExperience } from '../hooks/useEventsExperience';

export function EventsScreen() {
  const {
    activeTab,
    banner,
    busyKey,
    cameraPermission,
    canValidateTickets,
    cart,
    cartItemCount,
    currentOrder,
    filteredEvents,
    getCartQuantity,
    getDraftQuantity,
    handleAddAddOn,
    handleAddTicket,
    handleCameraScan,
    handleClearCart,
    handleCreateOrder,
    handlePreparePayment,
    handleRefreshTickets,
    handleSelectEvent,
    handleSelectScannerEvent,
    handleTabChange,
    handleUpdateCartItem,
    handleValidateTicket,
    isBootstrapping,
    isCheckingCameraPermission,
    isDemoMode,
    isStripeConfigured,
    loadingEventId,
    paymentIntent,
    requestCameraPermission,
    resetScanner,
    scanFeedback,
    scannerCameraPaused,
    scannerEventId,
    scannerInput,
    searchQuery,
    selectedEvent,
    selectedEventSummary,
    session,
    setScannerInput,
    setSearchQuery,
    signOut,
    tickets,
    updateDraftQuantity,
    userRoles,
    visibleEvents,
  } = useEventsExperience();

  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.backgroundOrbPrimary} />
      <View pointerEvents="none" style={styles.backgroundOrbSecondary} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <Text style={styles.kicker}>Night Owl Mobile</Text>
              <Text style={styles.title}>Events, passes and door control in one flow.</Text>
              <Text style={styles.subtitle}>
                Signed in as {session?.user.email}. Browse events, build the cart, prepare Stripe checkout, then show
                the ticket pass at the door.
              </Text>
            </View>

            <Pressable onPress={() => void signOut()} style={styles.signOutButton}>
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </View>

          <View style={styles.roleRow}>
            {userRoles.map((role) => (
              <View key={role} style={styles.roleChip}>
                <Text style={styles.roleChipText}>{role}</Text>
              </View>
            ))}

            {isDemoMode ? (
              <View style={styles.demoBadge}>
                <Text style={styles.demoBadgeText}>Demo mode</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.tabRow}>
          <TabButton label="Discover" isActive={activeTab === 'discover'} onPress={() => handleTabChange('discover')} />
          <TabButton label="Cart" isActive={activeTab === 'cart'} onPress={() => handleTabChange('cart')} count={cartItemCount} />
          <TabButton label="Tickets" isActive={activeTab === 'tickets'} onPress={() => handleTabChange('tickets')} count={tickets.length} />
          {canValidateTickets ? (
            <TabButton label="Scanner" isActive={activeTab === 'scanner'} onPress={() => handleTabChange('scanner')} />
          ) : null}
        </View>

        {banner ? <BannerCard tone={banner.tone} message={banner.message} /> : null}

        {isBootstrapping ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#f0b35c" size="large" />
            <Text style={styles.loadingLabel}>Loading event inventory, cart and tickets...</Text>
          </View>
        ) : null}

        {!isBootstrapping && activeTab === 'discover' ? (
          <DiscoverPanel
            filteredEvents={filteredEvents}
            getCartQuantity={getCartQuantity}
            getDraftQuantity={getDraftQuantity}
            loadingEventId={loadingEventId}
            onAddAddOn={(addOn) => void handleAddAddOn(addOn)}
            onAddTicket={(ticketType) => void handleAddTicket(ticketType)}
            onDecreaseDraftQuantity={(itemId) => updateDraftQuantity(itemId, -1)}
            onIncreaseDraftQuantity={(itemId) => updateDraftQuantity(itemId, 1)}
            onSearchChange={setSearchQuery}
            onSelectEvent={handleSelectEvent}
            searchQuery={searchQuery}
            selectedEvent={selectedEvent}
            selectedEventSummary={selectedEventSummary}
            busyKey={busyKey}
          />
        ) : null}

        {!isBootstrapping && activeTab === 'cart' ? (
          <CartPanel
            busyKey={busyKey}
            cart={cart}
            currentOrder={currentOrder}
            onClearCart={() => void handleClearCart()}
            onCreateOrder={() => void handleCreateOrder()}
            onPreparePayment={() => void handlePreparePayment()}
            onUpdateCartItem={(item, nextQuantity) => void handleUpdateCartItem(item, nextQuantity)}
            isStripeConfigured={isStripeConfigured}
            paymentIntent={paymentIntent}
            visibleEvents={visibleEvents}
          />
        ) : null}

        {!isBootstrapping && activeTab === 'tickets' ? (
          <TicketsPanel
            busyKey={busyKey}
            onRefreshTickets={() => void handleRefreshTickets()}
            tickets={tickets}
          />
        ) : null}

        {!isBootstrapping && activeTab === 'scanner' ? (
          <ScannerPanel
            busyKey={busyKey}
            cameraPermission={cameraPermission}
            isCheckingCameraPermission={isCheckingCameraPermission}
            onCameraScan={handleCameraScan}
            onRequestCameraPermission={() => void requestCameraPermission()}
            onResetScanner={resetScanner}
            onSelectScannerEvent={handleSelectScannerEvent}
            onSetScannerInput={setScannerInput}
            onValidateScan={() => void handleValidateTicket()}
            scanFeedback={scanFeedback}
            scannerCameraPaused={scannerCameraPaused}
            scannerEventId={scannerEventId}
            scannerInput={scannerInput}
            visibleEvents={visibleEvents}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}
