import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { onSnapshot, query, where, documentId } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection } from "../../utils/firestoreHelpers";
import { fetchFridgeListFromFridgelogs } from "../../utils/fridgeHelpers";
import {
  buildNoDeliveryByDateKeyFromDocs,
  buildWeeklyComplianceReport,
  formatWeekRangeLabel,
  getMondayOfWeek,
  getWeekDateKeys,
} from "../../utils/reportingHelpers";
import { DELIVERY_DAY_STATUS_COLLECTION } from "../../utils/deliveryDayStatus";
import { Colors, Spacing, Typography } from "../../constants";
import { getAndroidTitleMargin } from "../../utils/responsive";
import useNavigationBar from "../../hooks/useNavigationBar";

export default function ReportingScreen() {
  const { restaurantId } = useRestaurant();
  const navigationBar = useNavigationBar();
  navigationBar.useHidden();

  const [weekMonday, setWeekMonday] = useState(() => getMondayOfWeek(new Date()));
  const [refreshing, setRefreshing] = useState(false);
  const [fridgeListNonce, setFridgeListNonce] = useState(0);

  const [openingTaskIds, setOpeningTaskIds] = useState(() => new Set());
  const [closingTaskIds, setClosingTaskIds] = useState(() => new Set());
  const [openingLogsByDate, setOpeningLogsByDate] = useState({});
  const [closingLogsByDate, setClosingLogsByDate] = useState({});
  const [fridgeLogDocs, setFridgeLogDocs] = useState([]);
  const [masterFridges, setMasterFridges] = useState([]);
  const [deliveryLogDocs, setDeliveryLogDocs] = useState([]);
  const [deliveryStatusDocs, setDeliveryStatusDocs] = useState([]);
  const [coolingReheatingDocs, setCoolingReheatingDocs] = useState([]);

  const todayMonday = getMondayOfWeek(new Date());
  const canGoNextWeek = weekMonday.getTime() < todayMonday.getTime();

  const weekKeys = useMemo(() => getWeekDateKeys(weekMonday), [weekMonday]);
  const weekStartKey = weekKeys[0];
  const weekEndKey = weekKeys[6];

  useEffect(() => {
    if (!restaurantId) {
      setOpeningTaskIds(new Set());
      return;
    }
    const unsub = onSnapshot(
      getRestaurantCollection(restaurantId, "openinglist"),
      (snap) => setOpeningTaskIds(new Set(snap.docs.map((d) => d.id))),
      () => setOpeningTaskIds(new Set())
    );
    return unsub;
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) {
      setClosingTaskIds(new Set());
      return;
    }
    const unsub = onSnapshot(
      getRestaurantCollection(restaurantId, "closinglist"),
      (snap) => setClosingTaskIds(new Set(snap.docs.map((d) => d.id))),
      () => setClosingTaskIds(new Set())
    );
    return unsub;
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) {
      setOpeningLogsByDate({});
      return;
    }
    const q = query(
      getRestaurantCollection(restaurantId, "openingChecklistLogs"),
      where("date", ">=", weekStartKey),
      where("date", "<=", weekEndKey)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const byDate = {};
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          if (!d.date || !d.taskId) return;
          if (!byDate[d.date]) byDate[d.date] = {};
          byDate[d.date][d.taskId] = d.completed === true;
        });
        setOpeningLogsByDate(byDate);
      },
      () => setOpeningLogsByDate({})
    );
    return unsub;
  }, [restaurantId, weekStartKey, weekEndKey]);

  useEffect(() => {
    if (!restaurantId) {
      setClosingLogsByDate({});
      return;
    }
    const q = query(
      getRestaurantCollection(restaurantId, "closingChecklistLogs"),
      where("date", ">=", weekStartKey),
      where("date", "<=", weekEndKey)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const byDate = {};
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          if (!d.date || !d.taskId) return;
          if (!byDate[d.date]) byDate[d.date] = {};
          byDate[d.date][d.taskId] = d.completed === true;
        });
        setClosingLogsByDate(byDate);
      },
      () => setClosingLogsByDate({})
    );
    return unsub;
  }, [restaurantId, weekStartKey, weekEndKey]);

  useEffect(() => {
    if (!restaurantId) {
      setFridgeLogDocs([]);
      return;
    }
    const unsub = onSnapshot(
      getRestaurantCollection(restaurantId, "fridgelogs"),
      (snap) => {
        setFridgeLogDocs(snap.docs);
        setFridgeListNonce((n) => n + 1);
      },
      () => setFridgeLogDocs([])
    );
    return unsub;
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    const unsub = onSnapshot(
      getRestaurantCollection(restaurantId, "fridges"),
      () => setFridgeListNonce((n) => n + 1),
      () => {}
    );
    return unsub;
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) {
      setMasterFridges([]);
      return;
    }
    let cancelled = false;
    fetchFridgeListFromFridgelogs(restaurantId, null).then((list) => {
      if (!cancelled) setMasterFridges(list);
    });
    return () => {
      cancelled = true;
    };
  }, [restaurantId, fridgeListNonce]);

  useEffect(() => {
    if (!restaurantId) {
      setDeliveryLogDocs([]);
      return;
    }
    const unsub = onSnapshot(
      getRestaurantCollection(restaurantId, "deliverylogs"),
      (snap) => setDeliveryLogDocs(snap.docs),
      () => setDeliveryLogDocs([])
    );
    return unsub;
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) {
      setCoolingReheatingDocs([]);
      return;
    }
    const unsub = onSnapshot(
      getRestaurantCollection(restaurantId, "coolingreheating"),
      (snap) => setCoolingReheatingDocs(snap.docs),
      () => setCoolingReheatingDocs([])
    );
    return unsub;
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) {
      setDeliveryStatusDocs([]);
      return;
    }
    const weekKeys = getWeekDateKeys(weekMonday);
    const q = query(
      getRestaurantCollection(restaurantId, DELIVERY_DAY_STATUS_COLLECTION),
      where(documentId(), "in", weekKeys)
    );
    const unsub = onSnapshot(
      q,
      (snap) => setDeliveryStatusDocs(snap.docs),
      () => setDeliveryStatusDocs([])
    );
    return unsub;
  }, [restaurantId, weekMonday]);

  const noDeliveryByDateKey = useMemo(
    () => buildNoDeliveryByDateKeyFromDocs(deliveryStatusDocs),
    [deliveryStatusDocs]
  );

  const report = useMemo(
    () =>
      buildWeeklyComplianceReport({
        weekMonday,
        openingTaskIds,
        closingTaskIds,
        openingLogsByDate,
        closingLogsByDate,
        masterFridges,
        fridgelogDocs: fridgeLogDocs,
        deliveryLogDocs,
        noDeliveryByDateKey,
        coolingReheatingDocs,
      }),
    [
      weekMonday,
      openingTaskIds,
      closingTaskIds,
      openingLogsByDate,
      closingLogsByDate,
      masterFridges,
      fridgeLogDocs,
      deliveryLogDocs,
      noDeliveryByDateKey,
      coolingReheatingDocs,
    ]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (restaurantId) {
      try {
        const list = await fetchFridgeListFromFridgelogs(restaurantId, null);
        setMasterFridges(list);
      } catch (_) {
        /* realtime listeners will reconcile */
      }
    }
    setTimeout(() => setRefreshing(false), 400);
  }, [restaurantId]);

  const goPrevWeek = () => {
    const d = new Date(weekMonday);
    d.setDate(d.getDate() - 7);
    setWeekMonday(d);
  };

  const goNextWeek = () => {
    if (!canGoNextWeek) return;
    const d = new Date(weekMonday);
    d.setDate(d.getDate() + 7);
    const nextMonday = getMondayOfWeek(d);
    if (nextMonday.getTime() > getMondayOfWeek(new Date()).getTime()) return;
    setWeekMonday(nextMonday);
  };

  const scoreRounded = Math.round(report.scorePercent);
  const missedCount = report.totalUnits - report.completedUnits;

  if (!restaurantId) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.centered}>
          <Text style={styles.muted}>Select a restaurant to view reporting.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.weekNav}>
          <TouchableOpacity style={styles.weekNavBtn} onPress={goPrevWeek} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <View style={styles.weekNavCenter}>
            <Text style={styles.weekNavLabel}>Week of</Text>
            <Text style={styles.weekNavRange}>{formatWeekRangeLabel(weekMonday)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.weekNavBtn, !canGoNextWeek && styles.weekNavBtnDisabled]}
            onPress={goNextWeek}
            disabled={!canGoNextWeek}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chevron-forward"
              size={22}
              color={canGoNextWeek ? Colors.primary : Colors.gray300}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.scoreCard}>
          <Text style={styles.scoreCardLabel}>Weekly score</Text>
          <Text style={styles.scoreValue}>{scoreRounded}%</Text>
          <Text style={styles.scoreDetail}>
            {report.completedUnits} of {report.totalUnits} tasks completed
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              <Text style={styles.summaryText}>
                {report.completedUnits} completed task{report.completedUnits === 1 ? "" : "s"} this week
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Ionicons name="alert-circle-outline" size={20} color={Colors.warning} />
              <Text style={styles.summaryText}>
                {missedCount} missed task{missedCount === 1 ? "" : "s"} this week
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This week overview</Text>
          {report.days.map((day) => (
            <View key={day.dateKey} style={styles.dayRow}>
              <View style={styles.dayRowLeft}>
                <Text
                  style={styles.dayWeekday}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                >
                  {day.weekday}
                </Text>
                <Text style={styles.dayDate} numberOfLines={1}>
                  {day.shortLabel}
                </Text>
              </View>
              <View style={styles.pills}>
                <View style={[styles.pill, day.opening ? styles.pillOk : styles.pillMiss]}>
                  <Text
                    style={styles.pillText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    Opening
                  </Text>
                </View>
                <View style={[styles.pill, day.closing ? styles.pillOk : styles.pillMiss]}>
                  <Text
                    style={styles.pillText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    Closing
                  </Text>
                </View>
                <View style={[styles.pill, day.fridge ? styles.pillOk : styles.pillMiss]}>
                  <Text
                    style={styles.pillText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    Fridge
                  </Text>
                </View>
                <View style={[styles.pill, day.delivery ? styles.pillOk : styles.pillMiss]}>
                  <Text
                    style={styles.pillText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    Delivery
                  </Text>
                </View>
                <View style={[styles.pill, day.cookingReheating ? styles.pillOk : styles.pillMiss]}>
                  <Text
                    style={styles.pillText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    C/R
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Missed tasks by day</Text>
          {report.missedSummaries.length === 0 ? (
            <View style={styles.emptyMissed}>
              <Ionicons name="ribbon-outline" size={40} color={Colors.gray300} />
              <Text style={styles.emptyMissedText}>Every day fully completed — great work.</Text>
            </View>
          ) : (
            report.missedSummaries.map((day) => (
              <View key={day.dateKey} style={styles.missedCard}>
                <Text style={styles.missedDayTitle}>
                  {day.weekday} · {day.shortLabel}
                </Text>
                <Text style={styles.missedList}>{day.missed.join(" · ")}</Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 88 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Spacing.lg + getAndroidTitleMargin(),
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  muted: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.gray50,
    borderRadius: 16,
  },
  weekNavBtn: {
    padding: Spacing.sm,
  },
  weekNavBtnDisabled: {
    opacity: 0.4,
  },
  weekNavCenter: {
    flex: 1,
    alignItems: "center",
  },
  weekNavLabel: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontMedium,
    color: Colors.textSecondary,
  },
  weekNavRange: {
    fontSize: Typography.base,
    fontFamily: Typography.fontSemiBold,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  scoreCard: {
    marginHorizontal: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    marginBottom: Spacing.lg,
  },
  scoreCardLabel: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontMedium,
    color: Colors.activeBlue,
    marginBottom: Spacing.xs,
  },
  scoreValue: {
    fontSize: 40,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
  },
  scoreDetail: {
    fontSize: Typography.base,
    fontFamily: Typography.fontMedium,
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },
  section: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontSemiBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.gray50,
    borderRadius: 14,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  dayRowLeft: {
    width: 118,
    flexShrink: 0,
  },
  dayWeekday: {
    fontSize: Typography.base,
    fontFamily: Typography.fontSemiBold,
    color: Colors.textPrimary,
    width: "100%",
  },
  dayDate: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  pills: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    minWidth: 0,
  },
  pill: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 3,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  pillOk: {
    backgroundColor: "#D1FAE5",
  },
  pillMiss: {
    backgroundColor: "#FEE2E2",
  },
  pillText: {
    fontSize: 9,
    fontFamily: Typography.fontMedium,
    color: Colors.gray700,
    textAlign: "center",
    width: "100%",
  },
  summaryCard: {
    backgroundColor: Colors.gray50,
    borderRadius: 16,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  summaryText: {
    flex: 1,
    fontSize: Typography.base,
    fontFamily: Typography.fontRegular,
    color: Colors.textPrimary,
  },
  emptyMissed: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.gray50,
    borderRadius: 16,
  },
  emptyMissedText: {
    marginTop: Spacing.sm,
    fontSize: Typography.base,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  missedCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  missedDayTitle: {
    fontSize: Typography.base,
    fontFamily: Typography.fontSemiBold,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  missedList: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontRegular,
    color: Colors.gray700,
    lineHeight: 20,
  },
});
