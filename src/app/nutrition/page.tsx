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
import { Apple, Plus, X } from 'lucide-react'
import Link from 'next/link'
import { getLocalDateString } from '@/lib/date'
import { getEffectiveTarget, type TrainingIntensity, type TrainingPhase } from '@/lib/nutrition'

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
}

type FoodItemForm = {
  name: string
  loggedAt: string
  ingredients: string
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
  const [foodItems, setFoodItems] = useState<FoodItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
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

    if (entry) {
      const { data: items, error: itemsError } = await supabase
        .from('nutrition_food_items')
        .select('*')
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
        })),
      })
    } else {
      setForm({ ...emptyForm, date: today })
    }
    setIsDialogOpen(true)
  }

  const addFoodItemRow = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, { name: '', loggedAt: '', ingredients: '' }] }))
  }

  const updateFoodItemRow = (index: number, field: keyof FoodItemForm, value: string) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }))
  }

  const removeFoodItemRow = (index: number) => {
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }))
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
        }))
      )
      if (itemsError) {
        console.error('Error saving food items:', itemsError)
      }
    }

    setSaving(false)
    setIsDialogOpen(false)
    fetchData()
  }

  const effectiveTarget = getEffectiveTarget(
    maintenanceCalories,
    trainingPhase,
    trainingIntensity,
    todayEntry?.activity_adjustment_kcal ?? null
  )

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
                <div className="space-y-3">
                  {foodItems.map((item) => (
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
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
