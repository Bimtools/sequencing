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

import {
  FileOutlined,
  DeleteOutlined,
  EditOutlined,
  CloseOutlined,
} from "@ant-design/icons";

import {
  SetObjectsRequest,
  SetActiveSimulationItem,
} from "../store/sequence/action";

const getObjectKey = (obj) => {
  const runtimeId = obj.id || obj.runtimeId || obj.objectRuntimeId;

  return `${obj.modelId}-${runtimeId}`;
};

const getObjectDate = (obj) => {
  return obj.date || obj.assignedDate || "";
};

const isSameObject = (first, second) => {
  if (!first || !second) return false;

  const firstId = first.id || first.runtimeId || first.objectRuntimeId;

  const secondId = second.id || second.runtimeId || second.objectRuntimeId;

  return (
    String(first.modelId) === String(second.modelId) &&
    String(firstId) === String(secondId)
  );
};

const SortableSubItem = React.memo(
  ({
    item,
    displayIndex,
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

    const isSelected = selectedIds.some((selected) =>
      isSameObject(selected, item),
    );

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      cursor: "pointer",
      background: isSelected ? "#e6f4ff" : undefined,
      paddingLeft: 10,
      paddingRight: 2,
      border: isSelected ? "1px solid #91caff" : undefined,
    };

    const handleClick = async (event) => {
      event.stopPropagation();

      listRef.current?.focus();

      const isCtrlSelect = event.ctrlKey || event.metaKey;

      const isShiftSelect = event.shiftKey;

      let nextSelection = [];

      if (isShiftSelect && lastSelected) {
        const startIndex = currentObjects.findIndex((obj) =>
          isSameObject(obj, lastSelected),
        );

        const endIndex = currentObjects.findIndex((obj) =>
          isSameObject(obj, item),
        );

        if (startIndex !== -1 && endIndex !== -1) {
          const range = currentObjects.slice(
            Math.min(startIndex, endIndex),
            Math.max(startIndex, endIndex) + 1,
          );

          nextSelection = [
            ...new Map(
              [...selectedIds, ...range].map((obj) => [getObjectKey(obj), obj]),
            ).values(),
          ];

          setSelectedIds(nextSelection);
          setLastSelected(item);
        }
      } else if (isCtrlSelect) {
        const exists = selectedIds.some((selected) =>
          isSameObject(selected, item),
        );

        nextSelection = exists
          ? selectedIds.filter((selected) => !isSameObject(selected, item))
          : [...selectedIds, item];

        setSelectedIds(nextSelection);
        setLastSelected(item);
      } else {
        nextSelection = [item];

        setSelectedIds(nextSelection);
        setLastSelected(item);
        setActiveItem(item);
      }

      const clickedIndex = currentObjects.findIndex((obj) =>
        isSameObject(obj, item),
      );

      if (clickedIndex !== -1) {
        setFocusedIndex(clickedIndex);
      }

      await selectObjectsInViewer(nextSelection);
    };

    const handleDeleteClick = (event) => {
      event.stopPropagation();
      onDelete(item);
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
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <DatePicker
              size="small"
              value={assignDate}
              onChange={setAssignDate}
            />

            <Input
              size="small"
              type="number"
              style={{ width: 50 }}
              value={dateStep}
              onChange={(event) => setDateStep(event.target.value)}
            />

            <Button
              size="small"
              type="text"
              disabled={!assignDate}
              icon={<EditOutlined />}
              onClick={(event) => {
                event.stopPropagation();

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
        danger: true,
        icon: <DeleteOutlined />,
        label: "Delete",
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation();
          onDelete(item);
        },
      },
    ];

    const displayWeight =
      item.weight != null && Number.isFinite(Number(item.weight))
        ? Math.round((Number(item.weight) + Number.EPSILON) * 100) / 100
        : null;

    const displayDate = getObjectDate(item);

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
              gap: 8,
            }}
          >
            <span
              {...listeners}
              style={{
                display: "flex",
                alignItems: "center",
                cursor: "grab",
                flexShrink: 0,
              }}
              onClick={(event) => event.stopPropagation()}
            >
              {icon}
            </span>

            <strong
              style={{
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  minWidth: 24,
                }}
              >
                {displayIndex}.
              </span>

              {item.asmPos || item.id}

              {item.positionCode ? ` [${item.positionCode}]` : ""}

              {displayWeight != null ? ` (${displayWeight} kg)` : ""}
            </strong>

            <div style={{ flex: 1 }} />

            {displayDate && (
              <span
                style={{
                  opacity: 0.7,
                  whiteSpace: "nowrap",
                }}
              >
                {displayDate}
              </span>
            )}

            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={handleDeleteClick}
            />
          </div>
        </List.Item>
      </Dropdown>
    );
  },
);

