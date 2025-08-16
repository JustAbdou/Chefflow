# ChefFlow Daily Reset Cloud Functions

This Firebase Cloud Function automatically resets daily restaurant data at 3 AM every day.

## 🚀 **What it does:**

### **Every day at 3 AM:**
1. **Order Lists** → Deletes ALL orders from current collection
2. **Prep Lists** → Deletes ONLY completed items (`done: true`), keeps incomplete items
3. **Fridge Temp Logs** → Deletes ALL logs from current collection  
4. **Delivery Temp Logs** → Deletes ALL logs from current collection
5. **Cleaning Checklist** → Deletes ONLY completed tasks (`done: true`), keeps incomplete tasks

## ⚠️ **Important:** 
Items are **permanently deleted** - no archiving is performed. This ensures a clean start each day without storing old data.

## 🛠 **Setup & Deployment:**

### **1. Install Dependencies:**
```bash
cd functions
npm install
```

### **2. Deploy to Firebase:**
```bash
# Make sure you're logged in to Firebase
firebase login

# Deploy the function
firebase deploy --only functions
```

### **3. Verify Deployment:**
```bash
# Check function logs
firebase functions:log --only dailyReset
```

## 🧪 **Testing:**

### **Manual Testing:**
You can trigger a manual reset for testing:
```bash
# Replace YOUR_RESTAURANT_ID with actual restaurant ID
curl "https://YOUR_REGION-YOUR_PROJECT_ID.cloudfunctions.net/manualReset?restaurantId=YOUR_RESTAURANT_ID"
```

### **Local Testing:**
```bash
# Start local emulator
npm run serve

# Test locally (replace restaurant ID)
curl "http://localhost:5001/YOUR_PROJECT_ID/us-central1/manualReset?restaurantId=YOUR_RESTAURANT_ID"
```

## ⚙️ **Configuration:**

### **Timezone:**
Currently set to `Europe/London`. Change in `functions/index.js`:
```javascript
.timeZone('America/New_York') // or your preferred timezone
```

### **Schedule:**
Currently set to 3 AM daily (`'0 3 * * *'`). Modify the cron expression:
```javascript
.schedule('0 6 * * *') // 6 AM daily
.schedule('0 3 * * 1') // 3 AM every Monday
```

## 🔍 **Monitoring:**

### **Check Logs:**
```bash
firebase functions:log --only dailyReset
```

### **Firebase Console:**
- Go to Firebase Console → Functions → dailyReset
- View execution history and logs

## 🚨 **Important Notes:**

1. **Billing:** Cloud Functions require Firebase Blaze plan (pay-as-you-go)
2. **Timezone:** Make sure timezone matches your restaurant's location
3. **Backup:** Archives are automatically created before deletion
4. **Testing:** Use `manualReset` function for testing (remove in production)

## 🔧 **Troubleshooting:**

### **Function not running:**
- Check Firebase Console → Functions for errors
- Verify timezone and schedule format
- Check billing plan (must be Blaze)

### **Permission errors:**
- Ensure Cloud Functions has Firestore access
- Check Firebase IAM permissions

### **Missing archives:**
- Check `/restaurants/{restaurantId}/archives/` collections
- Verify date format (YYYY-MM-DD)
