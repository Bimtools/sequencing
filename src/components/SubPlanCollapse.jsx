import React, { useMemo } from "react";
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
  UpdateCommentRequest,
  UpdatePlanRequest,
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

const SubPlanCollapse = ({ plan }) => {
  const dispatch = useDispatch();

  const subPlans = useSelector((state) => state.sequence.subPlans);
  const phaseCommentId = useSelector((state) => state.sequence.phaseCommentId);
  const sequenceObjects = useSelector(
    (state) => state.sequence.sequenceObjects,
  );
  const loading = useSelector((state) => state.sequence.pending);

  const [isEditFormOpen, setIsEditFormOpen] = React.useState(false);
  const [selectedSubPlan, setSelectedSubPlan] = React.useState(null);
  const [loadedSubPlanIds, setLoadedSubPlanIds] = React.useState([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  const currentSubPlans = useMemo(() => {
    return subPlans.filter((x) => x.planId === plan.id);
  }, [subPlans, plan.id]);

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;

    const oldIndex = currentSubPlans.findIndex((x) => x.id === active.id);
    const newIndex = currentSubPlans.findIndex((x) => x.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const sortedCurrentSubPlans = arrayMove(
      currentSubPlans,
      oldIndex,
      newIndex,
    );
    console.log("Sorted Sub Plans:", sortedCurrentSubPlans);

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
    console.log("Assign object to sub plan", subPlan);
    const tcapi = await WorkspaceAPI.connect(window.parent);
    const selections = await tcapi.viewer.getSelection();

    tcapi.viewer.activateTool("pointMarkup");

    // handler stored so it can be removed later
    const onMessage = async (event) => {
      if (event.data.event === "viewer.onMarkupChanged") {
        window.removeEventListener("message", onMessage);
        const start = event.data.data.data.markup.start;
        const refPoint = [
          Number(start.positionX),
          Number(start.positionY),
          Number(start.positionZ),
        ];
        var newAddedSequenceObjects = [];
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
            const properties = items[i].properties;
            let asm_pos = "";
            let positionCode = "";
            properties.every((property) => {
              if (property.name === "ASSEMBLY") {
                const asm_properties = property.properties;
                asm_properties.every((asm_property) => {
                  if (asm_pos !== "" && positionCode !== "") return false;
                  if (asm_property.name.trim() === "ASSEMBLY_POS") {
                    asm_pos = asm_property.value.replace("(?)", "");
                  }
                  return true;
                });
                return false;
              } else if (
                property.name.trim() === "Tekla Assembly" ||
                property.name.trim() === "PropertySet"
              ) {
                const asm_properties = property.properties;
                asm_properties.every((asm_property) => {
                  if (asm_pos !== "" && positionCode !== "") return false;
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
              center: center,
              asmPos: asm_pos,
              date: dayjs().format("DD-MM-YYYY"),
              positionCode: positionCode,
            });
          }
        }

        newAddedSequenceObjects.sort((a, b) => {
          return Number(a.distance) - Number(b.distance);
        });
        const existingObjects =
          sequenceObjects.filter((x) => x && x.subPlanId === subPlan.id)[0]
            ?.objects ?? [];

        var newObjects = [...existingObjects];
        newObjects.push(...newAddedSequenceObjects);
        const newAssignedObjects = newObjects.map((x) => {
          return {
            asmPos: x.asmPos,
            date: x.date,
            id: x.id,
            modelId: x.modelId,
            planId: x.planId,
            subPlanId: x.subPlanId,
            positionCode: x.positionCode,
          };
        });
        const newSequenceObjects = {
          subPlanId: subPlan.id,
          objects: newAssignedObjects,
        };
        console.log(newSequenceObjects);
        dispatch(SetObjectsRequest(newSequenceObjects));
        // dispatch(SelectObjectsSuccess(newSequenceObjects));
      }
    };

    window.addEventListener("message", onMessage);
  };

  const items = currentSubPlans.map((subPlan) => ({
    key: subPlan.id,
    label: (
      <SortableHeader
        plan={subPlan}
        onEdit={() => handleEdit(subPlan)}
        onDelete={(item) => {
          console.log("delete sub plan", item);
          const deleteSubPlanBody = {
            planId: plan.id,
            subPlanId: item.id,
            subPlans: subPlans,
            sequenceObjects: sequenceObjects,
          };
          console.log(deleteSubPlanBody);
          dispatch(DeleteSubPlanRequest(deleteSubPlanBody));
        }}
        onAssignObject={() => handleAssignObject(subPlan)}
      />
    ),
    children: <SequenceObjectCollapse subPlan={subPlan} />,
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
            items={currentSubPlans.map((x) => x.id)}
            strategy={verticalListSortingStrategy}
          >
            <Collapse
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
