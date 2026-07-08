'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  MUSCLE_GROUPS,
  EQUIPMENT_TYPES,
  CATEGORIES,
} from '@/lib/gym-constants'

export interface ExerciseFormValues {
  name: string
  primaryMuscleGroup: string
  secondaryMuscleGroups: string[]
  equipmentType: string
  category: string
  notes: string
}

interface ExerciseFormProps {
  title: string
  subtitle: string
  backHref: string
  submitLabel: string
  savingLabel: string
  initialValues?: Partial<ExerciseFormValues>
  onSubmit: (values: ExerciseFormValues) => Promise<void>
}

function OptionGrid({
  options,
  isSelected,
  onSelect,
  selectedClassName = 'bg-white text-black border-white',
}: {
  options: string[]
  isSelected: (option: string) => boolean
  onSelect: (option: string) => void
  selectedClassName?: string
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onSelect(option)}
          className={`p-3 rounded-lg border transition-all duration-200 text-sm ${
            isSelected(option)
              ? selectedClassName
              : 'bg-white/[0.02] border-white/10 text-white hover:bg-white/[0.04]'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

export default function ExerciseForm({
  title,
  subtitle,
  backHref,
  submitLabel,
  savingLabel,
  initialValues,
  onSubmit,
}: ExerciseFormProps) {
  const [name, setName] = useState(initialValues?.name ?? '')
  const [primaryMuscleGroup, setPrimaryMuscleGroup] = useState(
    initialValues?.primaryMuscleGroup ?? ''
  )
  const [secondaryMuscleGroups, setSecondaryMuscleGroups] = useState<string[]>(
    initialValues?.secondaryMuscleGroups ?? []
  )
  const [equipmentType, setEquipmentType] = useState(
    initialValues?.equipmentType ?? ''
  )
  const [category, setCategory] = useState(initialValues?.category ?? '')
  const [notes, setNotes] = useState(initialValues?.notes ?? '')
  const [saving, setSaving] = useState(false)

  const toggleSecondaryMuscle = (muscle: string) => {
    setSecondaryMuscleGroups((prev) =>
      prev.includes(muscle)
        ? prev.filter((m) => m !== muscle)
        : [...prev, muscle]
    )
  }

  const isComplete = Boolean(
    name && primaryMuscleGroup && equipmentType && category
  )

  const handleSubmit = async () => {
    if (!isComplete) {
      alert('Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      await onSubmit({
        name,
        primaryMuscleGroup,
        secondaryMuscleGroups,
        equipmentType,
        category,
        notes,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href={backHref}
        className="text-white/40 hover:text-white/60 transition-colors mb-6 block"
      >
        ← Back
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
        {title}
      </h1>
      <p className="text-white/50 text-sm mb-8">{subtitle}</p>

      <div className="max-w-2xl space-y-6">
        <div>
          <label className="text-white/60 text-sm mb-2 block">
            Exercise Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bench Press"
            className="w-full bg-white/5 border-white/10 text-white rounded-xl px-4 py-3 placeholder:text-white/30"
          />
        </div>

        <div>
          <label className="text-white/60 text-sm mb-3 block">
            Primary Muscle Group *
          </label>
          <OptionGrid
            options={MUSCLE_GROUPS}
            isSelected={(muscle) => primaryMuscleGroup === muscle}
            onSelect={setPrimaryMuscleGroup}
          />
        </div>

        <div>
          <label className="text-white/60 text-sm mb-3 block">
            Secondary Muscle Groups (optional)
          </label>
          <OptionGrid
            options={MUSCLE_GROUPS.filter((m) => m !== primaryMuscleGroup)}
            isSelected={(muscle) => secondaryMuscleGroups.includes(muscle)}
            onSelect={toggleSecondaryMuscle}
            selectedClassName="bg-white/10 text-white border-white/20"
          />
        </div>

        <div>
          <label className="text-white/60 text-sm mb-3 block">
            Equipment Type *
          </label>
          <OptionGrid
            options={EQUIPMENT_TYPES}
            isSelected={(equipment) => equipmentType === equipment}
            onSelect={setEquipmentType}
          />
        </div>

        <div>
          <label className="text-white/60 text-sm mb-3 block">Category *</label>
          <OptionGrid
            options={CATEGORIES}
            isSelected={(cat) => category === cat}
            onSelect={setCategory}
          />
        </div>

        <div>
          <label className="text-white/60 text-sm mb-2 block">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes about this exercise..."
            rows={3}
            className="w-full bg-white/5 border-white/10 text-white rounded-xl px-4 py-3 placeholder:text-white/30 resize-none"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving || !isComplete}
          className="w-full bg-white text-black hover:bg-white/90 rounded-xl px-4 py-4 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? savingLabel : submitLabel}
        </button>
      </div>
    </div>
  )
}
