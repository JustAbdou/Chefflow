# Restaurant Name Configuration Guide

## How to Change Your Restaurant Name

### Option 1: Use a Predefined Restaurant Name
Edit `/src/contexts/RestaurantContext.js` and change this line:
```javascript
const restaurantName = RESTAURANT_NAMES.MARIOS_PIZZERIA; // Change this
```

Available predefined options:
- `RESTAURANT_NAMES.MARIOS_PIZZERIA` → "Mario's Pizzeria" (ID: marios-pizzeria)
- `RESTAURANT_NAMES.JOES_CAFE` → "Joe's Cafe" (ID: joes-cafe)
- `RESTAURANT_NAMES.DOWNTOWN_BISTRO` → "Downtown Bistro" (ID: downtown-bistro)
- `RESTAURANT_NAMES.GOLDEN_DRAGON` → "Golden Dragon" (ID: golden-dragon)
- `RESTAURANT_NAMES.BURGER_PALACE` → "Burger Palace" (ID: burger-palace)
- `RESTAURANT_NAMES.FINE_DINING` → "Fine Dining Restaurant" (ID: fine-dining-restaurant)
- `RESTAURANT_NAMES.FAMILY_KITCHEN` → "Family Kitchen" (ID: family-kitchen)
- `RESTAURANT_NAMES.STREET_FOOD` → "Street Food Corner" (ID: street-food-corner)

### Option 2: Use a Custom Restaurant Name
Edit `/src/contexts/RestaurantContext.js` and change this line:
```javascript
const restaurantName = normalizeRestaurantName("Your Restaurant Name Here");
```

Examples:
- `"Mario's Delicious Pizza & Pasta"` → becomes `marios-delicious-pizza-pasta`
- `"The Golden Dragon Restaurant"` → becomes `the-golden-dragon-restaurant`
- `"Joe's 24/7 Diner & Grill"` → becomes `joes-247-diner-grill`

### Option 3: Use the Restaurant Selector Screen
Add the RestaurantSelectorScreen to your navigation to switch restaurants dynamically:

```javascript
// In your navigation file
import RestaurantSelectorScreen from '../screens/settings/RestaurantSelectorScreen';

// Add to your navigation stack
<Stack.Screen name="RestaurantSelector" component={RestaurantSelectorScreen} />
```

## Your Firestore Structure

With restaurant name "Mario's Pizzeria", your data will be stored at:
```
restaurants/
  marios-pizzeria/
    cleaninglist/
      {task-id}: { ... }
    preplist/
      {prep-id}: { ... }
    orderlist/
      {order-id}: { ... }
    recipes/
      {recipe-id}: { 
        ingredients/
          {ingredient-id}: { ... }
      }
    // etc...
```

## Migration

If you have existing data, run the migration:
```javascript
import { migrateToRestaurant } from './src/utils/dataMigration';

// Migrate to your restaurant
await migrateToRestaurant("Mario's Pizzeria");
```

## Important Notes

- Restaurant names are automatically normalized to valid Firestore document IDs
- Special characters are removed/replaced with hyphens
- All data is scoped to your specific restaurant
- You can change restaurant names anytime, but you'll need to migrate data
- The restaurant ID becomes part of your Firestore path structure
