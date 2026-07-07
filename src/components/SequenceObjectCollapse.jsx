import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { Empty, List, Dropdown, Button, DatePicker, Input } from "antd";
import * as WorkspaceAPI from "trimble-connect-workspace-api";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  useSortable,
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import { FileOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";

import {
  SetObjectsRequest,
  SetActiveSimulationItem,
} from "../store/sequence/action";

const getObjectKey = (obj) => `${obj.modelId}-${obj.id}`;

const SortableSubItem = React.memo(
  ({
    item,
    icon,
    selectedIds,
    setSelectedIds,
    lastSelected,
    setLastSelected,
    setFocusedIndex,
    currentObjects,
    onAssignDate,
    onDelete,
    selectObjectsInViewer,
    setActiveItem,
    listRef,
  }) => {
    const [assignDate, setAssignDate] = useState(null);
    const [dateStep, setDateStep] = useState(0);

    const sortableId = getObjectKey(item);

    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({
        id: sortableId,
      });

    const isSelected = selectedIds.some(
      (x) =>
        String(x.modelId) === String(item.modelId) &&
        String(x.id) === String(item.id),
    );

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      cursor: "pointer",
      background: isSelected ? "#e6f4ff" : undefined,
      paddingLeft: 10,
      paddingRight: 10,
      border: isSelected ? "1px solid #91caff" : undefined,
    };

    const handleClick = async (e) => {
      e.stopPropagation();

      listRef.current?.focus();

      const isCtrlSelect = e.ctrlKey || e.metaKey;
      const isShiftSelect = e.shiftKey;

      let nextSelection = [];

      if (isShiftSelect && lastSelected) {
        const startIndex = currentObjects.findIndex(
          (x) =>
            String(x.modelId) === String(lastSelected.modelId) &&
            String(x.id) === String(lastSelected.id),
        );

        const endIndex = currentObjects.findIndex(
          (x) =>
            String(x.modelId) === String(item.modelId) &&
            String(x.id) === String(item.id),
        );

        if (startIndex !== -1 && endIndex !== -1) {
          const range = currentObjects.slice(
            Math.min(startIndex, endIndex),
            Math.max(startIndex, endIndex) + 1,
          );

          nextSelection = [
            ...new Map(
              [...selectedIds, ...range].map((x) => [getObjectKey(x), x]),
            ).values(),
          ];

          setSelectedIds(nextSelection);
        }
      } else if (isCtrlSelect) {
        const exists = selectedIds.some(
          (x) =>
            String(x.modelId) === String(item.modelId) &&
            String(x.id) === String(item.id),
        );

        nextSelection = exists
          ? selectedIds.filter(
              (x) =>
                !(
                  String(x.modelId) === String(item.modelId) &&
                  String(x.id) === String(item.id)
                ),
            )
          : [...selectedIds, item];

        setSelectedIds(nextSelection);
        setLastSelected(item);
      } else {
        nextSelection = [item];

        setSelectedIds(nextSelection);
        setLastSelected(item);
        setActiveItem(item);
      }

      const clickedIndex = currentObjects.findIndex(
        (x) =>
          String(x.modelId) === String(item.modelId) &&
          String(x.id) === String(item.id),
      );

      if (clickedIndex !== -1) {
        setFocusedIndex(clickedIndex);
      }

      await selectObjectsInViewer(nextSelection);
    };

    const contextMenuItems = [
      {
        key: "assignDate",
        label: (
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <DatePicker
              size="small"
              value={assignDate}
              onChange={(date) => setAssignDate(date)}
            />

            <Input
              size="small"
              style={{ width: 40 }}
              value={dateStep}
              onChange={(e) => setDateStep(e.target.value)}
            />

            <Button
              size="small"
              type="text"
              disabled={!assignDate}
              icon={<EditOutlined />}
              onClick={() => {
                onAssignDate(assignDate, dateStep);
              }}
            />
          </div>
        ),
      },
      {
        type: "divider",
      },
      {
        key: "delete",
        label: (
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDelete(item)}
          >
            Delete
          </Button>
        ),
      },
    ];

    return (
      <Dropdown
        trigger={["contextMenu"]}
        menu={{
          items: contextMenuItems,
        }}
      >
        <List.Item
          ref={setNodeRef}
          data-object-key={sortableId}
          style={style}
          {...attributes}
          onClick={handleClick}
          tabIndex={-1}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
            }}
          >
            <span
              {...listeners}
              style={{
                cursor: "grab",
                marginRight: 12,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {icon}
            </span>

            <strong>
              {item.asmPos ?? item.id}
              {item.positionCode != null && ` [${item.positionCode}]`}
              {item.weight != null && ` (${Number(Number(item.weight || 0).toFixed(2))} kg)`}
            </strong>

            <div style={{ flex: 1 }} />

            {item.date && (
              <span
                style={{
                  opacity: 0.7,
                }}
              >
                {item.date}
              </span>
            )}
          </div>
        </List.Item>
      </Dropdown>
    );
  },
);

