import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { BannerCard } from '../../../core/ui/components';
import { CartFeature } from '../../cart/components/CartFeature';
import { CheckoutFeature } from '../../checkout/components/CheckoutFeature';
import { DiscoverFeature } from '../../discover/components/DiscoverFeature';
import { ScannerFeature } from '../../scanner/components/ScannerFeature';
import { TicketsFeature } from '../../tickets/components/TicketsFeature';
import { TabButton } from '../components/EventUi';
import { styles } from '../components/eventsScreenStyles';
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
    handleCheckout,
    handleClearCart,
    handleRefreshTickets,
    handleSelectEvent,
    handleSelectScannerEvent,
    handleTabChange,
    handleUpdateCartItem,
    handleValidateTicket,
    isBootstrapping,
    isCheckingCameraPermission,
    isDemoMode,
    isPlatformWalletSupported,
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
    selectedPaymentMethod,
    session,
    setScannerInput,
    setSearchQuery,
    setSelectedPaymentMethod,
    signOut,
    tickets,
    updateDraftQuantity,
    userRoles,
    visibleEvents,
  } = useEventsExperience();

  return (
    <View testID="events-screen" style={styles.screen}>
      <View pointerEvents="none" style={styles.backgroundOrbPrimary} />
      <View pointerEvents="none" style={styles.backgroundOrbSecondary} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        testID="events-scroll"
      >
        <View testID="events-hero" style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <Text style={styles.kicker}>Night Owl Mobile</Text>
              <Text style={styles.title}>Events, passes and door control in one flow.</Text>
              <Text style={styles.subtitle}>
                Signed in as {session?.user.email}. Browse events, build your cart, pay in one Stripe checkout flow,
                then show the ticket pass at the door.
              </Text>
            </View>

            <Pressable testID="sign-out-button" onPress={() => void signOut()} style={styles.signOutButton}>
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
              <View testID="demo-mode-badge" style={styles.demoBadge}>
                <Text style={styles.demoBadgeText}>Demo mode</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.tabRow}>
          <TabButton
            label="Discover"
            isActive={activeTab === 'discover'}
            onPress={() => handleTabChange('discover')}
            testID="tab-discover"
          />
          <TabButton
            label="Cart"
            isActive={activeTab === 'cart'}
            onPress={() => handleTabChange('cart')}
            count={cartItemCount}
            testID="tab-cart"
          />
          <TabButton
            label="Tickets"
            isActive={activeTab === 'tickets'}
            onPress={() => handleTabChange('tickets')}
            count={tickets.length}
            testID="tab-tickets"
          />
          {canValidateTickets ? (
            <TabButton
              label="Scanner"
              isActive={activeTab === 'scanner'}
              onPress={() => handleTabChange('scanner')}
              testID="tab-scanner"
            />
          ) : null}
        </View>

        {banner ? <BannerCard testID="app-banner" tone={banner.tone} message={banner.message} /> : null}

        {isBootstrapping ? (
          <View testID="events-loading-state" style={styles.loadingCard}>
            <ActivityIndicator color="#f0b35c" size="large" />
            <Text style={styles.loadingLabel}>Loading event inventory, cart and tickets...</Text>
          </View>
        ) : null}

        {!isBootstrapping && activeTab === 'discover' ? (
          <DiscoverFeature
            busyKey={busyKey}
            filteredEvents={filteredEvents}
            getCartQuantity={getCartQuantity}
            getDraftQuantity={getDraftQuantity}
            loadingEventId={loadingEventId}
            onAddAddOn={handleAddAddOn}
            onAddTicket={handleAddTicket}
            onDecreaseDraftQuantity={(itemId) => updateDraftQuantity(itemId, -1)}
            onIncreaseDraftQuantity={(itemId) => updateDraftQuantity(itemId, 1)}
            onSearchChange={setSearchQuery}
            onSelectEvent={handleSelectEvent}
            searchQuery={searchQuery}
            selectedEvent={selectedEvent}
            selectedEventSummary={selectedEventSummary}
          />
        ) : null}

        {!isBootstrapping && activeTab === 'cart' ? (
          <>
            <CheckoutFeature
              busyKey={busyKey}
              cart={cart}
              currentOrder={currentOrder}
              isPlatformWalletSupported={isPlatformWalletSupported}
              isStripeConfigured={isStripeConfigured}
              onCheckout={handleCheckout}
              onSelectPaymentMethod={setSelectedPaymentMethod}
              paymentIntent={paymentIntent}
              selectedPaymentMethod={selectedPaymentMethod}
            />
            <CartFeature
              busyKey={busyKey}
              cart={cart}
              onClearCart={handleClearCart}
              onUpdateCartItem={handleUpdateCartItem}
              visibleEvents={visibleEvents}
            />
          </>
        ) : null}

        {!isBootstrapping && activeTab === 'tickets' ? (
          <TicketsFeature
            busyKey={busyKey}
            onRefreshTickets={handleRefreshTickets}
            tickets={tickets}
          />
        ) : null}

        {!isBootstrapping && activeTab === 'scanner' ? (
          <ScannerFeature
            busyKey={busyKey}
            cameraPermission={cameraPermission}
            isCheckingCameraPermission={isCheckingCameraPermission}
            onCameraScan={handleCameraScan}
            onRequestCameraPermission={requestCameraPermission}
            onResetScanner={resetScanner}
            onSelectScannerEvent={handleSelectScannerEvent}
            onSetScannerInput={setScannerInput}
            onValidateScan={handleValidateTicket}
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
