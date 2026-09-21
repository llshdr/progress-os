import { redirect } from 'next/navigation'
export default async function CalendarRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { const query = new URLSearchParams(); for(const [k,v] of Object.entries(await searchParams)) if(typeof v==='string') query.set(k,v); redirect('/plan'+(query.size?'?'+query.toString():'')) }
