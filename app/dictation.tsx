'use client';
import {useState} from 'react';
import {summarizeDictation} from '../scripts/typewhisper.mjs';
import {summarizeWispr} from '../scripts/wispr.mjs';
import {Button} from '@/components/ui/button';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';

export type DictationSource = {
  host:string; status:string; checkedAt?:string; source?:string;
  days?:{date:string;transcriptions:number;words:number;audioSeconds:number;wordRecords?:number;audioRecords?:number;engines:{engine:string;transcriptions:number}[]}[];
};
const fmt=(value:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(value);
const missing:Record<string,string>={
  'not-connected':'Optional source is not connected.',
  'not-found':'No statistics store was found for this source.',
  ambiguous:'Multiple statistics stores were found. No totals were combined.',
  unavailable:'Statistics could not be read. Values are unknown.',
};
export default function Dictation({sources=[]}:{sources?:DictationSource[]}) {
  const [host,setHost]=useState('Mac');
  const [provider,setProvider]=useState('Wispr Flow');
  const [period,setPeriod]=useState<'week'|'all'>('week');
  const source=sources.find(row=>row.host===host && (row.source || 'TypeWhisper')===provider);
  const wispr=provider==='Wispr Flow';
  const days=source?.days || [];
  const end=days.at(-1)?.date;
  const start=end && period==='week'?new Date(Date.parse(end+'T12:00:00Z')-6*86400000).toISOString().slice(0,10):undefined;
  const wisprSummary=wispr?summarizeWispr(source,start,end):null;
  const summary=wispr?wisprSummary:summarizeDictation(source,start,end);
  const selected=days.filter(day=>!start || day.date>=start);
  return <>
    <div className="view-heading"><div><h1>Dictation</h1><p>{provider} statistics without transcripts or recordings.</p></div><span className="period-chip">Optional source</span></div>
    <div className="dictation-controls">
      <div role="group" aria-label="Dictation source">{['Wispr Flow','TypeWhisper'].map(value=><Button key={value} variant={provider===value?'default':'outline'} aria-pressed={provider===value} onClick={()=>setProvider(value)}>{value}{value==='TypeWhisper'?' history':''}</Button>)}</div>
      <div role="group" aria-label="Dictation device">{['Mac','Windows'].map(value=><Button key={value} variant={host===value?'default':'outline'} aria-pressed={host===value} onClick={()=>setHost(value)}>{value}</Button>)}</div>
      <div role="group" aria-label="Dictation period">{(['week','all'] as const).map(value=><Button key={value} variant={period===value?'default':'outline'} aria-pressed={period===value} onClick={()=>setPeriod(value)}>{value==='week'?'Latest recorded week':'All retained'}</Button>)}</div>
    </div>
    {source?.status!=='ok'?<div className="empty-state"><p>{missing[source?.status || 'not-connected'] || missing.unavailable}</p></div>:!summary?<div className="empty-state"><p>No retained transcription aggregates. Usage is unknown, not a confirmed zero.</p></div>:<>
      <p className="dictation-period">{selected[0]?.date} to {end}, {wispr?'America/New_York':'device-local'} dates. {summary.recordedDays} {summary.recordedDays===1?'date':'dates'} with retained records.</p>
      <div className="dictation-metrics">
        <div><span>{wispr?'History records':'Transcriptions'}</span><strong>{fmt(summary.transcriptions)}</strong></div>
        <div><span>Words</span><strong>{wispr && !wisprSummary?.wordRecords?'Unknown':fmt(summary.words)}</strong></div>
        <div><span>Recorded audio</span><strong>{wispr && !wisprSummary?.audioRecords?'Unknown':<>{fmt(summary.audioSeconds/60)} <small>min</small></>}</strong></div>
      </div>
      {wispr?<p>Available metadata totals. Words recorded for {wisprSummary?.wordRecords} of {summary.transcriptions} records. Audio duration recorded for {wisprSummary?.audioRecords} of {summary.transcriptions}. Incomplete coverage is not a full usage total.</p>:<section className="dictation-detail"><h2>Recorded engines</h2>{summary.engines.length?<ul>{summary.engines.map((engine:{engine:string;transcriptions:number})=><li key={engine.engine}><span>{engine.engine}</span><strong>{fmt(engine.transcriptions)} {engine.transcriptions===1?'transcription':'transcriptions'}</strong></li>)}</ul>:<p>Unknown. Engine breakdown was not recorded.</p>}</section>}
      <section className="dictation-detail"><h2>Daily totals</h2><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>{wispr?'History records':'Transcriptions'}</TableHead><TableHead>Words</TableHead><TableHead>Audio minutes</TableHead></TableRow></TableHeader><TableBody>{selected.slice().reverse().map(day=><TableRow key={day.date}><TableCell>{day.date}</TableCell><TableCell>{fmt(day.transcriptions)}</TableCell><TableCell>{wispr && !day.wordRecords?'Unknown':fmt(day.words)}{wispr && day.wordRecords!==day.transcriptions?' (partial)':''}</TableCell><TableCell>{wispr && !day.audioRecords?'Unknown':fmt(day.audioSeconds/60)}{wispr && day.audioRecords!==day.transcriptions?' (partial)':''}</TableCell></TableRow>)}</TableBody></Table></section>
    </>}
    <div className="dictation-note"><p>{wispr?'Wispr totals describe retained history, including unfinished or failed records when present. Duration includes silence, not speech-only time. A host identifies the store read, not necessarily the device that recorded the audio. Synced or imported records can overlap.':'TypeWhisper history can include recovered or imported transcriptions.'} Missing dates are not filled with zeros.</p><p>Hosts and products stay separate. Clearing source history removes what this reader can show. Transcripts, recordings, app names and custom model names are excluded.</p>{source?.checkedAt && <p>Last checked: {new Date(source.checkedAt).toLocaleString()}</p>}</div>
  </>;
}
