type ToolRow = {date:string;category:string;count:number;tool?:string|null;namespace?:string};
export default function ToolDetail({rows=[]}:{rows?:ToolRow[]}) {
  const groups=new Map<string,{tool:string;namespace:string;legacy:boolean;count:number;days:Map<string,number>}>();
  for (const row of rows) {
    const tool=row.tool || `Legacy category: ${row.category}`, namespace=row.namespace || '';
    const key=JSON.stringify([tool,namespace]);
    const group=groups.get(key) || {tool,namespace,legacy:!row.tool,count:0,days:new Map()};
    group.count+=row.count;
    group.days.set(row.date,(group.days.get(row.date)||0)+row.count);
    groups.set(key,group);
  }
  if (!groups.size) return <p>No saved calls in this scan.</p>;
  return <div className="tool-details">{[...groups.values()].sort((a,b)=>b.count-a.count||a.tool.localeCompare(b.tool)).map(group=>(
    <details className="model-detail" key={JSON.stringify([group.tool,group.namespace])}>
      <summary><span><strong style={{overflowWrap:'anywhere'}}>{group.tool}</strong>{group.namespace&&<small>Namespace: {group.namespace}</small>}</span><span>{group.count.toLocaleString()} calls</span></summary>
      {group.legacy&&<p>This older snapshot recorded a category only, not exact tool names.</p>}
      <dl className="model-counts">{[...group.days].sort(([a],[b])=>b.localeCompare(a)).map(([date,count])=><div key={date}><dt>{date}</dt><dd>{count.toLocaleString()} calls</dd></div>)}</dl>
    </details>
  ))}</div>;
}
