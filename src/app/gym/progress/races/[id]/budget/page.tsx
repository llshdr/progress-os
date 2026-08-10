'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ArrowLeft, Wallet, Plus, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { raceTypeLabel, type RaceType } from '@/lib/race-constants'
import { BUDGET_CATEGORIES, BUDGET_CATEGORY_LABEL, IRONMAN_WORTH_IT, IRONMAN_SKIPPABLE, type BudgetCategory } from '@/lib/race-plan/budget-guidance'

type RaceHeader = { id: string; race_type: RaceType; courseOrLocation: string | null; budgetTarget: number | null }
type BudgetItem = { id: string; category: BudgetCategory; description: string | null; amount: number; incurred_date: string | null }

// No currency symbol anywhere on this page - this app has no established
// currency preference (unlike weight_unit's real kg/lbs toggle), and
// guessing one (e.g. hardcoding $) would misrepresent a real number for
// anyone not using that currency. Plain numbers, the user's own frame of
// reference.
function formatAmount(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export default function RaceBudgetPage() {
  const params = useParams()
  const raceId = params.id as string
  const supabase = createClient()

  const [race, setRace] = useState<RaceHeader | null>(null)
  const [items, setItems] = useState<BudgetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [budgetInput, setBudgetInput] = useState('')
  const [savingBudget, setSavingBudget] = useState(false)

  const [showAddModal, setShowAddModal] = useState(false)
  const [category, setCategory] = useState<BudgetCategory>('gear')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [incurredDate, setIncurredDate] = useState('')
  const [saving, setSaving] = useState(false)

  const [itemToDelete, setItemToDelete] = useState<string | null>(null)

  useEffect(() => {
    fetchAll()
  }, [raceId])

  const fetchAll = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const [{ data: raceRow, error: raceError }, { data: itemRows, error: itemsError }] = await Promise.all([
      supabase.from('races').select('id, race_type, course_id, location, budget_target').eq('id', raceId).maybeSingle(),
      supabase
        .from('race_budget_items')
        .select('id, category, description, amount, incurred_date')
        .eq('race_id', raceId)
        .order('created_at', { ascending: false }),
    ])

    if (raceError) console.error('Error fetching race:', raceError)
    if (itemsError) console.error('Error fetching budget items:', itemsError)

    if (!raceRow) {
      setNotFound(true)
      setLoading(false)
      return
    }

    let courseOrLocation: string | null = raceRow.location ?? null
    if (raceRow.course_id) {
      const { data: course } = await supabase.from('race_courses').select('name').eq('id', raceRow.course_id).maybeSingle()
      courseOrLocation = course?.name ?? courseOrLocation
    }

    setRace({
      id: raceRow.id,
      race_type: raceRow.race_type as RaceType,
      courseOrLocation,
      budgetTarget: raceRow.budget_target,
    })
    setBudgetInput(raceRow.budget_target != null ? String(raceRow.budget_target) : '')
    setItems(
      (itemRows ?? []).map((r) => ({
        id: r.id,
        category: r.category as BudgetCategory,
        description: r.description,
        amount: typeof r.amount === 'string' ? parseFloat(r.amount) : r.amount,
        incurred_date: r.incurred_date,
      }))
    )
    setLoading(false)
  }

  const handleSaveBudget = async () => {
    setSavingBudget(true)
    const value = budgetInput.trim() === '' ? null : parseFloat(budgetInput)
    const { error } = await supabase.from('races').update({ budget_target: value }).eq('id', raceId)
    if (error) {
      console.error('Error saving budget target:', error)
    } else {
      setRace((prev) => (prev ? { ...prev, budgetTarget: value } : prev))
    }
    setSavingBudget(false)
  }

  const handleAddItem = async () => {
    if (!amount || parseFloat(amount) < 0) return

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setSaving(true)
    const { error } = await supabase.from('race_budget_items').insert({
      user_id: user.id,
      race_id: raceId,
      category,
      description: description.trim() || null,
      amount: parseFloat(amount),
      incurred_date: incurredDate || null,
    })

    if (error) {
      console.error('Error adding budget item:', error)
      setSaving(false)
      return
    }

    setSaving(false)
    setShowAddModal(false)
    setCategory('gear')
    setDescription('')
    setAmount('')
    setIncurredDate('')
    fetchAll()
  }

  const handleDeleteItem = async () => {
    if (!itemToDelete) return
    const { error } = await supabase.from('race_budget_items').delete().eq('id', itemToDelete)
    if (error) console.error('Error deleting budget item:', error)
    setItemToDelete(null)
    fetchAll()
  }

  if (loading) {
    return (
      <AppLayout>
        <PageSkeleton />
      </AppLayout>
    )
  }

  if (notFound || !race) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-lapis-text-tertiary">Race not found.</p>
        </div>
      </AppLayout>
    )
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0)
  const remaining = race.budgetTarget != null ? race.budgetTarget - total : null
  const isIronman = race.race_type === 'ironman'

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href={`/gym/progress/races/${raceId}`}
          className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {raceTypeLabel(race.race_type)}
        </Link>

        <div className="flex items-center gap-4 mb-8 mt-6">
          <div className="p-3 rounded-lapis-lg bg-lapis-surface-2 border border-lapis-border-subtle">
            <Wallet className="w-8 h-8 text-lapis-text-secondary" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-1">Budget</h1>
            <p className="text-lapis-text-tertiary text-sm">
              {raceTypeLabel(race.race_type)}
              {race.courseOrLocation && ` · ${race.courseOrLocation}`}
            </p>
          </div>
        </div>

        <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
            <div>
              <p className="text-xs text-lapis-text-tertiary mb-1">Spent so far</p>
              <p className="text-lapis-text-primary text-2xl font-semibold">{formatAmount(total)}</p>
            </div>
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="budget-target" className="text-lapis-text-secondary text-xs">
                  Budget target (optional)
                </Label>
                <Input
                  id="budget-target"
                  type="number"
                  min="0"
                  step="1"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-32 bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
                />
              </div>
              <Button
                variant="outline"
                onClick={handleSaveBudget}
                disabled={savingBudget}
                className="border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2"
              >
                {savingBudget ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>

          {remaining != null && (
            <div className={`flex items-center gap-2 text-sm ${remaining >= 0 ? 'text-lapis-jade' : 'text-lapis-garnet'}`}>
              {remaining >= 0 ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>
                {remaining >= 0
                  ? `${formatAmount(remaining)} left within your ${formatAmount(race.budgetTarget!)} budget.`
                  : `${formatAmount(Math.abs(remaining))} over your ${formatAmount(race.budgetTarget!)} budget.`}
              </span>
            </div>
          )}
        </div>

        {isIronman && (
          <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 mb-8">
            <h2 className="text-lg font-medium text-lapis-text-primary mb-1">Where the money actually matters</h2>
            <p className="text-lapis-text-tertiary text-sm mb-4">
              Researched guidance for a first Ironman, not generic tips - real costs vary a lot by athlete and race.
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-lapis-jade uppercase tracking-wide mb-2">Worth spending on</p>
                <ul className="space-y-2">
                  {IRONMAN_WORTH_IT.map((line, i) => (
                    <li key={i} className="text-lapis-text-secondary text-sm">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-lapis-text-tertiary uppercase tracking-wide mb-2">Skippable for a first-timer</p>
                <ul className="space-y-2">
                  {IRONMAN_SKIPPABLE.map((line, i) => (
                    <li key={i} className="text-lapis-text-secondary text-sm">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-lapis-text-primary">Expenses</h2>
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogTrigger>
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-lapis-md bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 transition-colors">
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Add Expense</span>
              </button>
            </DialogTrigger>
            <DialogContent className="bg-lapis-bg border-lapis-border-subtle text-lapis-text-primary">
              <DialogHeader>
                <DialogTitle>Add Expense</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-lapis-text-secondary">Category</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {BUDGET_CATEGORIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategory(c)}
                        className={`p-2.5 rounded-lapis-sm border text-sm transition-colors ${
                          category === c
                            ? 'bg-lapis-accent-500 text-lapis-text-primary border-lapis-border'
                            : 'bg-lapis-surface-1 border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2'
                        }`}
                      >
                        {BUDGET_CATEGORY_LABEL[c]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense-description" className="text-lapis-text-secondary">
                    Description (optional)
                  </Label>
                  <Input
                    id="expense-description"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Wetsuit rental"
                    className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expense-amount" className="text-lapis-text-secondary">
                      Amount
                    </Label>
                    <Input
                      id="expense-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="100"
                      className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expense-date" className="text-lapis-text-secondary">
                      Date (optional)
                    </Label>
                    <Input
                      id="expense-date"
                      type="date"
                      value={incurredDate}
                      onChange={(e) => setIncurredDate(e.target.value)}
                      className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleAddItem}
                  disabled={saving || !amount}
                  className="w-full bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110"
                >
                  {saving ? 'Saving...' : 'Add Expense'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {items.length === 0 ? (
          <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-12 text-center">
            <Wallet className="w-10 h-10 text-lapis-text-disabled mx-auto mb-4" />
            <p className="text-lapis-text-tertiary">No expenses logged yet — add one to start tracking.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between border border-lapis-border-subtle rounded-lapis-md bg-lapis-surface-1 p-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-tertiary border border-lapis-border-subtle">
                    {BUDGET_CATEGORY_LABEL[item.category]}
                  </span>
                  <div className="min-w-0">
                    <p className="text-lapis-text-primary text-sm truncate">{item.description || BUDGET_CATEGORY_LABEL[item.category]}</p>
                    {item.incurred_date && (
                      <p className="text-lapis-text-disabled text-xs">
                        {new Date(item.incurred_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-lapis-text-primary font-medium">{formatAmount(item.amount)}</span>
                  <button
                    onClick={() => setItemToDelete(item.id)}
                    className="p-1.5 rounded-lapis-sm text-lapis-text-tertiary hover:text-lapis-garnet hover:bg-lapis-surface-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <ConfirmationModal
          open={itemToDelete !== null}
          onOpenChange={(open) => !open && setItemToDelete(null)}
          title="Delete this expense?"
          description="This can't be undone."
          confirmText="Delete"
          destructive
          onConfirm={handleDeleteItem}
        />
      </div>
    </AppLayout>
  )
}
