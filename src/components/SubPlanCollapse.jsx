import React, { useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Collapse, Empty, Spin } from "antd";
import dayjs from "dayjs";
import * as WorkspaceAPI from "trimble-connect-workspace-api";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import SortableHeader from "./SortableHeader";

import {
  DeleteSubPlanRequest,
  UpdateSubPlanRequest,
  SetObjectsRequest,
} from "../store/sequence/action";

import SubPlanModal from "./SubPlanModal";
import SequenceObjectCollapse from "./SequenceObjectCollapse";

const math = require("mathjs");

const getRgbColor = (color) => {
  if (!color) return undefined;
  return `rgb(${color.r ?? 0}, ${color.g ?? 0}, ${color.b ?? 0})`;
};

const SubPlanCollapse = ({ plan, activeSimulationItem }) => {
  const dispatch = useDispatch();

  const subPlans = useSelector((state) => state.sequence.subPlans);
  const sequenceObjects = useSelector(
    (state) => state.sequence.sequenceObjects,
  );
  const loading = useSelector((state) => state.sequence.pending);

  const [isEditFormOpen, setIsEditFormOpen] = React.useState(false);
  const [selectedSubPlan, setSelectedSubPlan] = React.useState(null);
  const [activeKeys, setActiveKeys] = React.useState([]);

  const messageListenerRef = useRef(null);
  const keyListenerRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  const currentSubPlans = useMemo(() => {
    return subPlans.filter((x) => String(x.planId) === String(plan.id));
  }, [subPlans, plan.id]);

  useEffect(() => {
    if (!activeSimulationItem?.subPlanId) return;

    const subPlanKey = String(activeSimulationItem.subPlanId);

    const isSubPlanInThisPlan = currentSubPlans.some(
      (x) => String(x.id) === subPlanKey,
    );

    if (!isSubPlanInThisPlan) return;

    const timer = setTimeout(() => {
      setActiveKeys([subPlanKey]);
    }, 100);

    return () => clearTimeout(timer);
  }, [activeSimulationItem, currentSubPlans]);

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;

    const oldIndex = currentSubPlans.findIndex(
      (x) => String(x.id) === String(active.id),
    );

    const newIndex = currentSubPlans.findIndex(
      (x) => String(x.id) === String(over.id),
    );

    if (oldIndex === -1 || newIndex === -1) return;

    const sortedCurrentSubPlans = arrayMove(
      currentSubPlans,
      oldIndex,
      newIndex,
    );

    dispatch(
      UpdateSubPlanRequest({
        subPlans: sortedCurrentSubPlans,
      }),
    );
  };

  const handleEdit = (subPlan) => {
    setSelectedSubPlan(subPlan);
    setIsEditFormOpen(true);
  };

  const handleAssignObject = async (subPlan) => {
    const tcapi = await WorkspaceAPI.connect(window.parent);
    const selections = await tcapi.viewer.getSelection();

    if (!selections?.length) return;

    tcapi.viewer.activateTool("pointMarkup");

    const onMessage = async (event) => {
      if (event.data.event !== "viewer.onMarkupChanged") return;

      window.removeEventListener("message", onMessage);

      const start = event.data.data.data.markup.start;

      const refPoint = [
        Number(start.positionX),
        Number(start.positionY),
        Number(start.positionZ),
      ];

      const newAddedSequenceObjects = [];

      const createObjectKey = (modelId, objectId) =>
        `${String(modelId)}::${String(objectId)}`;

      /*
       * Store all objects that have already been assigned.
       * If you only want to check duplicates within the current
       * Sub Plan, use `existingObjects` instead of `sequenceObjects`.
       */
      const existingObjectKeys = new Set();

      sequenceObjects.forEach((group) => {
        (group?.objects || []).forEach((obj) => {
          if (obj?.modelId == null || obj?.id == null) {
            return;
          }

          existingObjectKeys.add(createObjectKey(obj.modelId, obj.id));
        });
      });

      /*
       * Prevent duplicate objects within the current assignment.
       */
      const newObjectKeys = new Set();

      tcapi.viewer.activateTool("selection");

      for (const selection of selections) {
        const objBoxes = await tcapi.viewer.getObjectBoundingBoxes(
          selection.modelId,
          selection.objectRuntimeIds,
        );

        const items = await tcapi.viewer.getObjectProperties(
          selection.modelId,
          selection.objectRuntimeIds,
        );

        await tcapi.markup.removeMarkups(undefined);

        for (let i = 0; i < objBoxes.length; i++) {
          const box = objBoxes[i];

          const objectKey = createObjectKey(selection.modelId, box.id);

          if (
            existingObjectKeys.has(objectKey) ||
            newObjectKeys.has(objectKey)
          ) {
            console.warn("Object has already been assigned:", {
              modelId: selection.modelId,
              id: box.id,
            });

            continue;
          }

          /*
           * Mark the object immediately to avoid duplicates
           * during the current assignment.
           */
          newObjectKeys.add(objectKey);

          const center = math.divide(
            math.add(
              [
                1000 * box.boundingBox.min.x,
                1000 * box.boundingBox.min.y,
                1000 * box.boundingBox.min.z,
              ],
              [
                1000 * box.boundingBox.max.x,
                1000 * box.boundingBox.max.y,
                1000 * box.boundingBox.max.z,
              ],
            ),
            2,
          );

          const properties = items[i]?.properties || [];

          let asmName = items[i]?.product?.name || "";
          let asm_pos = "";
          let positionCode = "";
          let weight = 0;
          let asmLength = 0;

          const isCompleted = () =>
            asm_pos !== "" &&
            positionCode !== "" &&
            weight !== 0 &&
            asmName !== "" &&
            asmLength !== 0;

          for (const property of properties) {
            const propertyName = String(property.name || "")
              .toUpperCase()
              .trim();

            const isValidPropertyGroup =
              propertyName.includes("ASSEMBLY") ||
              propertyName.includes("PROPERTY") ||
              propertyName.includes("PRODUCT") ||
              propertyName.includes("COMMON") ||
              propertyName.includes("QUANTITY");

            if (!isValidPropertyGroup) {
              continue;
            }

            for (const asmProperty of property.properties || []) {
              if (isCompleted()) {
                break;
              }

              const name = String(asmProperty.name || "").trim();
              const upperName = name.toUpperCase();
              const value = asmProperty.value;

              if (
                !asm_pos &&
                (name === "Assembly/Cast unit Mark" ||
                  upperName === "ASSEMBLY_POS")
              ) {
                asm_pos = String(value || "")
                  .replace("(?)", "")
                  .trim();

                continue;
              }

              if (
                !positionCode &&
                (name === "Assembly/Cast unit position code" ||
                  upperName === "ASSEMBLY_POSITION_CODE")
              ) {
                positionCode = String(value || "").trim();
                continue;
              }

              if (!weight && upperName.includes("WEIGHT") && value != null) {
                const parsedWeight = Number(value);

                if (Number.isFinite(parsedWeight)) {
                  weight =
                    Math.round((parsedWeight + Number.EPSILON) * 100) / 100;
                }

                continue;
              }

              if (!asmName && upperName.includes("NAME") && value != null) {
                asmName = String(value).trim();
                continue;
              }

              if (!asmLength && upperName.includes("LENGTH") && value != null) {
                const parsedLength = Number(value);

                if (Number.isFinite(parsedLength)) {
                  asmLength = Math.round(parsedLength);
                }
              }
            }

            if (isCompleted()) {
              break;
            }
          }

          const distance = math.distance(refPoint, center);

          newAddedSequenceObjects.push({
            modelId: selection.modelId,
            subPlanId: subPlan.id,
            planId: plan.id,
            id: box.id,
            distance: math.round(distance),
            center,
            asmPos: asm_pos,
            date: dayjs().format("DD-MM-YYYY"),
            weight,
            length: asmLength,
            name: asmName,
            positionCode,
          });
        }
      }

      newAddedSequenceObjects.sort(
        (a, b) => Number(a.distance) - Number(b.distance),
      );

      const existingObjects =
        sequenceObjects.find(
          (x) => x && String(x.subPlanId) === String(subPlan.id),
        )?.objects ?? [];

      const newObjects = [...existingObjects, ...newAddedSequenceObjects];

      const newAssignedObjects = newObjects.map((x) => ({
        asmPos: x.asmPos,
        date: x.date,
        id: x.id,
        modelId: x.modelId,
        planId: x.planId,
        subPlanId: x.subPlanId,
        positionCode: x.positionCode,
        weight: x.weight,
        name: x.name,
        length: x.length,
      }));

      dispatch(
        SetObjectsRequest({
          subPlanId: subPlan.id,
          objects: newAssignedObjects,
        }),
      );
    };

    window.addEventListener("message", onMessage);
  };

  const stopAutoAssign = () => {
    if (messageListenerRef.current) {
      window.removeEventListener("message", messageListenerRef.current);
      messageListenerRef.current = null;
    }

    if (keyListenerRef.current) {
      window.removeEventListener("keydown", keyListenerRef.current);
      keyListenerRef.current = null;
    }

    console.log("Auto assign stopped");
  };

  const handleAutoAssign = async (subPlan) => {
    const tcapi = await WorkspaceAPI.connect(window.parent);
    const selections = await tcapi.viewer.getSelection();

    if (!selections?.length) return;

    const createObjectKey = (modelId, objectId) =>
      `${String(modelId)}::${String(objectId)}`;

    const existingObjectKeys = new Set();

    sequenceObjects.forEach((group) => {
      (group?.objects || []).forEach((obj) => {
        if (obj?.modelId == null || obj?.id == null) return;

        existingObjectKeys.add(createObjectKey(obj.modelId, obj.id));
      });
    });

    // Prevent duplicates within the current assignment.
    const newObjectKeys = new Set();

    const newAddedSequenceObjects = [];

    for (const selection of selections) {
      const items = await tcapi.viewer.getObjectProperties(
        selection.modelId,
        selection.objectRuntimeIds,
      );

      for (let i = 0; i < items.length; i++) {
        const objectId = selection.objectRuntimeIds[i];

        // Prevent duplicates based on modelId and objectId.
        const objectKey = createObjectKey(selection.modelId, objectId);

        if (existingObjectKeys.has(objectKey) || newObjectKeys.has(objectKey)) {
          console.warn("Object has already been assigned.", {
            modelId: selection.modelId,
            objectId,
          });

          continue;
        }

        newObjectKeys.add(objectKey);

        const properties = items[i]?.properties || [];

        let asmName = items[i]?.product?.name || "";
        let asm_pos = "";
        let positionCode = "";
        let weight = 0;
        let asmLength = 0;

        const isCompleted = () =>
          asm_pos !== "" &&
          positionCode !== "" &&
          weight !== 0 &&
          asmName !== "" &&
          asmLength !== 0;

        for (const property of properties) {
          const propertyName = String(property.name || "")
            .toUpperCase()
            .trim();

          const isValidPropertyGroup =
            propertyName.includes("ASSEMBLY") ||
            propertyName.includes("PROPERTY") ||
            propertyName.includes("PRODUCT") ||
            propertyName.includes("COMMON") ||
            propertyName.includes("QUANTITY");

          if (!isValidPropertyGroup) {
            continue;
          }

          for (const asmProperty of property.properties || []) {
            if (isCompleted()) {
              break;
            }

            const name = String(asmProperty.name || "").trim();
            const upperName = name.toUpperCase();
            const value = asmProperty.value;

            if (
              !asm_pos &&
              (name === "Assembly/Cast unit Mark" ||
                upperName === "ASSEMBLY_POS")
            ) {
              asm_pos = String(value || "")
                .replace("(?)", "")
                .trim();

              continue;
            }

            if (
              !positionCode &&
              (name === "Assembly/Cast unit position code" ||
                upperName === "ASSEMBLY_POSITION_CODE")
            ) {
              positionCode = String(value || "").trim();
              continue;
            }

            if (!weight && upperName.includes("WEIGHT") && value != null) {
              const parsedWeight = Number(value);

              if (Number.isFinite(parsedWeight)) {
                weight =
                  Math.round((parsedWeight + Number.EPSILON) * 100) / 100;
              }

              continue;
            }

            if (!asmName && upperName.includes("NAME") && value != null) {
              asmName = String(value).trim();
              continue;
            }

            if (!asmLength && upperName.includes("LENGTH") && value != null) {
              const parsedLength = Number(value);

              if (Number.isFinite(parsedLength)) {
                asmLength = Math.round(parsedLength);
              }
            }
          }

          if (isCompleted()) {
            break;
          }
        }

        newAddedSequenceObjects.push({
          modelId: selection.modelId,
          subPlanId: subPlan.id,
          planId: plan.id,
          id: objectId,
          distance: 0,
          center: [0, 0, 0],
          asmPos: asm_pos,
          date: dayjs().format("DD-MM-YYYY"),
          weight,
          length: asmLength,
          name: asmName,
          positionCode,
        });
      }
    }

    const existingObjects =
      sequenceObjects.find(
        (x) => x && String(x.subPlanId) === String(subPlan.id),
      )?.objects ?? [];

    const newObjects = [...existingObjects, ...newAddedSequenceObjects];

    const newAssignedObjects = newObjects.map((x) => ({
      asmPos: x.asmPos,
      date: x.date,
      id: x.id,
      modelId: x.modelId,
      planId: x.planId,
      subPlanId: x.subPlanId,
      positionCode: x.positionCode,
      weight: x.weight,
      name: x.name,
      length: x.length,
    }));

    dispatch(
      SetObjectsRequest({
        subPlanId: subPlan.id,
        objects: newAssignedObjects,
      }),
    );
  };

  const handleSortByDate = (subPlan) => {
    const currentGroup = sequenceObjects.find(
      (group) => group && String(group.subPlanId) === String(subPlan.id),
    );

    const objects = currentGroup?.objects || [];

    const sortedObjects = [...objects].sort((a, b) => {
      const dateA = dayjs(
        a.date || a.assignedDate || "",
        ["DD-MM-YYYY", "DD/MM/YYYY", "YYYY-MM-DD"],
        true,
      );

      const dateB = dayjs(
        b.date || b.assignedDate || "",
        ["DD-MM-YYYY", "DD/MM/YYYY", "YYYY-MM-DD"],
        true,
      );

      if (!dateA.isValid() && !dateB.isValid()) return 0;
      if (!dateA.isValid()) return 1;
      if (!dateB.isValid()) return -1;

      return dateA.valueOf() - dateB.valueOf();
    });

    dispatch(
      SetObjectsRequest({
        subPlanId: subPlan.id,
        objects: sortedObjects,
      }),
    );
  };

  const handleHighlightObject = async (subPlan) => {
    try {
      const tcapi = await WorkspaceAPI.connect(window.parent);

      const currentGroup = sequenceObjects.find(
        (group) => group && String(group.subPlanId) === String(subPlan.id),
      );

      const objects = currentGroup?.objects || [];

      if (!objects.length) {
        await tcapi.viewer.setSelection(
          {
            modelObjectIds: [],
          },
          "set",
        );

        return;
      }

      // Group objects by modelId and prevent duplicate objectRuntimeIds.
      const modelGroups = new Map();

      for (const obj of objects) {
        if (obj?.modelId == null || obj?.id == null) {
          continue;
        }

        const modelId = String(obj.modelId);
        const objectId = Number(obj.id);

        if (!Number.isFinite(objectId)) {
          continue;
        }

        if (!modelGroups.has(modelId)) {
          modelGroups.set(modelId, {
            modelId: obj.modelId,
            objectRuntimeIds: new Set(),
          });
        }

        modelGroups.get(modelId).objectRuntimeIds.add(objectId);
      }

      const modelObjectIds = [...modelGroups.values()]
        .map((group) => ({
          modelId: group.modelId,
          objectRuntimeIds: [...group.objectRuntimeIds],
        }))
        .filter((group) => group.objectRuntimeIds.length > 0);

      if (!modelObjectIds.length) {
        await tcapi.viewer.setSelection(
          {
            modelObjectIds: [],
          },
          "set",
        );

        return;
      }

      await tcapi.viewer.setSelection(
        {
          modelObjectIds,
        },
        "set",
      );
    } catch (error) {
      console.error("Failed to highlight objects:", error);
    }
  };

  const getObjectKey = (obj) => {
    const runtimeId = obj.id || obj.runtimeId || obj.objectRuntimeId;

    return `${obj.modelId}-${runtimeId}`;
  };

  const getObjectDate = (obj) => {
    return obj.date || obj.assignedDate || "";
  };

  const displayIndexMap = useMemo(() => {
    const dateCounters = new Map();
    const objectIndexes = new Map();

    sequenceObjects.forEach((group) => {
      (group.objects || []).forEach((item, index) => {
        const dateKey = getObjectDate(item) || "NO_DATE";

        const dateIndex = (dateCounters.get(dateKey) || 0) + 1;

        dateCounters.set(dateKey, dateIndex);

        objectIndexes.set(getObjectKey(item), `${index + 1}-${dateIndex}`);
      });
    });

    return objectIndexes;
  }, [sequenceObjects, plan.id, subPlans]);

  useEffect(() => {
    return () => {
      stopAutoAssign();
    };
  }, []);

  const items = currentSubPlans.map((subPlan) => ({
    key: String(subPlan.id),
    label: (
      <SortableHeader
        plan={subPlan}
        onEdit={() => handleEdit(subPlan)}
        onDelete={(item) => {
          dispatch(
            DeleteSubPlanRequest({
              planId: plan.id,
              subPlanId: item.id,
              subPlans,
              sequenceObjects,
            }),
          );
        }}
        onAssignObject={() => handleAssignObject(subPlan)}
        onAutoAssign={() => handleAutoAssign(subPlan)}
        onSortByDate={() => handleSortByDate(subPlan)}
        onHighlightObject={()=>handleHighlightObject(subPlan)}
      />
    ),
    children: (
      <SequenceObjectCollapse
        subPlan={subPlan}
        activeSimulationItem={activeSimulationItem}
        displayIndexMap={displayIndexMap}
      />
    ),
    style: {
      background: getRgbColor(subPlan.color),
      borderRadius: 0,
      marginBottom: 4,
    },
  }));

  if (!currentSubPlans.length) {
    return (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No Sub Plan" />
    );
  }

  return (
    <>
      <SubPlanModal
        plan={selectedSubPlan}
        title="Edit Sub Plan"
        open={isEditFormOpen}
        onCancel={() => setIsEditFormOpen(false)}
        buttonName="Modify"
        isEditing={true}
      />

      <Spin spinning={loading}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={currentSubPlans.map((x) => String(x.id))}
            strategy={verticalListSortingStrategy}
          >
            <Collapse
              activeKey={activeKeys}
              onChange={(keys) => {
                const nextKeys = Array.isArray(keys)
                  ? keys.map(String)
                  : [String(keys)];

                setActiveKeys(nextKeys);
              }}
              size="small"
              items={items}
              style={{
                borderRadius: 0,
                marginRight: -10,
                marginTop: -10,
                marginBottom: -10,
                background: "transparent",
              }}
              styles={{
                header: {
                  marginLeft: 10,
                  alignItems: "center",
                },
                body: {
                  padding: 8,
                },
              }}
            />
          </SortableContext>
        </DndContext>
      </Spin>
    </>
  );
};

export default SubPlanCollapse;
