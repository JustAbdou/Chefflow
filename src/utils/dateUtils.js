export function getFormattedTodayDate() {
  const today = new Date();
  const options = { weekday: 'long', month: 'long', day: 'numeric' };
  return today.toLocaleDateString(undefined, options);
}

export function isItemFromYesterday(itemCreatedAt) {
  if (!itemCreatedAt) return false;
  
  let itemDate;
  if (typeof itemCreatedAt.toDate === 'function') {
    itemDate = itemCreatedAt.toDate();
  } else if (itemCreatedAt instanceof Date) {
    itemDate = itemCreatedAt;
  } else {
    itemDate = new Date(itemCreatedAt);
  }
  
  const now = new Date();
  
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayAt3AM = new Date(today.getTime() + (3 * 60 * 60 * 1000));
  
  // If current time is before 3 AM, we consider "today" to start from yesterday's 3 AM
  let cutoffTime;
  if (now.getHours() < 3) {
    // It's before 3 AM, so "yesterday" items are those before yesterday's 3 AM
    const yesterdayAt3AM = new Date(todayAt3AM.getTime() - (24 * 60 * 60 * 1000));
    cutoffTime = yesterdayAt3AM;
  } else {
    // It's after 3 AM, so "yesterday" items are those before today's 3 AM
    cutoffTime = todayAt3AM;
  }
  
  return itemDate < cutoffTime;
}

export function groupPrepItemsByDay(items) {
  const todayItems = [];
  const yesterdayItems = [];
  
  // Get current date and time
  const now = new Date();
  
  // Calculate the 3 AM cutoff for today
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayAt3AM = new Date(today.getTime() + (3 * 60 * 60 * 1000)); // 3 AM today
  
  // If current time is before 3 AM, adjust the cutoff to yesterday's 3 AM
  let currentDayCutoff;
  if (now.getHours() < 3) {
    // It's before 3 AM, so current "day" started from yesterday's 3 AM
    currentDayCutoff = new Date(todayAt3AM.getTime() - (24 * 60 * 60 * 1000));
  } else {
    // It's after 3 AM, so current "day" started from today's 3 AM
    currentDayCutoff = todayAt3AM;
  }
  
  // Calculate the 48-hour window start (previous day's 3 AM)
  const window48HoursStart = new Date(currentDayCutoff.getTime() - (24 * 60 * 60 * 1000));
  
  items.forEach(item => {
    if (!item.createdAt) {
      // If no creation date, put in today's items as fallback
      todayItems.push(item);
      return;
    }
    
    // Convert Firestore timestamp to Date if needed
    let itemDate;
    if (typeof item.createdAt.toDate === 'function') {
      itemDate = item.createdAt.toDate();
    } else if (item.createdAt instanceof Date) {
      itemDate = item.createdAt;
    } else {
      itemDate = new Date(item.createdAt);
    }
    
    // Check if item falls within the 48-hour window
    if (itemDate >= currentDayCutoff) {
      // Item is from current day (after current day's 3 AM cutoff)
      todayItems.push(item);
    } else if (itemDate >= window48HoursStart && itemDate < currentDayCutoff) {
      // Item is from yesterday (within 48-hour window, before current day's 3 AM)
      yesterdayItems.push(item);
    }
    // Items older than 48 hours are not included in either list
  });
  
  return { todayItems, yesterdayItems };
}

export function groupCleaningTasksByDay(tasks) {
  const todayTasks = [];
  const yesterdayTasks = [];
  
  // Get current date and time
  const now = new Date();
  
  // Calculate the 3 AM cutoff for today
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayAt3AM = new Date(today.getTime() + (3 * 60 * 60 * 1000)); // 3 AM today
  
  // If current time is before 3 AM, adjust the cutoff to yesterday's 3 AM
  let currentDayCutoff;
  if (now.getHours() < 3) {
    // It's before 3 AM, so current "day" started from yesterday's 3 AM
    currentDayCutoff = new Date(todayAt3AM.getTime() - (24 * 60 * 60 * 1000));
  } else {
    // It's after 3 AM, so current "day" started from today's 3 AM
    currentDayCutoff = todayAt3AM;
  }
  
  // Calculate the 48-hour window start (previous day's 3 AM)
  const window48HoursStart = new Date(currentDayCutoff.getTime() - (24 * 60 * 60 * 1000));
  
  tasks.forEach(task => {
    if (!task.createdAt) {
      // If no creation date, put in today's tasks as fallback
      todayTasks.push(task);
      return;
    }
    
    // Convert Firestore timestamp to Date if needed
    let taskDate;
    if (typeof task.createdAt.toDate === 'function') {
      taskDate = task.createdAt.toDate();
    } else if (task.createdAt instanceof Date) {
      taskDate = task.createdAt;
    } else {
      taskDate = new Date(task.createdAt);
    }
    
    // Check if task falls within the 48-hour window
    if (taskDate >= currentDayCutoff) {
      // Task is from current day (after current day's 3 AM cutoff)
      todayTasks.push(task);
    } else if (taskDate >= window48HoursStart && taskDate < currentDayCutoff) {
      // Task is from yesterday (within 48-hour window, before current day's 3 AM)
      yesterdayTasks.push(task);
    }
    // Tasks older than 48 hours are not included in either list
  });
  
  return { todayTasks, yesterdayTasks };
}