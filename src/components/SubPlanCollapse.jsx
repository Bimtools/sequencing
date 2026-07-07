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

        tcapi.markup.removeMarkups(undefined);

        for (let i = 0; i < objBoxes.length; i++) {
          const box = objBoxes[i];

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

          let asm_pos = "";
          let positionCode = "";
          let weight = "";

          properties.every((property) => {
            if (property.name === "ASSEMBLY") {
              const asm_properties = property.properties || [];

              asm_properties.every((asm_property) => {
                if (asm_pos !== "" && positionCode !== "" && weight !== "") return false;
                if (asm_property.name.trim() === "ASSEMBLY_POS") {
                  asm_pos = asm_property.value.replace("(?)", "");
                }

                return true;
              });

              return false;
            }

            if (
              property.name.trim() === "Tekla Assembly" ||
              property.name.trim() === "PropertySet"
            ) {
              const asm_properties = property.properties || [];

              asm_properties.every((asm_property) => {
                if (asm_pos !== "" && positionCode !== "" && weight !== "") return false;
                if (
                  asm_property.name.trim() === "Assembly/Cast unit Mark" ||
                  asm_property.name.trim() === "ASSEMBLY_POS"
                ) {
                  asm_pos = asm_property.value;
                }

                if (
                  asm_property.name.trim() ===
                    "Assembly/Cast unit position code" ||
                  asm_property.name.trim() === "ASSEMBLY_POSITION_CODE"
                ) {
                  positionCode = asm_property.value;
                }
                if (
                  asm_property.name
                    .toLocaleUpperCase()
                    .trim()
                    .includes("WEIGHT") &&
                  asm_property.value
                ) {
                  const weight = Number(Number(asm_property.value).toFixed(2));
                }

                return true;
              });

              return false;
            }

            return true;
          });

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
            weight: weight,
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
    stopAutoAssign();

    await WorkspaceAPI.connect(window.parent);

    const onMessage = (event) => {
      if (event.data.event !== "viewer.onSelectionChanged") return;

      console.log("Selection changed:", event.data.data);
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        stopAutoAssign();
      }
    };

    messageListenerRef.current = onMessage;
    keyListenerRef.current = onKeyDown;

    window.addEventListener("message", onMessage);
    window.addEventListener("keydown", onKeyDown);

    console.log("Press ESC to stop Auto Assign");
  };

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
      />
    ),
    children: (
      <SequenceObjectCollapse
        subPlan={subPlan}
        activeSimulationItem={activeSimulationItem}
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