const SequenceObjectCollapse = ({ subPlan, activeSimulationItem }) => {
  const dispatch = useDispatch();

  const sequenceObjects = useSelector(
    (state) => state.sequence.sequenceObjects,
  );

  const loading = useSelector((state) => state.sequence.pending);

  const [selectedIds, setSelectedIds] = useState([]);
  const [lastSelected, setLastSelected] = useState(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const tcapiRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const connectApi = async () => {
      try {
        tcapiRef.current = await WorkspaceAPI.connect(window.parent);
      } catch (error) {
        console.error(error);
      }
    };

    connectApi();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  const currentObjects = useMemo(() => {
    const subPlanObjects = sequenceObjects.find(
      (x) => x && String(x.subPlanId) === String(subPlan.id),
    );

    return subPlanObjects?.objects || [];
  }, [sequenceObjects, subPlan.id]);

  const items = useMemo(() => {
    const result = [];

    sequenceObjects.forEach((plan) => {
      const objects = plan.objects || [];

      objects.forEach((obj) => {
        const runtimeId = obj.id || obj.runtimeId || obj.objectRuntimeId;

        result.push({
          ...obj,
          planId: plan.planId || plan.id,
          subPlanId: plan.subPlanId,
          modelId: obj.modelId,
          id: runtimeId,
        });
      });
    });

    return result;
  }, [sequenceObjects]);

  const updateObjects = useCallback(
    (objects) => {
      dispatch(
        SetObjectsRequest({
          subPlanId: subPlan.id,
          objects,
        }),
      );
    },
    [dispatch, subPlan.id],
  );

  const selectObjectsInViewer = useCallback(async (objects) => {
    try {
      const tcapi = tcapiRef.current;

      if (!tcapi || !objects?.length) {
        return;
      }

      await tcapi.viewer.setSelection(
        {
          modelObjectIds: objects.map((x) => ({
            modelId: x.modelId,
            objectRuntimeIds: [x.id || x.runtimeId || x.objectRuntimeId],
          })),
        },
        "set",
      );
    } catch (error) {
      console.error(error);
    }
  }, []);

  const changeIndex = useCallback(
    async (newIndex) => {
      if (!items.length) return;

      const safeIndex = Math.max(0, Math.min(newIndex, items.length - 1));
      const item = items[safeIndex];

      dispatch(
        SetActiveSimulationItem({
          planId: item.planId,
          subPlanId: item.subPlanId,
          modelId: item.modelId,
          id: item.id,
        }),
      );

      await selectObjectsInViewer([item]);
    },
    [items, dispatch, selectObjectsInViewer],
  );

  const getCurrentIndex = useCallback(() => {
    if (activeSimulationItem) {
      return items.findIndex(
        (x) =>
          String(x.subPlanId) === String(activeSimulationItem.subPlanId) &&
          String(x.modelId) === String(activeSimulationItem.modelId) &&
          String(x.id) === String(activeSimulationItem.id),
      );
    }

    const currentItem = selectedIds[0] || currentObjects[focusedIndex];

    if (!currentItem) return -1;

    return items.findIndex(
      (x) =>
        String(x.subPlanId) === String(currentItem.subPlanId || subPlan.id) &&
        String(x.modelId) === String(currentItem.modelId) &&
        String(x.id) ===
          String(
            currentItem.id ||
              currentItem.runtimeId ||
              currentItem.objectRuntimeId,
          ),
    );
  }, [
    items,
    activeSimulationItem,
    selectedIds,
    currentObjects,
    focusedIndex,
    subPlan.id,
  ]);

  const next = useCallback(() => {
    const currentIndex = getCurrentIndex();

    if (currentIndex === -1) {
      changeIndex(0);
      return;
    }

    changeIndex(currentIndex + 1);
  }, [getCurrentIndex, changeIndex]);

  const prev = useCallback(() => {
    const currentIndex = getCurrentIndex();

    if (currentIndex === -1) {
      changeIndex(0);
      return;
    }

    changeIndex(currentIndex - 1);
  }, [getCurrentIndex, changeIndex]);

  const setActiveItem = useCallback(
    (item) => {
      const runtimeId = item.id || item.runtimeId || item.objectRuntimeId;

      dispatch(
        SetActiveSimulationItem({
          planId: item.planId,
          subPlanId: item.subPlanId || subPlan.id,
          modelId: item.modelId,
          id: runtimeId,
        }),
      );
    },
    [dispatch, subPlan.id],
  );

  useEffect(() => {
    if (!activeSimulationItem || !currentObjects.length) return;

    if (String(activeSimulationItem.subPlanId) !== String(subPlan.id)) return;

    const index = currentObjects.findIndex(
      (x) =>
        String(x.modelId) === String(activeSimulationItem.modelId) &&
        String(x.id) === String(activeSimulationItem.id),
    );

    if (index === -1) return;

    const item = currentObjects[index];

    setFocusedIndex(index);
    setSelectedIds([item]);
    setLastSelected(item);

    setTimeout(() => {
      listRef.current?.focus();

      const el = listRef.current?.querySelector(
        `[data-object-key="${getObjectKey(item)}"]`,
      );

      el?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);
  }, [activeSimulationItem, currentObjects, subPlan.id]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

      e.preventDefault();
      e.stopPropagation();

      if (e.key === "ArrowDown") {
        next();
      }

      if (e.key === "ArrowUp") {
        prev();
      }
    },
    [next, prev],
  );

  const onDragEndSubItem = useCallback(
    (event) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = currentObjects.findIndex(
        (x) => getObjectKey(x) === active.id,
      );

      const newIndex = currentObjects.findIndex(
        (x) => getObjectKey(x) === over.id,
      );

      if (oldIndex < 0 || newIndex < 0) {
        return;
      }

      const reordered = arrayMove(currentObjects, oldIndex, newIndex);

      updateObjects(reordered);
      setFocusedIndex(newIndex);
    },
    [currentObjects, updateObjects],
  );

  const handleAssignDate = useCallback(
    (date, dateStep) => {
      if (!date) return;

      const step = Number(dateStep) || 0;
      const selectedKeys = selectedIds.map((x) => getObjectKey(x));

      let dateCount = 0;

      const updated = currentObjects.map((obj) => {
        const key = getObjectKey(obj);

        if (selectedKeys.includes(key)) {
          const assignedDate = date.add(dateCount, "day").format("DD-MM-YYYY");

          dateCount += step;

          return {
            ...obj,
            date: assignedDate,
          };
        }

        return obj;
      });

      updateObjects(updated);
    },
    [currentObjects, selectedIds, updateObjects],
  );

  const handleDelete = useCallback(
    (item) => {
      const updated = currentObjects.filter(
        (obj) =>
          !(
            String(obj.modelId) === String(item.modelId) &&
            String(obj.id) === String(item.id)
          ),
      );
      const remainingObjects = [];
      for (const obj of sequenceObjects) {
        const index = remainingObjects.findIndex(
          (x) => x.subPlanId === obj.subPlanId,
        );
        if (index === -1) {
          remainingObjects.push({
            planId: obj.planId,
            subPlanId: obj.subPlanId,
            objects: [obj],
          });
        } else {
          remainingObjects[index].objects.push(obj);
        }
      }

      updateObjects(updated);

      setSelectedIds((prev) =>
        prev.filter(
          (x) =>
            !(
              String(x.modelId) === String(item.modelId) &&
              String(x.id) === String(item.id)
            ),
        ),
      );

      setFocusedIndex((prev) =>
        Math.max(0, Math.min(prev, updated.length - 1)),
      );
    },
    [currentObjects, updateObjects],
  );

  useEffect(() => {
    if (focusedIndex > currentObjects.length - 1) {
      setFocusedIndex(Math.max(0, currentObjects.length - 1));
    }
  }, [currentObjects.length, focusedIndex]);

  if (!currentObjects.length) {
    return (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No Objects" />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEndSubItem}
    >
      <SortableContext
        items={currentObjects.map((x) => getObjectKey(x))}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={listRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          style={{
            outline: "none",
          }}
        >
          <List
            loading={loading}
            dataSource={currentObjects}
            style={{
              marginLeft: 10,
              minWidth: 100,
              maxHeight: 600,
              overflowY: "auto",
            }}
            renderItem={(item) => (
              <SortableSubItem
                key={getObjectKey(item)}
                item={item}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                lastSelected={lastSelected}
                setLastSelected={setLastSelected}
                setFocusedIndex={setFocusedIndex}
                currentObjects={currentObjects}
                icon={<FileOutlined />}
                onAssignDate={handleAssignDate}
                onDelete={handleDelete}
                selectObjectsInViewer={selectObjectsInViewer}
                setActiveItem={setActiveItem}
                listRef={listRef}
              />
            )}
          />
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default SequenceObjectCollapse;
