import React, { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Collapse, Empty, Spin } from "antd";
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
import { UpdateCommentRequest, UpdatePlanRequest } from "../store/sequence/action";
import CreateSubPlanModal from "./CreateSubPlanModal";

const getRgbColor = (color) => {
  if (!color) return undefined;

  return `rgb(${color.r ?? 0}, ${color.g ?? 0}, ${color.b ?? 0})`;
};

const SubPlanCollapse = ({ plan }) => {
  const dispatch = useDispatch();

  const subPlans = useSelector((state) => state.sequence.sequences);
  const phaseCommentId = useSelector((state) => state.sequence.phaseCommentId);
  const loading = useSelector((state) => state.sequence.pending);

  const [isEditFormOpen, setIsEditFormOpen] = React.useState(false);
  const [selectedSubPlan, setSelectedSubPlan] = React.useState(null);

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

    // dispatch(
    //   UpdateCommentRequest({
    //     commentId: phaseCommentId,
    //     sequences: sortedCurrentSubPlans,
    //   }),
    // );
  };

  const handleEdit = (subPlan) => {
    setSelectedSubPlan(subPlan);
    setIsEditFormOpen(true);
  };

  const items = currentSubPlans.map((subPlan) => ({
    key: subPlan.id,
    label: (
      <SortableHeader
        plan={subPlan}
        onEdit={() => handleEdit(subPlan)}
        onDelete={(item) => console.log("delete sub plan", item)}
      />
    ),
    children: (
      <div style={{ paddingLeft: 8 }}>
        <p style={{ margin: 0 }}>Sub Plan ID: {subPlan.id}</p>
      </div>
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
      <CreateSubPlanModal
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
