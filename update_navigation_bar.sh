
echo "🤖 ChefFlow Android Navigation Bar Update Script"
echo "================================================"

update_screen() {
    local file_path="$1"
    local screen_name=$(basename "$file_path" .js)
    
    echo "📱 Updating $screen_name..."
    
    if [ ! -f "$file_path" ]; then
        echo "❌ File not found: $file_path"
        return 1
    fi
    
    if grep -q "useNavigationBar" "$file_path"; then
        echo "✅ $screen_name already has navigation bar control"
        return 0
    fi
    
    echo "🔧 Adding navigation bar control to $screen_name"
    
    echo "   - Add import: import useNavigationBar from '../../hooks/useNavigationBar';"
    echo "   - Add hook: const navigationBar = useNavigationBar();"
    echo "   - Add call: navigationBar.useLeanBack();"
    echo ""
}

SCREEN_FILES=(
    "src/screens/recipes/AddRecipeScreen.js"
    "src/screens/recipes/RecipeDetailScreen.js"
    "src/screens/invoices/InvoicesDownloadsScreen.js"
    "src/screens/invoices/InvoiceUploadScreen.js"
    "src/screens/temperature/TemperatureRecordsScreen.js"
    "src/screens/temperature/TemperatureDownloadsScreen.js"
    "src/screens/handover/HandoverCompletionScreen.js"
    "src/screens/fridge/AddFridgeTempModal.js"
    "src/screens/orders/AddOrderItemModal.js"
    "src/screens/prep/AddPrepItemModal.js"
    "src/screens/cleaning/AddCleaningTaskModal.js"
)

echo "🎯 Checking remaining screens..."
echo ""

for file in "${SCREEN_FILES[@]}"; do
    if [ -f "$file" ]; then
        update_screen "$file"
    else
        echo "⚠️  File not found: $file"
    fi
done

echo ""
echo "✅ Script complete!"
echo ""
echo "📋 Manual Steps Required:"
echo "1. For each file listed above, add the import statement"
echo "2. Add the hook initialization in the component"
echo "3. Add the useLeanBack() call"
echo ""
echo "💡 Example for any React component:"
echo ""
echo "   // Add import at top"
echo "   import useNavigationBar from '../../hooks/useNavigationBar';"
echo ""
echo "   // Add in component function"
echo "   const navigationBar = useNavigationBar();"
echo "   navigationBar.useLeanBack();"
echo ""
