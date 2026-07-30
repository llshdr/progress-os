'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { Flag, ArrowLeft, Plus, Trash2 } from 'lucide-react'
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
      console.error('Error adding race:', error)
      setSaving(false)
      return
    }

    setSaving(false)
    setShowAddModal(false)
    resetForm()
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
      console.error('Error deleting race:', error)
    } else {
      fetchRaces()
    }
    setRaceToDelete(null)
  }

  const today = getLocalDateString()
  const upcoming = races.filter((r) => r.race_date >= today)
  const completed = races.filter((r) => r.race_date < today).sort((a, b) => (a.race_date < b.race_date ? 1 : -1))

  const renderRaceCard = (race: Race) => (
    <div key={race.id} className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all duration-200">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Link href={`/gym/progress/races/${race.id}`} className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-medium text-white">{raceTypeLabel(race.race_type)}</h3>
            {(race.courseName || race.location) && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40 border border-white/10">
                {race.courseName ?? race.location}
              </span>
            )}
          </div>
          <p className="text-white/40 text-sm">{formatRaceDate(race.race_date)}</p>
          {RACE_TYPE_DISTANCE[race.race_type] && (
            <p className="text-white/30 text-xs mt-1">{RACE_TYPE_DISTANCE[race.race_type]}</p>
          )}
          {race.notes && <p className="text-white/30 text-xs mt-1">{race.notes}</p>}
        </Link>
        <div className="flex items-center gap-4 shrink-0">
          {race.result_duration_seconds != null && (
            <div className="text-right">
              <p className="text-xs text-white/40 mb-1">Result</p>
              <p className="text-white font-semibold">{formatResultDuration(race.result_duration_seconds)}</p>
            </div>
          )}
          <button onClick={() => openDeleteModal(race.id)} className="p-2 rounded-lg hover:bg-white/5 transition-colors" title="Delete">
            <Trash2 className="w-4 h-4 text-white/40" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/gym/progress"
          className="text-white/40 hover:text-white/60 transition-colors mb-6 inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Progress
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-4 mb-8 mt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <Flag className="w-8 h-8 text-white/80" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">Races</h1>
              <p className="text-white/50 text-sm">Your race history and what&apos;s next</p>
            </div>
          </div>

          <Dialog
            open={showAddModal}
            onOpenChange={(open) => {
              setShowAddModal(open)
              if (!open) resetForm()
            }}
          >
            <DialogTrigger>
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-white/90 transition-colors">
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Add Race</span>
              </button>
            </DialogTrigger>
            <DialogContent className="bg-black border-white/10 text-white max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Race</DialogTitle>
                <DialogDescription className="text-white/40">
                  Log an upcoming or completed race.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/80">Race Type</Label>
                  <select
                    value={raceType}
                    onChange={(e) => {
                      setRaceType(e.target.value as RaceType)
                      setSelectedCourseId('')
                    }}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-4 py-2.5"
                  >
                    {RACE_TYPES.map((t) => (
                      <option key={t.value} value={t.value} className="bg-black">
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {coursesForType.length > 0 ? (
                  <div className="space-y-2">
                    <Label className="text-white/80">Course</Label>
                    <select
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-4 py-2.5"
                    >
                      <option value="" className="bg-black">
                        Select a course...
                      </option>
                      {coursesForType.map((c) => (
                        <option key={c.id} value={c.id} className="bg-black">
                          {c.name}
                        </option>
                      ))}
                      <option value="other" className="bg-black">
                        Other (not listed)
                      </option>
                    </select>
                  </div>
                ) : null}

                {usingCustomLocation && (
                  <div className="space-y-2">
                    <Label htmlFor="race-location" className="text-white/80">
                      Location
                    </Label>
                    <Input
                      id="race-location"
                      type="text"
                      value={customLocation}
                      onChange={(e) => setCustomLocation(e.target.value)}
                      placeholder="e.g. Stockholm Marathon"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="race-date" className="text-white/80">
                    Date
                  </Label>
                  <Input
                    id="race-date"
                    type="date"
                    value={raceDate}
                    onChange={(e) => setRaceDate(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white/80">Result (optional)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      type="number"
                      value={resultHours}
                      onChange={(e) => setResultHours(e.target.value)}
                      placeholder="hh"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                    <Input
                      type="number"
                      value={resultMinutes}
                      onChange={(e) => setResultMinutes(e.target.value)}
                      placeholder="mm"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                    <Input
                      type="number"
                      value={resultSeconds}
                      onChange={(e) => setResultSeconds(e.target.value)}
                      placeholder="ss"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="race-notes" className="text-white/80">
                    Notes (optional)
                  </Label>
                  <Textarea
                    id="race-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any context worth remembering..."
                    rows={2}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
                  />
                </div>

                <Button
                  onClick={handleAddRace}
                  disabled={saving || !canSave}
                  className="w-full bg-white text-black hover:bg-white/90"
                >
                  {saving ? 'Saving...' : 'Save Race'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-white/40">Loading...</div>
          </div>
        ) : races.length === 0 ? (
          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-12 text-center">
            <p className="text-white/40">No races yet — add one to start tracking your race history.</p>
          </div>
        ) : (
          <div className="space-y-10">
            <div>
              <h2 className="text-lg font-medium text-white mb-4">Upcoming</h2>
              {upcoming.length === 0 ? (
                <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-8 text-center">
                  <p className="text-white/40 text-sm">No upcoming races.</p>
                </div>
              ) : (
                <div className="grid gap-3">{upcoming.map(renderRaceCard)}</div>
              )}
            </div>

            <div>
              <h2 className="text-lg font-medium text-white mb-4">Completed</h2>
              {completed.length === 0 ? (
                <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-8 text-center">
                  <p className="text-white/40 text-sm">No completed races yet.</p>
                </div>
              ) : (
                <div className="grid gap-3">{completed.map(renderRaceCard)}</div>
              )}
            </div>
          </div>
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
