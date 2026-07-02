import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { CreatePlanRequest } from "../store/sequence/action";
import {
  Collapse,
  Button,
  Dropdown,
  Popconfirm,
  Modal,
  Form,
  Input,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  FolderAddOutlined,
  MenuOutlined,
  MoreOutlined,
} from "@ant-design/icons";
import { DeletePlanRequest, UpdatePlanRequest } from "../store/sequence/action";
import { signal } from "@preact/signals";

const selectedPlan = signal(null);
const Main = () => {
  const dispatch = useDispatch();
  const plans = useSelector((state) => state.sequence.phases);
  const loading = useSelector((state) => state.sequence.pending);
  const rootFolderId = useSelector((state) => state.sequence.rootFolderId);
  const rootCommentId = useSelector((state) => state.sequence.rootCommentId);
  const phaseCommentId = useSelector((state) => state.sequence.phaseCommentId);

  const [isEditFormOpen, setIsEditFormOpen] = React.useState(false);
  const [planName, setPlanName] = React.useState("");

  const planMenuItems = [
    {
      key: "addSubPlan",
      label: (
        <Button
          size="small"
          type="text"
          icon={<FolderAddOutlined />}
          onClick={() => console.log("Create new sub plan")}
        >
          Create Sub Plan
        </Button>
      ),
    },
    {
      key: "editName",
      label: (
        <>
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={() => {
              setIsEditFormOpen(true);
            }}
          >
            Edit Name
          </Button>
        </>
      ),
    },
    {
      key: "deletePlan",
      label: (
        <Popconfirm
          title="Delete the plan"
          description="Are you sure to delete this plan?"
          onConfirm={() => {
            const deleteSequenceBody = {
              rootCommentId: rootCommentId,
              folderId: selectedPlan.value.id,
              phases: plans,
            };
            dispatch(DeletePlanRequest(deleteSequenceBody));
          }}
          okText="Yes"
          cancelText="No"
        >
          <Button size="small" danger type="text" icon={<DeleteOutlined />}>
            Delete
          </Button>
        </Popconfirm>
      ),
    },
  ];
  return (
    <>
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
        <Form autoComplete="off">
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
            <Button
              type="primary"
              htmlType="submit"
              disabled={!planName}
              onClick={() => {
                const newPhases = plans.map((x) =>
                  x.id !== selectedPlan.value.id ? x : { ...x, name: planName },
                );
                console.log(newPhases);
                dispatch(
                  UpdatePlanRequest({
                    commentId: rootCommentId,
                    phases: newPhases,
                  }),
                );
              }}
            >
              Modify
            </Button>
          </Form.Item>
        </Form>
      </Modal>
      <Collapse
        loading={loading}
        size="small"
        style={{
          borderRadius: 0,
        }}
        styles={{
          header: {
            padding: 0,
          },
          body: {
            padding: 0,
          },
        }}
      >
        {plans.map((plan) => (
          <Collapse.Panel
            header={plan.name}
            key={plan.id}
            extra={
              <div
                onClick={(e) => {
                  selectedPlan.value = plan;
                  setPlanName(plan.name);
                  e.stopPropagation();
                }}
              >
                <Dropdown menu={{ items: planMenuItems }} trigger={["click"]}>
                  <Button type="text" icon={<MoreOutlined />} />
                </Dropdown>
              </div>
            }
          >
            <p>Plan ID: {plan.id}</p>
          </Collapse.Panel>
        ))}
      </Collapse>
    </>
  );
};

export default Main;
