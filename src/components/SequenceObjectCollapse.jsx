import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Empty,
  List,
  Dropdown,
  Button,
  DatePicker,
  Input,
  InputNumber,
} from "antd";
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
  DeleteFilled,
  DeleteOutlined,
  EditOutlined,
} from "@ant-design/icons";

import {
  SetObjectsRequest,
  UpdateSubPlanRequest,
} from "../store/sequence/action";

const SortableSubItem = React.memo(
  ({
    item,
    icon,
    selectedIds,
    setSelectedIds,
    lastSelected,
    setLastSelected,
    currentObjects,
    onAssignDate,
    onDelete,
    tcapiRef,
  }) => {
    const [assignDate, setAssignDate] = useState(null);
    const [dateStep, setDateStep] = useState(1);
    const sortableId = `${item.modelId}-${item.id}`;
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({
        id: sortableId,
      });

    const isSelected =
      selectedIds.findIndex(
        (x) => x.modelId === item.modelId && x.id === item.id,
      ) >= 0;

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      cursor: "pointer",
      background: isSelected ? "#e6f4ff" : undefined,
      paddingLeft: 10,
      paddingRight: 10,
    };

    const handleClick = async (e) => {
      e.stopPropagation();

      const isCtrlSelect = e.ctrlKey || e.metaKey;
      const isShiftSelect = e.shiftKey;

      let nextSelection = [];

      // SHIFT + CLICK
      if (isShiftSelect && lastSelected) {
        const startIndex = currentObjects.findIndex(
          (x) => x.modelId === lastSelected.modelId && x.id === lastSelected.id,
        );

        const endIndex = currentObjects.findIndex(
          (x) => x.modelId === item.modelId && x.id === item.id,
        );

        if (startIndex !== -1 && endIndex !== -1) {
          const range = currentObjects.slice(
            Math.min(startIndex, endIndex),
            Math.max(startIndex, endIndex) + 1,
          );

          nextSelection = [
            ...new Map(
              [...selectedIds, ...range].map((x) => [
                `${x.modelId}-${x.id}`,
                x,
              ]),
            ).values(),
          ];

          setSelectedIds(nextSelection);
        }
      }
      // CTRL + CLICK
      else if (isCtrlSelect) {
        const exists = selectedIds.some(
          (x) => x.modelId === item.modelId && x.id === item.id,
        );

        nextSelection = exists
          ? selectedIds.filter(
              (x) => !(x.modelId === item.modelId && x.id === item.id),
            )
          : [...selectedIds, item];

        setSelectedIds(nextSelection);
        setLastSelected(item);
      }
      // NORMAL CLICK
      else {
        nextSelection = [item];

        setSelectedIds(nextSelection);
        setLastSelected(item);
      }

      try {
        const tcapi = tcapiRef.current;

        if (tcapi) {
          const tcObjectsTobeSelected = nextSelection.map((x) => {
            return {
              modelId: x.modelId,
              objectRuntimeIds: [x.id],
            };
          });
          await tcapi.viewer.setSelection(
            {
              modelObjectIds: [...tcObjectsTobeSelected],
            },
            "set",
          );
        }
      } catch (error) {
        console.error(error);
      }
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

            <InputNumber
              size="small"
              min={1}
              style={{ width: 40 }}
              value={dateStep}
              onChange={setDateStep}
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
        style={{
          borderRadius: 0,
        }}
      >
        <List.Item
          ref={setNodeRef}
          style={style}
          {...attributes}
          onClick={handleClick}
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

            <strong>{item.asmPos ? item.asmPos : item.id}</strong>

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

const SequenceObjectCollapse = ({ subPlan }) => {
  const dispatch = useDispatch();

  const sequenceObjects = useSelector(
    (state) => state.sequence.sequenceObjects,
  );

  const loading = useSelector((state) => state.sequence.pending);

  const [selectedIds, setSelectedIds] = useState([]);
  const [lastSelected, setLastSelected] = useState(null);

  const tcapiRef = useRef(null);

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
      (x) => x && x.subPlanId === subPlan.id,
    );

    return subPlanObjects?.objects || [];
  }, [sequenceObjects, subPlan.id]);

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

  const onDragEndSubItem = useCallback(
    (event) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = currentObjects.findIndex(
        (x) => `${x.modelId}-${x.id}` === active.id,
      );

      const newIndex = currentObjects.findIndex(
        (x) => `${x.modelId}-${x.id}` === over.id,
      );

      if (oldIndex < 0 || newIndex < 0) {
        return;
      }

      const reordered = arrayMove(currentObjects, oldIndex, newIndex);

      updateObjects(reordered);
    },
    [currentObjects, updateObjects],
  );

  const handleAssignDate = useCallback(
    (date, dateStep) => {
      if (!date) return;

      const step = Number(dateStep) || 0;

      const selectedKeys = selectedIds.map((x) => `${x.modelId}-${x.id}`);

      let dateCount = 0;

      const updated = currentObjects.map((obj) => {
        const key = `${obj.modelId}-${obj.id}`;

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
        (obj) => !(obj.modelId === item.modelId && obj.id === item.id),
      );

      updateObjects(updated);

      setSelectedIds((prev) =>
        prev.filter((x) => !(x.modelId === item.modelId && x.id === item.id)),
      );
    },
    [currentObjects, updateObjects],
  );

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
        items={currentObjects.map((x) => `${x.modelId}-${x.id}`)}
        strategy={verticalListSortingStrategy}
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
              key={`${item.modelId}-${item.id}`}
              item={item}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              lastSelected={lastSelected}
              setLastSelected={setLastSelected}
              currentObjects={currentObjects}
              icon={<FileOutlined />}
              onAssignDate={handleAssignDate}
              onDelete={handleDelete}
              tcapiRef={tcapiRef}
            />
          )}
        />
      </SortableContext>
    </DndContext>
  );
};

export default SequenceObjectCollapse;
