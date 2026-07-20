'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Apple, BookOpen, Plus, X } from 'lucide-react'
import Link from 'next/link'
import { getLocalDateString } from '@/lib/date'
import { getEffectiveTarget, type TrainingIntensity, type TrainingPhase } from '@/lib/nutrition'
import NutritionChart from '@/components/nutrition/nutrition-chart'
import NutritionInsightCard from '@/components/nutrition/nutrition-insight-card'
import type { CaloriePoint } from '@/lib/nutrition-trend'
import MealTagPicker from '@/components/nutrition/meal-tag-picker'
import { MEAL_TAGS, mealTagLabel, type MealTag } from '@/lib/food-constants'

const MIN_ENTRIES_FOR_TREND = 3

type NutritionEntry = {
  id: string
  date: string
  calories: number
  protein_g: number
  fat_g: number
  carbs_g: number
  activity_adjustment_kcal: number | null
  activity_note: string | null
}

type FoodItem = {
  id: string
  name: string
  logged_at: string | null
  ingredients: string | null
  meal_tag: string | null
  food_library_id: string | null
  servings: number | null
  logged_calories: number | null
  logged_protein_g: number | null
  logged_fat_g: number | null
  logged_carbs_g: number | null
}

type FoodTemplate = {
  id: string
  name: string
  calories: number
  protein_g: number
  fat_g: number
  carbs_g: number
  default_meal_tag: string | null
  ingredients: string | null
}

type FoodItemForm = {
  name: string
  loggedAt: string
  ingredients: string
  mealTag: MealTag | null
  foodLibraryId: string | null
  servings: number
  loggedCalories: number | null
  loggedProteinG: number | null
  loggedFatG: number | null
  loggedCarbsG: number | null
}

const emptyForm = {
  date: '',
  calories: '',
  protein: '',
  fat: '',
  carbs: '',
  activityAdjustment: '',
  activityNote: '',
  items: [] as FoodItemForm[],
}

