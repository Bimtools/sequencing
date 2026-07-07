import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

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

import { Collapse, Button, Modal, Form, Input, Spin } from "antd";

import {
  DeletePlanRequest,
  UpdatePlanRequest,
} from "../store/sequence/action";

import SubPlanModal from "./SubPlanModal";
import SubPlanCollapse from "./SubPlanCollapse";
import SortableHeader from "./SortableHeader";
import CopySubPlanModal from "./CopySubPlanModal";

const Main = () => {
  const dispatch = useDispatch();

  const plans = useSelector((state) => state.sequence.plans || []);
  const loading = useSelector((state) => state.sequence.pending);
  const rootCommentId = useSelector((state) => state.sequence.rootCommentId);

  const activeSimulationItem = useSelector(
    (state) => state.sequence.activeSimulationItem,
  );

  const [form] = Form.useForm();

  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [isCreateSubPlanOpen, setIsCreateSubPlanOpen] = useState(false);
  const [isCopySubPlanOpen, setIsCopySubPlanOpen] = useState(false);

  const [planName, setPlanName] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [activePlanKeys, setActivePlanKeys] = useState([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  useEffect(() => {
    if (!plans.length) return;
    if (!activeSimulationItem?.planId) return;

    const planKey = String(activeSimulationItem.planId);

    const exists = plans.some((plan) => String(plan.id) === planKey);
    if (!exists) return;

    setActivePlanKeys((prevKeys) => {
      const keys = prevKeys.map(String);

      if (keys.includes(planKey)) return keys;

      return [...keys, planKey];
    });
  }, [plans, activeSimulationItem?.planId]);

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;

    const oldIndex = plans.findIndex((x) => String(x.id) === String(active.id));
    const newIndex = plans.findIndex((x) => String(x.id) === String(over.id));

    if (oldIndex === -1 || newIndex === -1) return;

    const newPlans = arrayMove(plans, oldIndex, newIndex);

    dispatch(
      UpdatePlanRequest({
        commentId: rootCommentId,
        plans: newPlans,
      }),
    );
  };

  const handleEdit = (plan) => {
    setSelectedPlan(plan);
    setPlanName(plan.name);

    form.setFieldsValue({
      planName: plan.name,
    });

    setIsEditFormOpen(true);
  };

  const handleAddSubPlan = (plan) => {
    setSelectedPlan(plan);
    setIsCreateSubPlanOpen(true);
  };

  const handleCopySubPlan = (plan) => {
    setSelectedPlan(plan);
    setIsCopySubPlanOpen(true);
  };

  const handleDelete = (plan) => {
    dispatch(
      DeletePlanRequest({
        rootCommentId,
        folderId: plan.id,
        plans,
      }),
    );
  };

  const handleModifyName = () => {
    if (!selectedPlan) return;

    const newPlans = plans.map((x) =>
      String(x.id) !== String(selectedPlan.id)
        ? x
        : {
            ...x,
            name: planName,
          },
    );

    dispatch(
      UpdatePlanRequest({
        commentId: rootCommentId,
        plans: newPlans,
      }),
    );

    setIsEditFormOpen(false);
    setSelectedPlan(null);
    setPlanName("");
    form.resetFields();
  };

  const handlePlanCollapseChange = (activeKeys) => {
    const keys = Array.isArray(activeKeys)
      ? activeKeys.map(String)
      : activeKeys
        ? [String(activeKeys)]
        : [];

    setActivePlanKeys(keys);
  };

  const collapseItems = plans.map((plan) => ({
    key: String(plan.id),
    label: (
      <SortableHeader
        plan={plan}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAddSubPlan={handleAddSubPlan}
        onCopySubPlan={handleCopySubPlan}
      />
    ),
    children: (
      <SubPlanCollapse
        plan={plan}
        activeSimulationItem={activeSimulationItem}
      />
    ),
  }));

  return (
    <>
      <CopySubPlanModal
        selectedPlan={selectedPlan}
        open={isCopySubPlanOpen}
        onCancel={() => {
          setIsCopySubPlanOpen(false);
          setSelectedPlan(null);
        }}
      />

      <SubPlanModal
        title="Create Sub Plan"
        buttonName="Create"
        plan={selectedPlan}
        open={isCreateSubPlanOpen}
        onCancel={() => {
          setIsCreateSubPlanOpen(false);
          setSelectedPlan(null);
        }}
      />

      <Modal
        title="Edit Plan Name"
        open={isEditFormOpen}
        onCancel={() => {
          setIsEditFormOpen(false);
          setSelectedPlan(null);
          setPlanName("");
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} autoComplete="off" onFinish={handleModifyName}>
          <Form.Item
            name="planName"
            rules={[
              {
                required: true,
                message: "Please enter plan name",
              },
            ]}
          >
            <Input
              placeholder="Plan Name"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" disabled={!planName}>
              Modify
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Spin spinning={loading}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={plans.map((x) => String(x.id))}
            strategy={verticalListSortingStrategy}
          >
            <Collapse
              activeKey={activePlanKeys}
              size="small"
              items={collapseItems}
              onChange={handlePlanCollapseChange}
              style={{
                borderRadius: 0,
              }}
              styles={{
                header: {
                  padding: "4px 8px",
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

export default Main;