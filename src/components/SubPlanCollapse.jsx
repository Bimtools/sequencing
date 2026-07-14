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

          console.log(items[i]);
          const properties = items[i]?.properties || [];
          let asmName = "";
          if (items[i].product) {
            asmName = items[i].product.name;
          }
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

          for (const property of properties || []) {
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
            weight: weight,
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
    const newAddedSequenceObjects = [];

    for (const selection of selections) {
      const items = await tcapi.viewer.getObjectProperties(
        selection.modelId,
        selection.objectRuntimeIds,
      );
      for (let i = 0; i < items.length; i++) {
        console.log(items[i]);
        const properties = items[i]?.properties || [];
        let asmName = "";
        if (items[i].product) {
          asmName = items[i].product.name;
        }
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

        for (const property of properties || []) {
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
        const center = [0,0,0]

        newAddedSequenceObjects.push({
          modelId: selection.modelId,
          subPlanId: subPlan.id,
          planId: plan.id,
          id: selection.objectRuntimeIds[i],
          distance: 0,
          center,
          asmPos: asm_pos,
          date: dayjs().format("DD-MM-YYYY"),
          weight: weight,
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
