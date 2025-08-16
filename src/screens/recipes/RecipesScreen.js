"use client"
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Image } from "react-native"
import { Colors } from "../../constants/Colors"
import { Typography } from "../../constants/Typography"
import { Spacing } from "../../constants/Spacing"
import { RestaurantIcon, ChevronRightIcon } from "../../components/icons/NavigationIcons"

function RecipesScreen() {
  const recipes = [
    {
      id: 1,
      name: "Classic Beef Bourguignon",
      category: "Main",
      image: "https://i.ibb.co/JFwG3BBv/1.jpg",
    },
    {
      id: 2,
      name: "Shepherd’s Pie",
      category: "Main",
      image: "https://i.ibb.co/MD9z31RG/2.jpg", 
    },
    {
      id: 3,
      name: "Yorkshire Pudding",
      category: "Desserts",
      image: "https://i.ibb.co/7JWLKJgW/3.jpg",
    },
    {
      id: 4,
      name: "Pizza Margherita",
      category: "Main",
      image: "https://i.ibb.co/vCJqy9c6/4.jpg",
    },
  ]

  const renderRecipeCard = (recipe) => (
    <TouchableOpacity key={recipe.id} style={styles.recipeCard} activeOpacity={0.7}>
      <Image
        source={{ uri: recipe.image }}
        style={styles.recipeImage}
        resizeMode="cover"
      />
      <View style={styles.recipeInfo}>
        <Text style={styles.recipeName}>{recipe.name}</Text>
        <Text style={styles.recipeCategory}>{recipe.category}</Text>
      </View>
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.appTitle}>ChefFlow</Text>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Recipe Library</Text>
          <Text style={styles.subtitle}>156 recipes available</Text>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Text style={styles.searchPlaceholder}>Search recipes...</Text>
          </View>
        </View>

        <View style={styles.categoriesContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
            {["All Recipes", "Starters", "Main", "Dessert"].map((category, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.categoryChip, index === 0 && styles.activeCategoryChip]}
                activeOpacity={0.7}
              >
                <Text style={[styles.categoryText, index === 0 && styles.activeCategoryText]}>{category}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.recipesContainer}>
          {recipes.map(renderRecipeCard)}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  appTitle: {
    fontSize: Typography.xxl,
    fontFamily: Typography.fontBold,
    color: Colors.primary,
    textAlign: 'center',
  },
  title: {
    fontSize: 30,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  searchBar: {
    backgroundColor: Colors.gray50,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchPlaceholder: {
    color: Colors.gray400,
    fontSize: Typography.base,
  },
  categoriesContainer: {
    marginBottom: Spacing.lg,
  },
  categoriesScroll: {
    paddingLeft: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  categoryChip: {
    backgroundColor: Colors.gray100,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 50,
    marginRight: Spacing.sm,
  },
  activeCategoryChip: {
    backgroundColor: Colors.primary,
  },
  categoryText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  activeCategoryText: {
    color: Colors.background,
  },
  recipesContainer: {
    paddingHorizontal: Spacing.lg,
  },
  recipeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  recipeImage: {
    width: 100,
    height: 100,
    borderRadius: 15,
    backgroundColor: Colors.gray100,
    marginRight: Spacing.md,
  },
  recipeInfo: {
    flex: 1,
  },
  recipeName: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  recipeCategory: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  recipeTime: {
    fontSize: Typography.xs,
    color: Colors.gray400,
  },
})

export default RecipesScreen
