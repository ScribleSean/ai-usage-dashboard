'use client';
import {useState} from 'react';
import {summarizeDictation} from '../scripts/typewhisper.mjs';
import {Button} from '@/components/ui/button';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';

export type DictationSource = {
  host:string; status:string; checkedAt?:string;
  days?:{date:string;transcriptions:number;words:number;audioSeconds:number;engines:{engine:string;transcriptions:number}[]}[];
};
const fmt=(value:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(value);
const missing:Record<string,string>={
  'not-connected':'Optional source is not connected.',
  'not-found':'No TypeWhisper statistics store was found.',
  ambiguous:'Multiple statistics stores were found. No totals were combined.',
  unavailable:'Statistics could not be read. Values are unknown.',
};
export default function Dictation({sources=[]}:{sources?:DictationSource[]}) {
  const [host,setHost]=useState('Mac');
  const [period,setPeriod]=useState<'week'|'all'>('week');
  const source=sources.find(row=>row.host===host);
  const days=source?.days || [];
  const end=days.at(-1)?.date;
  const start=end && period==='week'?new Date(Date.parse(end+'T12:00:00Z')-6*86400000).toISOString().slice(0,10):undefined;
  const summary=summarizeDictation(source,start,end);
  const selected=days.filter(day=>!start || day.date>=start);
  return <>
    <div className="view-heading"><div><h1>Dictation</h1><p>TypeWhisper statistics without transcripts or recordings.</p></div><span className="period-chip">Optional source</span></div>
    <div className="dictation-controls">
      <div role="group" aria-label="Dictation device">{['Mac','Windows'].map(value=><Button key={value} variant={host===value?'default':'outline'} aria-pressed={host===value} onClick={()=>setHost(value)}>{value}</Button>)}</div>
      <div role="group" aria-label="Dictation period">{(['week','all'] as const).map(value=><Button key={value} variant={period===value?'default':'outline'} aria-pressed={period===value} onClick={()=>setPeriod(value)}>{value==='week'?'Latest recorded week':'All retained'}</Button>)}</div>
    </div>
    {source?.status!=='ok'?<div className="empty-state"><p>{missing[source?.status || 'not-connected'] || missing.unavailable}</p></div>:!summary?<div className="empty-state"><p>No retained transcription aggregates. Usage is unknown, not a confirmed zero.</p></div>:<>
      <p className="dictation-period">{selected[0]?.date} to {end}, device-local dates. {summary.recordedDays} {summary.recordedDays===1?'date':'dates'} with retained records.</p>
      <div className="dictation-metrics">
        <div><span>Transcriptions</span><strong>{fmt(summary.transcriptions)}</strong></div>
        <div><span>Words</span><strong>{fmt(summary.words)}</strong></div>
        <div><span>Recorded audio</span><strong>{fmt(summary.audioSeconds/60)} <small>min</small></strong></div>
      </div>
      <section className="dictation-detail"><h2>Recorded engines</h2>{summary.engines.length?<ul>{summary.engines.map((engine:{engine:string;transcriptions:number})=><li key={engine.engine}><span>{engine.engine}</span><strong>{fmt(engine.transcriptions)} {engine.transcriptions===1?'transcription':'transcriptions'}</strong></li>)}</ul>:<p>Unknown. Engine breakdown was not recorded.</p>}</section>
      <section className="dictation-detail"><h2>Daily totals</h2><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Transcriptions</TableHead><TableHead>Words</TableHead><TableHead>Audio minutes</TableHead></TableRow></TableHeader><TableBody>{selected.slice().reverse().map(day=><TableRow key={day.date}><TableCell>{day.date}</TableCell><TableCell>{fmt(day.transcriptions)}</TableCell><TableCell>{fmt(day.words)}</TableCell><TableCell>{fmt(day.audioSeconds/60)}</TableCell></TableRow>)}</TableBody></Table></section>
    </>}
    <div className="dictation-note"><p>Daily totals can include recovered or imported transcriptions. They do not identify individual hotkey sessions, failed attempts, or speech-only time. Missing dates are not filled with zeros.</p><p>Devices stay separate because imported statistics may overlap. Clearing TypeWhisper statistics removes this source’s history. Only fixed engine labels are shown. Custom model names and app names are excluded.</p>{source?.checkedAt && <p>Last checked: {new Date(source.checkedAt).toLocaleString()}</p>}</div>
  </>;
}
