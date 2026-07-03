import { Button, Form, Modal, Tooltip, Input, Switch } from "antd";
import React from "react";
import {
  FolderAddOutlined,
  CheckOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { CreatePlanRequest } from "../store/sequence/action";

const TopMenu = () => {
  const dispatch = useDispatch();
  const plans = useSelector((state) => state.sequence.plans);
  const rootFolderId = useSelector((state) => state.sequence.rootFolderId);
  const rootCommentId = useSelector((state) => state.sequence.rootCommentId);
  const phaseCommentId = useSelector((state) => state.sequence.phaseCommentId);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [planName, setPlanName] = React.useState("");
  return (
    <div
      style={{
        display: "flex",
        gap: 5,
      }}
    >
      <Tooltip title="Create new plan">
        <Button
          type="text"
          icon={<FolderAddOutlined />}
          onClick={() => setIsModalOpen(true)}
        />
      </Tooltip>
      <Tooltip title="Auto Assign"></Tooltip>

      <Modal
        title="Create New Plan"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
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
                dispatch(
                  CreatePlanRequest({
                    name: planName,
                    rootCommentId: rootCommentId,
                    rootFolderId: rootFolderId,
                    plans: plans,
                  }),
                );
              }}
            >
              Create
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TopMenu;
