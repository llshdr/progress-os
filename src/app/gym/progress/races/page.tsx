'use client'

import BackLink from '@/components/lapis/back-link'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import RaceIdentity from '@/components/races/race-identity'
import { usePageState } from '@/lib/use-page-state'
import { changed } from '@/components/lapis/app-provider'
import Link from 'next/link'
import { Flag, Plus, Trash2 } from 'lucide-react'
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
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { RACE_TYPES, RACE_TYPE_DISTANCE, raceTypeLabel, type RaceType } from '@/lib/race-constants'
import { getLocalDateString } from '@/lib/date'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { LoadErrorBanner } from '@/components/ui/load-error-banner'

type RaceCourse = { id: string; race_type: string; name: string }

type Race = {
  id: string
  race_type: RaceType
  course_id: string | null
  courseName: string | null
  location: string | null
  race_date: string
  result_duration_seconds: number | null
  notes: string | null
}

function formatResultDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

function formatRaceDate(dateString: string): string {
  return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function RacesPage() {
  const [races, setRaces] = useState<Race[]>([])
  const [courses, setCourses] = useState<RaceCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [view, setView] = usePageState<"upcoming" | "past">("view", "upcoming", v => ["upcoming", "past"].includes(v))

  const [showAddModal, setShowAddModal] = useState(false)
  const [raceType, setRaceType] = useState<RaceType>('ironman')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [customLocation, setCustomLocation] = useState('')
  const [raceDate, setRaceDate] = useState('')
  const [resultHours, setResultHours] = useState('')
  const [resultMinutes, setResultMinutes] = useState('')
  const [resultSeconds, setResultSeconds] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [raceToDelete, setRaceToDelete] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchRaces()
  }, [])

  const fetchRaces = async () => {
    setLoadError(false)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const [{ data: raceRows, error: racesError }, { data: courseRows, error: coursesError }] = await Promise.all([
      supabase
        .from('races')
        .select('id, race_type, course_id, location, race_date, result_duration_seconds, notes')
        .eq('user_id', user.id)
        .order('race_date', { ascending: true }),
      supabase.from('race_courses').select('id, race_type, name').order('display_order', { ascending: true }),
    ])

    if (racesError) console.error('Error fetching races:', racesError)
    if (coursesError) console.error('Error fetching race courses:', coursesError)
    if (racesError || coursesError) setLoadError(true)

    const courseList = courseRows ?? []
    setCourses(courseList)

    const courseNameById = new Map(courseList.map((c) => [c.id, c.name]))

    setRaces(
      (raceRows ?? []).map((r) => ({
        id: r.id,
        race_type: r.race_type,
        course_id: r.course_id,
        courseName: r.course_id ? courseNameById.get(r.course_id) ?? null : null,
        location: r.location,
        race_date: r.race_date,
        result_duration_seconds: r.result_duration_seconds,
        notes: r.notes,
      }))
    )
    setLoading(false)
  }

  const resetForm = () => {
    setRaceType('ironman')
    setSelectedCourseId('')
    setCustomLocation('')
    setRaceDate('')
    setResultHours('')
    setResultMinutes('')
    setResultSeconds('')
    setNotes('')
  }

  const coursesForType = courses.filter((c) => c.race_type === raceType)
  const usingCustomLocation = coursesForType.length === 0 || selectedCourseId === 'other'

  const canSave = Boolean(raceDate) && (usingCustomLocation ? customLocation.trim().length > 0 : Boolean(selectedCourseId))

  const handleAddRace = async () => {
    if (!raceDate) return

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setSaveError(null)
    setSaving(true)

    const hasResult = Boolean(resultHours || resultMinutes || resultSeconds)
    const resultSecondsTotal = hasResult
      ? (parseInt(resultHours || '0', 10) * 3600) + (parseInt(resultMinutes || '0', 10) * 60) + parseInt(resultSeconds || '0', 10)
      : null

    const { error } = await supabase.from('races').insert({
      user_id: user.id,
      race_type: raceType,
      course_id: usingCustomLocation ? null : selectedCourseId,
      location: usingCustomLocation ? customLocation.trim() || null : null,
      race_date: raceDate,
      result_duration_seconds: resultSecondsTotal,
      notes: notes.trim() || null,
    })

    if (error) {
      setSaveError('Your race could not save. Your details are still here; please retry.')
      setSaving(false)
      return
    }

    setSaving(false)
    setShowAddModal(false)
    resetForm()
    changed()
    fetchRaces()
  }

  const openDeleteModal = (raceId: string) => {
    setRaceToDelete(raceId)
    setShowDeleteModal(true)
  }

  const deleteRace = async () => {
    if (!raceToDelete) return

    const { error } = await supabase.from('races').delete().eq('id', raceToDelete)
    if (error) {
      setSaveError('Your race could not be deleted. Please retry.')
    } else {
      changed()
      fetchRaces()
    }
    setRaceToDelete(null)
  }

  const today = getLocalDateString()
  const upcoming = races.filter((r) => r.race_date >= today && r.result_duration_seconds == null)
  const completed = races.filter((r) => r.race_date < today || r.result_duration_seconds != null).sort((a, b) => (a.race_date < b.race_date ? 1 : -1))

  const renderRaceCard = (race: Race) => (
    <article key={race.id} className="race-card">
      <Link href={`/gym/progress/races/${race.id}`} className="block" aria-label={`Open ${raceTypeLabel(race.race_type)} ${race.courseName || race.location || ''}`}>
        <RaceIdentity compact type={race.race_type} location={race.courseName || race.location} date={race.race_date} result={race.result_duration_seconds != null ? formatResultDuration(race.result_duration_seconds) : null} />
      </Link>
      <div className="race-card-footer"><Link href={`/gym/progress/races/${race.id}`} className="inline-flex min-h-11 items-center text-sm font-medium text-lapis-accent-400">{race.result_duration_seconds != null ? 'Race & result' : 'Open race'} →</Link><button onClick={() => openDeleteModal(race.id)} className="lapis-icon-button" aria-label={`Delete ${raceTypeLabel(race.race_type)}`}><Trash2 size={16}/></button></div>
    </article>
  )

  return (
    <AppLayout>
      <div className="lapis-page">
        <BackLink fallback="/gym/progress" className="mb-6" />

        <div className="flex items-center justify-between flex-wrap gap-4 mb-7">
          <div><p className="lapis-eyebrow mb-2">Training with a purpose</p><h1 className="lapis-title">Races</h1><p className="lapis-subtitle">From the next session to the finish line.</p></div>

          <Dialog
            open={showAddModal}
            onOpenChange={(open) => {
              setShowAddModal(open)
              if (!open) resetForm()
            }}
          >
            <DialogTrigger render={<button className="flex items-center gap-2 px-4 py-2.5 rounded-lapis-md bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 transition-colors" />}>
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Add Race</span>
            </DialogTrigger>
            <DialogContent className="bg-lapis-bg border-lapis-border-subtle text-lapis-text-primary max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Race</DialogTitle>
                <DialogDescription className="text-lapis-text-tertiary">
                  Log an upcoming or completed race.
                </DialogDescription>
              </DialogHeader>

              {saveError && <p role="alert" className="text-sm text-lapis-garnet">{saveError}</p>}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-lapis-text-secondary">Race Type</Label>
                  <select
                    value={raceType}
                    onChange={(e) => {
                      setRaceType(e.target.value as RaceType)
                      setSelectedCourseId('')
                    }}
                    className="w-full bg-lapis-surface-2 border border-lapis-border-subtle text-lapis-text-primary rounded-lapis-sm px-4 py-2.5"
                  >
                    {RACE_TYPES.map((t) => (
                      <option key={t.value} value={t.value} className="bg-lapis-bg">
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {coursesForType.length > 0 ? (
                  <div className="space-y-2">
                    <Label className="text-lapis-text-secondary">Course</Label>
                    <select
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      className="w-full bg-lapis-surface-2 border border-lapis-border-subtle text-lapis-text-primary rounded-lapis-sm px-4 py-2.5"
                    >
                      <option value="" className="bg-lapis-bg">
                        Select a course...
                      </option>
                      {coursesForType.map((c) => (
                        <option key={c.id} value={c.id} className="bg-lapis-bg">
                          {c.name}
                        </option>
                      ))}
                      <option value="other" className="bg-lapis-bg">
                        Other (not listed)
                      </option>
                    </select>
                  </div>
                ) : null}

                {usingCustomLocation && (
                  <div className="space-y-2">
                    <Label htmlFor="race-location" className="text-lapis-text-secondary">
                      Location
                    </Label>
                    <Input
                      id="race-location"
                      type="text"
                      value={customLocation}
                      onChange={(e) => setCustomLocation(e.target.value)}
                      placeholder="e.g. Stockholm Marathon"
                      className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="race-date" className="text-lapis-text-secondary">
                    Date
                  </Label>
                  <Input
                    id="race-date"
                    type="date"
                    value={raceDate}
                    onChange={(e) => setRaceDate(e.target.value)}
                    className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-lapis-text-secondary">Result (optional)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      type="number"
                      value={resultHours}
                      onChange={(e) => setResultHours(e.target.value)}
                      placeholder="hh"
                      className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
                    />
                    <Input
                      type="number"
                      value={resultMinutes}
                      onChange={(e) => setResultMinutes(e.target.value)}
                      placeholder="mm"
                      className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
                    />
                    <Input
                      type="number"
                      value={resultSeconds}
                      onChange={(e) => setResultSeconds(e.target.value)}
                      placeholder="ss"
                      className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="race-notes" className="text-lapis-text-secondary">
                    Notes (optional)
                  </Label>
                  <Textarea
                    id="race-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any context worth remembering..."
                    rows={2}
                    className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled resize-none"
                  />
                </div>

                <Button
                  onClick={handleAddRace}
                  disabled={saving || !canSave}
                  className="w-full bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110"
                >
                  {saving ? 'Saving...' : 'Save Race'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : (
          <>
            {loadError && <LoadErrorBanner message="Couldn't load your race history. Try refreshing." />}
            {races.length === 0 ? (
          <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-12 text-center">
            <Flag className="w-10 h-10 text-lapis-text-disabled mx-auto mb-4" />
            <p className="text-lapis-text-tertiary">No races yet — add one to start tracking your race history.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="lapis-tabs max-w-md" aria-label="Race history"><button aria-pressed={view === 'upcoming'} onClick={() => setView('upcoming')}>Upcoming · {upcoming.length}</button><button aria-pressed={view === 'past'} onClick={() => setView('past')}>Past races · {completed.length}</button></div>
            {(view === 'upcoming' ? upcoming : completed).length ? <div className="grid gap-5 xl:grid-cols-2">{(view === 'upcoming' ? upcoming : completed).map(renderRaceCard)}</div> : <section className="lapis-panel"><h2 className="font-semibold">{view === 'upcoming' ? 'Your next start line is open' : 'Your race history starts here'}</h2><p className="mt-2 text-sm text-lapis-text-secondary">{view === 'upcoming' ? 'Add a race when you have one in mind.' : 'Past races and recorded finishes will appear in this view.'}</p></section>}
            {saveError && !showAddModal && <p role="alert" className="text-sm text-lapis-garnet">{saveError}</p>}
          </div>
        )}
          </>
        )}
      </div>

      <ConfirmationModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        title="Delete Race"
        description="Are you sure you want to delete this race? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={deleteRace}
        destructive
      />
    </AppLayout>
  )
}
