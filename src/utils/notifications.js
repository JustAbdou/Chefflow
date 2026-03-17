import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const EHO_REMINDER_TITLE = 'EHO Reminder';
const EHO_REMINDER_BODY = 'Don’t forget to complete all your EHO logs.';

// Configure how notifications are handled when received while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannelAsync() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

function isMatchingDailyTrigger(notification, hour, minute) {
  const trigger = notification.trigger;

  if (!trigger) return false;

  const type = trigger.type;
  const triggerHour = trigger.hour ?? trigger.dateComponents?.hour;
  const triggerMinute = trigger.minute ?? trigger.dateComponents?.minute;
  const repeats = trigger.repeats ?? trigger.repeating;

  return (
    (type === Notifications.SchedulableTriggerInputTypes.DAILY ||
      type === 'daily') &&
    repeats &&
    triggerHour === hour &&
    triggerMinute === minute
  );
}

export async function scheduleDailyEHOReminders() {
  try {
    // 1. Request / confirm permissions
    let { status } = await Notifications.getPermissionsAsync();

    if (status !== 'granted') {
      const permissionResponse = await Notifications.requestPermissionsAsync();
      status = permissionResponse.status;
    }

    if (status !== 'granted') {
      console.warn('Notifications permission not granted; EHO reminders will not be scheduled.');
      return;
    }

    // 2. Ensure Android notification channel
    await ensureAndroidChannelAsync();

    // 3. Check existing scheduled notifications to avoid duplicates
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();

    const has11amReminder = scheduled.some(
      (n) =>
        n.content?.title === EHO_REMINDER_TITLE &&
        n.content?.body === EHO_REMINDER_BODY &&
        isMatchingDailyTrigger(n, 11, 0)
    );

    const has3pmReminder = scheduled.some(
      (n) =>
        n.content?.title === EHO_REMINDER_TITLE &&
        n.content?.body === EHO_REMINDER_BODY &&
        isMatchingDailyTrigger(n, 15, 0)
    );

    // 4. Schedule any missing reminders
    if (!has11amReminder) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: EHO_REMINDER_TITLE,
          body: EHO_REMINDER_BODY,
        },
        trigger: {
          channelId: 'default', // Android; ignored on iOS
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 11,
          minute: 0,
          repeats: true,
        },
      });
    }

    if (!has3pmReminder) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: EHO_REMINDER_TITLE,
          body: EHO_REMINDER_BODY,
        },
        trigger: {
          channelId: 'default', // Android; ignored on iOS
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 15,
          minute: 0,
          repeats: true,
        },
      });
    }
  } catch (error) {
    console.error('Failed to schedule daily EHO reminders:', error);
  }
}

