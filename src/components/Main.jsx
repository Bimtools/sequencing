import React from "react";
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
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  Collapse,
  Button,
  Dropdown,
  Popconfirm,
  Modal,
  Form,
  Input,
  Spin,
} from "antd";

import {
  DeleteOutlined,
  EditOutlined,
  FolderAddOutlined,
  MenuOutlined,
  MoreOutlined,
} from "@ant-design/icons";

import {
  DeletePlanRequest,
  UpdatePlanRequest,
  GetSequenceRequest,
} from "../store/sequence/action";

import CreateSubPlanModal from "./CreateSubPlanModal";
import SubPlanCollapse from "./SubPlanCollapse";
import SortableHeader from "./SortableHeader";

const Main = () => {
  const dispatch = useDispatch();

  const plans = useSelector((state) => state.sequence.phases);
  const loading = useSelector((state) => state.sequence.pending);
  const rootCommentId = useSelector((state) => state.sequence.rootCommentId);

  const [form] = Form.useForm();

  const [isEditFormOpen, setIsEditFormOpen] = React.useState(false);
  const [isCreateSubPlanOpen, setIsCreateSubPlanOpen] = React.useState(false);
  const [planName, setPlanName] = React.useState("");
  const [selectedPlan, setSelectedPlan] = React.useState(null);
  const [loadedPhaseIds, setLoadedPhaseIds] = React.useState([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;

    const oldIndex = plans.findIndex((x) => x.id === active.id);
    const newIndex = plans.findIndex((x) => x.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newPhases = arrayMove(plans, oldIndex, newIndex);

    dispatch(
      UpdatePlanRequest({
        commentId: rootCommentId,
        phases: newPhases,
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

  const handleDelete = (plan) => {
    dispatch(
      DeletePlanRequest({
        rootCommentId,
        folderId: plan.id,
        phases: plans,
      }),
    );
  };

  const handleModifyName = () => {
    if (!selectedPlan) return;

    const newPhases = plans.map((x) =>
      x.id !== selectedPlan.id ? x : { ...x, name: planName },
    );

    dispatch(
      UpdatePlanRequest({
        commentId: rootCommentId,
        phases: newPhases,
      }),
    );

    setIsEditFormOpen(false);
    setSelectedPlan(null);
    setPlanName("");
    form.resetFields();
  };

  const handlePhaseCollapseChange = (activeKeys) => {
    const keys = Array.isArray(activeKeys) ? activeKeys : [activeKeys];
    console.log("Active keys:", keys);
    keys.forEach((phaseId) => {
      if (!loadedPhaseIds.includes(phaseId)) {
        dispatch(
          GetSequenceRequest({
            folderId: phaseId,
          }),
        );

        setLoadedPhaseIds((prev) => [...prev, phaseId]);
      }
    });
  };

  const collapseItems = plans.map((plan) => ({
    key: plan.id,
    label: (
      <SortableHeader
        plan={plan}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAddSubPlan={handleAddSubPlan}
      />
    ),
    children: (
      <SubPlanCollapse
        plan={plan}
        plans={plans}
        rootCommentId={rootCommentId}
        dispatch={dispatch}
      />
    ),
  }));

  return (
    <>
      <CreateSubPlanModal
        title="Create Sub Plan"
        buttonName="Create"
        plan={selectedPlan}
        open={isCreateSubPlanOpen}
        onCancel={() => setIsCreateSubPlanOpen(false)}
      />

      <Modal
        title="Edit Plan Name"
        open={isEditFormOpen}
        onCancel={() => setIsEditFormOpen(false)}
        footer={null}
        styles={{
          header: {
            padding: 0,
            marginBottom: 0,
          },
          body: {
            padding: 0,
          },
        }}
      >
        <Form form={form} autoComplete="off" onFinish={handleModifyName}>
          <Form.Item
            name="planName"
            style={{ marginBottom: 2 }}
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

          <Form.Item style={{ marginBottom: 0 }}>
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
            items={plans.map((x) => x.id)}
            strategy={verticalListSortingStrategy}
          >
            <Collapse
              loading={loading}
              size="small"
              items={collapseItems}
              onChange={handlePhaseCollapseChange}
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
