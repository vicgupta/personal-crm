import { useEffect, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import { api } from '../api';
import { STAGES, STAGE_LABELS, formatMoney, type Deal, type Stage } from '../types';
import { moveDealToStage, columnTotals } from '../pipeline-utils';

function DraggableDealCard({ deal }: { deal: Deal }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `deal-${deal.id}` });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`deal-card${isDragging ? ' dragging' : ''}`}
      title={`${deal.name} — drag to another stage`}
    >
      <div className="deal-name">{deal.name}</div>
      <div className="deal-meta">
        <span>{deal.organization_name ?? ''}</span>
        <span className="deal-value">{formatMoney(deal.value)}</span>
      </div>
    </div>
  );
}

function DroppableColumn({ stage, children }: { stage: Stage; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div ref={setNodeRef} className={`pipeline-column${isOver ? ' drag-over' : ''}`}>
      {children}
    </div>
  );
}

export default function Pipeline() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    api.deals.list().then((d) => { setDeals(d); setLoading(false); }).catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const dealId = Number(String(active.id).replace(/^deal-/, ''));
    const newStage = over.id as Stage;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === newStage || !STAGES.includes(newStage)) return;
    try {
      const updated = await api.deals.setStage(dealId, newStage);
      setDeals((prev) => moveDealToStage(prev, dealId, updated.stage, updated.probability));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to move deal');
    }
  }

  if (loading) return <div className="loading">Loading pipeline…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Pipeline</h1>
          <p>Drag a deal card to another column to change its stage.</p>
        </div>
      </div>
      {error && <div className="error-box">{error}</div>}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="pipeline-board">
          {STAGES.map((stage) => {
            const totals = columnTotals(deals, stage);
            return (
              <DroppableColumn key={stage} stage={stage}>
                <h3>{STAGE_LABELS[stage]} <span>{totals.count}</span></h3>
                <div className="col-total">
                  {formatMoney(totals.total)} total · {formatMoney(Math.round(totals.expected))} expected
                </div>
                {deals.filter((d) => d.stage === stage).map((d) => (
                  <DraggableDealCard key={d.id} deal={d} />
                ))}
              </DroppableColumn>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