export default function NutritionPage() {
  const today = getLocalDateString()
  const [maintenanceCalories, setMaintenanceCalories] = useState<number | null>(null)
  const [trainingPhase, setTrainingPhase] = useState<TrainingPhase | null>(null)
  const [trainingIntensity, setTrainingIntensity] = useState<TrainingIntensity | null>(null)
  const [todayEntry, setTodayEntry] = useState<NutritionEntry | null>(null)
  const [allEntries, setAllEntries] = useState<NutritionEntry[]>([])
  const [foodItems, setFoodItems] = useState<FoodItem[]>([])
  const [libraryFoods, setLibraryFoods] = useState<FoodTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  // Bumped after an entry is saved so the (server-cached) AI insight
  // refetches — it only actually regenerates if the underlying data changed.
  const [insightRefreshKey, setInsightRefreshKey] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: settings } = await supabase
      .from('user_settings')
      .select('maintenance_calories, training_phase, training_intensity')
      .eq('user_id', user.id)
      .maybeSingle()

    setMaintenanceCalories(settings?.maintenance_calories ?? null)
    setTrainingPhase((settings?.training_phase as TrainingPhase) ?? null)
    setTrainingIntensity((settings?.training_intensity as TrainingIntensity) ?? null)

    const { data: foods, error: foodsError } = await supabase
      .from('food_library')
      .select('id, name, calories, protein_g, fat_g, carbs_g, default_meal_tag, ingredients')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('name', { ascending: true })

    if (foodsError) {
      console.error('Error fetching food library:', foodsError)
    }
    setLibraryFoods(foods || [])

    const { data: entry, error: entryError } = await supabase
      .from('nutrition_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle()

    if (entryError) {
      console.error('Error fetching nutrition entry:', entryError)
    }
    setTodayEntry(entry ?? null)

    const { data: entries, error: entriesError } = await supabase
      .from('nutrition_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true })

    if (entriesError) {
      console.error('Error fetching nutrition entries:', entriesError)
    }
    setAllEntries(entries || [])

    if (entry) {
      const { data: items, error: itemsError } = await supabase
        .from('nutrition_food_items')
        .select(
          'id, name, logged_at, ingredients, meal_tag, food_library_id, servings, logged_calories, logged_protein_g, logged_fat_g, logged_carbs_g'
        )
        .eq('entry_id', entry.id)
        .order('logged_at', { ascending: true })

      if (itemsError) {
        console.error('Error fetching food items:', itemsError)
      }
      setFoodItems(items || [])
    } else {
      setFoodItems([])
    }

    setLoading(false)
  }

  const openDialog = () => {
    if (todayEntry) {
      setForm({
        date: todayEntry.date,
        calories: String(todayEntry.calories),
        protein: String(todayEntry.protein_g),
        fat: String(todayEntry.fat_g),
        carbs: String(todayEntry.carbs_g),
        activityAdjustment:
          todayEntry.activity_adjustment_kcal != null ? String(todayEntry.activity_adjustment_kcal) : '',
        activityNote: todayEntry.activity_note ?? '',
        items: foodItems.map((item) => ({
          name: item.name,
          loggedAt: item.logged_at ? new Date(item.logged_at).toTimeString().slice(0, 5) : '',
          ingredients: item.ingredients ?? '',
          mealTag: (item.meal_tag as MealTag) ?? null,
          foodLibraryId: item.food_library_id,
          servings: item.servings ?? 1,
          loggedCalories: item.logged_calories,
          loggedProteinG: item.logged_protein_g,
          loggedFatG: item.logged_fat_g,
          loggedCarbsG: item.logged_carbs_g,
        })),
      })
    } else {
      setForm({ ...emptyForm, date: today })
    }
    setIsDialogOpen(true)
  }

  const addFoodItemRow = () => {
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          name: '',
          loggedAt: '',
          ingredients: '',
          mealTag: null,
          foodLibraryId: null,
          servings: 1,
          loggedCalories: null,
          loggedProteinG: null,
          loggedFatG: null,
          loggedCarbsG: null,
        },
      ],
    }))
  }

  const updateFoodItemRow = (index: number, field: keyof FoodItemForm, value: string) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }))
  }

  const updateFoodItemMealTag = (index: number, tag: MealTag | null) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, mealTag: tag } : item)),
    }))
  }

  // Appends a snapshotted item and prefills the editable totals - it never
  // locks them, so manual typing on top still works and always wins.
  const addFoodFromLibrary = (food: FoodTemplate) => {
    setForm((prev) => ({
      ...prev,
      calories: String(Math.round(parseFloat(prev.calories || '0') + food.calories)),
      protein: String((parseFloat(prev.protein || '0') + food.protein_g).toFixed(1)),
      fat: String((parseFloat(prev.fat || '0') + food.fat_g).toFixed(1)),
      carbs: String((parseFloat(prev.carbs || '0') + food.carbs_g).toFixed(1)),
      items: [
        ...prev.items,
        {
          name: food.name,
          loggedAt: new Date().toTimeString().slice(0, 5),
          ingredients: food.ingredients ?? '',
          mealTag: (food.default_meal_tag as MealTag) ?? null,
          foodLibraryId: food.id,
          servings: 1,
          loggedCalories: food.calories,
          loggedProteinG: food.protein_g,
          loggedFatG: food.fat_g,
          loggedCarbsG: food.carbs_g,
        },
      ],
    }))
  }

  const removeFoodItemRow = (index: number) => {
    setForm((prev) => {
      const removed = prev.items[index]
      const items = prev.items.filter((_, i) => i !== index)
      // Only library-sourced rows carry a snapshot - manual rows never
      // touched the totals, so there's nothing to subtract back out.
      if (removed.loggedCalories == null) {
        return { ...prev, items }
      }
      return {
        ...prev,
        items,
        calories: String(Math.max(0, Math.round(parseFloat(prev.calories || '0') - removed.loggedCalories))),
        protein: String(Math.max(0, parseFloat(prev.protein || '0') - (removed.loggedProteinG ?? 0)).toFixed(1)),
        fat: String(Math.max(0, parseFloat(prev.fat || '0') - (removed.loggedFatG ?? 0)).toFixed(1)),
        carbs: String(Math.max(0, parseFloat(prev.carbs || '0') - (removed.loggedCarbsG ?? 0)).toFixed(1)),
      }
    })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setSaving(true)

    const { data: entry, error: entryError } = await supabase
      .from('nutrition_entries')
      .upsert(
        {
          user_id: user.id,
          date: form.date,
          calories: parseInt(form.calories, 10),
          protein_g: parseFloat(form.protein),
          fat_g: parseFloat(form.fat),
          carbs_g: parseFloat(form.carbs),
          activity_adjustment_kcal: form.activityAdjustment ? parseInt(form.activityAdjustment, 10) : null,
          activity_note: form.activityNote.trim() || null,
        },
        { onConflict: 'user_id,date' }
      )
      .select('id')
      .single()

    if (entryError || !entry) {
      console.error('Error saving nutrition entry:', entryError)
      setSaving(false)
      return
    }

    // Replace this entry's food items with whatever's in the dialog now,
    // rather than trying to diff/merge - simplest correct behavior for a
    // first version.
    const { error: deleteError } = await supabase.from('nutrition_food_items').delete().eq('entry_id', entry.id)
    if (deleteError) {
      console.error('Error clearing previous food items:', deleteError)
    }

    const validItems = form.items.filter((item) => item.name.trim())
    if (validItems.length > 0) {
      const { error: itemsError } = await supabase.from('nutrition_food_items').insert(
        validItems.map((item) => ({
          entry_id: entry.id,
          name: item.name.trim(),
          logged_at: item.loggedAt ? new Date(`${form.date}T${item.loggedAt}:00`).toISOString() : null,
          ingredients: item.ingredients.trim() || null,
          food_library_id: item.foodLibraryId,
          servings: item.servings,
          meal_tag: item.mealTag,
          logged_calories: item.loggedCalories,
          logged_protein_g: item.loggedProteinG,
          logged_fat_g: item.loggedFatG,
          logged_carbs_g: item.loggedCarbsG,
        }))
      )
      if (itemsError) {
        console.error('Error saving food items:', itemsError)
      }
    }

    setSaving(false)
    setIsDialogOpen(false)
    fetchData()
    setInsightRefreshKey((k) => k + 1)
  }

  const effectiveTarget = getEffectiveTarget(
    maintenanceCalories,
    trainingPhase,
    trainingIntensity,
    todayEntry?.activity_adjustment_kcal ?? null
  )

  // Derived from the already-fetched entries — no extra query.
  const chartPoints: CaloriePoint[] = allEntries.map((e) => ({
    date: e.date,
    calories: e.calories,
    targetCalories: getEffectiveTarget(maintenanceCalories, trainingPhase, trainingIntensity, e.activity_adjustment_kcal ?? null),
  }))

  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  const recentEntries = allEntries.filter((e) => new Date(e.date) >= sevenDaysAgo && new Date(e.date) <= new Date(today))
  const recentAverages =
    recentEntries.length > 0
      ? {
          protein: recentEntries.reduce((sum, e) => sum + e.protein_g, 0) / recentEntries.length,
          fat: recentEntries.reduce((sum, e) => sum + e.fat_g, 0) / recentEntries.length,
          carbs: recentEntries.reduce((sum, e) => sum + e.carbs_g, 0) / recentEntries.length,
        }
      : null

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-white/40">Loading...</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <Apple className="w-8 h-8 text-white/80" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">Nutrition</h1>
              <p className="text-white/50 text-sm">Today&apos;s totals, logged manually</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/nutrition/library">
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm">
                <BookOpen className="w-4 h-4" />
                Library
              </button>
            </Link>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger>
              <Button onClick={openDialog} className="bg-white text-black hover:bg-white/90 text-sm">
                {todayEntry ? 'Edit Today' : 'Log Today'}
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-black border-white/10 text-white max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Log Today&apos;s Nutrition</DialogTitle>
                <DialogDescription className="text-white/40">
                  Copy your totals over from Lifesum (or wherever you track).
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="entry-date" className="text-white/80">
                    Date
                  </Label>
                  <Input
                    id="entry-date"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                    max={today}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="calories" className="text-white/80">
                      Calories
                    </Label>
                    <Input
                      id="calories"
                      type="number"
                      value={form.calories}
                      onChange={(e) => setForm({ ...form, calories: e.target.value })}
                      required
                      placeholder="2100"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="protein" className="text-white/80">
                      Protein (g)
                    </Label>
                    <Input
                      id="protein"
                      type="number"
                      step="0.1"
                      value={form.protein}
                      onChange={(e) => setForm({ ...form, protein: e.target.value })}
                      required
                      placeholder="160"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fat" className="text-white/80">
                      Fat (g)
                    </Label>
                    <Input
                      id="fat"
                      type="number"
                      step="0.1"
                      value={form.fat}
                      onChange={(e) => setForm({ ...form, fat: e.target.value })}
                      required
                      placeholder="70"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="carbs" className="text-white/80">
                      Carbs (g)
                    </Label>
                    <Input
                      id="carbs"
                      type="number"
                      step="0.1"
                      value={form.carbs}
                      onChange={(e) => setForm({ ...form, carbs: e.target.value })}
                      required
                      placeholder="220"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="activity-adjustment" className="text-white/80">
                      Extra activity today (optional)
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        id="activity-adjustment"
                        type="number"
                        value={form.activityAdjustment}
                        onChange={(e) => setForm({ ...form, activityAdjustment: e.target.value })}
                        placeholder="+300 kcal"
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      />
                      <Input
                        type="text"
                        value={form.activityNote}
                        onChange={(e) => setForm({ ...form, activityNote: e.target.value })}
                        placeholder="e.g. extra cardio"
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      />
                    </div>
                  </div>
                </div>

                {libraryFoods.length > 0 && (
                  <div className="border-t border-white/10 pt-4 space-y-2">
                    <Label className="text-white/80">Quick add from library</Label>
                    <div className="flex flex-wrap gap-2">
                      {libraryFoods.map((food) => (
                        <button
                          key={food.id}
                          type="button"
                          onClick={() => addFoodFromLibrary(food)}
                          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-left hover:bg-white/10 transition-colors"
                        >
                          <span className="text-sm text-white">{food.name}</span>
                          <span className="text-white/40 text-xs ml-2">{food.calories} kcal</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-white/10 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-white/80">Food items (optional)</Label>
                    <button
                      type="button"
                      onClick={addFoodItemRow}
                      className="flex items-center gap-1 text-sm text-white/60 hover:text-white transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add item
                    </button>
                  </div>
                  {form.items.map((item, index) => (
                    <div key={index} className="border border-white/10 rounded-xl bg-white/[0.02] p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateFoodItemRow(index, 'name', e.target.value)}
                          placeholder="Food name"
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 flex-1"
                        />
                        <Input
                          type="time"
                          value={item.loggedAt}
                          onChange={(e) => updateFoodItemRow(index, 'loggedAt', e.target.value)}
                          className="bg-white/5 border-white/10 text-white w-28"
                        />
                        <button
                          type="button"
                          onClick={() => removeFoodItemRow(index)}
                          className="p-2 text-white/40 hover:text-white/70 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <Textarea
                        value={item.ingredients}
                        onChange={(e) => updateFoodItemRow(index, 'ingredients', e.target.value)}
                        placeholder="Ingredients (optional)"
                        rows={2}
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
                      />
                      <MealTagPicker value={item.mealTag} onChange={(tag) => updateFoodItemMealTag(index, tag)} />
                    </div>
                  ))}
                </div>

                <Button type="submit" disabled={saving} className="w-full bg-white text-black hover:bg-white/90">
                  {saving ? 'Saving...' : 'Save Entry'}
                </Button>
              </form>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        {maintenanceCalories == null && (
          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 mb-6">
            <p className="text-white/40 text-sm">
              Set your maintenance calories in{' '}
              <Link href="/settings/nutrition" className="text-white/70 hover:text-white underline">
                Nutrition settings
              </Link>{' '}
              to see today&apos;s target alongside your logged totals.
            </p>
          </div>
        )}

        {allEntries.length >= MIN_ENTRIES_FOR_TREND ? (
          <div className="grid gap-4 mb-6 lg:grid-cols-2">
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
              <h3 className="text-lg font-medium text-white mb-4">Trend</h3>
              <NutritionChart points={chartPoints} />
              {recentAverages && (
                <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/10">
                  <div>
                    <p className="text-xs text-white/40 mb-1">Avg Protein (7d)</p>
                    <p className="text-sm font-semibold text-white">{recentAverages.protein.toFixed(0)}g</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40 mb-1">Avg Fat (7d)</p>
                    <p className="text-sm font-semibold text-white">{recentAverages.fat.toFixed(0)}g</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40 mb-1">Avg Carbs (7d)</p>
                    <p className="text-sm font-semibold text-white">{recentAverages.carbs.toFixed(0)}g</p>
                  </div>
                </div>
              )}
            </div>
            <NutritionInsightCard refreshKey={insightRefreshKey} />
          </div>
        ) : allEntries.length > 0 ? (
          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 mb-6">
            <p className="text-white/40 text-sm">
              Log {MIN_ENTRIES_FOR_TREND - allEntries.length} more day
              {MIN_ENTRIES_FOR_TREND - allEntries.length === 1 ? '' : 's'} to see your trend and an AI insight.
            </p>
          </div>
        ) : null}

        {!todayEntry ? (
          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-12 text-center">
            <p className="text-white/40 mb-4">No entry logged for today yet</p>
            <Button onClick={openDialog} variant="outline" className="border-white/10 text-white hover:bg-white/5">
              Log today&apos;s nutrition
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
              <h2 className="text-lg font-medium text-white mb-4">Today</h2>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-semibold text-white">{todayEntry.calories}</span>
                <span className="text-white/40">
                  {effectiveTarget != null ? `/ ${effectiveTarget} kcal` : 'kcal'}
                </span>
              </div>
              {effectiveTarget != null && (
                <div className="w-full bg-white/10 rounded-full h-2 mb-1">
                  <div
                    className="bg-white rounded-full h-2 transition-all duration-300"
                    style={{ width: `${Math.min((todayEntry.calories / effectiveTarget) * 100, 100)}%` }}
                  />
                </div>
              )}
              {todayEntry.activity_adjustment_kcal != null && (
                <p className="text-white/40 text-xs mt-2">
                  Includes {todayEntry.activity_adjustment_kcal > 0 ? '+' : ''}
                  {todayEntry.activity_adjustment_kcal} kcal today
                  {todayEntry.activity_note ? ` (${todayEntry.activity_note})` : ''}
                </p>
              )}

              <div className="grid grid-cols-3 gap-4 mt-6">
                <div>
                  <p className="text-xs text-white/40 mb-1">Protein</p>
                  <p className="text-lg font-semibold text-white">{todayEntry.protein_g}g</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">Fat</p>
                  <p className="text-lg font-semibold text-white">{todayEntry.fat_g}g</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">Carbs</p>
                  <p className="text-lg font-semibold text-white">{todayEntry.carbs_g}g</p>
                </div>
              </div>
            </div>

            {foodItems.length > 0 && (
              <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
                <h2 className="text-lg font-medium text-white mb-4">Food Logged Today</h2>
                <div className="space-y-5">
                  {[...MEAL_TAGS.map((t) => t.value as string | null), null].map((tag) => {
                    const group = foodItems.filter((item) => (item.meal_tag ?? null) === tag)
                    if (group.length === 0) return null
                    return (
                      <div key={tag ?? 'untagged'}>
                        <p className="text-white/40 text-xs uppercase tracking-wide mb-2">{mealTagLabel(tag)}</p>
                        <div className="space-y-3">
                          {group.map((item) => (
                            <div key={item.id} className="border-b border-white/5 pb-3 last:border-0 last:pb-0">
                              <div className="flex items-center justify-between">
                                <p className="text-white font-medium">{item.name}</p>
                                {item.logged_at && (
                                  <p className="text-white/40 text-sm">
                                    {new Date(item.logged_at).toLocaleTimeString('en-US', {
                                      hour: 'numeric',
                                      minute: '2-digit',
                                    })}
                                  </p>
                                )}
                              </div>
                              {item.ingredients && <p className="text-white/40 text-sm mt-1">{item.ingredients}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