const SequenceObjectCollapse = ({ subPlan, activeSimulationItem, displayIndexMap}) => {
  const dispatch = useDispatch();

  const sequenceObjects = useSelector(
    (state) => state.sequence.sequenceObjects || [],
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
      (group) => group && String(group.subPlanId) === String(subPlan.id),
    );

    return subPlanObjects?.objects || [];
  }, [sequenceObjects, subPlan.id]);


  /*
   * Đánh số theo ngày nhưng không thay đổi thứ tự
   * của currentObjects.
   *
   * 15-07-2026: 1, 2, 3, 4
   * 18-07-2026: 1, 2
   */
  const displayIndexMap1 = useMemo(() => {
    const dateCounters = new Map();
    const objectIndexes = new Map();
    console.log(currentObjects)
    currentObjects.forEach((item) => {
      const dateKey = getObjectDate(item) || "NO_DATE";

      const nextIndex = (dateCounters.get(dateKey) || 0) + 1;

      dateCounters.set(dateKey, nextIndex);
      objectIndexes.set(getObjectKey(item), nextIndex);
    });

    return objectIndexes;
  }, [currentObjects]);


  const items = useMemo(() => {
    const result = [];

    sequenceObjects.forEach((group) => {
      const objects = group.objects || [];

      objects.forEach((obj) => {
        const runtimeId = obj.id || obj.runtimeId || obj.objectRuntimeId;

        result.push({
          ...obj,
          planId: group.planId || group.id,
          subPlanId: group.subPlanId,
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

      const modelGroups = new Map();

      objects.forEach((item) => {
        const runtimeId = item.id || item.runtimeId || item.objectRuntimeId;

        if (!item.modelId || runtimeId == null) {
          return;
        }

        const modelKey = String(item.modelId);

        if (!modelGroups.has(modelKey)) {
          modelGroups.set(modelKey, {
            modelId: item.modelId,
            objectRuntimeIds: [],
          });
        }

        modelGroups.get(modelKey).objectRuntimeIds.push(runtimeId);
      });

      await tcapi.viewer.setSelection(
        {
          modelObjectIds: [...modelGroups.values()],
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
        (item) =>
          String(item.subPlanId) === String(activeSimulationItem.subPlanId) &&
          String(item.modelId) === String(activeSimulationItem.modelId) &&
          String(item.id) === String(activeSimulationItem.id),
      );
    }

    const currentItem = selectedIds[0] || currentObjects[focusedIndex];

    if (!currentItem) return -1;

    return items.findIndex(
      (item) =>
        String(item.subPlanId) ===
          String(currentItem.subPlanId || subPlan.id) &&
        isSameObject(item, currentItem),
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
    if (!activeSimulationItem || !currentObjects.length) {
      return;
    }

    if (String(activeSimulationItem.subPlanId) !== String(subPlan.id)) {
      return;
    }

    const index = currentObjects.findIndex(
      (item) =>
        String(item.modelId) === String(activeSimulationItem.modelId) &&
        String(item.id || item.runtimeId || item.objectRuntimeId) ===
          String(activeSimulationItem.id),
    );

    if (index === -1) return;

    const item = currentObjects[index];

    setFocusedIndex(index);
    setSelectedIds([item]);
    setLastSelected(item);

    const timeoutId = setTimeout(() => {
      listRef.current?.focus();

      const element = listRef.current?.querySelector(
        `[data-object-key="${getObjectKey(item)}"]`,
      );

      element?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [activeSimulationItem, currentObjects, subPlan.id]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (event.key === "ArrowDown") {
        next();
      } else {
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
        (item) => getObjectKey(item) === active.id,
      );

      const newIndex = currentObjects.findIndex(
        (item) => getObjectKey(item) === over.id,
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

      const selectedKeys = new Set(
        selectedIds.map((item) => getObjectKey(item)),
      );

      let dateCount = 0;

      const updated = currentObjects.map((obj) => {
        const key = getObjectKey(obj);

        if (!selectedKeys.has(key)) {
          return obj;
        }

        const assignedDate = date.add(dateCount, "day").format("DD-MM-YYYY");

        dateCount += step;

        return {
          ...obj,
          date: assignedDate,
        };
      });

      updateObjects(updated);
    },
    [currentObjects, selectedIds, updateObjects],
  );

  const handleDelete = useCallback(
    (item) => {
      const updated = currentObjects.filter((obj) => !isSameObject(obj, item));

      updateObjects(updated);

      setSelectedIds((previous) =>
        previous.filter((selected) => !isSameObject(selected, item)),
      );

      setLastSelected((previous) =>
        isSameObject(previous, item) ? null : previous,
      );

      setFocusedIndex((previous) => {
        if (!updated.length) return -1;

        return Math.max(0, Math.min(previous, updated.length - 1));
      });
    },
    [currentObjects, updateObjects],
  );

  useEffect(() => {
    if (!currentObjects.length) {
      setFocusedIndex(-1);
      return;
    }

    if (focusedIndex > currentObjects.length - 1) {
      setFocusedIndex(currentObjects.length - 1);
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
        items={currentObjects.map((item) => getObjectKey(item))}
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
                displayIndex={displayIndexMap.get(getObjectKey(item)) || 1}
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
