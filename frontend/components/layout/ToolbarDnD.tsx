// [claude-code 2026-05-15] S66-T3: @dnd-kit drag-and-drop toolbar wrapper.
// Replaces native HTML5 DnD with SortableContext + DragOverlay.
// PointerSensor at 5px distance prevents accidental drag on click.
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  setToolbarOrder,
  type ToolbarItemId,
} from "../../lib/layoutOrderStorage";

interface SortableToolbarItemProps {
  id: ToolbarItemId;
  editMode: boolean;
  children: ReactNode;
}

function SortableToolbarItem({
  id,
  editMode,
  children,
}: SortableToolbarItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !editMode });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative",
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-0.5">
      {editMode && (
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none shrink-0 p-0.5 text-gray-600 hover:text-[var(--fintheon-accent)]"
          title="Drag to reorder"
        >
          <GripVertical className="w-3 h-3" />
        </div>
      )}
      {children}
    </div>
  );
}

interface ToolbarDnDProps {
  items: ToolbarItemId[];
  children: (id: ToolbarItemId) => ReactNode;
  editMode: boolean;
  onOrderChange: (newOrder: ToolbarItemId[]) => void;
}

export function ToolbarDnD({
  items,
  children,
  editMode,
  onOrderChange,
}: ToolbarDnDProps) {
  const [activeId, setActiveId] = useState<ToolbarItemId | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as ToolbarItemId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.indexOf(active.id as ToolbarItemId);
    const newIndex = items.indexOf(over.id as ToolbarItemId);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(items, oldIndex, newIndex);
    setToolbarOrder(newOrder);
    onOrderChange(newOrder);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items} strategy={horizontalListSortingStrategy}>
        <div className="flex items-center gap-0.5">
          {items.map((id) => (
            <SortableToolbarItem key={id} id={id} editMode={editMode}>
              {children(id)}
            </SortableToolbarItem>
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeId ? (
          <div className="backdrop-blur-sm bg-[rgba(5,4,2,0.7)] border border-[var(--fintheon-accent)]/30 rounded-md shadow-lg px-3 py-1.5 flex items-center gap-1">
            <GripVertical className="w-3 h-3 text-[var(--fintheon-accent)]" />
            {children(activeId)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
